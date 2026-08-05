import { safeSetItem } from '../utils/storage'

const STORAGE_KEY = 'customer-encoder-vehicles'

export const VEHICLE_STATUSES = ['Available', 'Rented', 'Under Maintenance']

export const DEFAULT_VEHICLES = [
  {
    id: 'v1',
    make: 'Nissan',
    engineNo: 'QR25-DE-48291',
    bodyType: 'Pick-up',
    plateNo: 'ABC 1234',
    series: 'Navara Pro-4X',
    chassisNo: 'JN1TBNP23U0123456',
    status: 'Available',
    image:
      'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v2',
    make: 'Toyota',
    engineNo: '2GD-FTV-77302',
    bodyType: 'SUV',
    plateNo: 'XYZ 5678',
    series: 'Fortuner G',
    chassisNo: 'MR0KA8CD5K0123456',
    status: 'Rented',
    image:
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v3',
    make: 'Hyundai',
    engineNo: 'D4CB-99104',
    bodyType: 'Van',
    plateNo: 'HND 9012',
    series: 'Starex Premium',
    chassisNo: 'KMJWA37HPBU012345',
    status: 'Available',
    image:
      'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v4',
    make: 'Mitsubishi',
    engineNo: '4N15-33421',
    bodyType: 'Pick-up',
    plateNo: 'MTS 3456',
    series: 'Strada Athlete',
    chassisNo: 'MMBJNKB40KD012345',
    status: 'Under Maintenance',
    image:
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v5',
    make: 'Honda',
    engineNo: 'L15B-22847',
    bodyType: 'Sedan',
    plateNo: 'HND 7890',
    series: 'City RS',
    chassisNo: 'MRHGM6640KP012345',
    status: 'Available',
    image:
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v6',
    make: 'Isuzu',
    engineNo: '4JJ1-55603',
    bodyType: 'Pick-up',
    plateNo: 'ISU 1122',
    series: 'D-Max LS',
    chassisNo: 'MPATFS85JKT012345',
    status: 'Rented',
    image:
      'https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?auto=format&fit=crop&w=800&q=80',
  },
]

function normalizeVehicle(v) {
  return {
    ...v,
    status: VEHICLE_STATUSES.includes(v.status) ? v.status : 'Available',
  }
}

export function loadVehicles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VEHICLES.map(normalizeVehicle)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_VEHICLES.map(normalizeVehicle)
    }
    return parsed.map(normalizeVehicle)
  } catch {
    return DEFAULT_VEHICLES.map(normalizeVehicle)
  }
}

export function saveVehicles(vehicles) {
  const result = safeSetItem(STORAGE_KEY, JSON.stringify(vehicles))
  if (!result.ok) {
    console.warn('Unable to persist vehicles to localStorage', result.error)
    return false
  }
  return true
}
