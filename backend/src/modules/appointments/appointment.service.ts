import { query } from '../../core/db.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';

export class AppointmentService {
  static async listAppointments(options: {
    date?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) AS total FROM appointments a JOIN patients pt ON pt.id = a.patient_id WHERE 1=1`;
    let dataSql = `
      SELECT a.id, a.appointment_date AS "appointmentDate", a.token_number AS "tokenNumber",
             a.status, a.cancel_reason AS "cancelReason", a.created_at AS "createdAt",
             pt.id AS "patientId", pt.full_name AS "patientName", pt.phone_number AS "patientPhone",
             p.amount_paisa AS "amountPaisa", p.status AS "paymentStatus"
      FROM appointments a
      JOIN patients pt ON pt.id = a.patient_id
      LEFT JOIN payments p ON p.appointment_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.date) {
      params.push(options.date);
      countSql += ` AND a.appointment_date = $${params.length}::date`;
      dataSql += ` AND a.appointment_date = $${params.length}::date`;
    }

    if (options.status) {
      params.push(options.status);
      countSql += ` AND a.status = $${params.length}::appointment_status`;
      dataSql += ` AND a.status = $${params.length}::appointment_status`;
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      countSql += ` AND (pt.full_name ILIKE $${params.length} OR pt.phone_number LIKE $${params.length})`;
      dataSql += ` AND (pt.full_name ILIKE $${params.length} OR pt.phone_number LIKE $${params.length})`;
    }

    dataSql += ` ORDER BY a.appointment_date DESC, a.token_number ASC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);
    const data = dataRes.rows.map((r) => ({
      id: r.id,
      appointmentDate: r.appointmentDate,
      tokenNumber: r.tokenNumber,
      status: r.status,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt,
      patient: { id: r.patientId, fullName: r.patientName, phoneNumber: r.patientPhone },
      payment: r.amountPaisa ? { amountPaisa: r.amountPaisa, status: r.paymentStatus } : null,
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAppointmentById(id: string) {
    const res = await query(`
      SELECT a.id, a.appointment_date AS "appointmentDate", a.token_number AS "tokenNumber",
             a.status, a.cancel_reason AS "cancelReason", a.created_at AS "createdAt",
             pt.id AS "patientId", pt.full_name AS "patientName", pt.phone_number AS "patientPhone",
             p.amount_paisa AS "amountPaisa", p.status AS "paymentStatus"
      FROM appointments a
      JOIN patients pt ON pt.id = a.patient_id
      LEFT JOIN payments p ON p.appointment_id = a.id
      WHERE a.id = $1;
    `, [id]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      appointmentDate: r.appointmentDate,
      tokenNumber: r.tokenNumber,
      status: r.status,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt,
      patient: { id: r.patientId, fullName: r.patientName, phoneNumber: r.patientPhone },
      payment: r.amountPaisa ? { amountPaisa: r.amountPaisa, status: r.paymentStatus } : null,
    };
  }

  static async updateStatus(
    id: string,
    status: string,
    adminUserId: string,
    cancelReason?: string
  ) {
    const completedAt = status === 'COMPLETED' ? new Date() : null;
    const cancelledAt = status === 'CANCELLED' ? new Date() : null;
    const reason = status === 'CANCELLED' ? cancelReason || 'Cancelled by clinic administration' : null;

    const res = await query(`
      UPDATE appointments
      SET status = $1::appointment_status,
          completed_at = COALESCE($2, completed_at),
          cancelled_at = COALESCE($3, cancelled_at),
          cancel_reason = COALESCE($4, cancel_reason),
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, appointment_date AS "appointmentDate", token_number AS "tokenNumber", status;
    `, [status, completedAt, cancelledAt, reason, id]);

    const updated = res.rows[0];

    let auditAction = 'APPOINTMENT_MARK_IN_PROGRESS';
    if (status === 'COMPLETED') auditAction = 'APPOINTMENT_MARK_COMPLETED';
    if (status === 'NO_SHOW') auditAction = 'APPOINTMENT_MARK_NO_SHOW';
    if (status === 'CANCELLED') auditAction = 'APPOINTMENT_CANCELLED';

    await recordAuditLog({
      adminUserId,
      action: auditAction,
      entityType: 'Appointment',
      entityId: id,
      metadata: { newStatus: status, tokenNumber: updated.tokenNumber, cancelReason: reason },
    });

    return updated;
  }
}
