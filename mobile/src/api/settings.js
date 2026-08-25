import { apiRequest } from './client';

export function fetchAdminProfile() {
  return apiRequest('/api/settings/admin-profile');
}

export function saveAdminProfile(profile) {
  return apiRequest('/api/settings/admin-profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}
