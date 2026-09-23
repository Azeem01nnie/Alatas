/** Normalize vehicle display gallery (multi-image) with legacy `image` fallback. */

const logoFallback = require('../../assets/logo.jpg')

/** Vite-hashed logo paths from old builds — not real vehicle photos. */
function isPlaceholderLogoUrl(url) {
  const s = String(url || '')
  return (
    !s ||
    s === 'logo' ||
    s.endsWith('logonobg.png') ||
    s.includes('/logonobg') ||
    /\/assets\/logonobg[^/]*\.(png|jpe?g|webp|svg)/i.test(s)
  )
}

export function getVehicleGallery(vehicle) {
  const list = Array.isArray(vehicle?.images)
    ? vehicle.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const cleaned = list.filter((u) => !isPlaceholderLogoUrl(u))
  if (cleaned.length) return cleaned
  const single = String(vehicle?.image || '').trim()
  if (single.startsWith('[')) {
    try {
      const arr = JSON.parse(single)
      if (Array.isArray(arr)) {
        return arr.map((u) => String(u || '').trim()).filter((u) => u && !isPlaceholderLogoUrl(u))
      }
    } catch {
      /* fall through */
    }
  }
  if (single && !isPlaceholderLogoUrl(single)) {
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

export function withSyncedPrimaryImage(vehicle) {
  const images = getVehicleGallery(vehicle)
  return {
    ...vehicle,
    images,
    image: images[0] || vehicle?.image || '',
    insuranceImages: getInsuranceImages(vehicle),
  }
}

/** React Native Image `source` — real gallery URI or brand logo. */
export function vehicleImageSource(vehicle) {
  const uri = getVehicleGallery(vehicle)[0] || ''
  if (uri && (uri.startsWith('http') || uri.startsWith('data:') || uri.startsWith('file:'))) {
    return { uri }
  }
  return logoFallback
}
