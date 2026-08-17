import { safeSetItem } from './storage'

const OWNERS_KEY = 'alatas-owners'

function autoCapitalizeWords(value) {
  return String(value ?? '').replace(/\b([a-z])/g, (match) => match.toUpperCase())
}

export function loadOwners() {
  try {
    const raw = localStorage.getItem(OWNERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOwners(owners) {
  safeSetItem(OWNERS_KEY, JSON.stringify(owners))
  return owners
}

export function addOwner({ name, ownershipType = 'company' }) {
  const trimmed = autoCapitalizeWords(String(name || '').trim())
  if (!trimmed) throw new Error('Owner name is required')

  const owners = loadOwners()
  const existing = owners.find(
    (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (existing) return existing

  const owner = {
    id: `own_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    ownershipType: ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
    createdAt: new Date().toISOString(),
  }
  const next = [...owners, owner]
  saveOwners(next)
  return owner
}

export function updateOwner(id, patch) {
  const owners = loadOwners()
  const next = owners.map((o) => {
    if (o.id !== id) return o
    return {
      ...o,
      ...patch,
      name: patch.name != null ? autoCapitalizeWords(String(patch.name).trim()) : o.name,
      ownershipType:
        patch.ownershipType === 'thirdParty'
          ? 'thirdParty'
          : patch.ownershipType === 'company'
            ? 'company'
            : o.ownershipType,
    }
  })
  saveOwners(next)
  return next.find((o) => o.id === id) || null
}

export function getOwnerById(id) {
  return loadOwners().find((o) => o.id === id) || null
}

export function removeOwner(id) {
  const next = loadOwners().filter((o) => o.id !== id)
  saveOwners(next)
  return next
}

/**
 * Keep only owners that are still referenced by at least one vehicle.
 * Clears OCR junk folders that were created without saving a vehicle.
 */
export function purgeOrphanOwners(vehicleOwnerIds = []) {
  const keep = new Set(
    (vehicleOwnerIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  )
  const owners = loadOwners()
  const next = owners.filter((o) => keep.has(o.id))
  if (next.length !== owners.length) saveOwners(next)
  return next
}

export { autoCapitalizeWords }
