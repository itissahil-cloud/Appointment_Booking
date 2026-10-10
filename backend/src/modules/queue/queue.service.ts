import { query, getClient } from '../../core/db.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';

export class QueueService {
  static async getTodayQueue() {
    const todayStr = new Date().toISOString().split('T')[0];

    const res = await query(`
      SELECT a.id, a.token_number AS "tokenNumber", a.status, a.created_at AS "createdAt",
             pt.full_name AS "patientName", pt.phone_number AS "patientPhone",
             p.amount_paisa AS "amountPaisa", p.status AS "paymentStatus", p.provider_order_id AS "providerOrderId"
      FROM appointments a
      JOIN patients pt ON pt.id = a.patient_id
      LEFT JOIN payments p ON p.appointment_id = a.id
      WHERE a.appointment_date = $1::date
        AND a.status IN ('CONFIRMED'::appointment_status, 'IN_PROGRESS'::appointment_status, 'COMPLETED'::appointment_status, 'NO_SHOW'::appointment_status, 'CANCELLED'::appointment_status)
      ORDER BY a.token_number ASC NULLS LAST;
    `, [todayStr]);

    const appointments = res.rows.map((r) => ({
      id: r.id,
      tokenNumber: r.tokenNumber,
      status: r.status,
      createdAt: r.createdAt,
      patient: { fullName: r.patientName, phoneNumber: r.patientPhone },
      payment: { amountPaisa: r.amountPaisa, status: r.paymentStatus, providerOrderId: r.providerOrderId },
    }));

    const currentInProgress = appointments.find((a) => a.status === 'IN_PROGRESS');

    return {
      date: todayStr,
      currentTokenNumber: currentInProgress?.tokenNumber || null,
      appointments,
    };
  }

  static async callNextPatient(adminUserId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Mark existing IN_PROGRESS as COMPLETED
      const activeRes = await client.query(`
        SELECT id, token_number
        FROM appointments
        WHERE appointment_date = $1::date AND status = 'IN_PROGRESS'::appointment_status
        LIMIT 1;
      `, [todayStr]);

      let previousToken: number | null = null;
      if (activeRes.rows.length > 0) {
        previousToken = activeRes.rows[0].token_number;
        await client.query(`
          UPDATE appointments
          SET status = 'COMPLETED'::appointment_status, completed_at = NOW(), updated_at = NOW()
          WHERE id = $1;
        `, [activeRes.rows[0].id]);
      }

      // 2. Find next waiting CONFIRMED appointment
      const nextRes = await client.query(`
        SELECT a.id, a.token_number, pt.full_name, pt.phone_number
        FROM appointments a
        JOIN patients pt ON pt.id = a.patient_id
        WHERE a.appointment_date = $1::date AND a.status = 'CONFIRMED'::appointment_status
        ORDER BY a.token_number ASC
        LIMIT 1;
      `, [todayStr]);

      if (nextRes.rows.length === 0) {
        await client.query('COMMIT');
        return {
          previousCompleted: previousToken,
          nextInProgress: null,
          message: 'No more waiting patients in queue for today.',
        };
      }

      const nextAppt = nextRes.rows[0];

      // 3. Mark next appointment as IN_PROGRESS
      await client.query(`
        UPDATE appointments
        SET status = 'IN_PROGRESS'::appointment_status, updated_at = NOW()
        WHERE id = $1;
      `, [nextAppt.id]);

      await client.query('COMMIT');

      await recordAuditLog({
        adminUserId,
        action: 'APPOINTMENT_CALL_NEXT',
        entityType: 'Appointment',
        entityId: nextAppt.id,
        metadata: { tokenNumber: nextAppt.token_number, patientName: nextAppt.full_name },
      });

      // 4. Send WhatsApp notification
      WhatsAppService.sendTextMessage(
        nextAppt.phone_number,
        `🔔 *S K Poddar neurological clinic - It's your turn!*\n\n` +
        `Patient: ${nextAppt.full_name}\n` +
        `Token: #${nextAppt.token_number}\n\n` +
        `Please step into the consultation room.`
      ).catch(() => {});

      return {
        previousCompleted: previousToken,
        nextInProgress: {
          id: nextAppt.id,
          tokenNumber: nextAppt.token_number,
          patient: { fullName: nextAppt.full_name, phoneNumber: nextAppt.phone_number },
        },
        message: `Token #${nextAppt.token_number} (${nextAppt.full_name}) called to doctor room.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
