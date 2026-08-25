export function mapVehicleFromApi(vehicle) {
  if (!vehicle) return null;
  const status =
    vehicle.status === 'Under Maintenance' ? 'Maintenance' : vehicle.status || 'Available';

  return {
    id: vehicle.id,
    make: vehicle.make || '',
    model: vehicle.series || '',
    series: vehicle.series || '',
    bodyType: vehicle.bodyType || '',
    seats: vehicle.seats ?? 5,
    transmission: vehicle.transmission || 'Automatic',
    plate: vehicle.plateNo || '',
    plateNo: vehicle.plateNo || '',
    status,
    ownerId: vehicle.ownerId || '',
    ownerName: vehicle.ownerName || '',
    ownershipType: vehicle.ownershipType || 'company',
    engineNo: vehicle.engineNo || '',
    chassisNo: vehicle.chassisNo || '',
    reportEntries: Array.isArray(vehicle.reportEntries) ? vehicle.reportEntries : [],
    image: vehicle.image ? { uri: vehicle.image } : null,
    imageUri: vehicle.image || null,
    rates: vehicle.rates || {},
    _raw: vehicle,
  };
}

export function mapVehicleToApi(car, nextStatus) {
  const raw = car._raw || {};
  const status =
    nextStatus === 'Maintenance' ? 'Under Maintenance' : nextStatus || car.status;

  return {
    ...raw,
    id: car.id,
    make: car.make,
    series: car.model || car.series,
    bodyType: car.bodyType,
    seats: car.seats,
    transmission: car.transmission,
    plateNo: car.plate || car.plateNo,
    status: status === 'Maintenance' ? 'Under Maintenance' : status,
    ownerId: car.ownerId ?? raw.ownerId,
    ownerName: car.ownerName ?? raw.ownerName,
    ownershipType: car.ownershipType ?? raw.ownershipType,
    rates: car.rates ?? raw.rates,
    image: car.imageUri ?? raw.image,
  };
}

export function rentalToActivityLog(rental) {
  const personal = rental.personal || {};
  const vehicle = rental.vehicle || {};
  const name = [personal.firstName, personal.lastName].filter(Boolean).join(' ') || personal.fullName || rental.source || 'Field';
  const plate = vehicle.plateNo || vehicle.plate || rental.vehicleId || '—';
  const notes = rental.rental?.notes || rental.rental?.remarks || personal.notes || '';

  let status = 'Upcoming';
  if (
    rental.rentalLifecycle === 'cancelled' ||
    rental.approvalStatus === 'rejected' ||
    rental.rentalLifecycle === 'rejected'
  ) {
    status = 'Cancelled';
  } else if (rental.rentalLifecycle === 'completed') {
    status = 'Completed';
  } else if (rental.rentalLifecycle === 'active') {
    status = 'On Rent';
  } else if (
    rental.approvalStatus === 'pending' ||
    rental.rentalLifecycle === 'pending_approval'
  ) {
    status = 'Waiting for approval';
  } else if (rental.rentalLifecycle === 'scheduled') {
    status = 'Upcoming';
  } else if (rental.approvalStatus === 'accepted') {
    status = 'On Rent';
  }

  const created = rental.cancelledAt || rental.completedAt || rental.updatedAt || rental.createdAt
    ? new Date(rental.cancelledAt || rental.completedAt || rental.updatedAt || rental.createdAt)
    : null;
  const time = created && !Number.isNaN(created.getTime())
    ? created.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    : '—';

  return {
    id: rental.id,
    time,
    employee: name,
    vehicle: plate,
    text: rental.rentalLifecycle === 'cancelled'
      ? (notes ? `Cancelled · ${notes}` : 'Rental cancelled')
      : rental.rentalLifecycle === 'completed'
        ? (rental.rental?.periodToLabel
          ? `Completed · returned ${rental.rental.periodToLabel}`
          : 'Rental completed')
      : rental.approvalStatus === 'pending' || rental.rentalLifecycle === 'pending_approval'
        ? (rental.rental?.periodFromLabel
          ? `Waiting for approval · ${rental.rental.periodFromLabel}`
          : 'Waiting for approval')
      : rental.source === 'desktop'
        ? (rental.rental?.periodFromLabel
          ? `Desktop rental · ${rental.rental.periodFromLabel}`
          : 'Desktop rental')
        : (notes || 'Field rental submission'),
    status,
    image: rental.photo ? { uri: rental.photo } : null,
    rental,
  };
}

