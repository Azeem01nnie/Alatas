/** Normalize vehicle display gallery (multi-image) with legacy `image` fallback. */
import { findCatalogImage } from '../data/vehicles'
import logoFallback from '../assets/logo.jpg'

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

/**
 * Best display image: uploaded gallery → catalog stock match → Alatas logo.
 * Use this in lists/cards so units without a photo still show something.
 */
export function resolveVehicleDisplayImage(vehicle) {
  const gallery = getVehicleGallery(vehicle)
  if (gallery[0]) return gallery[0]
  const catalog = findCatalogImage(vehicle?.make, vehicle?.series)
  if (catalog) return catalog
  return logoFallback
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
