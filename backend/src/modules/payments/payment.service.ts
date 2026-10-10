import { env } from '../../config/env.js';
import { query } from '../../core/db.js';
import { logger } from '../../core/logger.js';
import { toLocalDateString } from '../clinic-settings/date-calculator.js';
import { TokenEngine, TokenAllocationResult } from '../tokens/token-engine.js';
import { PaymentProvider } from './payment.interface.js';
import { HdfcPaymentProvider } from './providers/hdfc.provider.js';
import { MockPaymentProvider } from './providers/mock.provider.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';

export class PaymentService {
  private static providerInstance: PaymentProvider = env.USE_MOCK_PAYMENT
    ? new MockPaymentProvider()
    : new HdfcPaymentProvider();

  static setProvider(provider: PaymentProvider) {
    this.providerInstance = provider;
  }

  static getProvider(): PaymentProvider {
    return this.providerInstance;
  }

  static async initiateBookingPayment(params: {
    patientId: string;
    appointmentDate: Date;
  }) {
    const { patientId, appointmentDate } = params;
    const dateStr = toLocalDateString(appointmentDate);

    // 1. Check if patient already has a CONFIRMED appointment for this date
    const confRes = await query(`
      SELECT id, token_number AS "tokenNumber"
      FROM appointments
      WHERE patient_id = $1 AND appointment_date = $2::date AND status = 'CONFIRMED'::appointment_status;
    `, [patientId, dateStr]);

    if (confRes.rows.length > 0) {
      throw new Error(`ALREADY_CONFIRMED: Patient already has confirmed token #${confRes.rows[0].tokenNumber} for this date`);
    }

    // 2. Fetch clinic fee
    const setRes = await query(`SELECT booking_amount_paisa AS "bookingAmountPaisa" FROM clinic_settings LIMIT 1;`);
    const amountPaisa = setRes.rows[0]?.bookingAmountPaisa ?? 10000;

    // 3. Check for existing unexpired PAYMENT_PENDING appointment/order
    const pendRes = await query(`
      SELECT a.id AS appt_id, a.appointment_date AS "appointmentDate", a.status AS "appointmentStatus",
             p.id AS pay_id, p.provider_order_id AS "providerOrderId", p.payment_url AS "paymentUrl",
             p.expires_at AS "expiresAt", p.status AS "paymentStatus"
      FROM appointments a
      JOIN payments p ON p.appointment_id = a.id
      WHERE a.patient_id = $1 AND a.appointment_date = $2::date
        AND a.status = 'PAYMENT_PENDING'::appointment_status
        AND p.status = 'PENDING'::payment_status
        AND p.expires_at > NOW();
    `, [patientId, dateStr]);

    if (pendRes.rows.length > 0) {
      const existing = pendRes.rows[0];
      logger.info(`Reusing existing unexpired pending payment order for patient ${patientId}`);
      return {
        isReused: true,
        appointment: { id: existing.appt_id, appointmentDate, status: existing.appointmentStatus },
        payment: { id: existing.pay_id, providerOrderId: existing.providerOrderId, paymentUrl: existing.paymentUrl },
        paymentUrl: existing.paymentUrl,
      };
    }

    // 4. Create new Appointment in PAYMENT_PENDING state
    const patRes = await query(`SELECT full_name, phone_number FROM patients WHERE id = $1;`, [patientId]);
    const patient = patRes.rows[0];

    const apptRes = await query(`
      INSERT INTO appointments (patient_id, appointment_date, status)
      VALUES ($1, $2::date, 'PAYMENT_PENDING'::appointment_status)
      RETURNING id, appointment_date AS "appointmentDate", status;
    `, [patientId, dateStr]);
    const appointment = apptRes.rows[0];

    // 5. Call gateway provider
    const orderResult = await this.providerInstance.createPaymentOrder({
      appointmentId: appointment.id,
      patientId,
      amountPaisa,
      currency: 'INR',
      patientName: patient.full_name,
      patientPhone: patient.phone_number,
    });

    // 6. Save Payment record
    const payRes = await query(`
      INSERT INTO payments (
        appointment_id, patient_id, amount_paisa, currency, status,
        provider, provider_order_id, payment_url, expires_at
      ) VALUES (
        $1, $2, $3, 'INR', 'PENDING'::payment_status,
        $4, $5, $6, $7
      ) RETURNING id, provider_order_id AS "providerOrderId", payment_url AS "paymentUrl", expires_at AS "expiresAt";
    `, [
      appointment.id,
      patientId,
      amountPaisa,
      this.providerInstance.providerName,
      orderResult.providerOrderId,
      orderResult.paymentUrl,
      orderResult.expiresAt,
    ]);
    const payment = payRes.rows[0];

    // 7. Update conversation
    await query(`
      INSERT INTO whatsapp_conversations (patient_id, current_state, pending_booking_date, active_payment_id)
      VALUES ($1, 'PAYMENT_PENDING'::whatsapp_conversation_state, $2::date, $3)
      ON CONFLICT (patient_id) DO UPDATE SET
        current_state = 'PAYMENT_PENDING'::whatsapp_conversation_state,
        pending_booking_date = $2::date,
        active_payment_id = $3,
        last_interaction_at = NOW();
    `, [patientId, dateStr, payment.id]);

    return {
      isReused: false,
      appointment,
      payment,
      paymentUrl: orderResult.paymentUrl,
    };
  }

