import { query } from '../../core/db.js';
import { normalizePhoneNumber } from './phone.util.js';

export class PatientService {
  static async findOrCreateByPhone(rawPhone: string, fullName?: string) {
    const phoneNumber = normalizePhoneNumber(rawPhone);

    const findRes = await query(`
      SELECT id, phone_number AS "phoneNumber", full_name AS "fullName", email, is_active AS "isActive", created_at AS "createdAt"
      FROM patients
      WHERE phone_number = $1;
    `, [phoneNumber]);

    let patient = findRes.rows[0];

    if (!patient) {
      const defaultName = fullName?.trim() || 'Valued Patient';
      const insertRes = await query(`
        INSERT INTO patients (phone_number, full_name)
        VALUES ($1, $2)
        RETURNING id, phone_number AS "phoneNumber", full_name AS "fullName", email, is_active AS "isActive", created_at AS "createdAt";
      `, [phoneNumber, defaultName]);
      patient = insertRes.rows[0];

      // Initialize whatsapp conversation
      await query(`
        INSERT INTO whatsapp_conversations (patient_id, current_state)
        VALUES ($1, 'IDLE')
        ON CONFLICT (patient_id) DO NOTHING;
      `, [patient.id]);
    } else if (fullName && fullName.trim() && patient.fullName === 'Valued Patient') {
      const updateRes = await query(`
        UPDATE patients
        SET full_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, phone_number AS "phoneNumber", full_name AS "fullName", email, is_active AS "isActive", created_at AS "createdAt";
      `, [fullName.trim(), patient.id]);
      patient = updateRes.rows[0];
    }

    return patient;
  }

  static async findByPhone(rawPhone: string) {
    const phoneNumber = normalizePhoneNumber(rawPhone);
    const res = await query(`
      SELECT p.id, p.phone_number AS "phoneNumber", p.full_name AS "fullName", p.email,
             c.current_state AS "currentState", c.pending_booking_date AS "pendingBookingDate",
             c.active_payment_id AS "activePaymentId", c.last_interaction_at AS "lastInteractionAt"
      FROM patients p
      LEFT JOIN whatsapp_conversations c ON c.patient_id = p.id
      WHERE p.phone_number = $1;
    `, [phoneNumber]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      phoneNumber: row.phoneNumber,
      fullName: row.fullName,
      email: row.email,
      whatsAppConversation: row.currentState ? {
        currentState: row.currentState,
        pendingBookingDate: row.pendingBookingDate,
        activePaymentId: row.activePaymentId,
        lastInteractionAt: row.lastInteractionAt,
      } : null,
    };
  }

  static async listPatients(options: { search?: string; page?: number; limit?: number }) {
    const page = options.page || 1;
    const limit = options.limit || 15;
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) AS total FROM patients`;
    let dataSql = `
      SELECT p.id, p.full_name AS "fullName", p.phone_number AS "phoneNumber", p.email,
             p.created_at AS "createdAt",
             COUNT(a.id)::int AS "totalVisits",
             MAX(a.appointment_date) AS "lastVisit"
      FROM patients p
      LEFT JOIN appointments a ON a.patient_id = p.id
    `;
    const params: any[] = [];

    if (options.search) {
      countSql += ` WHERE full_name ILIKE $1 OR phone_number LIKE $1`;
      dataSql += ` WHERE p.full_name ILIKE $1 OR p.phone_number LIKE $1`;
      params.push(`%${options.search}%`);
    }

    dataSql += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [countRes, dataRes] = await Promise.all([
      query(countSql, options.search ? [`%${options.search}%`] : []),
      query(dataSql, [...params, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);

    return {
      data: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPatientById(id: string) {
    const pRes = await query(`
      SELECT id, full_name AS "fullName", phone_number AS "phoneNumber", email, created_at AS "createdAt"
      FROM patients
      WHERE id = $1;
    `, [id]);

    if (pRes.rows.length === 0) return null;
    const patient = pRes.rows[0];

    const [apptsRes, notesRes] = await Promise.all([
      query(`
        SELECT a.id, a.appointment_date AS "appointmentDate", a.token_number AS "tokenNumber",
               a.status, a.created_at AS "createdAt",
               p.amount_paisa AS "amountPaisa", p.status AS "paymentStatus"
        FROM appointments a
        LEFT JOIN payments p ON p.appointment_id = a.id
        WHERE a.patient_id = $1
        ORDER BY a.appointment_date DESC;
      `, [id]),
      query(`
        SELECT n.id, n.note, n.created_at AS "createdAt",
               u.full_name AS "doctorName"
        FROM patient_notes n
        JOIN admin_users u ON u.id = n.admin_user_id
        WHERE n.patient_id = $1
        ORDER BY n.created_at DESC;
      `, [id]),
    ]);

    return {
      ...patient,
      appointments: apptsRes.rows.map((r) => ({
        id: r.id,
        appointmentDate: r.appointmentDate,
        tokenNumber: r.tokenNumber,
        status: r.status,
        createdAt: r.createdAt,
        payment: r.amountPaisa ? { amountPaisa: r.amountPaisa, status: r.paymentStatus } : null,
      })),
      notes: notesRes.rows.map((r) => ({
        id: r.id,
        note: r.note,
        createdAt: r.createdAt,
        adminUser: { fullName: r.doctorName },
      })),
    };
  }

  static async addDoctorNote(patientId: string, adminUserId: string, note: string) {
    const res = await query(`
      INSERT INTO patient_notes (patient_id, admin_user_id, note)
      VALUES ($1, $2, $3)
      RETURNING id, patient_id AS "patientId", admin_user_id AS "adminUserId", note, created_at AS "createdAt";
    `, [patientId, adminUserId, note.trim()]);

    const adminRes = await query(`SELECT full_name AS "fullName" FROM admin_users WHERE id = $1`, [adminUserId]);

    return {
      ...res.rows[0],
      adminUser: { fullName: adminRes.rows[0]?.fullName || 'Doctor' },
    };
  }
}
