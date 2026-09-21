import {
  fetchEmployees as sbFetch,
  createEmployee as sbCreate,
  updateEmployee as sbUpdate,
  deleteEmployee as sbDelete,
  authenticateEmployee as sbAuth,
} from './supabaseBackend'

export function fetchEmployees() {
  return sbFetch()
}

export function createEmployee(employee) {
  return sbCreate(employee)
}

export function updateEmployee(id, patch) {
  return sbUpdate(id, patch)
}

export function deleteEmployee(id) {
  return sbDelete(id)
}

export function authenticateEmployee(username, password) {
  return sbAuth(username, password)
}
