/** Normalize vehicle display gallery (multi-image) with legacy `image` fallback. */
export function getVehicleGallery(vehicle) {
  const list = Array.isArray(vehicle?.images)
    ? vehicle.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  if (list.length) return list
  const single = String(vehicle?.image || '').trim()
  if (single.startsWith('[')) {
    try {
      const arr = JSON.parse(single)
      if (Array.isArray(arr)) {
        return arr.map((u) => String(u || '').trim()).filter(Boolean)
      }
    } catch {
      /* fall through */
    }
  }
  if (
    single &&
    single !== 'logo' &&
    !single.endsWith('logonobg.png') &&
    !single.includes('/logonobg')
  ) {
    return [single]
  }
  return []
}

/** Insurance photo list (no OCR). */
export function getInsuranceImages(vehicle) {
  if (Array.isArray(vehicle?.insuranceImages)) {
    return vehicle.insuranceImages.map((u) => String(u || '').trim()).filter(Boolean)
  }
  const single = String(vehicle?.insuranceImage || '').trim()
  return single ? [single] : []
}

export function withSyncedPrimaryImage(vehicle, logoFallback = '') {
  const images = getVehicleGallery(vehicle)
  return {
    ...vehicle,
    images,
    image: images[0] || logoFallback || vehicle?.image || '',
    insuranceImages: getInsuranceImages(vehicle),
  }
}
