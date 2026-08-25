import { API_URL } from '../config/api';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** User-safe message — never show raw HTML error pages in the UI. */
export function formatApiError(err, context = '') {
  const status = err?.status;
  const raw = String(err?.message || err || 'Unknown error');
  const body = String(err?.body || '');
  const combined = `${raw} ${body} ${context}`.toLowerCase();

  if (status === 404 || raw.includes('404')) {
    if (combined.includes('chat')) {
      return 'Chat is not available on the server yet. Redeploy the cloud backend, or use the desk API in dev.';
    }
    if (combined.includes('employee')) {
      return 'Employees are not available on the server yet. Redeploy the cloud backend to enable employee sync.';
    }
    if (combined.includes('vehicle-report')) {
      return 'Vehicle reports are not available on the server yet. Redeploy the cloud backend to enable sync.';
    }
    return 'This feature is not available on the server yet. Redeploy the cloud backend.';
  }
  if (raw.includes('<!DOCTYPE') || raw.includes('<html') || raw.includes('<pre>')) {
    return status ? `Server error (${status})` : 'Server error';
  }
  if (raw.startsWith('API ')) {
    const trimmed = raw.replace(/^API \d+:\s*/, '').trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return status ? `Server error (${status})` : 'Server error';
    }
    return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
  }
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
}

export async function apiRequest(path, options = {}) {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      `API ${response.status}: ${text || response.statusText}`,
      response.status,
      text,
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function checkHealth() {
  return apiRequest('/api/health');
}

export async function fetchSystemStatus() {
  return apiRequest('/api/system/status');
}
