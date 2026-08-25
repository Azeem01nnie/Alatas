import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Electron sets ALATAS_DATA_DIR to a writable userData path; dev falls back to backend/sqlite
const sqliteDir = process.env.ALATAS_DATA_DIR
  ? path.resolve(process.env.ALATAS_DATA_DIR)
  : path.join(__dirname, '..', 'sqlite')
const sqlitePath = path.join(sqliteDir, 'alatas.db')

function ensureSqliteDir() {
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true })
  }
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function serializeJson(value) {
  return value == null ? null : JSON.stringify(value)
}

function ensureColumn(db, table, column, typeSql) {
  const info = db.prepare(`PRAGMA table_info('${table}')`).all()
  const hasColumn = info.some((col) => col.name === column)
  if (!hasColumn) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`).run()
  }
}

function createDb() {
  ensureSqliteDir()
  const db = new Database(sqlitePath, { verbose: null })
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      make TEXT,
      series TEXT,
      bodyType TEXT,
      seats INTEGER,
      transmission TEXT,
      plateNo TEXT,
      engineNo TEXT,
      chassisNo TEXT,
      status TEXT,
      image TEXT,
      ownerId TEXT,
      ownerName TEXT,
      ownershipType TEXT,
      orcrImage TEXT,
      orImage TEXT,
      hrs5 INTEGER,
      hrs12 INTEGER,
      hrs24 INTEGER,
      exceedHour INTEGER,
      createdAt TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      vehicleId TEXT,
      vehicle TEXT,
      personal TEXT,
      rental TEXT,
      photo TEXT,
      licensePhoto TEXT,
      signature TEXT,
      carPhotos TEXT,
      termsAccepted INTEGER,
      rentalLifecycle TEXT,
      startedAt TEXT,
      completedAt TEXT,
      encodedAt TEXT,
      createdAt TEXT
    );
  `)

  // Migrations for older databases
  ;[
    ['vehicles', 'ownerId', 'TEXT'],
    ['vehicles', 'ownerName', 'TEXT'],
    ['vehicles', 'ownershipType', 'TEXT'],
    ['vehicles', 'orcrImage', 'TEXT'],
    ['vehicles', 'orImage', 'TEXT'],
    ['rentals', 'encodedAt', 'TEXT'],
    ['rentals', 'licensePhoto', 'TEXT'],
    ['rentals', 'signature', 'TEXT'],
    ['rentals', 'carPhotos', 'TEXT'],
    ['rentals', 'termsAccepted', 'INTEGER'],
    ['rentals', 'approvalStatus', 'TEXT'],
    ['rentals', 'source', 'TEXT'],
    ['rentals', 'rejectionReason', 'TEXT'],
    ['rentals', 'updatedAt', 'TEXT'],
    ['rentals', 'carPhotosAddedBy', 'TEXT'],
    ['vehicles', 'reportEntries', 'TEXT'],
  ].forEach(([table, column, typeSql]) => ensureColumn(db, table, column, typeSql))

  db.prepare(
    `UPDATE rentals SET approvalStatus = 'accepted' WHERE approvalStatus IS NULL`,
  ).run()
  db.prepare(
    `UPDATE rentals SET source = 'desktop' WHERE source IS NULL`,
  ).run()

  return db
}

const db = createDb()

const getVehicleRows = db.prepare('SELECT * FROM vehicles ORDER BY createdAt DESC')
const deleteVehiclesStmt = db.prepare('DELETE FROM vehicles')
const insertVehicleStmt = db.prepare(
  `INSERT INTO vehicles (
      id, make, series, bodyType, seats, transmission, plateNo,
      engineNo, chassisNo, status, image, ownerId, ownerName, ownershipType,
      orcrImage, orImage, hrs5, hrs12, hrs24, exceedHour, createdAt, reportEntries
    ) VALUES (
      @id, @make, @series, @bodyType, @seats, @transmission, @plateNo,
      @engineNo, @chassisNo, @status, @image, @ownerId, @ownerName, @ownershipType,
      @orcrImage, @orImage, @hrs5, @hrs12, @hrs24, @exceedHour, @createdAt, @reportEntries
    )`,
)

