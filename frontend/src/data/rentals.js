import { estimateJsonBytes, safeSetItem } from '../utils/storage'

const HISTORY_KEY = 'customer-encoder-rentals'

export function loadRentals() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRentals(rentals) {
  let list = Array.isArray(rentals) ? [...rentals] : []

  // Keep payloads lean: drop oversized embeds if needed
  const slim = (items) =>
    items.map((r) => ({
      ...r,
      photo: typeof r.photo === 'string' && r.photo.length > 350_000 ? '' : r.photo,
      licensePhoto:
        typeof r.licensePhoto === 'string' && r.licensePhoto.length > 350_000
          ? ''
          : r.licensePhoto,
      vehicle: r.vehicle
        ? {
            ...r.vehicle,
            // Prefer URL images; drop huge base64 car embeds (recover from fleet by id)
            image:
              typeof r.vehicle.image === 'string' &&
              r.vehicle.image.startsWith('data:') &&
              r.vehicle.image.length > 200_000
                ? ''
                : r.vehicle.image,
          }
        : r.vehicle,
    }))

  list = slim(list)

  let payload = JSON.stringify(list)
  let result = safeSetItem(HISTORY_KEY, payload)

  // If still too large, drop oldest entries until it fits
  while (!result.ok && list.length > 0) {
    list = list.slice(0, Math.max(0, list.length - 1))
    payload = JSON.stringify(list)
    result = safeSetItem(HISTORY_KEY, payload)
  }

  if (!result.ok) {
    console.warn('Unable to persist rentals to localStorage', result.error)
    return false
  }

  if (estimateJsonBytes(list) > 4_000_000) {
    console.warn('Rental history is getting large; older entries may be trimmed.')
  }

  return true
}
