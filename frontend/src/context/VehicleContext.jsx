import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadVehicles, saveVehicles, deleteVehicle as deleteVehicleApi } from '../data/backendVehicles'
import {
  loadRentals,
  saveRentals,
  addRental as addRentalApi,
  submitPendingRental as submitPendingRentalApi,
  patchRentalCarPhotos as patchRentalCarPhotosApi,
} from '../data/backendRentals'
import { getArchivedIdSet, ARCHIVE_EVENT } from '../utils/archivedVehicles'
import { isScheduledWindow } from '../utils/vehicleDisplayStatus'
import { flushOfflineQueue } from '../utils/offlineQueue'
import {
  replaceVehicles as apiReplaceVehicles,
  replaceRentals as apiReplaceRentals,
  addRental as apiAddRental,
  completeVehicleRental as completeVehicleRentalApi,
} from '../api/backend'

const VehicleContext = createContext(null)

function normalizeRental(r) {
  let approvalStatus = r.approvalStatus || null
  let rentalLifecycle = r.rentalLifecycle || null

  // Reconcile inconsistent rows so rejected/accepted never stay in the pending queue.
  if (approvalStatus === 'rejected' || rentalLifecycle === 'cancelled') {
    approvalStatus = 'rejected'
    rentalLifecycle = 'cancelled'
  } else if (approvalStatus === 'pending' || rentalLifecycle === 'pending_approval') {
    approvalStatus = 'pending'
    rentalLifecycle = 'pending_approval'
  } else if (!approvalStatus) {
    approvalStatus = 'accepted'
  }

  const base = { ...r, approvalStatus, rentalLifecycle: rentalLifecycle || undefined }
  if (base.rentalLifecycle) return base
  if (approvalStatus === 'pending') {
    return { ...base, rentalLifecycle: 'pending_approval' }
  }
  if (approvalStatus === 'rejected') {
    return { ...base, rentalLifecycle: 'cancelled' }
  }
  return { ...base, rentalLifecycle: 'completed' }
}

function isActiveBooking(rental) {
  if (rental.approvalStatus === 'pending' || rental.approvalStatus === 'rejected') return false
  if (rental.rentalLifecycle === 'pending_approval' || rental.rentalLifecycle === 'rejected') {
    return false
  }
  return rental.rentalLifecycle === 'active' || rental.rentalLifecycle === 'scheduled'
}

function isDue(periodFrom) {
  if (!periodFrom) return false
  const start = new Date(periodFrom).getTime()
  return !Number.isNaN(start) && start <= Date.now()
}