const getRentalRows = db.prepare('SELECT * FROM rentals ORDER BY createdAt DESC')
const deleteRentalsStmt = db.prepare('DELETE FROM rentals')
const insertRentalStmt = db.prepare(
  `INSERT INTO rentals (
      id, vehicleId, vehicle, personal, rental, photo, licensePhoto, signature, carPhotos,
      termsAccepted, rentalLifecycle, startedAt, completedAt, encodedAt, createdAt,
      approvalStatus, source, rejectionReason, updatedAt, carPhotosAddedBy
    ) VALUES (
      @id, @vehicleId, @vehicle, @personal, @rental, @photo, @licensePhoto, @signature, @carPhotos,
      @termsAccepted, @rentalLifecycle, @startedAt, @completedAt, @encodedAt, @createdAt,
      @approvalStatus, @source, @rejectionReason, @updatedAt, @carPhotosAddedBy
    )`,
)

const deleteVehicleStmt = db.prepare('DELETE FROM vehicles WHERE id = ?')

function deleteVehicle(id) {
  const key = String(id || '').trim()
  if (!key) return getVehicles()
  // Keep rental history for audits; only remove the fleet record
  deleteVehicleStmt.run(key)
  return getVehicles()
}

function mapVehicle(row) {
  const reportEntries = parseJson(row.reportEntries)
  return {
    id: row.id,
    make: row.make,
    series: row.series,
    bodyType: row.bodyType,
    seats: row.seats,
    transmission: row.transmission,
    plateNo: row.plateNo,
    engineNo: row.engineNo,
    chassisNo: row.chassisNo,
    status: row.status,
    image: row.image,
    ownerId: row.ownerId || '',
    ownerName: row.ownerName || '',
    ownershipType: row.ownershipType || 'company',
    orcrImage: row.orcrImage || '',
    orImage: row.orImage || '',
    reportEntries: Array.isArray(reportEntries) ? reportEntries : [],
    rates: {
      hrs5: row.hrs5,
      hrs12: row.hrs12,
      hrs24: row.hrs24,
      exceedHour: row.exceedHour,
    },
  }
}

function mapRental(row) {
  const carPhotos = parseJson(row.carPhotos)
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: parseJson(row.vehicle),
    personal: parseJson(row.personal),
    rental: parseJson(row.rental),
    photo: row.photo,
    licensePhoto: row.licensePhoto,
    signature: row.signature,
    carPhotos:
      carPhotos && typeof carPhotos === 'object' && !Array.isArray(carPhotos)
        ? carPhotos
        : {},
    termsAccepted: Boolean(row.termsAccepted),
    rentalLifecycle: row.rentalLifecycle,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    encodedAt: row.encodedAt,
    createdAt: row.createdAt,
    approvalStatus: row.approvalStatus || 'accepted',
    source: row.source || 'desktop',
    rejectionReason: row.rejectionReason || null,
    updatedAt: row.updatedAt || row.createdAt,
    carPhotosAddedBy: row.carPhotosAddedBy || null,
  }
}

function getVehicles() {
  return getVehicleRows.all().map(mapVehicle)
}

