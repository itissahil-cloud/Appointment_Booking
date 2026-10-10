'use client';

import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New holiday inputs
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');

  const loadData = async () => {
    try {
      const [sRes, hRes] = await Promise.all([api.getSettings(), api.getHolidays()]);
      setSettings(sRes.data?.settings);
      setHolidays(hRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleDay = (dayId) => {
    const current = settings.workingDays || [];
    let updated;
    if (current.includes(dayId)) {
      if (current.length === 1) return; // Must have at least 1 working day
      updated = current.filter((d) => d !== dayId);
    } else {
      updated = [...current, dayId];
    }
    setSettings({ ...settings, workingDays: updated });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings({
        clinicName: settings.clinicName,
        doctorName: settings.doctorName,
        bookingAmountPaisa: Number(settings.bookingAmountPaisa),
        dailyTokenLimit: Number(settings.dailyTokenLimit),
        workingDays: settings.workingDays,
        clinicOpenTime: settings.clinicOpenTime,
        clinicCloseTime: settings.clinicCloseTime,
        cancellationCutoffHours: Number(settings.cancellationCutoffHours),
        isBookingEnabled: Boolean(settings.isBookingEnabled),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayDate || !holidayReason.trim()) return;
    try {
      await api.addHoliday({ holidayDate, reason: holidayReason });
      setHolidayDate('');
      setHolidayReason('');
      await loadData();
    } catch (err) {
      alert(`Failed to add holiday: ${err.message}`);
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await api.deleteHoliday(id);
      await loadData();
    } catch (err) {
      alert(`Failed to delete holiday: ${err.message}`);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Clinic Configuration</h1>
        <p className="text-xs text-slate-500">
          Manage clinic schedule, daily FCFS token limits, consultation fee, and official clinic holidays
        </p>
      </div>

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Clinic settings updated successfully!
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
          General Clinic Information
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Name</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor Name</label>
            <input
              type="text"
              value={settings.doctorName}
              onChange={(e) => setSettings({ ...settings, doctorName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Booking Amount (₹ INR)</label>
            <input
              type="number"
              value={settings.bookingAmountPaisa / 100}
              onChange={(e) => setSettings({ ...settings, bookingAmountPaisa: Number(e.target.value) * 100 })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Token Limit</label>
            <input
              type="number"
              value={settings.dailyTokenLimit}
              onChange={(e) => setSettings({ ...settings, dailyTokenLimit: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Opening Time</label>
            <input
              type="text"
              value={settings.clinicOpenTime}
              onChange={(e) => setSettings({ ...settings, clinicOpenTime: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Closing Time</label>
            <input
              type="text"
              value={settings.clinicCloseTime}
              onChange={(e) => setSettings({ ...settings, clinicCloseTime: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Working Days */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Weekly Working Days (Patient bookings will automatically skip unselected days)
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const isOpen = settings.workingDays?.includes(day.id);
              return (
                <button
                  type="button"
                  key={day.id}
                  onClick={() => handleToggleDay(day.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    isOpen
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {day.name} {isOpen ? '✓' : '(Closed)'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Booking Enable Toggle */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="enableBooking"
            checked={settings.isBookingEnabled}
            onChange={(e) => setSettings({ ...settings, isBookingEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="enableBooking" className="text-xs font-semibold text-slate-800">
            Enable Online WhatsApp Appointments (Uncheck to temporarily pause bookings)
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Clinic Configuration'}
          </button>
        </div>
      </form>

      {/* Holiday Manager */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-600" />
          Clinic Holidays Calendar
        </h2>
        <p className="text-xs text-slate-500">
          Dates marked as holidays are automatically bypassed by the WhatsApp booking bot.
        </p>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            required
            className="w-full sm:w-auto rounded-xl border border-slate-200 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <input
            type="text"
            value={holidayReason}
            onChange={(e) => setHolidayReason(e.target.value)}
            placeholder="Holiday description (e.g. Diwali, Clinic Renovation)..."
            required
            className="flex-1 rounded-xl border border-slate-200 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Holiday
          </button>
        </form>

        {/* Holidays List */}
        <div className="space-y-2 pt-2">
          {holidays.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No clinic holidays scheduled.</p>
          ) : (
            holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs hover:bg-slate-50"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    {new Date(h.holidayDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <p className="text-slate-500 text-[11px]">{h.reason}</p>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
