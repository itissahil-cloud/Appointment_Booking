'use client';

import { useState, useEffect } from 'react';
import { Search, Calendar, X, Lock } from 'lucide-react';
import { api } from '@/lib/api';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchPatients = async (query = '') => {
    setLoading(true);
    try {
      const res = await api.getPatients({ search: query });
      setPatients(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(search);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPatients(search);
  };

  const handleSelectPatient = async (p) => {
    setSelectedPatient(p);
    try {
      const res = await api.getPatientById(p.id);
      setPatientDetails(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedPatient) return;
    setSavingNote(true);
    try {
      await api.addDoctorNote(selectedPatient.id, newNote);
      setNewNote('');
      const updated = await api.getPatientById(selectedPatient.id);
      setPatientDetails(updated.data);
    } catch (err) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients Directory</h1>
          <p className="text-xs text-slate-500">
            Registered clinic patients with medical history and confidential notes
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Patients Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Patient Name</th>
              <th className="px-6 py-3.5">Phone Number</th>
              <th className="px-6 py-3.5">Total Visits</th>
              <th className="px-6 py-3.5">Last Visit</th>
              <th className="px-6 py-3.5">Registered On</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Loading patient records...
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                  No patients found matching your search.
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{p.fullName}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{p.phoneNumber}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {p.totalVisits} visit(s)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString('en-IN') : 'None yet'}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(p.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSelectPatient(p)}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      View Profile & Notes
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Patient Profile & Confidential Notes Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedPatient.fullName}</h3>
                <p className="text-xs text-slate-400">{selectedPatient.phoneNumber}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientDetails(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Doctor Private Notes Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    Doctor's Confidential Clinical Notes
                  </h4>
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
                    Private • Doctor Only
                  </span>
                </div>

                <form onSubmit={handleAddNote} className="space-y-2 mb-4">
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add clinical observation, follow-up advice, diagnosis notes..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingNote || !newNote.trim()}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {savingNote ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {patientDetails?.notes?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No notes recorded yet for this patient.</p>
                  ) : (
                    patientDetails?.notes?.map((n) => (
                      <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                        <p className="text-slate-800 leading-relaxed">{n.note}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>By {n.adminUser?.fullName || 'Doctor'}</span>
                          <span>{new Date(n.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Past Appointments History */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  Appointment History
                </h4>

                <div className="space-y-2">
                  {patientDetails?.appointments?.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          Token #{a.tokenNumber} • {new Date(a.appointmentDate).toLocaleDateString('en-IN')}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Payment: {a.payment?.status} (₹{(a.payment?.amountPaisa || 10000) / 100})
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          a.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : a.status === 'CONFIRMED'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