function replaceVehicles(vehicles) {
  const items = Array.isArray(vehicles) ? vehicles : []
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    deleteVehiclesStmt.run()

    for (const vehicle of items) {
      const id = String(vehicle?.id || '').trim()
      if (!id) continue

      insertVehicleStmt.run({
        id,
        make: vehicle.make ?? null,
        series: vehicle.series ?? null,
        bodyType: vehicle.bodyType ?? null,
        seats: vehicle.seats == null ? null : Number(vehicle.seats),
        transmission: vehicle.transmission ?? null,
        plateNo: vehicle.plateNo ?? null,
        engineNo: vehicle.engineNo ?? null,
        chassisNo: vehicle.chassisNo ?? null,
        status: vehicle.status ?? null,
        image: vehicle.image ?? null,
        ownerId: vehicle.ownerId ?? null,
        ownerName: vehicle.ownerName ?? null,
        ownershipType: vehicle.ownershipType ?? null,
        orcrImage: vehicle.orcrImage ?? null,
        orImage: vehicle.orImage ?? null,
        hrs5: vehicle.rates?.hrs5 == null ? null : Number(vehicle.rates.hrs5),
        hrs12: vehicle.rates?.hrs12 == null ? null : Number(vehicle.rates.hrs12),
        hrs24: vehicle.rates?.hrs24 == null ? null : Number(vehicle.rates.hrs24),
        exceedHour: vehicle.rates?.exceedHour == null ? null : Number(vehicle.rates.exceedHour),
        createdAt: vehicle.createdAt || now,
        reportEntries: serializeJson(
          Array.isArray(vehicle.reportEntries) ? vehicle.reportEntries : [],
        ),
      })
    }
  })

  run()
  return getVehicles()
}

function getRentals() {
  return getRentalRows.all().map(mapRental)
}

function toRentalRow(rental, fallbackNow) {
  const id = String(rental?.id || `r-${Date.now()}`).trim()
  const now = fallbackNow || new Date().toISOString()
  return {
    id,
    vehicleId: rental.vehicle?.id ?? rental.vehicleId ?? null,
    vehicle: serializeJson(rental.vehicle),
    personal: serializeJson(rental.personal),
    rental: serializeJson(rental.rental),
    photo: rental.photo ?? null,
    licensePhoto: rental.licensePhoto ?? null,
    signature: rental.signature ?? null,
    carPhotos: serializeJson(rental.carPhotos || {}),
    termsAccepted: rental.termsAccepted ? 1 : 0,
    rentalLifecycle: rental.rentalLifecycle ?? null,
    startedAt: rental.startedAt ?? null,
    completedAt: rental.completedAt ?? null,
    encodedAt: rental.encodedAt ?? now,
    createdAt: rental.createdAt ?? now,
    approvalStatus: rental.approvalStatus || 'accepted',
    source: rental.source || 'desktop',
    rejectionReason: rental.rejectionReason ?? null,
    updatedAt: rental.updatedAt ?? now,
    carPhotosAddedBy: rental.carPhotosAddedBy ?? null,
  }
}

function updateVehicleStatusById(id, status) {
  const key = String(id || '').trim()
  if (!key) return getVehicles()
  db.prepare(`UPDATE vehicles SET status = ? WHERE id = ?`).run(status, key)
  return getVehicles()
}

function addRental(rental) {
  const now = new Date().toISOString()
  const entry = toRentalRow(rental, now)
  insertRentalStmt.run(entry)
  return mapRental(entry)
}

const CAR_PHOTO_KEYS = ['front', 'rear', 'left', 'right']

function rentalCarPhotosComplete(carPhotos) {
  if (!carPhotos || typeof carPhotos !== 'object') return false
  return CAR_PHOTO_KEYS.every((key) => Boolean(carPhotos[key]))
}

function updateRentalCarPhotos(id, carPhotos, addedBy) {
  const key = String(id || '').trim()
  if (!key) throw new Error('Rental id is required')
  const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(key)
  if (!row) throw new Error('Rental not found')

  const existing =
    parseJson(row.carPhotos) && typeof parseJson(row.carPhotos) === 'object'
      ? parseJson(row.carPhotos)
      : {}
  if (rentalCarPhotosComplete(existing)) {
    throw new Error('Car photos are locked and cannot be changed')
  }

  const incoming = carPhotos && typeof carPhotos === 'object' ? carPhotos : {}
  const merged = { ...existing, ...incoming }
  const now = new Date().toISOString()
  const allComplete = rentalCarPhotosComplete(merged)
  const addedByName =
    (addedBy && String(addedBy).trim()) ||
    (merged._addedBy && String(merged._addedBy).trim()) ||
    row.carPhotosAddedBy ||
    null
  if (allComplete && addedByName) {
    merged._addedBy = addedByName
  }
  const carPhotosAddedBy = allComplete && addedByName ? addedByName : row.carPhotosAddedBy || null

  db.prepare(
    'UPDATE rentals SET carPhotos = ?, carPhotosAddedBy = ?, updatedAt = ? WHERE id = ?',
  ).run(serializeJson(merged), carPhotosAddedBy, now, key)

  const updated = db.prepare('SELECT * FROM rentals WHERE id = ?').get(key)
  return mapRental(updated)
}


