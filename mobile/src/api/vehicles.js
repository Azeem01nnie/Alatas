import { apiRequest } from './client';

export function fetchVehicles() {
  return apiRequest('/api/vehicles');
}

export function replaceVehicles(vehicles) {
  return apiRequest('/api/vehicles', {
    method: 'PUT',
    body: JSON.stringify(vehicles),
  });
}
