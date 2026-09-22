import { safeSetItem } from './storage'
import { formatPhMobile } from './phone'

const STORE_KEY = 'alatas-customers'

function emptyStore() {
  return { customers: [] }
}

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

export function customerDisplayName(c) {
  return [c?.firstName, c?.middleName, c?.lastName].filter(Boolean).join(' ').trim() || 'Customer'
}

export function upsertCustomerFromPersonal(personal = {}) {
  const contactNo = formatPhMobile(personal.contactNo || '')
  const key = customerContactKey(contactNo)
  if (!key || key.length < 10) return null

  const prev = loadCustomers()
  const existing = prev.find((c) => customerContactKey(c.contactNo) === key)
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
    rentalCount: (existing?.rentalCount || 0) + 1,
  }

  const next = [nextRow, ...prev.filter((c) => customerContactKey(c.contactNo) !== key)]
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
  const key = customerContactKey(contactNo)
  if (!key) return null
  return loadCustomers().find((c) => customerContactKey(c.contactNo) === key) || null
}

/** Seed / refresh customers from rental history without double-counting. */
export function syncCustomersFromRentals(rentals = []) {
  const prev = loadCustomers()
  const byContact = new Map(prev.map((c) => [customerContactKey(c.contactNo), { ...c }]))
  const counts = new Map()

  for (const r of Array.isArray(rentals) ? rentals : []) {
    const p = r?.personal || {}
    const contactNo = formatPhMobile(p.contactNo || '')
    const key = customerContactKey(contactNo)
    if (!key || key.length < 10) continue
    counts.set(key, (counts.get(key) || 0) + 1)

    const existing = byContact.get(key)
    const stamp = r.encodedAt || r.createdAt || new Date().toISOString()
    if (!existing) {
      byContact.set(key, {
        id: `cust_${key.slice(-8)}_${Math.random().toString(36).slice(2, 5)}`,
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
        rentalCount: 1,
      })
    } else {
      byContact.set(key, {
        ...existing,
        firstName: existing.firstName || String(p.firstName || '').trim(),
        middleName: existing.middleName || String(p.middleName || '').trim(),
        lastName: existing.lastName || String(p.lastName || '').trim(),
        address: existing.address || String(p.address || '').trim(),
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

  for (const [key, row] of byContact) {
    if (counts.has(key)) row.rentalCount = counts.get(key)
  }

  const list = Array.from(byContact.values()).sort((a, b) =>
    customerDisplayName(a).localeCompare(customerDisplayName(b)),
  )
  saveCustomers(list)
  return list
}
