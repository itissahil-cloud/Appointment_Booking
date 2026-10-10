import { query } from '../../core/db.js';
import { logger } from '../../core/logger.js';
import { formatClinicDate } from '../clinic-settings/date-calculator.js';
import { SettingsService } from '../clinic-settings/settings.service.js';
import { PaymentService } from '../payments/payment.service.js';
import { PatientService } from '../patients/patient.service.js';
import { WhatsAppService } from './whatsapp.service.js';

export interface InboundWhatsAppMessage {
  fromPhone: string;
  messageType: 'text' | 'button_reply' | 'interactive';
  text?: string;
  buttonId?: string;
  messageId?: string;
}

export class WhatsAppConversationStateMachine {
  static async handleIncomingMessage(event: InboundWhatsAppMessage): Promise<void> {
    const rawPhone = event.fromPhone;
    const text = (event.text || '').trim();
    const buttonId = event.buttonId || '';
    const upperText = text.toUpperCase();

    // 1. Fetch or create patient
    const patient = await PatientService.findOrCreateByPhone(rawPhone);

    const convRes = await query(`
      SELECT current_state AS "currentState", pending_booking_date AS "pendingBookingDate",
             active_payment_id AS "activePaymentId", last_interaction_at AS "lastInteractionAt"
      FROM whatsapp_conversations
      WHERE patient_id = $1;
    `, [patient.id]);

    const conv = convRes.rows[0];
    const now = new Date();

    // 2. Session timeout check: > 15 mins resets to IDLE
    let currentState: string = conv?.currentState || 'IDLE';
    let pendingDate = conv?.pendingBookingDate ? new Date(conv.pendingBookingDate) : null;

    if (conv && conv.lastInteractionAt) {
      const diffMinutes = (now.getTime() - new Date(conv.lastInteractionAt).getTime()) / (1000 * 60);
      if (diffMinutes > 15 && currentState !== 'IDLE') {
        logger.info(`Conversation timeout for patient ${patient.phoneNumber}, resetting to IDLE`);
        currentState = 'IDLE';
        pendingDate = null;
      }
    }

    // 3. GLOBAL COMMAND: STATUS
    if (upperText === 'STATUS') {
      await this.handleStatusCommand(patient);
      await this.updateConversation(patient.id, 'IDLE', null);
      return;
    }

    // 4. GLOBAL COMMAND: CANCEL
    if (upperText === 'CANCEL') {
      await this.handleCancelInitiation(patient);
      return;
    }

    // 5. PROCESS BASED ON CURRENT STATE
    switch (currentState) {
      case 'IDLE':
        await this.handleIdleState(patient, text, buttonId);
        break;

      case 'AWAITING_BOOKING_CONFIRMATION':
        await this.handleAwaitingBookingConfirmation(patient, pendingDate, text, buttonId);
        break;

      case 'AWAITING_PATIENT_NAME':
        await this.handleAwaitingPatientName(patient, pendingDate, text);
        break;

      case 'PAYMENT_PENDING':
        await this.handlePaymentPendingState(patient, text, buttonId);
        break;

      case 'AWAITING_CANCEL_CONFIRMATION':
        await this.handleAwaitingCancelConfirmation(patient, text, buttonId);
        break;

      default:
        await this.updateConversation(patient.id, 'IDLE', null);
        await this.handleIdleState(patient, text, buttonId);
        break;
    }
  }

  private static async updateConversation(
    patientId: string,
    state: string,
    bookingDate: Date | null,
    activePaymentId?: string | null
  ) {
    const dateStr = bookingDate ? bookingDate.toISOString().split('T')[0] : null;
    await query(`
      INSERT INTO whatsapp_conversations (patient_id, current_state, pending_booking_date, active_payment_id, last_interaction_at)
      VALUES ($1, $2::whatsapp_conversation_state, $3::date, $4, NOW())
      ON CONFLICT (patient_id) DO UPDATE SET
        current_state = $2::whatsapp_conversation_state,
        pending_booking_date = $3::date,
        active_payment_id = COALESCE($4, whatsapp_conversations.active_payment_id),
        last_interaction_at = NOW();
    `, [patientId, state, dateStr, activePaymentId || null]);
  }

