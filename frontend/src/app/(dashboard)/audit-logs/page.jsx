'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuditLogs()
      .then((res) => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Security Audit Logs</h1>
        <p className="text-xs text-slate-500">
          Immutable audit trail tracking administrative logins, queue calls, cancellations, and settings changes
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Action Event</th>
              <th className="px-6 py-3.5">Admin User</th>
              <th className="px-6 py-3.5">Entity Target</th>
              <th className="px-6 py-3.5">Metadata Details</th>
              <th className="px-6 py-3.5">IP Address</th>
              <th className="px-6 py-3.5">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Loading security audit trail...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-medium text-slate-800">
                    {log.adminUser?.fullName || 'Clinic Admin'}
                  </td>

                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                    {log.entityType} {log.entityId ? `(#${log.entityId.slice(0, 8)})` : ''}
                  </td>

                  <td className="px-6 py-4 font-mono text-[10px] text-slate-600 max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>

                  <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                    {log.ipAddress || '127.0.0.1'}
                  </td>

                  <td className="px-6 py-4 text-slate-400 text-[11px]">
                    {new Date(log.createdAt).toLocaleString('en-IN')}
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
