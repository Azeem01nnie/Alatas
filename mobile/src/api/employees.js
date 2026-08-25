import { apiRequest } from './client';

export function fetchEmployees() {
  return apiRequest('/api/employees');
}

export function createEmployee(employee) {
  return apiRequest('/api/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  });
}

export function updateEmployee(id, patch) {
  return apiRequest(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteEmployee(id) {
  return apiRequest(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function authenticateEmployee(username, password) {
  return apiRequest('/api/employees/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
