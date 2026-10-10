const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function fetcher(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('clinic_token') : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: async (credentials) => {
    const res = await fetcher('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    if (res?.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('clinic_token', res.data.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await fetcher('/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('clinic_token');
      }
    }
  },
  getMe: () => fetcher('/auth/me'),

  // Dashboard & Queue
  getDashboard: () => fetcher('/dashboard'),
  getTodayQueue: () => fetcher('/queue/today'),
  callNextPatient: () => fetcher('/queue/next', { method: 'POST' }),

  // Patients
  getPatients: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetcher(`/patients?${query.toString()}`);
  },
  getPatientById: (id) => fetcher(`/patients/${id}`),
  addDoctorNote: (patientId, note) =>
    fetcher(`/patients/${patientId}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),

  // Appointments
  getAppointments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetcher(`/appointments?${query.toString()}`);
  },
  markInProgress: (id) => fetcher(`/appointments/${id}/in-progress`, { method: 'POST' }),
  markCompleted: (id) => fetcher(`/appointments/${id}/complete`, { method: 'POST' }),
  markNoShow: (id) => fetcher(`/appointments/${id}/no-show`, { method: 'POST' }),
  cancelAppointment: (id, reason) =>
    fetcher(`/appointments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Payments
  getPayments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetcher(`/payments?${query.toString()}`);
  },
  reconcilePayment: (id) => fetcher(`/payments/${id}/reconcile`, { method: 'POST' }),
  simulateMockPayment: (orderId, status = 'SUCCESS') =>
    fetcher('/payments/mock/pay', { method: 'POST', body: JSON.stringify({ orderId, status }) }),

  // Settings & Holidays
  getSettings: () => fetcher('/settings'),
  updateSettings: (data) => fetcher('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  getHolidays: () => fetcher('/holidays'),
  addHoliday: (data) =>
    fetcher('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id) => fetcher(`/holidays/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetcher(`/audit-logs?${query.toString()}`);
  },
};
