import { safeSetItem } from './storage'
import { formatPhMobile } from './phone'

const STORE_KEY = 'alatas-customers'

export function loadCustomers() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.customers)
      ? parsed.customers
      : Array.isArray(parsed)
        ? parsed
        : []
  } catch {
    return []
  }
}

function saveCustomers(list) {
  safeSetItem(STORE_KEY, JSON.stringify({ customers: list }))
  return list
}

export function customerContactKey(contactNo = '') {
  return String(contactNo || '').replace(/\D/g, '')
}

function isCompleteContactKey(key = '') {
  // Normalized PH mobile: 639XXXXXXXXX
  return /^639\d{9}$/.test(String(key || ''))
}

function normalizeNameParts(person = {}) {
  return [person.firstName, person.middleName, person.lastName]
    .map((p) => String(p || '').trim().toUpperCase().replace(/\s+/g, ' '))
    .filter(Boolean)
}

export function normalizePersonName(person = {}) {
  return normalizeNameParts(person).join(' ')
}

function normalizeShortName(person = {}) {
  return [person.firstName, person.lastName]
    .map((p) => String(p || '').trim().toUpperCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' ')
}

export function customerDisplayName(c) {
  return [c?.firstName, c?.middleName, c?.lastName].filter(Boolean).join(' ').trim() || 'Customer'
}

/** Stable owner key: complete phone wins, otherwise full/short name. */
export function customerOwnerKey(person = {}) {
  const tel = customerContactKey(formatPhMobile(person.contactNo || ''))
  if (isCompleteContactKey(tel)) return `tel:${tel}`
  const full = normalizePersonName(person)
  if (full) return `name:${full}`
  const short = normalizeShortName(person)
  return short ? `name:${short}` : ''
}

/** Same inclusion rules as vehicle report income rows (minus cancelled). */
export function isCountableCustomerRental(rental) {
  const approval = String(rental?.approvalStatus || 'accepted').toLowerCase()
  if (approval === 'pending' || approval === 'rejected') return false
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'pending_approval' || life === 'cancelled') return false
  return true
}

function namesMatch(a, b) {
  const aFull = normalizePersonName(a)
  const bFull = normalizePersonName(b)
  if (aFull && bFull && aFull === bFull) return true
  const aShort = normalizeShortName(a)
  const bShort = normalizeShortName(b)
  if (aShort && bShort && aShort === bShort) return true
  // full vs short (middle name present on only one side)
  if (aFull && bShort && aFull === bShort) return true
  if (bFull && aShort && bFull === aShort) return true
  return false
}

/**
 * Exclusive ownership: complete phone on the rental always wins.
 * Name matching is only used when the rental has no complete phone.
 */
export function rentalBelongsToCustomer(rental, customer) {
  if (!rental || !customer) return false
  const p = rental.personal || {}
  const rTel = customerContactKey(formatPhMobile(p.contactNo || ''))
  const cTel = customerContactKey(formatPhMobile(customer.contactNo || ''))
  const rTelOk = isCompleteContactKey(rTel)
  const cTelOk = isCompleteContactKey(cTel)

  if (rTelOk) return cTelOk && rTel === cTel
  return namesMatch(p, customer)
}

export function countCustomerRentals(rentals = [], customer) {
  if (!customer) return 0
  return (Array.isArray(rentals) ? rentals : []).filter(
    (r) => isCountableCustomerRental(r) && rentalBelongsToCustomer(r, customer),
  ).length
}

function resolveRentalOwnerKey(rental, customersByKey) {
  const p = rental?.personal || {}
  const direct = customerOwnerKey(p)
  if (!direct) return ''

  // Name-only rental → attach to an existing customer with same name + phone.
  if (direct.startsWith('name:')) {
    for (const row of customersByKey.values()) {
      if (!isCompleteContactKey(customerContactKey(formatPhMobile(row.contactNo || '')))) {
        continue
      }
      if (namesMatch(p, row)) return customerOwnerKey(row)
    }
  }
  return direct
}

