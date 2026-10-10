import { query } from '../../core/db.js';
import { getNextBookableClinicDate } from './date-calculator.js';

export interface ClinicSettingRow {
  id: string;
  clinicName: string;
  doctorName: string;
  bookingAmountPaisa: number;
  dailyTokenLimit: number;
  workingDays: number[];
  clinicOpenTime: string;
  clinicCloseTime: string;
  bookingOpenTime: string;
  cancellationCutoffHours: number;
  isBookingEnabled: boolean;
}

export class SettingsService {
  static async getSettings(): Promise<ClinicSettingRow> {
    const res = await query(`
      SELECT 
        id, clinic_name AS "clinicName", doctor_name AS "doctorName",
        booking_amount_paisa AS "bookingAmountPaisa", daily_token_limit AS "dailyTokenLimit",
        working_days AS "workingDays", clinic_open_time AS "clinicOpenTime",
        clinic_close_time AS "clinicCloseTime", booking_open_time AS "bookingOpenTime",
        cancellation_cutoff_hours AS "cancellationCutoffHours", is_booking_enabled AS "isBookingEnabled"
      FROM clinic_settings
      LIMIT 1;
    `);

    if (res.rows.length === 0) {
      const initRes = await query(`
        INSERT INTO clinic_settings (clinic_name, doctor_name, booking_amount_paisa, daily_token_limit, working_days)
        VALUES ('S K Poddar neurological clinic', 'Dr. S K Poddar', 10000, 30, '{1, 2, 3, 4, 5, 6}')
        RETURNING 
          id, clinic_name AS "clinicName", doctor_name AS "doctorName",
          booking_amount_paisa AS "bookingAmountPaisa", daily_token_limit AS "dailyTokenLimit",
          working_days AS "workingDays", clinic_open_time AS "clinicOpenTime",
          clinic_close_time AS "clinicCloseTime", booking_open_time AS "bookingOpenTime",
          cancellation_cutoff_hours AS "cancellationCutoffHours", is_booking_enabled AS "isBookingEnabled";
      `);
      return initRes.rows[0];
    }

    return res.rows[0];
  }

  static async updateSettings(data: {
    clinicName?: string;
    doctorName?: string;
    bookingAmountPaisa?: number;
    dailyTokenLimit?: number;
    workingDays?: number[];
    clinicOpenTime?: string;
    clinicCloseTime?: string;
    bookingOpenTime?: string;
    cancellationCutoffHours?: number;
    isBookingEnabled?: boolean;
  }) {
    const current = await this.getSettings();

    const clinicName = data.clinicName ?? current.clinicName;
    const doctorName = data.doctorName ?? current.doctorName;
    const bookingAmountPaisa = data.bookingAmountPaisa ?? current.bookingAmountPaisa;
    const dailyTokenLimit = data.dailyTokenLimit ?? current.dailyTokenLimit;
    const workingDays = data.workingDays ?? current.workingDays;
    const clinicOpenTime = data.clinicOpenTime ?? current.clinicOpenTime;
    const clinicCloseTime = data.clinicCloseTime ?? current.clinicCloseTime;
    const cancellationCutoffHours = data.cancellationCutoffHours ?? current.cancellationCutoffHours;
    const isBookingEnabled = data.isBookingEnabled !== undefined ? data.isBookingEnabled : current.isBookingEnabled;

    const res = await query(`
      UPDATE clinic_settings
      SET 
        clinic_name = $1,
        doctor_name = $2,
        booking_amount_paisa = $3,
        daily_token_limit = $4,
        working_days = $5,
        clinic_open_time = $6,
        clinic_close_time = $7,
        cancellation_cutoff_hours = $8,
        is_booking_enabled = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING 
        id, clinic_name AS "clinicName", doctor_name AS "doctorName",
        booking_amount_paisa AS "bookingAmountPaisa", daily_token_limit AS "dailyTokenLimit",
        working_days AS "workingDays", clinic_open_time AS "clinicOpenTime",
        clinic_close_time AS "clinicCloseTime", booking_open_time AS "bookingOpenTime",
        cancellation_cutoff_hours AS "cancellationCutoffHours", is_booking_enabled AS "isBookingEnabled";
    `, [
      clinicName,
      doctorName,
      bookingAmountPaisa,
      dailyTokenLimit,
      workingDays,
      clinicOpenTime,
      clinicCloseTime,
      cancellationCutoffHours,
      isBookingEnabled,
      current.id,
    ]);

    return res.rows[0];
  }

  static async getNextBookingDate(): Promise<Date> {
    const settings = await this.getSettings();
    const holidayRes = await query(`
      SELECT holiday_date AS "holidayDate"
      FROM clinic_holidays
      WHERE holiday_date >= CURRENT_DATE;
    `);

    return getNextBookableClinicDate(
      new Date(),
      settings.workingDays,
      holidayRes.rows.map((r) => new Date(r.holidayDate))
    );
  }
}
