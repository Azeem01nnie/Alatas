import {
  db,
  getRentals,
  getVehicles,
  mapRental,
  toRentalRow,
  updateVehicleStatusById,
} from './sqlite-db.js'

const parseJson = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function ensureSyncTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      syncedAt TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

ensureSyncTables()

const listQueueStmt = db.prepare(
  `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY createdAt ASC`,
)
const insertQueueStmt = db.prepare(
  `INSERT INTO sync_queue (id, entityType, action, payload, status, createdAt)
   VALUES (@id, @entityType, @action, @payload, 'pending', @createdAt)`,
)
const markQueueSyncedStmt = db.prepare(
  `UPDATE sync_queue SET status = 'synced', syncedAt = @syncedAt, errorMessage = NULL WHERE id = @id`,
)
const markQueueFailedStmt = db.prepare(
  `UPDATE sync_queue SET status = 'failed', errorMessage = @errorMessage WHERE id = @id`,
)
const getRentalByIdStmt = db.prepare(`SELECT * FROM rentals WHERE id = ?`)
const updateRentalStmt = db.prepare(
  `UPDATE rentals SET
    vehicleId = @vehicleId, vehicle = @vehicle, personal = @personal, rental = @rental,
    photo = @photo, licensePhoto = @licensePhoto, signature = @signature, carPhotos = @carPhotos,
    termsAccepted = @termsAccepted, rentalLifecycle = @rentalLifecycle,
    startedAt = @startedAt, completedAt = @completedAt, encodedAt = @encodedAt,
    approvalStatus = @approvalStatus, source = @source, rejectionReason = @rejectionReason,
    updatedAt = @updatedAt
   WHERE id = @id`,
)
const insertRentalStmt = db.prepare(
  `INSERT INTO rentals (
      id, vehicleId, vehicle, personal, rental, photo, licensePhoto, signature, carPhotos,
      termsAccepted, rentalLifecycle, startedAt, completedAt, encodedAt, createdAt,
      approvalStatus, source, rejectionReason, updatedAt
    ) VALUES (
      @id, @vehicleId, @vehicle, @personal, @rental, @photo, @licensePhoto, @signature, @carPhotos,
      @termsAccepted, @rentalLifecycle, @startedAt, @completedAt, @encodedAt, @createdAt,
      @approvalStatus, @source, @rejectionReason, @updatedAt
    )`,
)

function isDue(periodFrom) {
  if (!periodFrom) return false
  const start = new Date(periodFrom).getTime()
  return !Number.isNaN(start) && start <= Date.now()
}

function vehicleIsBlocked(vehicleId, ignoreRentalId = null) {
  if (!vehicleId) return { blocked: true, reason: 'Missing vehicle.' }

  const vehicle = getVehicles().find((v) => String(v.id) === String(vehicleId))
  if (!vehicle) return { blocked: true, reason: 'Vehicle not found.' }

  const activeRentals = getRentals().filter((r) => {
    if (ignoreRentalId && String(r.id) === String(ignoreRentalId)) return false
    if (String(r.vehicleId || r.vehicle?.id) !== String(vehicleId)) return false
    if (r.approvalStatus === 'rejected') return false
    if (r.rentalLifecycle === 'pending_approval') return false
    return r.rentalLifecycle === 'active' || r.rentalLifecycle === 'scheduled'
  })

  if (activeRentals.length > 0) {
    return { blocked: true, reason: 'Vehicle already has an active or scheduled rental.' }
  }

  if (vehicle.status === 'Under Maintenance') {
    return { blocked: true, reason: 'Vehicle is Under Maintenance.' }
  }

  // Stale "Rented" with no active/scheduled rental — allow desk/mobile approval to proceed.
  return { blocked: false }
}

function getPendingRentals() {
  return getRentals().filter((r) => r.approvalStatus === 'pending')
}

function addPendingRental(rental) {
  const now = new Date().toISOString()
  const row = toRentalRow(
    {
      ...rental,
      approvalStatus: 'pending',
      source: rental.source || 'field',
      rentalLifecycle: 'pending_approval',
      startedAt: null,
      completedAt: null,
    },
    now,
  )
  insertRentalStmt.run(row)
  return mapRental(row)
}

function acceptPendingRental(id) {
  const existing = getRentalByIdStmt.get(id)
  if (!existing) {
    throw new Error('Pending rental not found.')
  }
  if (existing.approvalStatus !== 'pending') {
    throw new Error('Rental is not pending approval.')
  }

  const vehicleId = existing.vehicleId || parseJson(existing.vehicle)?.id
  const conflict = vehicleIsBlocked(vehicleId, id)
  if (conflict.blocked) {
    throw new Error(conflict.reason)
  }

  const periodFrom = parseJson(existing.rental)?.periodFrom
  const shouldStartNow = isDue(periodFrom)
  const now = new Date().toISOString()

  const row = {
    ...existing,
    approvalStatus: 'accepted',
    rentalLifecycle: shouldStartNow ? 'active' : 'scheduled',
    startedAt: shouldStartNow ? now : null,
    rejectionReason: null,
    updatedAt: now,
  }

  updateRentalStmt.run(row)

  if (vehicleId && (shouldStartNow || row.rentalLifecycle === 'scheduled')) {
    updateVehicleStatusById(vehicleId, 'Rented')
  }

  return mapRental(row)
}

function rejectPendingRental(id, reason = '') {
  const existing = getRentalByIdStmt.get(id)
  if (!existing) {
    throw new Error('Pending rental not found.')
  }
  if (existing.approvalStatus !== 'pending') {
    throw new Error('Rental is not pending approval.')
  }

  const now = new Date().toISOString()
  const row = {
    ...existing,
    approvalStatus: 'rejected',
    rentalLifecycle: 'cancelled',
    rejectionReason: String(reason || '').trim() || 'Rejected by admin',
    updatedAt: now,
  }

  updateRentalStmt.run(row)
  return mapRental(row)
}

function enqueueSyncItem({ entityType, action, payload }) {
  const now = new Date().toISOString()
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  insertQueueStmt.run({
    id,
    entityType,
    action,
    payload: JSON.stringify(payload ?? {}),
    createdAt: now,
  })
  return { id, entityType, action, status: 'pending', createdAt: now }
}

function getSyncQueue() {
  return listQueueStmt.all().map((row) => ({
    id: row.id,
    entityType: row.entityType,
    action: row.action,
    payload: parseJson(row.payload),
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    syncedAt: row.syncedAt,
  }))
}

function getSyncMeta(key) {
  const row = db.prepare(`SELECT value FROM sync_meta WHERE key = ?`).get(key)
  return row?.value ?? null
}

function setSyncMeta(key, value) {
  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, String(value))
}

function markQueueItemSynced(id) {
  markQueueSyncedStmt.run({ id, syncedAt: new Date().toISOString() })
}

function markQueueItemFailed(id, errorMessage) {
  markQueueFailedStmt.run({ id, errorMessage: String(errorMessage || 'Sync failed') })
}

export {
  getPendingRentals,
  addPendingRental,
  acceptPendingRental,
  rejectPendingRental,
  enqueueSyncItem,
  getSyncQueue,
  getSyncMeta,
  setSyncMeta,
  markQueueItemSynced,
  markQueueItemFailed,
  vehicleIsBlocked,
}