function replaceRentals(rentals) {
  const items = Array.isArray(rentals) ? rentals : []
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    deleteRentalsStmt.run()

    for (const rental of items) {
      const row = toRentalRow(rental, now)
      if (!row.id) continue
      insertRentalStmt.run(row)
    }
  })

  run()
  return getRentals()
}


function ensureSettingsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

ensureSettingsTable()

function getSetting(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  return row ? parseJson(row.value) : null
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ key, value: serializeJson(value) })
  return getSetting(key)
}

function getAdminProfile() {
  const stored = getSetting('admin_profile')
  if (stored && typeof stored === 'object') {
    return {
      displayName: String(stored.displayName || '').trim() || 'Alatas Admin',
      photo: typeof stored.photo === 'string' ? stored.photo : '',
    }
  }
  return { displayName: 'Alatas Admin', photo: '' }
}

function setAdminProfile(profile) {
  const next = {
    displayName: String(profile?.displayName || '').trim() || 'Alatas Admin',
    photo: typeof profile?.photo === 'string' ? profile.photo : '',
  }
  return setSetting('admin_profile', next)
}

const EMPTY_REPORT_STORE = { entries: [], submissions: [] }

function getVehicleReports() {
  const stored = getSetting('vehicle_reports')
  if (!stored || typeof stored !== 'object') return { ...EMPTY_REPORT_STORE }
  return {
    entries: Array.isArray(stored.entries) ? stored.entries : [],
    submissions: Array.isArray(stored.submissions) ? stored.submissions : [],
  }
}

function setVehicleReports(store) {
  const next = {
    entries: Array.isArray(store?.entries) ? store.entries : [],
    submissions: Array.isArray(store?.submissions) ? store.submissions : [],
  }
  setSetting('vehicle_reports', next)
  return next
}

function ensureEmployeesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      phone TEXT,
      role TEXT,
      password TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );
  `)
}

ensureEmployeesTable()

const ALLOWED_ROLES = new Set(['Manager', 'Inspector', 'Staff'])

function mapEmployee(row, { includePassword = false } = {}) {
  if (!row) return null
  const employee = {
    id: row.id,
    name: row.name || '',
    username: row.username || '',
    phone: row.phone || '',
    role: ALLOWED_ROLES.has(row.role) ? row.role : 'Staff',
    active: row.active === 1 || row.active === true,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  }
  if (includePassword) employee.password = row.password || ''
  return employee
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function getEmployees({ includePassword = false } = {}) {
  return db
    .prepare('SELECT * FROM employees ORDER BY createdAt DESC, name ASC')
    .all()
    .map((row) => mapEmployee(row, { includePassword }))
}

function getEmployeeById(id, { includePassword = false } = {}) {
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(String(id || ''))
  return mapEmployee(row, { includePassword })
}

function getEmployeeByUsername(username, { includePassword = false } = {}) {
  const key = normalizeUsername(username)
  if (!key) return null
  const row = db
    .prepare('SELECT * FROM employees WHERE lower(username) = ?')
    .get(key)
  return mapEmployee(row, { includePassword })
}

function createEmployee(input = {}) {
  const now = new Date().toISOString()
  const username = String(input.username || '').trim()
  const name = String(input.name || '').trim()
  const password = String(input.password || '')
  const phone = String(input.phone || '').trim()
  const role = ALLOWED_ROLES.has(input.role) ? input.role : 'Staff'
  const active = input.active === false ? 0 : 1

  if (!name) throw new Error('Employee name is required')
  if (!username) throw new Error('Username is required')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')
  if (getEmployeeByUsername(username)) throw new Error('Username is already taken')

  const id = String(input.id || `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  db.prepare(`
    INSERT INTO employees (id, name, username, phone, role, password, active, createdAt, updatedAt)
    VALUES (@id, @name, @username, @phone, @role, @password, @active, @createdAt, @updatedAt)
  `).run({
    id,
    name,
    username,
    phone,
    role,
    password,
    active,
    createdAt: input.createdAt || now,
    updatedAt: now,
  })
  return getEmployeeById(id)
}

