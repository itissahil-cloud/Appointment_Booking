'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [reconcilingId, setReconcilingId] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.getPayments({ search: search || undefined });
      setPayments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleReconcile = async (id) => {
    setReconcilingId(id);
    try {
      const res = await api.reconcilePayment(id);
      alert(`Reconciliation result: ${res.data?.status || 'Completed'}`);
      await fetchPayments();
    } catch (err) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      setReconcilingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments & Gateway Transactions</h1>
          <p className="text-xs text-slate-500">
            HDFC verified transactions, order references, and server-side payment reconciliation
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order ID / Transaction ID..."
            className="w-64 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Payments Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Patient Details</th>
              <th className="px-6 py-3.5">Amount (INR)</th>
              <th className="px-6 py-3.5">Payment Status</th>
              <th className="px-6 py-3.5">Gateway Order ID</th>
              <th className="px-6 py-3.5">Provider Transaction ID</th>
              <th className="px-6 py-3.5">Verified Date</th>
              <th className="px-6 py-3.5 text-right">Reconciliation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  Loading payment logs...
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                  No payment records found.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{p.patient?.fullName}</p>
                    <p className="text-[11px] text-slate-400">{p.patient?.phoneNumber}</p>
                  </td>

                  <td className="px-6 py-4 font-bold text-slate-900">
                    ₹{(p.amountPaisa / 100).toFixed(2)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        p.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.status === 'SUCCESS' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                      {p.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-mono text-[11px] text-slate-600">
                    {p.providerOrderId}
                  </td>

                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                    {p.providerTransactionId || '—'}
                  </td>

                  <td className="px-6 py-4 text-slate-400 text-[11px]">
                    {p.verifiedAt ? new Date(p.verifiedAt).toLocaleString('en-IN') : 'Pending verification'}
                  </td>

                  <td className="px-6 py-4 text-right">
                    {p.status === 'PENDING' && (
                      <button
                        onClick={() => handleReconcile(p.id)}
                        disabled={reconcilingId === p.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className={`h-3 w-3 ${reconcilingId === p.id ? 'animate-spin' : ''}`} />
                        Reconcile with HDFC
                      </button>
                    )}
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
