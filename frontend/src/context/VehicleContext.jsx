import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadVehicles, saveVehicles, deleteVehicle as deleteVehicleApi } from '../data/backendVehicles'
import { loadRentals, saveRentals, addRental as addRentalApi } from '../data/backendRentals'
import { getArchivedIdSet, ARCHIVE_EVENT } from '../utils/archivedVehicles'
import { isScheduledWindow } from '../utils/vehicleDisplayStatus'
import { flushOfflineQueue } from '../utils/offlineQueue'
import { replaceVehicles as apiReplaceVehicles, replaceRentals as apiReplaceRentals, addRental as apiAddRental } from '../api/backend'

const VehicleContext = createContext(null)

function normalizeRental(r) {
  const base = r.approvalStatus ? r : { ...r, approvalStatus: 'accepted' }
  if (base.rentalLifecycle) return base
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
          vehicles: (payload) => apiReplaceVehicles(payload),
          rentals: (payload) => apiReplaceRentals(payload),
          'rentals-add': (payload) => apiAddRental(payload),
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
    saveVehicles(vehicles).catch((err) => {
      console.warn('Vehicle save failed', err)
    })
  }, [vehicles])

  useEffect(() => {
    if (!hasLoaded.current) return
    saveRentals(rentals).catch((err) => {
      console.warn('Rental save failed', err)
    })
  }, [rentals])

  const reloadData = useCallback(async () => {
    const [vehiclesData, rentalsData] = await Promise.all([loadVehicles(), loadRentals()])
    setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
    setRentals(
      Array.isArray(rentalsData) ? rentalsData.map(normalizeRental) : [],
    )
    hasLoaded.current = true
    setLoadError(null)
    return {
      vehicles: Array.isArray(vehiclesData) ? vehiclesData : [],
      rentals: Array.isArray(rentalsData) ? rentalsData.map(normalizeRental) : [],
    }
  }, [])

  const replaceAllData = useCallback(async ({ vehicles: nextVehicles, rentals: nextRentals }) => {
    const vehiclesPayload = Array.isArray(nextVehicles) ? nextVehicles : []
    const rentalsPayload = Array.isArray(nextRentals)
      ? nextRentals.map(normalizeRental)
      : []

    const savedVehicles = await saveVehicles(vehiclesPayload)
    const savedRentals = await saveRentals(rentalsPayload)
    if (!savedVehicles || !savedRentals) {
      throw new Error('Could not save imported data to the backend.')
    }

    setVehicles(vehiclesPayload)
    setRentals(rentalsPayload)
    hasLoaded.current = true
    return { vehicles: vehiclesPayload, rentals: rentalsPayload }
  }, [])

  const updateVehicleStatus = useCallback((id, status) => {
    if (!id) return
    const key = String(id)
    setVehicles((prev) =>
      prev.map((v) => (String(v.id) === key ? { ...v, status } : v)),
    )
  }, [])

  const completeRentalForVehicle = useCallback((vehicleId) => {
    if (!vehicleId) return
    setVehicles((prev) =>
      prev.map((v) => (String(v.id) === String(vehicleId) ? { ...v, status: 'Available' } : v)),
    )
    setRentals((prev) =>
      prev.map((r) =>
        r.vehicle?.id === vehicleId && r.rentalLifecycle === 'active'
          ? {
              ...r,
              rentalLifecycle: 'completed',
              completedAt: new Date().toISOString(),
            }
          : r,
      ),
    )
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
        setTimeout(() => {
          setVehicles((vehiclesPrev) =>
            vehiclesPrev.map((v) =>
              vehicleIds.includes(v.id) ? { ...v, status: 'Rented' } : v,
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
    const entry = {
      ...vehicle,
      status: vehicle.status || 'Available',
      id: `v-${Date.now()}`,
    }
    setVehicles((prev) => [...prev, entry])
    return entry
  }

  const updateVehicle = (id, data) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...data, id: v.id } : v)),
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
    const shouldStartNow = isDue(record.rental?.periodFrom)
    const entry = {
      ...record,
      id: `r-${Date.now()}`,
      rentalLifecycle: shouldStartNow ? 'active' : 'scheduled',
      startedAt: shouldStartNow ? new Date().toISOString() : null,
    }

    const created = await addRentalApi(entry)
    if (!created?.id) {
      throw new Error('Could not save rental to the server.')
    }

    setRentals((prev) => [created, ...prev])
    const vid = created.vehicleId || created.vehicle?.id
    if (vid && (created.rentalLifecycle === 'active' || shouldStartNow)) {
      updateVehicleStatus(vid, 'Rented')
    }
    return created
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
        reloadData,
        replaceAllData,
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
