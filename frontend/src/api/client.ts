import { AiInsight, Alert, Anomaly, Company, Metric } from '../types';

// In local dev and single-host Docker Compose, the Vite proxy / nginx proxy
// forwards relative "/api" calls to the backend, so no env var is needed.
// In a split deployment (e.g. Vercel frontend + Render backend), set
// VITE_API_BASE_URL to the backend's public URL at build time.
const BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getCompanies: () => request<{ companies: Company[] }>('/companies'),
  getCompany: (id: string) => request<{ company: Company }>(`/companies/${id}`),

  getMetrics: (params: { company?: string; type?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]);
    return request<{ metrics: Metric[]; count: number }>(`/metrics?${qs.toString()}`);
  },

  getAnomalies: (params: { company?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]);
    return request<{ anomalies: Anomaly[] }>(`/anomalies?${qs.toString()}`);
  },
  detectAnomalies: (company?: string) =>
    request<{ anomaliesCreated: number }>('/anomalies/detect', { method: 'POST', body: JSON.stringify({ company }) }),
  updateAnomalyStatus: (id: string, status: string) =>
    request(`/anomalies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getAlerts: (params: { company?: string; severity?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]);
    return request<{ alerts: Alert[] }>(`/alerts?${qs.toString()}`);
  },
  generateAlerts: () => request<{ created: number; delivered: number }>('/alerts/generate', { method: 'POST' }),
  updateAlertStatus: (id: string, status: string) =>
    request(`/alerts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  generateInsight: (company_id: string, force = false) =>
    request<{ insight: AiInsight }>('/insights/generate', { method: 'POST', body: JSON.stringify({ company_id, force }) }),
  getLatestInsight: (companyId: string) => request<{ insight: AiInsight }>(`/insights/${companyId}/latest`),
};
