import { safeSetItem } from '../utils/storage'

import imgWigo from '../assets/cars/toyotawigo.webp'
import imgMirage from '../assets/cars/mistubishimirage.png'
import imgAlmera from '../assets/cars/nissanalmera.jpg'
import imgVios from '../assets/cars/toyotavios.png'
import imgLivina from '../assets/cars/nissanlivina.webp'
import imgXpander from '../assets/cars/mitsubishixpander.jpg'
import imgInnova from '../assets/cars/toyotainnova.jpg'
import imgMontero from '../assets/cars/mitsubishimontero.png'
import imgTerra from '../assets/cars/nissanterra.jpg'
import imgFortuner from '../assets/cars/toyotafortuner.avif'
import imgHilux from '../assets/cars/toyotahilux.jpg'
import imgNavara from '../assets/cars/nissannavara.jpg'
import imgStrada from '../assets/cars/mitsubishistrada.jpg'
import imgConquest from '../assets/cars/toyotaconquest.webp'
import imgNavaraCalx from '../assets/cars/nissancalibrex.jpg'
import imgWildtrak from '../assets/cars/fordwildtrak.jpg'
import imgCommuter from '../assets/cars/toyotacommuter.jpg'
import imgUrvanPremium from '../assets/cars/nissanurvanpremium.webp'
import imgUrvan from '../assets/cars/nissanurvan.jpg'
import imgHiace from '../assets/cars/toyotahiace.jpg'

const STORAGE_KEY = 'alatas-vehicles-v6'

export const VEHICLE_STATUSES = ['Available', 'Rented', 'Under Maintenance']

export const BODY_TYPES = [
  'Hatchback',
  'Sedan',
  'MPV',
  'SUV',
  'Pick-up',
  'Van',
]

function rates(hrs5, hrs12, hrs24, exceedHour) {
  return { hrs5, hrs12, hrs24, exceedHour }
}

function car({
  id,
  make,
  series,
  bodyType,
  seats,
  transmission,
  plateNo,
  rates: rateCard,
  image,
  status = 'Available',
}) {
  return {
    id,
    make,
    series,
    bodyType,
    seats,
    transmission,
    plateNo,
    engineNo: `ENG-${id.toUpperCase()}`,
    chassisNo: `CHS-${id.toUpperCase()}`,
    status,
    image,
    rates: rateCard,
  }
}

const R_HATCH_SEDAN = rates(850, 1500, 2500, 150)
const R_MPV_INNOVA = rates(1200, 2000, 3000, 200)
const R_SUV_PREMIUM = rates(1500, 2500, 3500, 200)
const R_PICKUP = rates(1500, 2500, 3500, 200)
const R_VAN_PREMIUM = rates(2000, 2800, 3800, 250)
const R_VAN_STANDARD = rates(1500, 2500, 3500, 230)