  private static async handleIdleState(patient: any, text: string, buttonId: string) {
    const settings = await SettingsService.getSettings();

    if (!settings.isBookingEnabled) {
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `🏥 *${settings.clinicName}*\n\nOnline booking is currently paused by the clinic. Please visit the clinic reception directly.`
      );
      return;
    }

    let nextDate: Date;
    try {
      nextDate = await SettingsService.getNextBookingDate();
    } catch {
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `🏥 *${settings.clinicName}*\n\nNo clinic working days are currently available for booking. Please check back soon.`
      );
      return;
    }

    const nextDateStr = nextDate.toISOString().split('T')[0];

    // Check if patient already has a confirmed appointment for this date
    const confRes = await query(`
      SELECT id, token_number
      FROM appointments
      WHERE patient_id = $1 AND appointment_date = $2::date AND status = 'CONFIRMED'::appointment_status;
    `, [patient.id, nextDateStr]);

    if (confRes.rows.length > 0) {
      const dateStr = formatClinicDate(nextDate);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `👋 You already have a confirmed appointment for *${dateStr}*.\n\n` +
        `🎫 *Your Token:* #${confRes.rows[0].token_number}\n\n` +
        `Send *STATUS* on your appointment day to track your queue order.`
      );
      return;
    }

    // Check if daily token limit reached
    const countRes = await query(`
      SELECT last_token FROM daily_token_counters WHERE appointment_date = $1::date;
    `, [nextDateStr]);

    if (countRes.rows.length > 0 && countRes.rows[0].last_token >= settings.dailyTokenLimit) {
      const dateStr = formatClinicDate(nextDate);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `Sorry, all tokens for *${dateStr}* are currently full (${settings.dailyTokenLimit}/${settings.dailyTokenLimit}).\n\n` +
        `Please try again on the next available clinic day.`
      );
      return;
    }

    await this.updateConversation(patient.id, 'AWAITING_BOOKING_CONFIRMATION', nextDate);

    const feeInRupees = (settings.bookingAmountPaisa / 100).toFixed(0);
    const dateFormatted = formatClinicDate(nextDate);

    const greeting = patient.fullName !== 'Valued Patient'
      ? `👋 Welcome back, *${patient.fullName}*!`
      : `👋 Welcome to *${settings.clinicName}*!`;

    const bodyText =
      `${greeting}\n\n` +
      `Appointments are open for: *${dateFormatted}*\n` +
      `Booking amount: *₹${feeInRupees}*\n` +
      `FCFS Token order assigned after payment.\n\n` +
      `Would you like to proceed with booking?`;

    await WhatsAppService.sendInteractiveButtons(patient.phoneNumber, bodyText, [
      { id: 'BTN_CONTINUE_BOOKING', title: 'Continue' },
      { id: 'BTN_CANCEL_BOOKING', title: 'Cancel' },
    ]);
  }

  private static async handleAwaitingBookingConfirmation(
    patient: any,
    pendingDate: Date | null,
    text: string,
    buttonId: string
  ) {
    const isCancel = buttonId === 'BTN_CANCEL_BOOKING' || text.toUpperCase() === 'CANCEL' || text.toLowerCase() === 'no';
    if (isCancel) {
      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(patient.phoneNumber, 'Booking cancelled. Send *Hi* anytime to book.');
      return;
    }

    const isContinue = buttonId === 'BTN_CONTINUE_BOOKING' || text.toUpperCase() === 'CONTINUE' || text.toLowerCase() === 'yes';
    if (!isContinue) {
      await WhatsAppService.sendInteractiveButtons(
        patient.phoneNumber,
        'Please select an option to continue:',
        [
          { id: 'BTN_CONTINUE_BOOKING', title: 'Continue' },
          { id: 'BTN_CANCEL_BOOKING', title: 'Cancel' },
        ]
      );
      return;
    }

    const bookingDate = pendingDate || (await SettingsService.getNextBookingDate());

    if (patient.fullName === 'Valued Patient' || !patient.fullName.trim()) {
      await this.updateConversation(patient.id, 'AWAITING_PATIENT_NAME', bookingDate);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'Please reply with the *Patient Full Name* for this appointment:'
      );
      return;
    }

    await this.createPaymentAndSendLink(patient, bookingDate);
  }

  private static async handleAwaitingPatientName(patient: any, pendingDate: Date | null, nameText: string) {
    const cleanedName = nameText.trim();
    if (cleanedName.length < 2) {
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'Please enter a valid full name (at least 2 letters):'
      );
      return;
    }

    await query(`UPDATE patients SET full_name = $1, updated_at = NOW() WHERE id = $2;`, [cleanedName, patient.id]);
    patient.fullName = cleanedName;

    const bookingDate = pendingDate || (await SettingsService.getNextBookingDate());
    await this.createPaymentAndSendLink(patient, bookingDate);
  }

  private static async createPaymentAndSendLink(patient: any, bookingDate: Date) {
    try {
      const order = await PaymentService.initiateBookingPayment({
        patientId: patient.id,
        appointmentDate: bookingDate,
      });

      const settings = await SettingsService.getSettings();
      const feeInRupees = (settings.bookingAmountPaisa / 100).toFixed(0);
      const dateFormatted = formatClinicDate(bookingDate);

      const message =
        `📋 *Booking Request Created*\n\n` +
        `*Patient:* ${patient.fullName}\n` +
        `*Date:* ${dateFormatted}\n` +
        `*Amount:* ₹${feeInRupees}\n\n` +
        `Please complete payment to secure your FCFS Token:\n` +
        `👉 ${order.paymentUrl}\n\n` +
        `⚠️ *Token is generated immediately upon successful payment verification.*`;

      await WhatsAppService.sendTextMessage(patient.phoneNumber, message);
    } catch (error: any) {
      logger.error('Failed to initiate payment', { error });
      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `Unable to process booking: ${error.message || 'Please try again later'}.`
      );
    }
  }

  private static async handlePaymentPendingState(patient: any, text: string, buttonId: string) {
    if (buttonId === 'BTN_CANCEL_BOOKING' || text.toUpperCase() === 'CANCEL') {
      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'Pending booking cancelled. Send *Hi* anytime to start over.'
      );
      return;
    }

    const payRes = await query(`
      SELECT payment_url FROM payments
      WHERE patient_id = $1 AND status = 'PENDING'::payment_status AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1;
    `, [patient.id]);

    if (payRes.rows.length > 0) {
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `Your appointment is awaiting payment.\n\n👉 Complete payment: ${payRes.rows[0].payment_url}\n\nYour token will be issued immediately after payment.`
      );
    } else {
      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'Your payment session expired. Send *Hi* to book a new appointment.'
      );
    }
  }

  private static async handleStatusCommand(patient: any) {
    const todayStr = new Date().toISOString().split('T')[0];

    const apptRes = await query(`
      SELECT id, token_number, status
      FROM appointments
      WHERE patient_id = $1 AND appointment_date = $2::date
        AND status IN ('CONFIRMED'::appointment_status, 'IN_PROGRESS'::appointment_status, 'COMPLETED'::appointment_status);
    `, [patient.id, todayStr]);

    if (apptRes.rows.length === 0) {
      const upRes = await query(`
        SELECT token_number, appointment_date
        FROM appointments
        WHERE patient_id = $1 AND appointment_date > $2::date AND status = 'CONFIRMED'::appointment_status
        ORDER BY appointment_date ASC LIMIT 1;
      `, [patient.id, todayStr]);

      if (upRes.rows.length > 0) {
        const dateStr = formatClinicDate(new Date(upRes.rows[0].appointment_date));
        await WhatsAppService.sendTextMessage(
          patient.phoneNumber,
          `📅 Your confirmed appointment is on *${dateStr}*.\n🎫 *Token:* #${upRes.rows[0].token_number}`
        );
        return;
      }

      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'You have no active appointments today. Send *Hi* to book.'
      );
      return;
    }

    const appt = apptRes.rows[0];

    const inProgRes = await query(`
      SELECT token_number FROM appointments
      WHERE appointment_date = $1::date AND status = 'IN_PROGRESS'::appointment_status;
    `, [todayStr]);

    const currentToken = inProgRes.rows[0]?.token_number || 0;
    const patientToken = appt.token_number || 0;
    const ahead = Math.max(0, patientToken - currentToken);

    let statusMsg = `📍 *Clinic Queue Status*\n\n`;
    statusMsg += `Today's current token being seen: *#${currentToken || 'Queue starting'}*\n`;
    statusMsg += `Your token: *#${patientToken}*\n`;
    statusMsg += `Status: *${appt.status}*\n`;

    if (appt.status === 'IN_PROGRESS') {
      statusMsg += `\n🔔 *It's your turn! Please step into the doctor's room.*`;
    } else if (appt.status === 'COMPLETED') {
      statusMsg += `\n✅ Your consultation has been marked completed.`;
    } else {
      statusMsg += `\nPatients ahead of you: *${ahead}*`;
    }

    await WhatsAppService.sendTextMessage(patient.phoneNumber, statusMsg);
  }

  private static async handleCancelInitiation(patient: any) {
    const todayStr = new Date().toISOString().split('T')[0];

    const upRes = await query(`
      SELECT id, token_number, appointment_date
      FROM appointments
      WHERE patient_id = $1 AND appointment_date >= $2::date AND status = 'CONFIRMED'::appointment_status
      ORDER BY appointment_date ASC LIMIT 1;
    `, [patient.id, todayStr]);

    if (upRes.rows.length === 0) {
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        'You do not have any upcoming confirmed appointments to cancel.'
      );
      return;
    }

    const appt = upRes.rows[0];
    const apptDate = new Date(appt.appointment_date);

    await this.updateConversation(patient.id, 'AWAITING_CANCEL_CONFIRMATION', apptDate);

    const dateStr = formatClinicDate(apptDate);
    await WhatsAppService.sendInteractiveButtons(
      patient.phoneNumber,
      `Your confirmed appointment:\n📅 *${dateStr}*\n🎫 *Token:* #${appt.token_number}\n\nDo you wish to cancel this appointment?`,
      [
        { id: 'BTN_CONFIRM_CANCEL', title: 'Yes, Cancel' },
        { id: 'BTN_KEEP_APPT', title: 'Keep Appointment' },
      ]
    );
  }

  private static async handleAwaitingCancelConfirmation(patient: any, text: string, buttonId: string) {
    const isConfirm = buttonId === 'BTN_CONFIRM_CANCEL' || text.toUpperCase() === 'YES';

    if (isConfirm) {
      const todayStr = new Date().toISOString().split('T')[0];
      await query(`
        UPDATE appointments
        SET status = 'CANCELLED'::appointment_status,
            cancel_reason = 'Cancelled by patient via WhatsApp',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE patient_id = $1 AND appointment_date >= $2::date AND status = 'CONFIRMED'::appointment_status;
      `, [patient.id, todayStr]);

      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(
        patient.phoneNumber,
        `Your appointment has been cancelled.\nNote: Refunds are processed according to clinic policy.`
      );
    } else {
      await this.updateConversation(patient.id, 'IDLE', null);
      await WhatsAppService.sendTextMessage(patient.phoneNumber, 'Your appointment remains confirmed.');
    }
  }
}