export function upsertCustomerFromPersonal(personal = {}) {
  const contactNo = formatPhMobile(personal.contactNo || '')
  const key = customerContactKey(contactNo)
  const ownerKey = customerOwnerKey({ ...personal, contactNo })
  if (!ownerKey) return null
  if (ownerKey.startsWith('tel:') && !isCompleteContactKey(key)) return null

  const prev = loadCustomers()
  const existing =
    prev.find((c) => customerOwnerKey(c) === ownerKey) ||
    (isCompleteContactKey(key)
      ? prev.find((c) => customerContactKey(c.contactNo) === key)
      : null)
  const now = new Date().toISOString()
  const nextRow = {
    id: existing?.id || `cust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    firstName: String(personal.firstName || '').trim(),
    middleName: String(personal.middleName || '').trim(),
    lastName: String(personal.lastName || '').trim(),
    address: String(personal.address || '').trim(),
    contactNo,
    emergencyName: String(personal.emergencyName || '').trim(),
    emergencyRelation: String(personal.emergencyRelation || '').trim(),
    emergencyRelationOther: String(personal.emergencyRelationOther || '').trim(),
    emergencyPhone: formatPhMobile(personal.emergencyPhone || ''),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    // Count is owned by sync / live recount — do not increment here.
    rentalCount: existing?.rentalCount || 0,
  }

  const next = [
    nextRow,
    ...prev.filter((c) => {
      if (existing && String(c.id) === String(existing.id)) return false
      if (ownerKey && customerOwnerKey(c) === ownerKey) return false
      if (isCompleteContactKey(key) && customerContactKey(c.contactNo) === key) return false
      return true
    }),
  ]
  saveCustomers(next)
  return nextRow
}

export function updateCustomer(id, patch) {
  const prev = loadCustomers()
  const next = prev.map((c) =>
    String(c.id) === String(id)
      ? {
          ...c,
          ...patch,
          contactNo: patch.contactNo != null ? formatPhMobile(patch.contactNo) : c.contactNo,
          emergencyPhone:
            patch.emergencyPhone != null
              ? formatPhMobile(patch.emergencyPhone)
              : c.emergencyPhone,
          updatedAt: new Date().toISOString(),
        }
      : c,
  )
  saveCustomers(next)
  return next.find((c) => String(c.id) === String(id)) || null
}

export function deleteCustomer(id) {
  const next = loadCustomers().filter((c) => String(c.id) !== String(id))
  saveCustomers(next)
  return next
}

export function findCustomerByContact(contactNo) {
  const key = customerContactKey(formatPhMobile(contactNo))
  if (!isCompleteContactKey(key)) return null
  return (
    loadCustomers().find((c) => customerContactKey(formatPhMobile(c.contactNo)) === key) || null
  )
}

/** Seed / refresh customers from rental history; recount per owner key. */
export function syncCustomersFromRentals(rentals = []) {
  const prev = loadCustomers()
  const byKey = new Map()

  for (const c of prev) {
    const key = customerOwnerKey(c)
    if (!key) continue
    // Prefer keeping the richer / older profile when colliding.
    if (!byKey.has(key)) byKey.set(key, { ...c })
  }

  const counts = new Map()

  for (const r of Array.isArray(rentals) ? rentals : []) {
    if (!isCountableCustomerRental(r)) continue
    const p = r?.personal || {}
    const key = resolveRentalOwnerKey(r, byKey)
    if (!key) continue

    counts.set(key, (counts.get(key) || 0) + 1)

    const contactNo = formatPhMobile(p.contactNo || '')
    const existing = byKey.get(key)
    const stamp = r.encodedAt || r.createdAt || new Date().toISOString()

    if (!existing) {
      byKey.set(key, {
        id: `cust_${key.replace(/\W/g, '').slice(-10)}_${Math.random().toString(36).slice(2, 5)}`,
        firstName: String(p.firstName || '').trim(),
        middleName: String(p.middleName || '').trim(),
        lastName: String(p.lastName || '').trim(),
        address: String(p.address || '').trim(),
        contactNo,
        emergencyName: String(p.emergencyName || '').trim(),
        emergencyRelation: String(p.emergencyRelation || '').trim(),
        emergencyRelationOther: String(p.emergencyRelationOther || '').trim(),
        emergencyPhone: formatPhMobile(p.emergencyPhone || ''),
        createdAt: stamp,
        updatedAt: stamp,
        rentalCount: 0,
      })
    } else {
      byKey.set(key, {
        ...existing,
        firstName: existing.firstName || String(p.firstName || '').trim(),
        middleName: existing.middleName || String(p.middleName || '').trim(),
        lastName: existing.lastName || String(p.lastName || '').trim(),
        address: existing.address || String(p.address || '').trim(),
        contactNo:
          isCompleteContactKey(customerContactKey(existing.contactNo))
            ? existing.contactNo
            : contactNo || existing.contactNo,
        emergencyName: existing.emergencyName || String(p.emergencyName || '').trim(),
        emergencyRelation:
          existing.emergencyRelation || String(p.emergencyRelation || '').trim(),
        emergencyRelationOther:
          existing.emergencyRelationOther || String(p.emergencyRelationOther || '').trim(),
        emergencyPhone: existing.emergencyPhone || formatPhMobile(p.emergencyPhone || ''),
        updatedAt: stamp,
      })
    }
  }

  for (const [key, row] of byKey) {
    row.rentalCount = counts.get(key) || 0
  }

  const list = Array.from(byKey.values()).sort((a, b) =>
    customerDisplayName(a).localeCompare(customerDisplayName(b)),
  )
  saveCustomers(list)
  return list
}