export const DEFAULT_VEHICLES = [
  car({
    id: 'wigo',
    make: 'Toyota',
    series: 'Wigo',
    bodyType: 'Hatchback',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'WGO 1001',
    rates: R_HATCH_SEDAN,
    image: imgWigo,
  }),
  car({
    id: 'mirage',
    make: 'Mitsubishi',
    series: 'Mirage',
    bodyType: 'Sedan',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'MRG 1002',
    rates: R_HATCH_SEDAN,
    image: imgMirage,
  }),
  car({
    id: 'almera',
    make: 'Nissan',
    series: 'Almera',
    bodyType: 'Sedan',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'ALM 1003',
    rates: R_HATCH_SEDAN,
    image: imgAlmera,
  }),
  car({
    id: 'vios',
    make: 'Toyota',
    series: 'Vios',
    bodyType: 'Sedan',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'VIO 1004',
    rates: R_HATCH_SEDAN,
    image: imgVios,
  }),
  car({
    id: 'livina',
    make: 'Nissan',
    series: 'Livina',
    bodyType: 'MPV',
    seats: 7,
    transmission: 'Automatic',
    plateNo: 'LIV 2001',
    rates: R_MPV_INNOVA,
    image: imgLivina,
  }),
  car({
    id: 'expander',
    make: 'Mitsubishi',
    series: 'Xpander',
    bodyType: 'MPV',
    seats: 7,
    transmission: 'Automatic',
    plateNo: 'XPD 2002',
    rates: R_MPV_INNOVA,
    image: imgXpander,
  }),
  car({
    id: 'innova',
    make: 'Toyota',
    series: 'Innova',
    bodyType: 'SUV',
    seats: 8,
    transmission: 'Automatic',
    plateNo: 'INN 3001',
    rates: R_MPV_INNOVA,
    image: imgInnova,
  }),
  car({
    id: 'montero',
    make: 'Mitsubishi',
    series: 'Montero',
    bodyType: 'SUV',
    seats: 8,
    transmission: 'Manual / Automatic',
    plateNo: 'MON 3002',
    rates: R_SUV_PREMIUM,
    image: imgMontero,
  }),
  car({
    id: 'terra',
    make: 'Nissan',
    series: 'Terra',
    bodyType: 'SUV',
    seats: 8,
    transmission: 'Manual / Automatic',
    plateNo: 'TER 3003',
    rates: R_SUV_PREMIUM,
    image: imgTerra,
  }),
  car({
    id: 'fortuner',
    make: 'Toyota',
    series: 'Fortuner',
    bodyType: 'SUV',
    seats: 8,
    transmission: 'Manual / Automatic',
    plateNo: 'FOR 3004',
    rates: R_SUV_PREMIUM,
    image: imgFortuner,
  }),
  car({
    id: 'hilux',
    make: 'Toyota',
    series: 'Hilux',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'HLX 4001',
    rates: R_PICKUP,
    image: imgHilux,
  }),
  car({
    id: 'navara',
    make: 'Nissan',
    series: 'Navara',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'NAV 4002',
    rates: R_PICKUP,
    image: imgNavara,
  }),
  car({
    id: 'strada',
    make: 'Mitsubishi',
    series: 'Strada',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'STR 4003',
    rates: R_PICKUP,
    image: imgStrada,
  }),
  car({
    id: 'conquest',
    make: 'Toyota',
    series: 'Conquest',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'CQE 4004',
    rates: R_PICKUP,
    image: imgConquest,
  }),
  car({
    id: 'navara-calx',
    make: 'Nissan',
    series: 'Navara Calibre X',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'NCX 4005',
    rates: R_PICKUP,
    image: imgNavaraCalx,
  }),
  car({
    id: 'wildtrak',
    make: 'Ford',
    series: 'Ranger Wildtrak',
    bodyType: 'Pick-up',
    seats: 5,
    transmission: 'Automatic',
    plateNo: 'WLD 4006',
    rates: R_PICKUP,
    image: imgWildtrak,
  }),
  car({
    id: 'commuter-deluxe',
    make: 'Toyota',
    series: 'Commuter Deluxe',
    bodyType: 'Van',
    seats: 15,
    transmission: 'Manual',
    plateNo: 'CDX 5001',
    rates: R_VAN_PREMIUM,
    image: imgCommuter,
  }),
  car({
    id: 'nissan-premium',
    make: 'Nissan',
    series: 'Urvan Premium',
    bodyType: 'Van',
    seats: 15,
    transmission: 'Automatic',
    plateNo: 'NSP 5002',
    rates: R_VAN_PREMIUM,
    image: imgUrvanPremium,
  }),
  car({
    id: 'urvan',
    make: 'Nissan',
    series: 'Urvan',
    bodyType: 'Van',
    seats: 15,
    transmission: 'Manual',
    plateNo: 'URV 5003',
    rates: R_VAN_STANDARD,
    image: imgUrvan,
  }),
  car({
    id: 'hiace',
    make: 'Toyota',
    series: 'Hiace Commuter',
    bodyType: 'Van',
    seats: 15,
    transmission: 'Manual',
    plateNo: 'HIA 5004',
    rates: R_VAN_STANDARD,
    image: imgHiace,
  }),
]

export function formatPeso(amount) {
  if (amount === '' || amount == null || Number.isNaN(Number(amount))) return '—'
  return `₱${Number(amount).toLocaleString('en-PH')}`
}

export function formatRateSummary(rateCard) {
  if (!rateCard) return 'No rates set'
  return `5h ${formatPeso(rateCard.hrs5)} · 12h ${formatPeso(rateCard.hrs12)} · 24h ${formatPeso(rateCard.hrs24)} · +${formatPeso(rateCard.exceedHour)}/hr`
}

function normalizeRates(ratesInput) {
  const src = ratesInput || {}
  return {
    hrs5: Number(src.hrs5) || 0,
    hrs12: Number(src.hrs12) || 0,
    hrs24: Number(src.hrs24) || 0,
    exceedHour: Number(src.exceedHour) || 0,
  }
}

function normalizeVehicle(v) {
  return {
    ...v,
    seats: Number(v.seats) || 5,
    transmission: v.transmission || 'Automatic',
    status: VEHICLE_STATUSES.includes(v.status) ? v.status : 'Available',
    rates: normalizeRates(v.rates),
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
