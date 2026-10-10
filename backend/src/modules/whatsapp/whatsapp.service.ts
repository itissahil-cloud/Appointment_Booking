import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';
import { formatClinicDate } from '../clinic-settings/date-calculator.js';

export interface WhatsAppButton {
  id: string;
  title: string;
}

export class WhatsAppService {
  /**
   * Sends a plain text WhatsApp message via Meta Cloud API or mock logger
   */
  static async sendTextMessage(toPhone: string, text: string): Promise<boolean> {
    if (env.USE_MOCK_WHATSAPP) {
      logger.info(`[MOCK WhatsApp] OUTBOUND TEXT to ${toPhone}:\n"${text}"`);
      return true;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone.replace('+', ''),
          type: 'text',
          text: { preview_url: true, body: text },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        logger.error('[WhatsApp Cloud API] Error sending text message', { errorData });
        return false;
      }
      return true;
    } catch (error) {
      logger.error('[WhatsApp Cloud API] Network error', { error });
      return false;
    }
  }

  /**
   * Sends interactive reply buttons (up to 3 buttons supported by Meta WhatsApp API)
   */
  static async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: WhatsAppButton[]
  ): Promise<boolean> {
    if (env.USE_MOCK_WHATSAPP) {
      const btnList = buttons.map((b) => `[${b.title} (${b.id})]`).join(' ');
      logger.info(`[MOCK WhatsApp] OUTBOUND INTERACTIVE to ${toPhone}:\n"${bodyText}"\nButtons: ${btnList}`);
      return true;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone.replace('+', ''),
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
              buttons: buttons.map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title.slice(0, 20) }, // 20 char max by Meta
              })),
            },
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        logger.error('[WhatsApp Cloud API] Error sending interactive buttons', { errorData });
        return false;
      }
      return true;
    } catch (error) {
      logger.error('[WhatsApp Cloud API] Network error', { error });
      return false;
    }
  }

  /**
   * Dispatches the official booking confirmation message upon verified payment.
   */
  static async sendBookingConfirmation(params: {
    phoneNumber: string;
    patientName: string;
    appointmentDate: Date;
    tokenNumber: number;
    amountPaisa: number;
  }) {
    const dateFormatted = formatClinicDate(params.appointmentDate);
    const amountInRupees = (params.amountPaisa / 100).toFixed(0);

    const message =
      `✅ *Appointment Confirmed*\n\n` +
      `*Patient:* ${params.patientName}\n` +
      `*Date:* ${dateFormatted}\n` +
      `*Token:* #${params.tokenNumber} (FCFS Queue)\n` +
      `*Payment:* ₹${amountInRupees} (Paid via HDFC)\n\n` +
      `Please arrive at the clinic according to your queue position.\n` +
      `You can reply *STATUS* on the appointment day to check live queue progress.`;

    await this.sendTextMessage(params.phoneNumber, message);
  }

  /**
   * Dispatches notification if payment attempt failed.
   */
  static async sendPaymentFailedNotice(params: { phoneNumber: string }) {
    const message =
      `❌ *Payment Incomplete*\n\n` +
      `Your payment was not completed or failed.\n` +
      `Your appointment has *not* been confirmed.\n\n` +
      `You can send *Hi* anytime to start a new booking.`;

    await this.sendTextMessage(params.phoneNumber, message);
  }
}
