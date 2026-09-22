import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  acceptPendingRental,
  addRental as addRentalApi,
  completeVehicleRental,
  deleteVehicle,
  fetchRentals,
  fetchVehicles,
  rejectPendingRental,
  replaceVehicles,
  submitPendingRental,
} from '../api/backend'
import { isSupabaseConfigured, requireSupabase } from '../api/supabaseClient'
import { useAuth } from './AuthContext'

const FleetContext = createContext(null)

function normalizeRental(r) {
  let approvalStatus = r.approvalStatus || null
  let rentalLifecycle = r.rentalLifecycle || null

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

export function FleetProvider({ children }) {
  const { isLoggedIn, bootstrapping: authBootstrapping } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [rentals, setRentals] = useState([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const hasLoaded = useRef(false)
  const skipVehicleSave = useRef(false)
  const rentalsRef = useRef(rentals)
  rentalsRef.current = rentals

  const loadFleet = useCallback(async () => {
    const [vehiclesData, rentalsData] = await Promise.all([
      fetchVehicles(),
      fetchRentals(),
    ])
    const nextVehicles = Array.isArray(vehiclesData) ? vehiclesData : []
    const nextRentals = Array.isArray(rentalsData)
      ? rentalsData.map(normalizeRental)
      : []
    skipVehicleSave.current = true
    setVehicles(nextVehicles)
    setRentals(nextRentals)
    hasLoaded.current = true
    setLoadError(null)
    return { vehicles: nextVehicles, rentals: nextRentals }
  }, [])

  const reloadData = useCallback(async () => loadFleet(), [loadFleet])

  useEffect(() => {
    if (authBootstrapping) return undefined
    let mounted = true
    let authSub = null

    async function start() {
      if (!isSupabaseConfigured) {
        try {
          await loadFleet()
        } catch (err) {
          if (mounted) setLoadError(err?.message || 'Could not load fleet data.')
        } finally {
          if (mounted) setReady(true)
        }
        return
      }

      const sb = requireSupabase()
      const {
        data: { session },
      } = await sb.auth.getSession()
      if (!mounted) return

      if (session || isLoggedIn) {
        try {
          await loadFleet()
        } catch (err) {
          if (mounted) setLoadError(err?.message || 'Could not load fleet data.')
        }
      }

      if (mounted) setReady(true)

      const { data } = sb.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' && nextSession) {
          void loadFleet().catch((err) => {
            console.warn('Fleet reload after sign-in failed', err)
          })
        }
        if (event === 'SIGNED_OUT') {
          hasLoaded.current = false
          skipVehicleSave.current = true
          setVehicles([])
          setRentals([])
          setLoadError(null)
        }
      })
      authSub = data?.subscription
    }

    void start()

    return () => {
      mounted = false
      authSub?.unsubscribe?.()
    }
  }, [authBootstrapping, isLoggedIn, loadFleet])

  useEffect(() => {
    if (!hasLoaded.current) return
    if (skipVehicleSave.current) {
      skipVehicleSave.current = false
      return
    }
    replaceVehicles(vehicles, { prune: false }).catch((err) => {
      console.warn('Vehicle save failed', err)
    })
  }, [vehicles])

  useEffect(() => {
    if (!ready || !isLoggedIn) return undefined
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const rentalsData = await fetchRentals()
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
              changed = true
              continue
            }
            if (
              String(a.approvalStatus || '') !== String(b.approvalStatus || '') ||
              String(a.rentalLifecycle || '') !== String(b.rentalLifecycle || '')
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
          return merged
        })
      } catch (err) {
        console.warn('Periodic rental refresh failed', err)
      }
    }, 5_000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [ready, isLoggedIn])

  const addVehicle = useCallback((vehicle) => {
    const now = new Date().toISOString()
    const entry = {
      ...vehicle,
      status: vehicle.status || 'Available',
      id: vehicle.id || `v-${Date.now()}`,
      createdAt: vehicle.createdAt || now,
      updatedAt: now,
    }
    setVehicles((prev) => [...prev, entry])
    return entry
  }, [])

  const updateVehicle = useCallback((id, data) => {
    const now = new Date().toISOString()
    setVehicles((prev) =>
      prev.map((v) =>
        String(v.id) === String(id) ? { ...v, ...data, id: v.id, updatedAt: now } : v,
      ),
    )
  }, [])

  const removeVehicle = useCallback(async (id) => {
    if (!id) return null
    const list = await deleteVehicle(id)
    if (Array.isArray(list)) {
      skipVehicleSave.current = true
      setVehicles(list)
    } else {
      skipVehicleSave.current = true
      setVehicles((prev) => prev.filter((v) => String(v.id) !== String(id)))
    }
    return { ok: true }
  }, [])

  const updateVehicleStatus = useCallback((id, status) => {
    if (!id) return
    setVehicles((prev) =>
      prev.map((v) => (String(v.id) === String(id) ? { ...v, status } : v)),
    )
  }, [])

  const addRental = useCallback(async (record) => {
    const autoApprove = Boolean(record?.autoApprove)
    const vehicleId = String(record?.vehicleId || record?.vehicle?.id || '')
    const plate = String(record?.vehicle?.plateNo || '').trim().toUpperCase()

    const hasOpenClash = rentalsRef.current.some((r) => {
      if (!isActiveBooking(r)) return false
      const rid = String(r.vehicleId || r.vehicle?.id || '')
      const rPlate = String(r.vehicle?.plateNo || '').trim().toUpperCase()
      if (vehicleId && rid === vehicleId) return true
      if (plate && rPlate === plate) return true
      return false
    })
    if (autoApprove && hasOpenClash) {
      throw new Error(
        plate
          ? `Vehicle ${plate} already has an active or scheduled rental.`
          : 'This vehicle already has an active or scheduled rental.',
      )
    }

    const entry = {
      ...record,
      id: record.id || `r-${Date.now()}`,
      source: record.source || 'mobile',
      approvalStatus: autoApprove ? 'accepted' : 'pending',
      rentalLifecycle: autoApprove
        ? (() => {
            const start = record?.rental?.periodFrom
              ? new Date(record.rental.periodFrom).getTime()
              : NaN
            return !Number.isNaN(start) && start > Date.now() ? 'scheduled' : 'active'
          })()
        : 'pending_approval',
      startedAt: autoApprove
        ? (() => {
            const start = record?.rental?.periodFrom
              ? new Date(record.rental.periodFrom).getTime()
              : NaN
            return Number.isNaN(start) || start <= Date.now() ? new Date().toISOString() : null
          })()
        : null,
      autoApprove: undefined,
    }

    const created = autoApprove
      ? await addRentalApi(entry)
      : await submitPendingRental(entry)

    if (!created?.id) {
      throw new Error('Could not save rental to the server. Please try again.')
    }

    const normalized = normalizeRental(created)
    setRentals((prev) => [
      normalized,
      ...prev.filter((r) => String(r.id) !== String(normalized.id)),
    ])

    if (
      autoApprove &&
      normalized.rentalLifecycle === 'active' &&
      (normalized.vehicleId || normalized.vehicle?.id)
    ) {
      const vid = normalized.vehicleId || normalized.vehicle?.id
      setVehicles((prev) =>
        prev.map((v) => (String(v.id) === String(vid) ? { ...v, status: 'Rented' } : v)),
      )
    }

    return normalized
  }, [])

  const completeRentalForVehicle = useCallback(async (vehicleId, plateNo = '', rentalId = '') => {
    if (!vehicleId && !plateNo && !rentalId) return
    const key = String(vehicleId || '')
    const plate = String(plateNo || '').trim().toUpperCase()
    const rentalKey = String(rentalId || '').trim()
    const now = new Date().toISOString()

    skipVehicleSave.current = true
    if (key) {
      setVehicles((prev) =>
        prev.map((v) => (String(v.id) === key ? { ...v, status: 'Available' } : v)),
      )
    }
    setRentals((prev) =>
      prev.map((r) => {
        const rid = String(r.vehicleId || r.vehicle?.id || '')
        const rPlate = String(r.vehicle?.plateNo || '').trim().toUpperCase()
        const matchByRental = rentalKey && String(r.id) === rentalKey
        const matchByVehicle =
          r.rentalLifecycle === 'active' &&
          ((key && rid === key) || (plate && rPlate === plate))
        if (!matchByRental && !matchByVehicle) return r
        return {
          ...r,
          rentalLifecycle: 'completed',
          completedAt: now,
          updatedAt: now,
        }
      }),
    )

    await completeVehicleRental(key, plate, rentalKey)
  }, [])

  const acceptPending = useCallback(async (rentalId) => {
    const updated = await acceptPendingRental(rentalId)
    if (!updated) return null
    const normalized = normalizeRental(updated)
    setRentals((prev) =>
      prev.map((r) => (String(r.id) === String(normalized.id) ? normalized : r)),
    )
    if (
      normalized.rentalLifecycle === 'active' &&
      (normalized.vehicleId || normalized.vehicle?.id)
    ) {
      const vid = normalized.vehicleId || normalized.vehicle?.id
      setVehicles((prev) =>
        prev.map((v) => (String(v.id) === String(vid) ? { ...v, status: 'Rented' } : v)),
      )
    }
    return normalized
  }, [])

  const rejectPending = useCallback(async (rentalId, reason = '') => {
    const updated = await rejectPendingRental(rentalId, reason)
    if (!updated) return null
    const normalized = normalizeRental(updated)
    setRentals((prev) =>
      prev.map((r) => (String(r.id) === String(normalized.id) ? normalized : r)),
    )
    return normalized
  }, [])

  const cancelScheduledRental = useCallback((rentalId) => {
    if (!rentalId) return
    const key = String(rentalId)
    const now = new Date().toISOString()
    setRentals((prev) =>
      prev.map((r) => {
        if (String(r.id) !== key) return r
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

  return (
    <FleetContext.Provider
      value={{
        vehicles,
        rentals,
        ready,
        loadError,
        reloadData,
        addVehicle,
        updateVehicle,
        removeVehicle,
        addRental,
        completeRentalForVehicle,
        cancelScheduledRental,
        acceptPending,
        rejectPending,
        updateVehicleStatus,
      }}
    >
      {children}
    </FleetContext.Provider>
  )
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used within FleetProvider')
  return ctx
}
