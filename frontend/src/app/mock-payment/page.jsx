'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

function MockPaymentContent() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const qOrder = searchParams.get('orderId');
    const qAmount = searchParams.get('amount');
    if (qOrder) setOrderId(qOrder);
    if (qAmount) setAmount(qAmount);
  }, [searchParams]);

  const handlePay = async (status) => {
    if (!orderId.trim()) {
      setError('Please provide a valid Order ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.simulateMockPayment(orderId.trim(), status);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Payment simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
              HDFC
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">HDFC Bank Payment Gateway</h1>
              <p className="text-[11px] text-blue-400">SmartGateway Sandbox Simulator</p>
            </div>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>

        {result?.success ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Payment Verified by HDFC!</h2>
              <p className="text-xs text-slate-400 mt-1">
                FCFS Token was generated atomically in the clinic database.
              </p>
            </div>

            {result.result?.tokenNumber && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Assigned FCFS Queue Token
                </span>
                <div className="text-4xl font-extrabold text-emerald-400 mt-1">
                  #{result.result.tokenNumber}
                </div>
                <p className="text-xs text-slate-300 mt-2 font-medium">
                  Patient: {result.result.patientName}
                </p>
              </div>
            )}

            <a
              href="/dashboard"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Go to Doctor Live Queue Dashboard
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Clinic Booking Order ID</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. HDFC_ORD_172821..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Payable Booking Fee</label>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-lg font-bold text-emerald-400">
                ₹{amount}.00
              </div>
            </div>

            <div className="rounded-xl bg-slate-700/50 p-3 text-[11px] text-slate-300 space-y-1">
              <p>• Verified directly via server-to-server webhook.</p>
              <p>• Token is assigned <strong>strictly after</strong> verified success.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handlePay('SUCCESS')}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Pay ₹${amount} (Success)`}
              </button>
              <button
                type="button"
                onClick={() => handlePay('FAILED')}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600/80 py-3 text-xs font-bold text-white hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50"
              >
                Simulate Failure
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        S K Poddar neurological clinic • Production HDFC Integration Sandbox
      </p>
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <div className="flex min-h-screen bg-slate-900 items-center justify-center p-4">
      <Suspense fallback={<div className="text-white text-xs">Loading simulator...</div>}>
        <MockPaymentContent />
      </Suspense>
    </div>
  );
}
