import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadVehicles, saveVehicles, deleteVehicle as deleteVehicleApi } from '../data/backendVehicles'
import { loadRentals, saveRentals, addRental as addRentalApi } from '../data/backendRentals'

const VehicleContext = createContext(null)

function normalizeRental(r) {
  if (r.rentalLifecycle) return r
  return { ...r, rentalLifecycle: 'completed' }
}

function isDue(periodFrom) {
  if (!periodFrom) return false
  const start = new Date(periodFrom).getTime()
  return !Number.isNaN(start) && start <= Date.now()
}

export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([])
  const [rentals, setRentals] = useState([])
  const hasLoaded = useRef(false)

  useEffect(() => {
    let mounted = true

    async function loadInitialData() {
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

    if (Array.isArray(result.rentals)) {
      setRentals(
        result.rentals.map(normalizeRental),
      )
    } else {
      setRentals((prev) =>
        prev.filter(
          (r) =>
            r.vehicle?.id !== id ||
            r.rentalLifecycle === 'completed',
        ),
      )
    }
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
    if (created?.id) {
      setRentals((prev) => [created, ...prev])
      if (created.vehicleId || created.vehicle?.id) {
        updateVehicleStatus(created.vehicleId || created.vehicle?.id, 'Rented')
      }
      return created
    }

    setRentals((prev) => [entry, ...prev])
    if (entry.vehicleId || entry.vehicle?.id) {
      updateVehicleStatus(entry.vehicleId || entry.vehicle?.id, 'Rented')
    }
    return entry
  }

  const bookedVehicleIds = useMemo(
    () =>
      rentals
        .filter(
          (r) =>
            r.rentalLifecycle === 'scheduled' || r.rentalLifecycle === 'active',
        )
        .map((r) => r.vehicle?.id)
        .filter(Boolean),
    [rentals],
  )

  return (
    <VehicleContext.Provider
      value={{
        vehicles,
        rentals,
        bookedVehicleIds,
        addVehicle,
        updateVehicle,
        removeVehicle,
        updateVehicleStatus,
        addRental,
        completeRentalForVehicle,
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
