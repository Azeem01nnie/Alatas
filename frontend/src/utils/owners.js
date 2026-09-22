import { safeSetItem } from './storage'
import { isSupabaseConfigured } from '../api/supabaseClient'

const OWNERS_KEY = 'alatas-owners'

function autoCapitalizeWords(value) {
  return String(value ?? '').toUpperCase()
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
  if (isSupabaseConfigured) {
    void import('../api/backend')
      .then(({ saveOwnersRemote }) => saveOwnersRemote(owners))
      .catch((err) => console.warn('Could not sync owners to cloud', err))
  }
  return owners
}

/** Merge remote + local owners by id (and by name when ids differ). */
export function mergeOwnerLists(localList = [], remoteList = []) {
  const byId = new Map()
  const byName = new Map()

  const upsert = (o) => {
    if (!o || typeof o !== 'object') return
    const id = String(o.id || '').trim()
    const name = autoCapitalizeWords(String(o.name || '').trim())
    if (!id || !name) return
    const next = {
      id,
      name,
      ownershipType: o.ownershipType === 'thirdParty' ? 'thirdParty' : 'company',
      createdAt: o.createdAt || new Date().toISOString(),
    }
    const existingByName = byName.get(name.toLowerCase())
    if (existingByName && existingByName.id !== id) {
      // Prefer the first id we saw; keep latest name/type
      byId.set(existingByName.id, {
        ...existingByName,
        name,
        ownershipType: next.ownershipType,
      })
      return
    }
    byId.set(id, next)
    byName.set(name.toLowerCase(), next)
  }

  ;(Array.isArray(localList) ? localList : []).forEach(upsert)
  ;(Array.isArray(remoteList) ? remoteList : []).forEach(upsert)
  return Array.from(byId.values()).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || '')),
  )
}

/** Pull owners from Supabase and merge into localStorage. */
export async function pullOwnersFromCloud() {
  if (!isSupabaseConfigured) return loadOwners()
  try {
    const { fetchOwnersRemote } = await import('../api/backend')
    const remote = await fetchOwnersRemote()
    const merged = mergeOwnerLists(loadOwners(), remote)
    safeSetItem(OWNERS_KEY, JSON.stringify(merged))
    return merged
  } catch (err) {
    console.warn('Could not pull owners from cloud', err)
    return loadOwners()
  }
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
 * Upsert owners from fleet vehicles so the Manage Vehicle dropdown matches
 * Vehicle Reports (which derives owners from vehicle ownerId/ownerName).
 */
export function syncOwnersFromVehicles(vehicles = []) {
  let owners = loadOwners()
  let changed = false

  for (const v of vehicles) {
    const name = autoCapitalizeWords(String(v?.ownerName || '').trim())
    if (!name) continue
    const ownershipType = v?.ownershipType === 'thirdParty' ? 'thirdParty' : 'company'
    const id = String(v?.ownerId || '').trim()

    if (id) {
      const byId = owners.find((o) => o.id === id)
      if (byId) {
        if (
          byId.name.toLowerCase() !== name.toLowerCase() ||
          byId.ownershipType !== ownershipType
        ) {
          owners = owners.map((o) =>
            o.id === id ? { ...o, name, ownershipType } : o,
          )
          changed = true
        }
        continue
      }
      const byName = owners.find((o) => o.name.toLowerCase() === name.toLowerCase())
      if (byName) {
        // Prefer the vehicle's ownerId so dropdown value matches saved vehicles.
        owners = owners.map((o) =>
          o.id === byName.id ? { ...o, id, name, ownershipType } : o,
        )
        changed = true
        continue
      }
      owners = [
        ...owners,
        {
          id,
          name,
          ownershipType,
          createdAt: new Date().toISOString(),
        },
      ]
      changed = true
      continue
    }

    if (!owners.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      owners = [
        ...owners,
        {
          id: `own_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          ownershipType,
          createdAt: new Date().toISOString(),
        },
      ]
      changed = true
    }
  }

  if (changed) saveOwners(owners)
  return owners
}

/**
 * Keep owners referenced by vehicle ownerId, owner name, or draft form ids.
 * Clears true orphans (e.g. abandoned Add Owner / OCR junk).
 */
export function purgeOrphanOwners({
  ownerIds = [],
  ownerNames = [],
} = {}) {
  const keepIds = new Set(
    (ownerIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  )
  const keepNames = new Set(
    (ownerNames || [])
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const owners = loadOwners()
  const next = owners.filter(
    (o) => keepIds.has(o.id) || keepNames.has(String(o.name || '').trim().toLowerCase()),
  )
  if (next.length !== owners.length) saveOwners(next)
  return next
}

export { autoCapitalizeWords }
