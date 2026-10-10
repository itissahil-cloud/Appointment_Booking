'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const STATUS_FILTERS = [
  'ALL',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'PAYMENT_PENDING',
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.getAppointments({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        search: search || undefined,
        date: dateFilter || undefined,
      });
      setAppointments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedStatus, dateFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAppointments();
  };

  const handleStatusChange = async (id, action) => {
    try {
      if (action === 'complete') await api.markCompleted(id);
      if (action === 'no-show') await api.markNoShow(id);
      if (action === 'cancel') await api.cancelAppointment(id, 'Admin cancellation');
      await fetchAppointments();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">All Clinic Appointments</h1>
        <p className="text-xs text-slate-500">
          Filter and manage clinic appointments by date, status, or patient phone number
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === s
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear date
            </button>
          )}

          <form onSubmit={handleSearch} className="flex items-center gap-1.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient..."
              className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Date & Token</th>
              <th className="px-6 py-3.5">Patient Details</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5">Payment Status</th>
              <th className="px-6 py-3.5">Created At</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Loading appointments...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                  No appointments found matching the selected criteria.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-extrabold text-white">
                        {a.tokenNumber ? `#${a.tokenNumber}` : 'Pending'}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {new Date(a.appointmentDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{a.patient?.fullName}</p>
                    <p className="text-[11px] text-slate-400">{a.patient?.phoneNumber}</p>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        a.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : a.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : a.status === 'CONFIRMED'
                          ? 'bg-indigo-100 text-indigo-800'
                          : a.status === 'CANCELLED'
                          ? 'bg-rose-100 text-rose-800'
                          : a.status === 'NO_SHOW'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-medium">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                      {a.payment?.status || 'N/A'} (₹{(a.payment?.amountPaisa || 10000) / 100})
                    </span>
                  </td>

                  <td className="px-6 py-4 text-slate-400 text-[11px]">
                    {new Date(a.createdAt).toLocaleString('en-IN')}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {['CONFIRMED', 'IN_PROGRESS'].includes(a.status) && (
                        <>
                          <button
                            onClick={() => handleStatusChange(a.id, 'complete')}
                            className="rounded px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleStatusChange(a.id, 'no-show')}
                            className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                          >
                            No Show
                          </button>
                          <button
                            onClick={() => handleStatusChange(a.id, 'cancel')}
                            className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
