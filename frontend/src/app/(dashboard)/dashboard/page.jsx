'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Ban,
  Volume2,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callingNext, setCallingNext] = useState(false);
  const [callAlert, setCallAlert] = useState(null);

  const loadData = async () => {
    try {
      const [dashRes, queueRes] = await Promise.all([api.getDashboard(), api.getTodayQueue()]);
      setMetrics(dashRes.data);
      setQueue(queueRes.data?.appointments || []);
    } catch (err) {
      console.error('Error loading dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh queue every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCallNext = async () => {
    setCallingNext(true);
    setCallAlert(null);
    try {
      const res = await api.callNextPatient();
      setCallAlert(res.data?.message || 'Queue advanced successfully.');
      await loadData();
    } catch (err) {
      setCallAlert(err.message || 'Failed to call next patient');
    } finally {
      setCallingNext(false);
    }
  };

  const handleStatusChange = async (id, action) => {
    try {
      if (action === 'in-progress') await api.markInProgress(id);
      if (action === 'complete') await api.markCompleted(id);
      if (action === 'no-show') await api.markNoShow(id);
      if (action === 'cancel') await api.cancelAppointment(id, 'Cancelled from doctor dashboard');
      await loadData();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner: Clinic & Dates */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Clinic Queue Console
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{metrics?.clinicName || 'S K Poddar neurological clinic'}</h1>
          <p className="text-xs text-slate-500">
            {metrics?.doctorName} • Daily Limit: {metrics?.dailyTokenLimit} Tokens
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Date</p>
            <p className="text-sm font-bold text-slate-800">{metrics?.todayDate}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Next Booking Date</p>
            <p className="text-sm font-bold text-emerald-800">{metrics?.nextBookingDate || 'Open Tomorrow'}</p>
          </div>
        </div>
      </div>

      {/* Doctor Action Bar: Call Next Patient */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-xl shadow-slate-900/10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Volume2 className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Queue Order</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Live FCFS
              </span>
            </div>
            <h2 className="text-xl font-bold">
              Current Token Being Seen: #{metrics?.currentToken || '0'}
            </h2>
            <p className="text-xs text-slate-400">
              {metrics?.waitingCount || 0} waiting patient(s) in chamber queue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadData}
            title="Refresh queue"
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleCallNext}
            disabled={callingNext || metrics?.waitingCount === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:pointer-events-none"
          >
            {callingNext ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Call Next Patient
              </>
            )}
          </button>
        </div>
      </div>

      {callAlert && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {callAlert}
          </span>
          <button onClick={() => setCallAlert(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Confirmed</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{metrics?.confirmedCount || 0}</p>
          <span className="text-[11px] text-slate-400">Total paid bookings</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">In Progress</span>
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-blue-600">{metrics?.inProgressCount || 0}</p>
          <span className="text-[11px] text-slate-400">In doctor's room</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Waiting</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-600">{metrics?.waitingCount || 0}</p>
          <span className="text-[11px] text-slate-400">In clinic lounge</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600">{metrics?.completedCount || 0}</p>
          <span className="text-[11px] text-slate-400">Consultations done</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Cancelled</span>
            <Ban className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-rose-600">{metrics?.cancelledCount || 0}</p>
          <span className="text-[11px] text-slate-400">Cancelled bookings</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Revenue</span>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">₹{metrics?.totalRevenueRupees || 0}</p>
          <span className="text-[11px] text-slate-400">Verified by HDFC</span>
        </div>
      </div>

      {/* Today's Live Queue Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Today's Token Queue</h3>
            <p className="text-xs text-slate-400">Sequential First Come, First Served queue for {metrics?.todayDate}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {queue.length} Total Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Token #</th>
                <th className="px-6 py-3.5">Patient Details</th>
                <th className="px-6 py-3.5">Appointment Status</th>
                <th className="px-6 py-3.5">HDFC Payment</th>
                <th className="px-6 py-3.5 text-right">Doctor Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No patient appointments booked for today yet.
                  </td>
                </tr>
              ) : (
                queue.map((appt) => {
                  const isCurrent = appt.status === 'IN_PROGRESS';
                  return (
                    <tr key={appt.id} className={isCurrent ? 'bg-blue-50/40' : 'hover:bg-slate-50/80 transition-colors'}>
                      {/* Token Number */}
                      <td className="px-6 py-4 font-bold">
                        <span
                          className={`inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-extrabold ${
                            isCurrent
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400/50'
                              : appt.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          #{appt.tokenNumber}
                        </span>
                      </td>

                      {/* Patient Details */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{appt.patient?.fullName}</p>
                        <p className="text-slate-400 text-[11px]">{appt.patient?.phoneNumber}</p>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            appt.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : appt.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : appt.status === 'CONFIRMED'
                              ? 'bg-indigo-100 text-indigo-700'
                              : appt.status === 'NO_SHOW'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {appt.status === 'IN_PROGRESS' && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />}
                          {appt.status === 'CONFIRMED' ? 'WAITING' : appt.status}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          ₹{(appt.payment?.amountPaisa || 10000) / 100} SUCCESS
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {appt.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleStatusChange(appt.id, 'in-progress')}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              Call to Chamber
                            </button>
                          )}
                          {appt.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleStatusChange(appt.id, 'complete')}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                            >
                              Mark Completed
                            </button>
                          )}
                          {['CONFIRMED', 'IN_PROGRESS'].includes(appt.status) && (
                            <>
                              <button
                                onClick={() => handleStatusChange(appt.id, 'no-show')}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                No Show
                              </button>
                              <button
                                onClick={() => handleStatusChange(appt.id, 'cancel')}
                                className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
