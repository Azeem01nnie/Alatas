import { ZAMBOANGA_CITY_ENTRIES } from './zamboangaCity'

function phBarangay(name, city, province) {
  return {
    type: 'barangay',
    name,
    barangay: name,
    city,
    province,
    priority: 0,
  }
}

function phStreet(name, barangay, city, province) {
  return {
    type: 'street',
    name,
    barangay,
    city,
    province,
    priority: 0,
  }
}

/** Secondary Philippine coverage outside Zamboanga City */
const OTHER_PH = [
  phBarangay('Santa Maria', 'Isabela City', 'Basilan'),
  phBarangay('Aguada', 'Isabela City', 'Basilan'),
  phBarangay('Menzi', 'Isabela City', 'Basilan'),
  phBarangay('San Roque', 'Pagadian City', 'Zamboanga del Sur'),
  phBarangay('Balangasan', 'Pagadian City', 'Zamboanga del Sur'),
  phBarangay('Miputak', 'Dipolog City', 'Zamboanga del Norte'),
  phBarangay('Central', 'Dipolog City', 'Zamboanga del Norte'),
  phBarangay('Poblacion', 'Davao City', 'Davao del Sur'),
  phBarangay('Buhangin', 'Davao City', 'Davao del Sur'),
  phBarangay('Talomo', 'Davao City', 'Davao del Sur'),
  phBarangay('Agdao', 'Davao City', 'Davao del Sur'),
  phBarangay('Matina Crossing', 'Davao City', 'Davao del Sur'),
  phBarangay('Carmen', 'Cagayan de Oro City', 'Misamis Oriental'),
  phBarangay('Lapasan', 'Cagayan de Oro City', 'Misamis Oriental'),
  phBarangay('Lagao', 'General Santos City', 'South Cotabato'),
  phBarangay('Lahug', 'Cebu City', 'Cebu'),
  phBarangay('Mabolo', 'Cebu City', 'Cebu'),
  phBarangay('Ermita', 'Manila', 'Metro Manila'),
  phBarangay('Malate', 'Manila', 'Metro Manila'),
  phBarangay('Commonwealth', 'Quezon City', 'Metro Manila'),
  phBarangay('Bel-Air', 'Makati City', 'Metro Manila'),
  phBarangay('Fort Bonifacio', 'Taguig City', 'Metro Manila'),
  phBarangay('Alabang', 'Muntinlupa City', 'Metro Manila'),
  phBarangay('Jaro', 'Iloilo City', 'Iloilo'),
  phStreet('EDSA', '', 'Quezon City', 'Metro Manila'),
  phStreet('Ayala Avenue', 'San Lorenzo', 'Makati City', 'Metro Manila'),
  phStreet('Roxas Boulevard', 'Malate', 'Manila', 'Metro Manila'),
  phStreet('Osmeña Boulevard', '', 'Cebu City', 'Cebu'),
  phStreet('J.P. Laurel Avenue', 'Bajada', 'Davao City', 'Davao del Sur'),
]

export const ADDRESS_ENTRIES = [...ZAMBOANGA_CITY_ENTRIES, ...OTHER_PH]

export const BARANGAY_ENTRIES = ADDRESS_ENTRIES

export function formatAddressLabel(entry) {
  if (entry.type === 'street') {
    const place = entry.barangay
      ? `${entry.barangay}, ${entry.city}`
      : entry.city
    return `${entry.name}, ${place}, ${entry.province}`
  }
  return `${entry.name}, ${entry.city}, ${entry.province}`
}

export function formatBarangayLabel(entry) {
  return formatAddressLabel(entry)
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripAddressPrefix(text) {
  return normalize(text).replace(
    /^(brgy\.?|barangay|bgy\.?|st\.?|street|ave\.?|avenue|rd\.?|road|drv\.?|drive|blvd\.?|boulevard)\s+/i,
    '',
  )
}

/**
 * Ranked suggestions: street/drive first (common typing order),
 * then barangay; Zamboanga City always prioritized.
 */
export function searchAddresses(query, limit = 12) {
  const raw = stripAddressPrefix(query)
  if (!raw) return []

  const looksLikeStreet =
    /\b(st|street|ave|avenue|rd|road|drv|drive|blvd|boulevard|highway|hwy)\b/.test(raw) ||
    /^(veterans|governor|mayor|climaco|jaldon|mcll|rizal|pilar|wharf|labuan|pasonanca|camins|alvarez|lim|agan)/.test(
      raw,
    )

  const scored = []

  for (const entry of ADDRESS_ENTRIES) {
    const name = normalize(entry.name)
    const barangay = normalize(entry.barangay || '')
    const city = normalize(entry.city)
    const province = normalize(entry.province)
    const full = `${name} ${barangay} ${city} ${province}`
    const label = normalize(formatAddressLabel(entry))

    const tokens = raw.split(' ').filter(Boolean)
    const tokensMatch =
      tokens.length > 1 &&
      tokens.every(
        (token) =>
          name.includes(token) ||
          barangay.includes(token) ||
          city.includes(token) ||
          province.includes(token),
      )

    let score = -1
    if (name.startsWith(raw)) score = 120
    else if (tokensMatch && entry.type === 'street') score = 115
    else if (tokensMatch) score = 100
    else if (barangay && barangay.startsWith(raw)) score = 85
    else if (name.includes(raw)) score = 80
    else if (barangay && barangay.includes(raw)) score = 60
    else if (city.startsWith(raw)) score = 45
    else if (full.includes(raw) || label.includes(raw)) score = 35
    else continue

    if (entry.priority === 1) score += 50

    if (entry.type === 'street') {
      score += looksLikeStreet ? 35 : 22
      // Prefer precise street + barangay fills
      if (entry.barangay) score += 8
    } else {
      score += looksLikeStreet ? -8 : 0
    }

    score -= Math.min(name.length, 40) * 0.05

    scored.push({ entry, score })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.entry.type !== b.entry.type) {
      return a.entry.type === 'street' ? -1 : 1
    }
    return a.entry.name.localeCompare(b.entry.name)
  })

  return scored.slice(0, limit).map((s) => s.entry)
}

export function searchBarangays(query, limit = 12) {
  return searchAddresses(query, limit)
}
