import { CAR_PHOTO_SLOTS, rentalHasCarPhotos, getCarPhotosAddedBy } from './vehicleMapper';

export function getImageUri(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('data:') || value.startsWith('file:') || value.startsWith('http')) {
    return value;
  }
  return null;
}

export function formatDateTime(value) {
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

export function rentalFullName(personal = {}) {
  return [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || personal.fullName || '—';
}

export function buildRentalReviewDetails(rental) {
  if (!rental) return null;

  const personal = rental.personal || {};
  const vehicle = rental.vehicle || {};
  const rentalInfo = rental.rental || {};

  return {
    transactionId: rental.id || '—',
    fullName: rentalFullName(personal),
    address: personal.address || '—',
    contactNo: personal.contactNo || '—',
    vehicleMake: [vehicle.make, vehicle.series].filter(Boolean).join(' ') || '—',
    plateNo: vehicle.plateNo || vehicle.plate || '—',
    periodFrom: rentalInfo.periodFromLabel || formatDateTime(rentalInfo.periodFrom),
    periodTo: rentalInfo.periodToLabel || formatDateTime(rentalInfo.periodTo),
    holdingLicenseUri: getImageUri(rental.photo),
    customerPhotoUri: getImageUri(rental.licensePhoto),
    vehicleImageUri: getImageUri(vehicle.image),
    carPhotos: CAR_PHOTO_SLOTS.map((slot) => ({
      key: slot.key,
      title: slot.title,
      uri: getImageUri(rental.carPhotos?.[slot.key]),
    })).filter((item) => item.uri),
    carPhotosComplete: rentalHasCarPhotos(rental),
    carPhotosAddedBy: getCarPhotosAddedBy(rental),
  };
}
