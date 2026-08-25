import { apiRequest } from './client';

export function fetchChatMessages({ threadId, since, limit } = {}) {
  const params = new URLSearchParams();
  if (threadId) params.set('threadId', threadId);
  if (since) params.set('since', since);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return apiRequest(`/api/chat/messages${qs ? `?${qs}` : ''}`);
}

export function sendChatMessage(payload) {
  return apiRequest('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchChatThreads() {
  return apiRequest('/api/chat/threads');
}
