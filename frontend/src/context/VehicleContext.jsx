import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadVehicles, saveVehicles } from '../data/vehicles'
import { loadRentals, saveRentals } from '../data/rentals'

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
  const [vehicles, setVehicles] = useState(() => loadVehicles())
  const [rentals, setRentals] = useState(() => {
    const loaded = loadRentals().map(normalizeRental)
    // Proactively slim history so quota errors don't break submit
    try {
      saveRentals(loaded)
    } catch {
      /* ignore */
    }
    return loaded
  })

  useEffect(() => {
    try {
      saveVehicles(vehicles)
    } catch (err) {
      console.warn('Vehicle save failed', err)
    }
  }, [vehicles])

  useEffect(() => {
    try {
      saveRentals(rentals)
    } catch (err) {
      console.warn('Rental save failed', err)
    }
  }, [rentals])

  const updateVehicleStatus = useCallback((id, status) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status } : v)),
    )
  }, [])

  const startRental = useCallback((rentalId, auto = false) => {
    let vehicleId = null
    setRentals((prev) => {
      const target = prev.find((r) => r.id === rentalId)
      if (!target || target.rentalLifecycle !== 'scheduled') return prev
      vehicleId = target.vehicle?.id || null
      return prev.map((r) =>
        r.id === rentalId
          ? {
              ...r,
              rentalLifecycle: 'active',
              startedAt: new Date().toISOString(),
              autoStarted: auto,
            }
          : r,
      )
    })
    if (vehicleId) {
      setVehicles((vehiclesPrev) =>
        vehiclesPrev.map((v) =>
          v.id === vehicleId ? { ...v, status: 'Rented' } : v,
        ),
      )
    }
  }, [])

  const completeRentalForVehicle = useCallback((vehicleId) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status: 'Available' } : v)),
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

  const removeVehicle = (id) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id))
  }

  const addRental = (record) => {
    const shouldStartNow = isDue(record.rental?.periodFrom)
    const entry = {
      ...record,
      id: `r-${Date.now()}`,
      rentalLifecycle: shouldStartNow ? 'active' : 'scheduled',
      startedAt: shouldStartNow ? new Date().toISOString() : null,
    }
    setRentals((prev) => [entry, ...prev])
    if (shouldStartNow && record.vehicle?.id) {
      updateVehicleStatus(record.vehicle.id, 'Rented')
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

  const getScheduledRental = useCallback(
    (vehicleId) =>
      rentals.find(
        (r) => r.vehicle?.id === vehicleId && r.rentalLifecycle === 'scheduled',
      ) || null,
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
        startRental,
        completeRentalForVehicle,
        getScheduledRental,
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
