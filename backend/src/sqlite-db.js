import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqliteDir = path.join(__dirname, '..', 'sqlite')
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

function createDb() {
  ensureSqliteDir()
  const db = new Database(sqlitePath, { verbose: null })
  db.pragma('journal_mode = WAL')
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
      rentalLifecycle TEXT,
      startedAt TEXT,
      completedAt TEXT,
      encodedAt TEXT,
      createdAt TEXT
    );
  `)

  ensureEncodedAtColumn(db)
  return db
}

function ensureEncodedAtColumn(db) {
  const info = db.prepare("PRAGMA table_info('rentals')").all()
  const hasEncodedAt = info.some((col) => col.name === 'encodedAt')
  if (!hasEncodedAt) {
    db.prepare('ALTER TABLE rentals ADD COLUMN encodedAt TEXT').run()
  }
}

const db = createDb()

const getVehicleRows = db.prepare('SELECT * FROM vehicles ORDER BY createdAt DESC')
const deleteVehiclesStmt = db.prepare('DELETE FROM vehicles')
const insertVehicleStmt = db.prepare(
  `INSERT INTO vehicles (
      id, make, series, bodyType, seats, transmission, plateNo,
      engineNo, chassisNo, status, image, hrs5, hrs12, hrs24, exceedHour, createdAt
    ) VALUES (
      @id, @make, @series, @bodyType, @seats, @transmission, @plateNo,
      @engineNo, @chassisNo, @status, @image, @hrs5, @hrs12, @hrs24, @exceedHour, @createdAt
    )`,
)

const getRentalRows = db.prepare('SELECT * FROM rentals ORDER BY createdAt DESC')
const deleteRentalsStmt = db.prepare('DELETE FROM rentals')
const insertRentalStmt = db.prepare(
  `INSERT INTO rentals (
      id, vehicleId, vehicle, personal, rental, photo,
      rentalLifecycle, startedAt, completedAt, encodedAt, createdAt
    ) VALUES (
      @id, @vehicleId, @vehicle, @personal, @rental, @photo,
      @rentalLifecycle, @startedAt, @completedAt, @encodedAt, @createdAt
    )`,
)

const deleteVehicleStmt = db.prepare('DELETE FROM vehicles WHERE id = ?')
const deleteRentalsByVehicleIdStmt = db.prepare('DELETE FROM rentals WHERE vehicleId = ?')

function deleteVehicle(id) {
  deleteVehicleStmt.run(String(id))
  deleteRentalsByVehicleIdStmt.run(String(id))
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
    rates: {
      hrs5: row.hrs5,
      hrs12: row.hrs12,
      hrs24: row.hrs24,
      exceedHour: row.exceedHour,
    },
  }
}

function getVehicles() {
  return getVehicleRows.all().map(mapVehicle)
}

function replaceVehicles(vehicles) {
  const items = Array.isArray(vehicles) ? vehicles : []
  const now = new Date().toISOString()

  return db.transaction(() => {
    deleteVehiclesStmt.run()

    for (const vehicle of items) {
      insertVehicleStmt.run({
        id: String(vehicle.id || ''),
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
        hrs5: vehicle.rates?.hrs5 == null ? null : Number(vehicle.rates.hrs5),
        hrs12: vehicle.rates?.hrs12 == null ? null : Number(vehicle.rates.hrs12),
        hrs24: vehicle.rates?.hrs24 == null ? null : Number(vehicle.rates.hrs24),
        exceedHour: vehicle.rates?.exceedHour == null ? null : Number(vehicle.rates.exceedHour),
        createdAt: now,
      })
    }
  })(), getVehicles()
}

function getRentals() {
  return getRentalRows.all().map((row) => ({
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: parseJson(row.vehicle),
    personal: parseJson(row.personal),
    rental: parseJson(row.rental),
    photo: row.photo,
    rentalLifecycle: row.rentalLifecycle,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    encodedAt: row.encodedAt,
    createdAt: row.createdAt,
  }))
}

function addRental(rental) {
  const entry = {
    id: String(rental.id || `r-${Date.now()}`),
    vehicleId: rental.vehicle?.id ?? null,
    vehicle: serializeJson(rental.vehicle),
    personal: serializeJson(rental.personal),
    rental: serializeJson(rental.rental),
    photo: rental.photo ?? null,
    rentalLifecycle: rental.rentalLifecycle ?? null,
    startedAt: rental.startedAt ?? null,
    completedAt: rental.completedAt ?? null,
    encodedAt: rental.encodedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  insertRentalStmt.run(entry)
  return {
    ...entry,
    vehicle: parseJson(entry.vehicle),
    personal: parseJson(entry.personal),
    rental: parseJson(entry.rental),
  }
}

function replaceRentals(rentals) {
  const items = Array.isArray(rentals) ? rentals : []
  const now = new Date().toISOString()

  return db.transaction(() => {
    deleteRentalsStmt.run()

    for (const rental of items) {
      insertRentalStmt.run({
        id: String(rental.id || `r-${Date.now()}`),
        vehicleId: rental.vehicle?.id ?? null,
        vehicle: serializeJson(rental.vehicle),
        personal: serializeJson(rental.personal),
        rental: serializeJson(rental.rental),
        photo: rental.photo ?? null,
        rentalLifecycle: rental.rentalLifecycle ?? null,
        startedAt: rental.startedAt ?? null,
        completedAt: rental.completedAt ?? null,
        encodedAt: rental.encodedAt ?? now,
        createdAt: now,
      })
    }
  })(), getRentals()
}

export { getVehicles, replaceVehicles, getRentals, addRental, replaceRentals, deleteVehicle }
