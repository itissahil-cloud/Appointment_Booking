import { query } from '../../core/db.js';
import { SettingsService } from '../clinic-settings/settings.service.js';

export class DashboardService {
  static async getDashboardMetrics() {
    const todayStr = new Date().toISOString().split('T')[0];

    const [settings, nextBookingDate, apptsRes, revRes] = await Promise.all([
      SettingsService.getSettings(),
      SettingsService.getNextBookingDate().catch(() => null),
      query(`
        SELECT status, token_number
        FROM appointments
        WHERE appointment_date = $1::date;
      `, [todayStr]),
      query(`
        SELECT COALESCE(SUM(amount_paisa), 0)::int AS total_revenue
        FROM payments
        WHERE status = 'SUCCESS'::payment_status AND created_at >= $1::date;
      `, [todayStr]),
    ]);

    const todayAppointments = apptsRes.rows;

    const confirmedCount = todayAppointments.filter((a) =>
      ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(a.status)
    ).length;

    const completedCount = todayAppointments.filter((a) => a.status === 'COMPLETED').length;
    const waitingCount = todayAppointments.filter((a) => a.status === 'CONFIRMED').length;
    const inProgressCount = todayAppointments.filter((a) => a.status === 'IN_PROGRESS').length;
    const cancelledCount = todayAppointments.filter((a) => a.status === 'CANCELLED').length;
    const noShowCount = todayAppointments.filter((a) => a.status === 'NO_SHOW').length;

    const inProgressAppt = todayAppointments.find((a) => a.status === 'IN_PROGRESS');
    const currentToken = inProgressAppt?.token_number || (completedCount > 0 ? completedCount : 0);

    const totalRevenuePaisa = revRes.rows[0]?.total_revenue || 0;

    return {
      todayDate: todayStr,
      nextBookingDate: nextBookingDate ? nextBookingDate.toISOString().split('T')[0] : null,
      currentToken,
      confirmedCount,
      completedCount,
      waitingCount,
      inProgressCount,
      cancelledCount,
      noShowCount,
      totalRevenuePaisa,
      totalRevenueRupees: totalRevenuePaisa / 100,
      dailyTokenLimit: settings.dailyTokenLimit,
      isBookingEnabled: settings.isBookingEnabled,
      clinicName: settings.clinicName,
      doctorName: settings.doctorName,
    };
  }
}
