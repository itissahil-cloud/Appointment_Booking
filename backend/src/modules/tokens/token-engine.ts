import { getClient } from '../../core/db.js';
import { logger } from '../../core/logger.js';
import { toLocalDateString } from '../clinic-settings/date-calculator.js';

export interface ConfirmPaymentAndAllocateTokenParams {
  providerOrderId: string;
  providerTransactionId: string;
  rawWebhookPayload?: any;
}

export interface TokenAllocationResult {
  isIdempotentReplay: boolean;
  appointmentId: string;
  patientId: string;
  appointmentDate: Date;
  tokenNumber: number;
  patientName: string;
  patientPhone: string;
  amountPaisa: number;
}

export class TokenEngine {
  /**
   * Atomically confirms a verified payment and generates the next sequential FCFS token.
   * Employs native PostgreSQL row-level locking (SELECT ... FOR UPDATE) inside an explicit ACID transaction.
   */
  static async confirmPaymentAndAllocateToken(
    params: ConfirmPaymentAndAllocateTokenParams
  ): Promise<TokenAllocationResult> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Fetch payment with associated appointment and patient
      const paymentRes = await client.query(`
        SELECT 
          p.id AS payment_id, p.status AS payment_status, p.amount_paisa,
          a.id AS appointment_id, a.appointment_date, a.token_number, a.status AS appointment_status,
          pt.id AS patient_id, pt.full_name AS patient_name, pt.phone_number AS patient_phone
        FROM payments p
        JOIN appointments a ON a.id = p.appointment_id
        JOIN patients pt ON pt.id = p.patient_id
        WHERE p.provider_order_id = $1;
      `, [params.providerOrderId]);

      if (paymentRes.rows.length === 0) {
        throw new Error(`PAYMENT_NOT_FOUND: Order ${params.providerOrderId} does not exist`);
      }

      const row = paymentRes.rows[0];

      // 2. IDEMPOTENCY CHECK: If already confirmed, return existing token immediately
      if (row.payment_status === 'SUCCESS' && row.appointment_status === 'CONFIRMED' && row.token_number !== null) {
        await client.query('COMMIT');
        logger.info(`Idempotent webhook replay detected for order: ${params.providerOrderId}`);
        return {
          isIdempotentReplay: true,
          appointmentId: row.appointment_id,
          patientId: row.patient_id,
          appointmentDate: new Date(row.appointment_date),
          tokenNumber: row.token_number,
          patientName: row.patient_name,
          patientPhone: row.patient_phone,
          amountPaisa: row.amount_paisa,
        };
      }

      const appointmentDateStr = toLocalDateString(new Date(row.appointment_date));

      // 3. Ensure daily_token_counters row exists for this clinic date
      await client.query(`
        INSERT INTO daily_token_counters (appointment_date, last_token)
        VALUES ($1::date, 0)
        ON CONFLICT (appointment_date) DO NOTHING;
      `, [appointmentDateStr]);

      // 4. ACQUIRE EXCLUSIVE ROW LOCK (SELECT ... FOR UPDATE)
      const lockRes = await client.query(`
        SELECT last_token
        FROM daily_token_counters
        WHERE appointment_date = $1::date
        FOR UPDATE;
      `, [appointmentDateStr]);

      const currentLastToken = lockRes.rows[0]?.last_token ?? 0;

      // 5. Check daily token limit from settings
      const settingsRes = await client.query(`
        SELECT daily_token_limit FROM clinic_settings LIMIT 1;
      `);
      const dailyLimit = settingsRes.rows[0]?.daily_token_limit ?? 30;

      if (currentLastToken >= dailyLimit) {
        await client.query(`
          UPDATE payments
          SET status = 'SUCCESS', provider_transaction_id = $1, raw_webhook_payload = $2, updated_at = NOW()
          WHERE id = $3;
        `, [params.providerTransactionId, params.rawWebhookPayload ? JSON.stringify(params.rawWebhookPayload) : null, row.payment_id]);

        await client.query('COMMIT');
        logger.warn(`Daily limit exceeded for ${appointmentDateStr}: limit=${dailyLimit}, current=${currentLastToken}`);
        throw new Error(`DAILY_LIMIT_EXCEEDED: Maximum daily tokens (${dailyLimit}) already allocated.`);
      }

      const nextTokenNumber = currentLastToken + 1;

      // 6. Atomically increment counter
      await client.query(`
        UPDATE daily_token_counters
        SET last_token = $1, updated_at = NOW()
        WHERE appointment_date = $2::date;
      `, [nextTokenNumber, appointmentDateStr]);

      // 7. Update appointment to CONFIRMED with assigned token
      await client.query(`
        UPDATE appointments
        SET token_number = $1, status = 'CONFIRMED'::appointment_status, updated_at = NOW()
        WHERE id = $2;
      `, [nextTokenNumber, row.appointment_id]);

      // 8. Update payment to SUCCESS
      await client.query(`
        UPDATE payments
        SET status = 'SUCCESS'::payment_status, provider_transaction_id = $1, verified_at = NOW(),
            raw_webhook_payload = $2, updated_at = NOW()
        WHERE id = $3;
      `, [params.providerTransactionId, params.rawWebhookPayload ? JSON.stringify(params.rawWebhookPayload) : null, row.payment_id]);

      // 9. Reset patient WhatsApp conversation to IDLE
      await client.query(`
        UPDATE whatsapp_conversations
        SET current_state = 'IDLE'::whatsapp_conversation_state,
            pending_booking_date = NULL,
            active_payment_id = NULL,
            last_interaction_at = NOW()
        WHERE patient_id = $1;
      `, [row.patient_id]);

      await client.query('COMMIT');

      logger.info(`Atomic FCFS Token assigned: Date=${appointmentDateStr}, Token=#${nextTokenNumber}, Patient=${row.patient_name}`);

      return {
        isIdempotentReplay: false,
        appointmentId: row.appointment_id,
        patientId: row.patient_id,
        appointmentDate: new Date(row.appointment_date),
        tokenNumber: nextTokenNumber,
        patientName: row.patient_name,
        patientPhone: row.patient_phone,
        amountPaisa: row.amount_paisa,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