export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([])
  const [rentals, setRentals] = useState([])
  const [tick, setTick] = useState(0)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const hasLoaded = useRef(false)
  const skipRentalAutosave = useRef(false)
  const skipVehicleAutosave = useRef(false)
  const rentalsRef = useRef(rentals)
  const rentalSaveGen = useRef(0)
  rentalsRef.current = rentals

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onArchive = () => setTick((t) => t + 1)
    window.addEventListener(ARCHIVE_EVENT, onArchive)
    return () => window.removeEventListener(ARCHIVE_EVENT, onArchive)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadInitialData() {
      try {
        await flushOfflineQueue({
          vehicles: (payload) => apiReplaceVehicles(payload, { prune: false }),
          rentals: (payload) => apiReplaceRentals(payload, { prune: false }),
          'rentals-add': (payload) => apiAddRental(payload),
          'pending-rental': (payload) => submitPendingRentalApi(payload),
        })

        const [vehiclesData, rentalsData] = await Promise.all([
          loadVehicles(),
          loadRentals(),
        ])

        if (!mounted) return
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
        setRentals(
          Array.isArray(rentalsData)
            ? rentalsData.map(normalizeRental)
            : [],
        )
        hasLoaded.current = true
        setLoadError(null)
      } catch (err) {
        console.warn('Initial data load failed', err)
        if (mounted) {
          setLoadError(err?.message || 'Could not load fleet data from the server.')
          // Do not mark hasLoaded — empty state must not autosave and wipe SQLite
        }
      } finally {
        if (mounted) setReady(true)
      }
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!hasLoaded.current) return
    if (skipVehicleAutosave.current) {
      skipVehicleAutosave.current = false
      return
    }
    saveVehicles(vehicles).catch((err) => {
      console.warn('Vehicle save failed', err)
    })
  }, [vehicles])

  useEffect(() => {
    if (!hasLoaded.current) return
    if (skipRentalAutosave.current) {
      skipRentalAutosave.current = false
      return
    }
    const gen = ++rentalSaveGen.current
    const timer = window.setTimeout(() => {
      if (gen !== rentalSaveGen.current) return
      saveRentals(rentalsRef.current).catch((err) => {
        console.warn('Rental save failed', err)
      })
    }, 750)
    return () => window.clearTimeout(timer)
  }, [rentals])

  const reloadData = useCallback(async () => {
    const [vehiclesData, rentalsData] = await Promise.all([loadVehicles(), loadRentals()])
    const nextVehicles = Array.isArray(vehiclesData) ? vehiclesData : []
    const nextRentals = Array.isArray(rentalsData)
      ? rentalsData.map(normalizeRental)
      : []
    skipRentalAutosave.current = true
    setVehicles(nextVehicles)
    setRentals(nextRentals)
    hasLoaded.current = true
    setLoadError(null)
    return {
      vehicles: nextVehicles,
      rentals: nextRentals,
    }
  }, [])

  // Refresh rentals for mobile approvals — do not replace vehicles here (avoids
  // overwriting a desk photo edit with a stale cloud/local snapshot mid-save).
  useEffect(() => {
    if (!ready) return undefined
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const rentalsData = await loadRentals()
        if (cancelled) return
        const nextRentals = Array.isArray(rentalsData)
          ? rentalsData.map(normalizeRental)
          : []
        setRentals((prev) => {
          const byId = new Map(nextRentals.map((row) => [String(row.id), row]))
          let changed = false
          const merged = []
          const seen = new Set()

          for (const a of prev) {
            const key = String(a.id)
            seen.add(key)
            const b = byId.get(key)
            if (!b) {
              // Dropped on server (or filtered) — keep local until explicit reload.
              merged.push(a)
              continue
            }
            const aTs = Date.parse(a.updatedAt || '') || 0
            const bTs = Date.parse(b.updatedAt || '') || 0
            if (aTs > bTs) {
              merged.push(a)
              continue
            }
            if (
              aTs < bTs ||
              String(a.approvalStatus || '') !== String(b.approvalStatus || '') ||
              String(a.rentalLifecycle || '') !== String(b.rentalLifecycle || '') ||
              String(a.carPhotosAddedBy || '') !== String(b.carPhotosAddedBy || '')
            ) {
              changed = true
              merged.push(b)
            } else {
              merged.push(a)
            }
          }

          for (const b of nextRentals) {
            const key = String(b.id)
            if (seen.has(key)) continue
            changed = true
            merged.push(b)
          }

          if (!changed && merged.length === prev.length) return prev
          skipRentalAutosave.current = true
          return merged
        })
      } catch (err) {
        console.warn('Periodic rental refresh failed', err)
      }
    }, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ready])

  const replaceAllData = useCallback(async ({ vehicles: nextVehicles, rentals: nextRentals }) => {
    const vehiclesPayload = Array.isArray(nextVehicles) ? nextVehicles : []
    const rentalsPayload = Array.isArray(nextRentals)
      ? nextRentals.map(normalizeRental)
      : []

    const savedVehicles = await saveVehicles(vehiclesPayload, { prune: true })
    const savedRentals = await saveRentals(rentalsPayload, { prune: true })
    if (!savedVehicles || !savedRentals) {
      throw new Error('Could not save imported data to the backend.')
    }

    skipVehicleAutosave.current = true
    skipRentalAutosave.current = true
    setVehicles(vehiclesPayload)
    setRentals(rentalsPayload)
    hasLoaded.current = true
    return { vehicles: vehiclesPayload, rentals: rentalsPayload }
  }, [])

  /** Reset in-memory fleet after an admin Clear data wipe (no immediate re-upload). */
  const wipeLocalFleet = useCallback(() => {
    skipVehicleAutosave.current = true
    skipRentalAutosave.current = true
    rentalSaveGen.current += 1
    setVehicles([])
    setRentals([])
    hasLoaded.current = true
  }, [])

  const updateVehicleStatus = useCallback((id, status) => {
    if (!id) return
    const key = String(id)
    setVehicles((prev) =>
      prev.map((v) => (String(v.id) === key ? { ...v, status } : v)),
    )
  }, [])

  const completeRentalForVehicle = useCallback(async (vehicleId) => {
    if (!vehicleId) return
    const key = String(vehicleId)
    const now = new Date().toISOString()

    // Optimistic UI update
    skipVehicleAutosave.current = true
    skipRentalAutosave.current = true
    rentalSaveGen.current += 1
    setVehicles((prev) =>
      prev.map((v) => (String(v.id) === key ? { ...v, status: 'Available' } : v)),
    )
    setRentals((prev) =>
      prev.map((r) => {
        const rid = String(r.vehicleId || r.vehicle?.id || '')
        if (rid !== key || r.rentalLifecycle !== 'active') return r
        return {
          ...r,
          rentalLifecycle: 'completed',
          completedAt: now,
          updatedAt: now,
        }
      }),
    )

    try {
      await completeVehicleRentalApi(key)
    } catch (err) {
      console.warn('Complete rental API failed; local state updated', err)
    }
  }, [])

  const cancelScheduledRental = useCallback((rentalId) => {
    if (!rentalId) return
    const key = String(rentalId)
    const now = new Date().toISOString()
    setRentals((prev) =>
      prev.map((r) => {
        if (String(r.id) !== key) return r
        // Allow cancel for scheduled (and stuck pending that was accepted into schedule)
        if (
          r.rentalLifecycle !== 'scheduled' &&
          r.rentalLifecycle !== 'pending_approval' &&
          r.approvalStatus !== 'pending'
        ) {
          return r
        }
        return {
          ...r,
          rentalLifecycle: 'cancelled',
          approvalStatus:
            r.approvalStatus === 'pending' ? 'rejected' : r.approvalStatus || 'accepted',
          cancelledAt: now,
          updatedAt: now,
        }
      }),
    )
  }, [])

  const updateRentalCarPhotos = useCallback(async (rentalId, carPhotos, addedBy = '') => {
    if (!rentalId) return null
    const key = String(rentalId)
    const addedByName = String(addedBy || '').trim()
    const nextPhotos =
      carPhotos && typeof carPhotos === 'object' && !Array.isArray(carPhotos) ? carPhotos : {}

    // Invalidate any in-flight full rental autosave before/while patching photos.
    rentalSaveGen.current += 1
    skipRentalAutosave.current = true

    const saved = await patchRentalCarPhotosApi(key, nextPhotos, addedByName)
    const normalized = saved ? normalizeRental(saved) : null

    skipRentalAutosave.current = true
    rentalSaveGen.current += 1
    setRentals((prev) => {
      const exists = prev.some((r) => String(r.id) === key)
      if (!exists && normalized) return [normalized, ...prev]
      return prev.map((r) => (String(r.id) === key ? { ...r, ...normalized } : r))
    })

    return normalized
  }, [])

  useEffect(() => {
    const activateDueRentals = () => {
      const now = Date.now()
      let vehicleIds = []

      setRentals((prev) => {
        const due = prev.filter((r) => {
          if (r.rentalLifecycle !== 'scheduled') return false
          if (r.approvalStatus === 'pending' || r.approvalStatus === 'rejected') return false
          const start = r.rental?.periodFrom
            ? new Date(r.rental.periodFrom).getTime()
            : NaN
          return !Number.isNaN(start) && start <= now
        })
        if (!due.length) return prev

        vehicleIds = due.map((r) => r.vehicle?.id).filter(Boolean)
        const dueIds = new Set(due.map((r) => r.id))
        return prev.map((r) =>
          dueIds.has(r.id)
            ? {
                ...r,
                rentalLifecycle: 'active',
                startedAt: new Date().toISOString(),
                autoStarted: true,
              }
            : r,
        )
      })

      if (vehicleIds.length) {
        const dueVehicleKeys = new Set(vehicleIds.map((id) => String(id)))
        setTimeout(() => {
          setVehicles((vehiclesPrev) =>
            vehiclesPrev.map((v) =>
              dueVehicleKeys.has(String(v.id)) ? { ...v, status: 'Rented' } : v,
            ),
          )
        }, 0)
      }
    }

    activateDueRentals()
    const timer = setInterval(activateDueRentals, 15_000)
    return () => clearInterval(timer)
  }, [])

  const addVehicle = (vehicle) => {
    const now = new Date().toISOString()
    const entry = {
      ...vehicle,
      status: vehicle.status || 'Available',
      id: `v-${Date.now()}`,
      createdAt: vehicle.createdAt || now,
      updatedAt: now,
    }
    setVehicles((prev) => [...prev, entry])
    return entry
  }

  const updateVehicle = (id, data) => {
    const now = new Date().toISOString()
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, ...data, id: v.id, updatedAt: now } : v,
      ),
    )
  }

  const removeVehicle = useCallback(async (id) => {
    if (!id) return null

    const result = await deleteVehicleApi(id)
    if (!result || !result.ok) return null

    if (Array.isArray(result.vehicles)) {
      setVehicles(result.vehicles)
    } else {
      setVehicles((prev) => prev.filter((v) => v.id !== id))
    }
    // Keep rental history for audits — do not strip rentals on vehicle delete
    return result
  }, [])

  const addRental = async (record) => {
    const autoApprove = Boolean(record?.autoApprove)
    const entry = {
      ...record,
      id: `r-${Date.now()}`,
      source: record.source || 'desktop',
      approvalStatus: autoApprove ? 'accepted' : 'pending',
      rentalLifecycle: autoApprove
        ? (() => {
            const start = record?.rental?.periodFrom
              ? new Date(record.rental.periodFrom).getTime()
              : NaN
            return !Number.isNaN(start) && start > Date.now() ? 'scheduled' : 'active'
          })()
        : 'pending_approval',
      startedAt:
        autoApprove &&
        (() => {
          const start = record?.rental?.periodFrom
            ? new Date(record.rental.periodFrom).getTime()
            : NaN
          return Number.isNaN(start) || start <= Date.now() ? new Date().toISOString() : null
        })(),
      autoApprove: undefined,
    }

    if (autoApprove) {
      const created = await addRentalApi(entry)
      if (!created?.id) {
        setRentals((prev) => [entry, ...prev])
        if (entry.rentalLifecycle === 'active' && entry.vehicle?.id) {
          setVehicles((prev) =>
            prev.map((v) =>
              String(v.id) === String(entry.vehicle.id) ? { ...v, status: 'Rented' } : v,
            ),
          )
        }
        return entry
      }
      setRentals((prev) => [normalizeRental(created), ...prev.filter((r) => String(r.id) !== String(created.id))])
      if (created.rentalLifecycle === 'active' && (created.vehicleId || created.vehicle?.id)) {
        const vid = created.vehicleId || created.vehicle?.id
        setVehicles((prev) =>
          prev.map((v) => (String(v.id) === String(vid) ? { ...v, status: 'Rented' } : v)),
        )
      }
      return normalizeRental(created)
    }

    // Employee / field submissions wait for admin approval.
    const created = await submitPendingRentalApi(entry)
    if (!created?.id) {
      setRentals((prev) => [entry, ...prev])
      return entry
    }

    setRentals((prev) => [normalizeRental(created), ...prev.filter((r) => String(r.id) !== String(created.id))])
    return normalizeRental(created)
  }

  const bookedVehicleIds = useMemo(() => {
    const archived = getArchivedIdSet()
    const now = Date.now()
    return rentals
      .filter((r) => {
        const vid = r.vehicle?.id
        if (!vid || archived.has(String(vid))) return false
        if (!isActiveBooking(r)) return false
        if (r.rentalLifecycle === 'active') return true
        if (r.rentalLifecycle === 'scheduled') {
          return isScheduledWindow(r.rental?.periodFrom, now)
        }
        return false
      })
      .map((r) => r.vehicle?.id)
      .filter(Boolean)
  }, [rentals, tick])

  return (
    <VehicleContext.Provider
      value={{
        vehicles,
        rentals,
        ready,
        loadError,
        bookedVehicleIds,
        addVehicle,
        updateVehicle,
        removeVehicle,
        updateVehicleStatus,
        addRental,
        completeRentalForVehicle,
        cancelScheduledRental,
        updateRentalCarPhotos,
        reloadData,
        replaceAllData,
        wipeLocalFleet,
      }}
    >
      {children}
    </VehicleContext.Provider>
  )
}

export function useVehicles() {
  const ctx = useContext(VehicleContext)
  if (!ctx) throw new Error('useVehicles must be used within VehicleProvider')
  return ctx
}
