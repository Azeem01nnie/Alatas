import { apiRequest } from './client';

export function fetchRentals() {
  return apiRequest('/api/rentals');
}

export function fetchPendingRentals() {
  return apiRequest('/api/pending-rentals');
}

export function submitPendingRental(rental) {
  return apiRequest('/api/rentals/pending', {
    method: 'POST',
    body: JSON.stringify(rental),
  });
}

export function acceptPendingRental(id) {
  return apiRequest(`/api/pending-rentals/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  });
}

export function rejectPendingRental(id, reason = '') {
  return apiRequest(`/api/pending-rentals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function updateRentalCarPhotos(id, carPhotos, addedBy) {
  try {
    return await apiRequest(`/api/rentals/${encodeURIComponent(id)}/car-photos`, {
      method: 'PATCH',
      body: JSON.stringify({ carPhotos, addedBy }),
    });
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  // Fallback for cloud/local servers that have not deployed the PATCH route yet.
  const rentals = await fetchRentals();
  const list = Array.isArray(rentals) ? [...rentals] : [];
  const index = list.findIndex((r) => String(r.id) === String(id));
  if (index === -1) {
    throw new Error('Rental not found');
  }

  const current = list[index];
  const existingPhotos =
    current.carPhotos && typeof current.carPhotos === 'object' ? current.carPhotos : {};
  const mergedPhotos = { ...existingPhotos, ...carPhotos };
  const allComplete = ['front', 'rear', 'left', 'right'].every((key) => Boolean(mergedPhotos[key]));

  if (['front', 'rear', 'left', 'right'].every((key) => Boolean(existingPhotos[key]))) {
    throw new Error('Car photos are locked and cannot be changed');
  }

  list[index] = {
    ...current,
    carPhotos: allComplete && addedBy ? { ...mergedPhotos, _addedBy: String(addedBy).trim() } : mergedPhotos,
    carPhotosAddedBy: allComplete && addedBy ? String(addedBy).trim() : current.carPhotosAddedBy || mergedPhotos._addedBy || null,
    updatedAt: new Date().toISOString(),
  };

  const saved = await apiRequest('/api/rentals', {
    method: 'PUT',
    body: JSON.stringify(list),
  });

  const updated = Array.isArray(saved)
    ? saved.find((r) => String(r.id) === String(id))
    : null;

  if (!updated) {
    throw new Error('Could not save car photos');
  }

  return updated;
}