/** All rentals from cloud/local API, merged with pending queue (matches desktop history). */
export function buildActivityLogs(rentals, pendingRentals) {
  const pendingIds = new Set((pendingRentals || []).map((r) => String(r.id)));
  const merged = [
    ...(pendingRentals || []),
    ...(rentals || []).filter((r) => !pendingIds.has(String(r.id))),
  ];
  return merged
    .map(rentalToActivityLog)
    .sort((a, b) => {
      const ta = new Date(a.rental?.updatedAt || a.rental?.createdAt || 0).getTime();
      const tb = new Date(b.rental?.updatedAt || b.rental?.createdAt || 0).getTime();
      return tb - ta;
    });
}

/** Field / mobile submissions merged with pending queue + cancelled rentals. */
export function buildFieldActivityLogs(rentals, pendingRentals) {
  const fieldRentals = (rentals || []).filter(
    (r) =>
      r.source === 'mobile' ||
      r.source === 'field' ||
      r.rentalLifecycle === 'cancelled',
  );
  const pendingIds = new Set((pendingRentals || []).map((r) => String(r.id)));
  const merged = [
    ...(pendingRentals || []),
    ...fieldRentals.filter((r) => !pendingIds.has(String(r.id))),
  ];
  return merged
    .map(rentalToActivityLog)
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

/** Pre-rental car photo sides (front, rear, left, right). */
export const CAR_PHOTO_SLOTS = [
  { key: 'front', title: 'Front', hint: 'Full front view of the vehicle.' },
  { key: 'rear', title: 'Rear', hint: 'Full rear view of the vehicle.' },
  { key: 'left', title: 'Left side', hint: 'Driver / left side of the vehicle.' },
  { key: 'right', title: 'Right side', hint: 'Passenger / right side of the vehicle.' },
];

export function rentalHasCarPhotos(rental) {
  if (!rental) return false;
  const cp = rental.carPhotos || {};
  return CAR_PHOTO_SLOTS.every((slot) => Boolean(cp[slot.key]));
}

export function getCarPhotosAddedBy(rental) {
  if (!rental) return null;
  const fromField = rental.carPhotosAddedBy && String(rental.carPhotosAddedBy).trim();
  if (fromField) return fromField;
  const fromMeta = rental.carPhotos?._addedBy && String(rental.carPhotos._addedBy).trim();
  if (fromMeta) return fromMeta;
  return null;
}

export function rentalNeedsCarPhotos(rental) {
  if (!rental || rental.rentalLifecycle !== 'scheduled') return false;
  return !rentalHasCarPhotos(rental);
}

/** Matches desktop Needs attention → Upcoming (scheduled, not pending/rejected). */
export function isWaitingForApproval(rental) {
  if (!rental) return false;
  return rental.approvalStatus === 'pending' || rental.rentalLifecycle === 'pending_approval';
}

export function buildWaitingApprovalNotices(rentals, pendingRentals) {
  const pendingIds = new Set((pendingRentals || []).map((r) => String(r.id)));
  const merged = [
    ...(pendingRentals || []),
    ...(rentals || []).filter(
      (r) => !pendingIds.has(String(r.id)) && isWaitingForApproval(r),
    ),
  ];
  return merged.map((rental) => {
    const log = rentalToActivityLog(rental);
    const name = [rental.personal?.firstName, rental.personal?.lastName]
      .filter(Boolean)
      .join(' ') || 'Customer';
    return {
      ...log,
      status: 'Waiting for approval',
      text: name
        ? `${name} · tap to review and approve`
        : 'Tap to review and approve',
    };
  });
}

export function isUpcomingRental(rental) {
  if (!rental) return false;
  if (rental.rentalLifecycle !== 'scheduled') return false;
  if (rental.approvalStatus === 'pending' || rental.approvalStatus === 'rejected') return false;
  return true;
}

export function buildUpcomingNotices(rentals) {
  return (rentals || [])
    .filter(isUpcomingRental)
    .map((rental) => {
      const log = rentalToActivityLog(rental);
      const needsPhotos = rentalNeedsCarPhotos(rental);
      const periodFrom = rental.rental?.periodFromLabel || rental.rental?.periodFrom || '';
      return {
        ...log,
        status: 'Upcoming',
        text: needsPhotos
          ? 'Add pre-rental car photos before the rental starts.'
          : getCarPhotosAddedBy(rental)
            ? `Scheduled · photos added by ${getCarPhotosAddedBy(rental)}`
            : periodFrom
              ? `Scheduled · starts ${periodFrom}`
              : 'Scheduled rental',
        needsCarPhotos: needsPhotos,
        photoLabel: needsPhotos ? 'Vehicle photos needed' : 'Vehicle photos added',
        carPhotosAddedBy: getCarPhotosAddedBy(rental),
      };
    })
    .sort((a, b) => {
      const ta = new Date(a.rental?.rental?.periodFrom || 0).getTime();
      const tb = new Date(b.rental?.rental?.periodFrom || 0).getTime();
      return ta - tb;
    });
}

/** @deprecated use buildUpcomingNotices */
export function buildUpcomingPhotoNotices(rentals) {
  return buildUpcomingNotices(rentals).filter((item) => item.needsCarPhotos);
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isScheduledWindow(periodFrom, now = Date.now()) {
  if (!periodFrom) return false;
  const start = new Date(periodFrom);
  if (Number.isNaN(start.getTime())) return false;
  const startDay = startOfLocalDay(start);
  const prepDay = startDay - 24 * 60 * 60 * 1000;
  const today = startOfLocalDay(now);
  return today >= prepDay;
}

function openRentalsForVehicle(vehicleId, rentals) {
  const key = String(vehicleId);
  return (rentals || []).filter(
    (r) =>
      String(r.vehicle?.id || r.vehicleId) === key &&
      (r.rentalLifecycle === 'scheduled' || r.rentalLifecycle === 'active'),
  );
}

function isMaintenanceStatus(status) {
  return status === 'Maintenance' || status === 'Under Maintenance';
}

/** Fleet badge status aligned with desktop Manage Vehicle. */
export function getVehicleDisplayStatus(vehicle, rentals, now = Date.now()) {
  if (!vehicle) return 'Available';
  if (isMaintenanceStatus(vehicle.status)) return 'Maintenance';

  const open = openRentalsForVehicle(vehicle.id, rentals);
  if (open.some((r) => r.rentalLifecycle === 'active')) return 'On Rent';

  const blockingScheduled = open.some(
    (r) =>
      r.rentalLifecycle === 'scheduled' && isScheduledWindow(r.rental?.periodFrom, now),
  );
  if (blockingScheduled) return 'Scheduled';

  return 'Available';
}

export function getFleetOverviewCounts(vehicles, rentals, pendingRentals = []) {
  const counts = { onRent: 0, maintenance: 0, available: 0, waitingApproval: 0 };
  (vehicles || []).forEach((v) => {
    const status = getVehicleDisplayStatus(v, rentals);
    if (status === 'On Rent') counts.onRent += 1;
    else if (status === 'Maintenance') counts.maintenance += 1;
    else counts.available += 1;
  });
  const pendingIds = new Set((pendingRentals || []).map((r) => String(r.id)));
  counts.waitingApproval = (pendingRentals || []).length
    + (rentals || []).filter(
      (r) =>
        !pendingIds.has(String(r.id)) &&
        (r.approvalStatus === 'pending' || r.rentalLifecycle === 'pending_approval'),
    ).length;
  return counts;
}

export function formatDateTimeLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOwnershipLabel(car) {
  const type = car?.ownershipType;
  const isThird =
    type === 'thirdParty' || type === 'third-party' || type === 'third_party';
  if (isThird) {
    return car?.ownerName ? `Third-party owned · ${car.ownerName}` : 'Third-party owned';
  }
  return 'Company-owned';
}

export function getActiveRentalForVehicle(vehicleId, rentals) {
  return (
    (rentals || []).find(
      (r) =>
        String(r.vehicle?.id || r.vehicleId) === String(vehicleId) &&
        r.rentalLifecycle === 'active',
    ) || null
  );
}

export function getVehicleRenterName(rental) {
  if (!rental?.personal) return null;
  const name = [rental.personal.firstName, rental.personal.middleName, rental.personal.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || rental.personal.fullName || null;
}

export function getVehicleReturnLabel(rental) {
  const info = rental?.rental;
  if (!info) return '—';
  return info.periodToLabel || formatDateTimeLabel(info.periodTo);
}

export function displayStatusLabel(status) {
  if (status === 'On Rent') return 'On Rent';
  if (status === 'Maintenance') return 'Maintenance';
  if (status === 'Scheduled') return 'Scheduled';
  return status || 'Available';
}

export function getReportsForVehicle(entries, vehicleOrId, allVehicles) {
  const fromStore = (entries || []).filter(Boolean);
  const embedded =
    vehicleOrId != null && typeof vehicleOrId === 'object' && Array.isArray(vehicleOrId.reportEntries)
      ? vehicleOrId.reportEntries
      : vehicleOrId != null &&
          typeof vehicleOrId === 'object' &&
          Array.isArray(vehicleOrId._raw?.reportEntries)
        ? vehicleOrId._raw.reportEntries
        : [];

  const combined = [...fromStore];
  const seen = new Set(combined.map((entry) => entry.id).filter(Boolean));
  embedded.forEach((entry) => {
    if (entry?.id && seen.has(entry.id)) return;
    if (entry?.id) seen.add(entry.id);
    combined.push(entry);
  });

  if (!combined.length) return [];

  const id =
    vehicleOrId != null && typeof vehicleOrId === 'object'
      ? vehicleOrId.id
      : vehicleOrId;
  const plate =
    vehicleOrId != null && typeof vehicleOrId === 'object'
      ? String(vehicleOrId.plate || vehicleOrId.plateNo || '').trim().toUpperCase()
      : '';

  const alternateIds = new Set();
  if (plate && Array.isArray(allVehicles)) {
    allVehicles.forEach((vehicle) => {
      const vehiclePlate = String(vehicle.plate || vehicle.plateNo || '').trim().toUpperCase();
      if (vehiclePlate && vehiclePlate === plate && vehicle.id != null) {
        alternateIds.add(String(vehicle.id));
      }
    });
  }
  if (id != null && id !== '') alternateIds.add(String(id));

  return combined
    .filter((entry) => {
      const entryVehicleId = String(entry.vehicleId ?? '');
      if (entryVehicleId && alternateIds.has(entryVehicleId)) return true;
      const entryPlate = String(entry.plateNo || entry.plate || '').trim().toUpperCase();
      if (plate && entryPlate && entryPlate === plate) return true;
      return false;
    })
    .sort((a, b) =>
      String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')),
    );
}

export function flattenVehicleReportEntries(vehicles) {
  const entries = [];
  const seen = new Set();
  (vehicles || []).forEach((vehicle) => {
    const rows =
      vehicle?.reportEntries ||
      vehicle?._raw?.reportEntries ||
      [];
    if (!Array.isArray(rows)) return;
    rows.forEach((entry) => {
      if (entry?.id) {
        if (seen.has(entry.id)) return;
        seen.add(entry.id);
      }
      entries.push(entry);
    });
  });
  return entries;
}

export function mergeReportEntries(primary, secondary) {
  const byId = new Map();
  (secondary || []).forEach((entry) => {
    if (entry?.id) byId.set(entry.id, entry);
  });
  (primary || []).forEach((entry) => {
    if (entry?.id) byId.set(entry.id, entry);
  });
  return [...byId.values()];
}

export function summarizeVehicleReports(reports) {
  const byType = {};
  const byCategory = {};
  let totalAmount = 0;

  (reports || []).forEach((row) => {
    const type = row.type || 'Other';
    const category = row.category || 'Uncategorized';
    byType[type] = (byType[type] || 0) + 1;
    byCategory[category] = (byCategory[category] || 0) + 1;
    totalAmount += Number(row.amount) || 0;
  });

  return {
    count: (reports || []).length,
    byType,
    byCategory,
    totalAmount,
  };
}

export function buildOnRentNotices(rentals, vehicles) {
  return (rentals || [])
    .filter((rental) => rental.rentalLifecycle === 'active')
    .map((rental) => {
      const vehicleId = rental.vehicle?.id || rental.vehicleId;
      const vehicle =
        (vehicles || []).find((v) => String(v.id) === String(vehicleId)) ||
        rental.vehicle ||
        {};
      const plate = vehicle.plateNo || vehicle.plate || '—';
      const title = [vehicle.make, vehicle.series || vehicle.model].filter(Boolean).join(' ');
      const renter = getVehicleRenterName(rental);
      const returnLabel = getVehicleReturnLabel(rental);
      return {
        id: rental.id,
        vehicle: plate,
        title: title || plate,
        text: renter ? `Rented by ${renter}` : 'Currently on rent',
        returnLabel,
        rental,
        car: (vehicles || []).find((v) => String(v.id) === String(vehicleId)) || null,
      };
    })
    .sort((a, b) => {
      const ta = new Date(a.rental?.rental?.periodTo || 0).getTime();
      const tb = new Date(b.rental?.rental?.periodTo || 0).getTime();
      return ta - tb;
    });
}
