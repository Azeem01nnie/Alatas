const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Backend request failed: ${response.status} ${response.statusText} ${errorText}`)
  }
  return response.json()
}

export function fetchVehicles() {
  return request('/api/vehicles')
}

export function replaceVehicles(vehicles) {
  return request('/api/vehicles', {
    method: 'PUT',
    body: JSON.stringify(vehicles),
  })
}

export function deleteVehicle(id) {
  return request(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function fetchRentals() {
  return request('/api/rentals')
}

export function replaceRentals(rentals) {
  return request('/api/rentals', {
    method: 'PUT',
    body: JSON.stringify(rentals),
  })
}

export function addRental(rental) {
  return request('/api/rentals', {
    method: 'POST',
    body: JSON.stringify(rental),
  })
}