function updateEmployee(id, patch = {}) {
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(String(id || ''))
  if (!existing) throw new Error('Employee not found')

  const nextUsername =
    patch.username != null ? String(patch.username).trim() : existing.username
  if (!nextUsername) throw new Error('Username is required')

  const conflict = getEmployeeByUsername(nextUsername, { includePassword: true })
  if (conflict && conflict.id !== existing.id) {
    throw new Error('Username is already taken')
  }

  const nextName = patch.name != null ? String(patch.name).trim() : existing.name
  if (!nextName) throw new Error('Employee name is required')

  let nextPassword = existing.password
  if (patch.password != null && String(patch.password).length > 0) {
    if (String(patch.password).length < 6) {
      throw new Error('Password must be at least 6 characters')
    }
    nextPassword = String(patch.password)
  }

  const nextRole = patch.role != null
    ? (ALLOWED_ROLES.has(patch.role) ? patch.role : existing.role)
    : existing.role
  const nextPhone = patch.phone != null ? String(patch.phone).trim() : existing.phone
  const nextActive =
    patch.active == null ? existing.active : (patch.active ? 1 : 0)
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE employees
    SET name = @name,
        username = @username,
        phone = @phone,
        role = @role,
        password = @password,
        active = @active,
        updatedAt = @updatedAt
    WHERE id = @id
  `).run({
    id: existing.id,
    name: nextName,
    username: nextUsername,
    phone: nextPhone,
    role: nextRole,
    password: nextPassword,
    active: nextActive,
    updatedAt: now,
  })

  return getEmployeeById(existing.id)
}

function deleteEmployee(id) {
  const existing = getEmployeeById(id)
  if (!existing) throw new Error('Employee not found')
  db.prepare('DELETE FROM employees WHERE id = ?').run(String(id))
  return existing
}

function replaceEmployees(list) {
  const items = Array.isArray(list) ? list : []
  const run = db.transaction(() => {
    db.prepare('DELETE FROM employees').run()
    for (const item of items) {
      const now = new Date().toISOString()
      const username = String(item.username || '').trim()
      const name = String(item.name || '').trim()
      if (!username || !name) continue
      db.prepare(`
        INSERT INTO employees (id, name, username, phone, role, password, active, createdAt, updatedAt)
        VALUES (@id, @name, @username, @phone, @role, @password, @active, @createdAt, @updatedAt)
      `).run({
        id: String(item.id || `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        name,
        username,
        phone: String(item.phone || '').trim(),
        role: ALLOWED_ROLES.has(item.role) ? item.role : 'Staff',
        password: String(item.password || 'ChangeMe@1'),
        active: item.active === false ? 0 : 1,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      })
    }
  })
  run()
  return getEmployees()
}

function authenticateEmployee(username, password) {
  const employee = getEmployeeByUsername(username, { includePassword: true })
  if (!employee) return null
  if (!employee.active) return null
  if (String(employee.password || '') !== String(password || '')) return null
  const { password: _pw, ...safe } = employee
  return safe
}

export {
  db,
  getVehicles,
  replaceVehicles,
  getRentals,
  addRental,
  updateRentalCarPhotos,
  replaceRentals,
  deleteVehicle,
  mapRental,
  toRentalRow,
  updateVehicleStatusById,
  getAdminProfile,
  setAdminProfile,
  getVehicleReports,
  setVehicleReports,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  replaceEmployees,
  authenticateEmployee,
}