  static async handleWebhook(
    headers: Record<string, any>,
    body: any
  ): Promise<{ success: boolean; result?: TokenAllocationResult; message?: string }> {
    const verification = await this.providerInstance.verifyWebhook(headers, body);

    if (!verification.isValid) {
      logger.warn('Invalid payment webhook signature received', { headers });
      throw new Error('INVALID_WEBHOOK_SIGNATURE');
    }

    if (verification.status === 'SUCCESS') {
      const tokenResult = await TokenEngine.confirmPaymentAndAllocateToken({
        providerOrderId: verification.providerOrderId,
        providerTransactionId: verification.providerTransactionId,
        rawWebhookPayload: verification.rawPayload,
      });

      if (!tokenResult.isIdempotentReplay) {
        await WhatsAppService.sendBookingConfirmation({
          phoneNumber: tokenResult.patientPhone,
          patientName: tokenResult.patientName,
          appointmentDate: tokenResult.appointmentDate,
          tokenNumber: tokenResult.tokenNumber,
          amountPaisa: tokenResult.amountPaisa,
        }).catch((err) => {
          logger.error('Failed to dispatch WhatsApp confirmation message', { err });
        });
      }

      return { success: true, result: tokenResult };
    } else {
      await query(`
        UPDATE payments
        SET status = 'FAILED'::payment_status, provider_transaction_id = $1, raw_webhook_payload = $2, updated_at = NOW()
        WHERE provider_order_id = $3;
      `, [verification.providerTransactionId, JSON.stringify(verification.rawPayload), verification.providerOrderId]);

      const patRes = await query(`
        SELECT pt.phone_number
        FROM payments p
        JOIN patients pt ON pt.id = p.patient_id
        WHERE p.provider_order_id = $1;
      `, [verification.providerOrderId]);

      if (patRes.rows[0]) {
        await WhatsAppService.sendPaymentFailedNotice({
          phoneNumber: patRes.rows[0].phone_number,
        }).catch(() => {});
      }

      return { success: false, message: 'Payment marked as failed' };
    }
  }

  static async reconcilePayment(paymentId: string) {
    const payRes = await query(`
      SELECT p.id, p.provider_order_id AS "providerOrderId", p.status AS "paymentStatus",
             a.status AS "appointmentStatus"
      FROM payments p
      JOIN appointments a ON a.id = p.appointment_id
      WHERE p.id = $1;
    `, [paymentId]);

    if (payRes.rows.length === 0) throw new Error('PAYMENT_NOT_FOUND');
    const payment = payRes.rows[0];

    if (payment.paymentStatus === 'SUCCESS' && payment.appointmentStatus === 'CONFIRMED') {
      return { status: 'ALREADY_CONFIRMED', payment };
    }

    const inquiry = await this.providerInstance.getPaymentStatus(payment.providerOrderId);

    if (inquiry.status === 'SUCCESS') {
      const tokenResult = await TokenEngine.confirmPaymentAndAllocateToken({
        providerOrderId: payment.providerOrderId,
        providerTransactionId: inquiry.providerTransactionId,
        rawWebhookPayload: inquiry.rawPayload,
      });
      return { status: 'CONFIRMED_VIA_RECONCILIATION', tokenResult };
    }

    return { status: inquiry.status, payment };
  }
}
