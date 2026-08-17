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
  ].forEach(([table, column, typeSql]) => ensureColumn(db, table, column, typeSql))

  return db
}

const db = createDb()

const getVehicleRows = db.prepare('SELECT * FROM vehicles ORDER BY createdAt DESC')
const deleteVehiclesStmt = db.prepare('DELETE FROM vehicles')
const insertVehicleStmt = db.prepare(
  `INSERT INTO vehicles (
      id, make, series, bodyType, seats, transmission, plateNo,
      engineNo, chassisNo, status, image, ownerId, ownerName, ownershipType,
      orcrImage, orImage, hrs5, hrs12, hrs24, exceedHour, createdAt
    ) VALUES (
      @id, @make, @series, @bodyType, @seats, @transmission, @plateNo,
      @engineNo, @chassisNo, @status, @image, @ownerId, @ownerName, @ownershipType,
      @orcrImage, @orImage, @hrs5, @hrs12, @hrs24, @exceedHour, @createdAt
    )`,
)

const getRentalRows = db.prepare('SELECT * FROM rentals ORDER BY createdAt DESC')
const deleteRentalsStmt = db.prepare('DELETE FROM rentals')
const insertRentalStmt = db.prepare(
  `INSERT INTO rentals (
      id, vehicleId, vehicle, personal, rental, photo, licensePhoto, signature, carPhotos,
      termsAccepted, rentalLifecycle, startedAt, completedAt, encodedAt, createdAt
    ) VALUES (
      @id, @vehicleId, @vehicle, @personal, @rental, @photo, @licensePhoto, @signature, @carPhotos,
      @termsAccepted, @rentalLifecycle, @startedAt, @completedAt, @encodedAt, @createdAt
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
    encodedAt: rental.encodedAt ?? fallbackNow,
    createdAt: rental.createdAt ?? fallbackNow,
  }
}

function addRental(rental) {
  const now = new Date().toISOString()
  const entry = toRentalRow(rental, now)
  insertRentalStmt.run(entry)
  return mapRental(entry)
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

export { getVehicles, replaceVehicles, getRentals, addRental, replaceRentals, deleteVehicle }
