import {
  fetchEmployees as fetchLocalEmployees,
  createEmployee as createLocalEmployee,
  updateEmployee as updateLocalEmployee,
  deleteEmployee as deleteLocalEmployee,
} from './backend'
import {
  fetchCloudEmployees,
  createCloudEmployee,
  updateCloudEmployee,
  deleteCloudEmployee,
  isCloudConfigured,
  CLOUD_SYNC_ENABLED,
} from './cloudSync'

function preferCloudDirect() {
  return CLOUD_SYNC_ENABLED && isCloudConfigured()
}

export async function fetchEmployees() {
  try {
    return await fetchLocalEmployees()
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return fetchCloudEmployees()
  }
}

export async function createEmployee(payload) {
  try {
    return await createLocalEmployee(payload)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return createCloudEmployee(payload)
  }
}

export async function updateEmployee(id, patch) {
  try {
    return await updateLocalEmployee(id, patch)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return updateCloudEmployee(id, patch)
  }
}

export async function deleteEmployee(id) {
  try {
    return await deleteLocalEmployee(id)
  } catch (err) {
    if (!preferCloudDirect()) throw err
    return deleteCloudEmployee(id)
  }
}
