import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchVehicles, replaceVehicles } from '../api/vehicles';
import { fetchVehicleReports } from '../api/vehicleReports';
import {
  fetchRentals,
  fetchPendingRentals,
  submitPendingRental,
  acceptPendingRental,
  rejectPendingRental,
  updateRentalCarPhotos,
} from '../api/rentals';
import { checkHealth } from '../api/client';
import { mapVehicleFromApi, mapVehicleToApi, flattenVehicleReportEntries, mergeReportEntries } from '../utils/vehicleMapper';
import { enqueueOfflineOp, flushOfflineQueue, getOfflineQueueLength } from '../utils/offlineQueue';
import { useConnectivity } from '../hooks/useConnectivity';
import { API_URL } from '../config/api';

const FleetContext = createContext(null);

export function FleetProvider({ children }) {
  const { online } = useConnectivity();
  const [vehicles, setVehicles] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [pendingRentals, setPendingRentals] = useState([]);
  const [vehicleReportEntries, setVehicleReportEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [queueLength, setQueueLength] = useState(0);
  const [apiOk, setApiOk] = useState(null);

  const refreshQueueLength = useCallback(async () => {
    setQueueLength(await getOfflineQueueLength());
  }, []);

  const refreshVehicleReports = useCallback(async () => {
    const [reportStore, vehicleRows] = await Promise.all([
      fetchVehicleReports(),
      fetchVehicles().catch(() => []),
    ]);
    const mappedVehicles = Array.isArray(vehicleRows) ? vehicleRows.map(mapVehicleFromApi) : [];
    const apiReportEntries = Array.isArray(reportStore?.entries) ? reportStore.entries : [];
    const vehicleReportRows = flattenVehicleReportEntries(mappedVehicles);
    const entries = mergeReportEntries(apiReportEntries, vehicleReportRows);
    setVehicleReportEntries(entries);
    return { ...reportStore, entries, unavailable: reportStore?.unavailable && entries.length === 0 };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await flushOfflineQueue({
        'pending-rental': (payload) => submitPendingRental(payload),
        'car-photos': (payload) => updateRentalCarPhotos(payload.id, payload.carPhotos),
      });
      await refreshQueueLength();

      const [health, vehicleRows, rentalRows, pendingRows, reportStore] = await Promise.all([
        checkHealth().catch(() => null),
        fetchVehicles(),
        fetchRentals(),
        fetchPendingRentals(),
        fetchVehicleReports().catch(() => ({ entries: [] })),
      ]);

      setApiOk(Boolean(health?.ok));
      const mappedVehicles = Array.isArray(vehicleRows) ? vehicleRows.map(mapVehicleFromApi) : [];
      setVehicles(mappedVehicles);
      setRentals(Array.isArray(rentalRows) ? rentalRows : []);
      setPendingRentals(Array.isArray(pendingRows) ? pendingRows : []);
      const apiReportEntries = Array.isArray(reportStore?.entries) ? reportStore.entries : [];
      const vehicleReportRows = flattenVehicleReportEntries(mappedVehicles);
      setVehicleReportEntries(mergeReportEntries(apiReportEntries, vehicleReportRows));
      setLastSynced(new Date());
    } catch (err) {
      setError(err?.message || 'Could not load fleet data.');
    } finally {
      setLoading(false);
    }
  }, [refreshQueueLength]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (online) {
      loadAll();
    }
  }, [online, loadAll]);

  const updateVehicleStatus = useCallback(async (car, nextStatus) => {
    const nextFleet = vehicles.map((v) =>
      mapVehicleToApi(v, v.id === car.id ? nextStatus : v.status),
    );

    if (!online) {
      await enqueueOfflineOp({ type: 'vehicles-replace', payload: nextFleet });
      await refreshQueueLength();
      setVehicles((prev) =>
        prev.map((v) => (v.id === car.id ? { ...v, status: nextStatus } : v)),
      );
      return;
    }

    const saved = await replaceVehicles(nextFleet);
    setVehicles(Array.isArray(saved) ? saved.map(mapVehicleFromApi) : []);
  }, [vehicles, online, refreshQueueLength]);

  const submitPending = useCallback(async (payload) => {
    if (!online) {
      await enqueueOfflineOp({ type: 'pending-rental', payload });
      await refreshQueueLength();
      return { queued: true };
    }
    const created = await submitPendingRental(payload);
    await loadAll();
    return created;
  }, [online, loadAll, refreshQueueLength]);

  const acceptPending = useCallback(async (id) => {
    const result = await acceptPendingRental(id);
    await loadAll();
    return result;
  }, [loadAll]);

  const rejectPending = useCallback(async (id, reason) => {
    const result = await rejectPendingRental(id, reason);
    await loadAll();
    return result;
  }, [loadAll]);

  const uploadCarPhotos = useCallback(async (id, carPhotos, addedBy) => {
    if (!online) {
      await enqueueOfflineOp({ type: 'car-photos', payload: { id, carPhotos, addedBy } });
      await refreshQueueLength();
      setRentals((prev) =>
        prev.map((r) => {
          if (String(r.id) !== String(id)) return r;
          const merged = { ...(r.carPhotos || {}), ...carPhotos };
          const allComplete = ['front', 'rear', 'left', 'right'].every((key) => Boolean(merged[key]));
          const addedByName = addedBy ? String(addedBy).trim() : merged._addedBy || r.carPhotosAddedBy || null;
          if (allComplete && addedByName) {
            merged._addedBy = addedByName;
          }
          return {
            ...r,
            carPhotos: merged,
            carPhotosAddedBy: allComplete && addedByName ? addedByName : r.carPhotosAddedBy || null,
          };
        }),
      );
      return { queued: true };
    }
    const updated = await updateRentalCarPhotos(id, carPhotos, addedBy);
    await loadAll();
    return updated;
  }, [online, loadAll, refreshQueueLength]);

  const syncNow = useCallback(async () => {
    const result = await flushOfflineQueue({
      'pending-rental': (payload) => submitPendingRental(payload),
      'car-photos': (payload) => updateRentalCarPhotos(payload.id, payload.carPhotos, payload.addedBy),
      'vehicles-replace': (payload) => replaceVehicles(payload),
      'employee-create': (payload) =>
        import('../api/employees').then((m) => m.createEmployee(payload)),
      'employee-update': (payload) =>
        import('../api/employees').then((m) => m.updateEmployee(payload.id, payload.patch)),
      'employee-delete': (payload) =>
        import('../api/employees').then((m) => m.deleteEmployee(payload.id)),
    });
    await refreshQueueLength();
    await loadAll();
    return result;
  }, [loadAll, refreshQueueLength]);

  const metrics = useMemo(() => {
    const fieldRentals = rentals.filter((r) => r.source === 'mobile' || r.source === 'field');
    const pendingCount = pendingRentals.length;
    const fleetCount = vehicles.length;
    const brands = new Set(vehicles.map((v) => v.make).filter(Boolean)).size;

    return {
      fleetCount,
      pendingCount,
      activityCount: fieldRentals.length,
      brandCount: brands,
      uploadedCount: fieldRentals.filter((r) => r.photo).length,
    };
  }, [vehicles, rentals, pendingRentals]);

  const value = useMemo(
    () => ({
      vehicles,
      rentals,
      pendingRentals,
      vehicleReportEntries,
      loading,
      error,
      online,
      apiOk,
      apiUrl: API_URL,
      lastSynced,
      queueLength,
      metrics,
      loadAll,
      syncNow,
      refreshVehicleReports,
      updateVehicleStatus,
      submitPending,
      acceptPending,
      rejectPending,
      uploadCarPhotos,
    }),
    [
      vehicles,
      rentals,
      pendingRentals,
      vehicleReportEntries,
      loading,
      error,
      online,
      apiOk,
      lastSynced,
      queueLength,
      metrics,
      loadAll,
      syncNow,
      refreshVehicleReports,
      updateVehicleStatus,
      submitPending,
      acceptPending,
      rejectPending,
      uploadCarPhotos,
    ],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used within FleetProvider');
  return ctx;
}
