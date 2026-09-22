import { isSupabaseConfigured, requireSupabase } from './supabaseClient'
import { collectPhotographerCredits, mergePhotographerCredits } from '../utils/photoCredits'
import { assertSafeDbId } from '../utils/security'

function mapVehicle(row) {
  if (!row) return null
  const images = Array.isArray(row.images)
    ? row.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const insuranceImages = Array.isArray(row.insurance_images)
    ? row.insurance_images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const image = images[0] || row.image || ''
  return {
    id: row.id,
    make: row.make,
    series: row.series,
    bodyType: row.body_type,
    seats: row.seats,
    transmission: row.transmission,
    plateNo: row.plate_no,
    engineNo: row.engine_no,
    chassisNo: row.chassis_no,
    status: row.status,
    image,
    images: images.length ? images : image ? [image] : [],
    insuranceImages,
    insuranceImage: insuranceImages[0] || '',
    ownerId: row.owner_id || '',
    ownerName: row.owner_name || '',
    ownershipType: row.ownership_type || 'company',
    orcrImage: row.orcr_image || '',
    orImage: row.or_image || '',
    reportEntries: Array.isArray(row.report_entries) ? row.report_entries : [],
    rates: {
      hrs5: row.hrs5,
      hrs12: row.hrs12,
      hrs24: row.hrs24,
      exceedHour: row.exceed_hour,
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function toVehicleRow(vehicle) {
  const images = Array.isArray(vehicle?.images)
    ? vehicle.images.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  const primary = images[0] || vehicle?.image || null
  const insuranceImages = Array.isArray(vehicle?.insuranceImages)
    ? vehicle.insuranceImages.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  return {
    id: String(vehicle?.id || '').trim(),
    make: vehicle.make ?? null,
    series: vehicle.series ?? null,
    body_type: vehicle.bodyType ?? null,
    seats: vehicle.seats == null ? null : Number(vehicle.seats),
    transmission: vehicle.transmission ?? null,
    plate_no: vehicle.plateNo ?? null,
    engine_no: vehicle.engineNo ?? null,
    chassis_no: vehicle.chassisNo ?? null,
    status: vehicle.status ?? null,
    image: primary,
    images: images.length ? images : primary ? [primary] : [],
    insurance_images: insuranceImages,
    owner_id: vehicle.ownerId ?? null,
    owner_name: vehicle.ownerName ?? null,
    ownership_type: vehicle.ownershipType ?? 'company',
    orcr_image: vehicle.orcrImage ?? null,
    or_image: vehicle.orImage ?? null,
    hrs5: vehicle.rates?.hrs5 ?? vehicle.hrs5 ?? null,
    hrs12: vehicle.rates?.hrs12 ?? vehicle.hrs12 ?? null,
    hrs24: vehicle.rates?.hrs24 ?? vehicle.hrs24 ?? null,
    exceed_hour: vehicle.rates?.exceedHour ?? vehicle.exceedHour ?? null,
    report_entries: Array.isArray(vehicle.reportEntries) ? vehicle.reportEntries : [],
    created_at: vehicle.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapRental(row) {
  if (!row) return null
  const carPhotos =
    row.car_photos && typeof row.car_photos === 'object' && !Array.isArray(row.car_photos)
      ? row.car_photos
      : {}
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicle: row.vehicle,
    personal: row.personal,
    rental: row.rental,
    photo: row.photo,
    licensePhoto: row.license_photo,
    signature: row.signature,
    carPhotos,
    termsAccepted: Boolean(row.terms_accepted),
    rentalLifecycle: row.rental_lifecycle,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    encodedAt: row.encoded_at,
    createdAt: row.created_at,
    approvalStatus: row.approval_status || 'accepted',
    source: row.source || 'desktop',
    rejectionReason: row.rejection_reason || null,
    updatedAt: row.updated_at || row.created_at,
    carPhotosAddedBy: row.car_photos_added_by || null,
    encodedBy:
      row.encoded_by ||
      (row.personal && typeof row.personal === 'object' ? row.personal.encodedBy : null) ||
      null,
  }
}

function toTimestampOrNull(value) {
  if (value == null || value === false || value === true) return null
  const text = String(value).trim()
  if (!text || text === 'false' || text === 'true') return null
  const ms = Date.parse(text)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

function toRentalRow(rental) {
  const now = new Date().toISOString()
  const vehicleId = rental.vehicleId || rental.vehicle?.id || null
  return {
    id: String(rental?.id || '').trim() || `r-${Date.now()}`,
    vehicle_id: vehicleId ? String(vehicleId) : null,
    vehicle: rental.vehicle ?? null,
    personal: rental.personal ?? null,
    rental: rental.rental ?? null,
    photo: rental.photo ?? null,
    license_photo: rental.licensePhoto ?? null,
    signature: rental.signature ?? null,
    car_photos:
      rental.carPhotos && typeof rental.carPhotos === 'object' ? rental.carPhotos : {},
    terms_accepted: Boolean(rental.termsAccepted),
    rental_lifecycle: rental.rentalLifecycle ?? null,
    started_at: toTimestampOrNull(rental.startedAt),
    completed_at: toTimestampOrNull(rental.completedAt),
    encoded_at: toTimestampOrNull(rental.encodedAt),
    created_at: toTimestampOrNull(rental.createdAt) || now,
    approval_status: rental.approvalStatus || 'accepted',
    source: rental.source || 'desktop',
    rejection_reason: rental.rejectionReason ?? null,
    updated_at: now,
    car_photos_added_by: rental.carPhotosAddedBy ?? null,
  }
}

async function knownVehicleIdSet(sb) {
  const { data, error } = await sb.from('vehicles').select('id')
  if (error) throwSb(error)
  return new Set((data || []).map((row) => String(row.id)))
}

/** Drop vehicle_id when the fleet row is missing so rentals can still save (snapshot stays in vehicle jsonb). */
function withSafeVehicleFk(row, vehicleIds) {
  if (!row.vehicle_id) return row
  if (vehicleIds.has(String(row.vehicle_id))) return row
  return { ...row, vehicle_id: null }
}

function mapEmployee(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    phone: row.phone,
    role: row.role,
    active: row.active !== false,
    authUserId: row.auth_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function throwSb(error, fallback = 'Supabase request failed') {
  throw new Error(String(error?.message || fallback).slice(0, 240))
}

export function fetchVehicles() {
  const sb = requireSupabase()
  return sb
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throwSb(error)
      return (data || []).map(mapVehicle)
    })
}

export async function replaceVehicles(vehicles, options = {}) {
  const prune = Boolean(options.prune)
  const sb = requireSupabase()
  const items = (Array.isArray(vehicles) ? vehicles : [])
    .map(toVehicleRow)
    .filter((v) => v.id)

  // Only delete missing rows for explicit full replaces (import / clear sync).
  // Autosave must never delete fleet rows — a partial client list was wiping vehicles
  // after rental completion and other status updates.
  if (prune) {
    const { data: existing, error: listErr } = await sb.from('vehicles').select('id')
    if (listErr) throwSb(listErr)

    const nextIds = new Set(items.map((v) => v.id))
    const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id))

    if (toDelete.length) {
      const { error } = await sb.from('vehicles').delete().in('id', toDelete)
      if (error) throwSb(error)
    }
  }

  if (items.length) {
    const { error } = await sb.from('vehicles').upsert(items, { onConflict: 'id' })
    if (error) throwSb(error)
  }

  return fetchVehicles()
}

export async function deleteVehicle(id) {
  const sb = requireSupabase()
  const key = String(id || '').trim()
  if (!key) return fetchVehicles()
  const { error } = await sb.from('vehicles').delete().eq('id', key)
  if (error) throwSb(error)
  return fetchVehicles()
}

/** Mark active rental(s) for a vehicle completed and set fleet status Available. */
export async function completeVehicleRental(vehicleId, plateNo = '', rentalId = '') {
  const sb = requireSupabase()
  const key = String(vehicleId || '').trim()
  const plate = String(plateNo || '').trim().toUpperCase()
  const rentalKey = String(rentalId || '').trim()
  if (!key && !plate && !rentalKey) throw new Error('Vehicle id is required')
  const now = new Date().toISOString()

  let completedRentals = []

  if (rentalKey) {
    const { data: byId, error: byIdErr } = await sb
      .from('rentals')
      .update({
        rental_lifecycle: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', rentalKey)
      .select('*')
    if (byIdErr) throwSb(byIdErr)
    completedRentals = byId || []
  }

  if (key) {
    const { data: updatedRentals, error: rentalErr } = await sb
      .from('rentals')
      .update({
        rental_lifecycle: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('rental_lifecycle', 'active')
      .eq('vehicle_id', key)
      .select('*')
    if (rentalErr) throwSb(rentalErr)
    const seen = new Set(completedRentals.map((r) => String(r.id)))
    for (const row of updatedRentals || []) {
      if (!seen.has(String(row.id))) completedRentals.push(row)
    }
  }

  // Complete any other active rows for this vehicle id (JSON) or same plate.
  const { data: activeRows, error: listErr } = await sb
    .from('rentals')
    .select('id, vehicle, vehicle_id')
    .eq('rental_lifecycle', 'active')
  if (listErr) throwSb(listErr)

  const doneIds = new Set(completedRentals.map((r) => String(r.id)))
  const extraIds = (activeRows || [])
    .filter((row) => {
      if (doneIds.has(String(row.id))) return false
      if (rentalKey && String(row.id) === rentalKey) return true
      if (key && String(row.vehicle_id || row.vehicle?.id || '') === key) return true
      if (plate) {
        const rowPlate = String(row.vehicle?.plateNo || row.vehicle?.plate_no || '')
          .trim()
          .toUpperCase()
        return rowPlate === plate
      }
      return false
    })
    .map((row) => row.id)

  if (extraIds.length) {
    const { data: extraUpdated, error } = await sb
      .from('rentals')
      .update({
        rental_lifecycle: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .in('id', extraIds)
      .select('*')
    if (error) throwSb(error)
    completedRentals = [...completedRentals, ...(extraUpdated || [])]
  }

  const vehicleIdsToFree = new Set()
  if (key) vehicleIdsToFree.add(key)
  for (const row of completedRentals) {
    const vid = String(row.vehicle_id || row.vehicle?.id || '').trim()
    if (vid) vehicleIdsToFree.add(vid)
  }

  for (const vid of vehicleIdsToFree) {
    const { error: vehicleErr } = await sb
      .from('vehicles')
      .update({ status: 'Available', updated_at: now })
      .eq('id', vid)
    if (vehicleErr) throwSb(vehicleErr)
  }

  return {
    vehicle: null,
    rentals: completedRentals.map(mapRental),
  }
}

/** Close duplicate open bookings for the same vehicle/plate — keep the newest. */
export async function reconcileDuplicateOpenRentals() {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('rentals')
    .select('*')
    .in('rental_lifecycle', ['active', 'scheduled'])
  if (error) throwSb(error)

  const open = (data || []).filter(
    (r) => r.approval_status !== 'pending' && r.approval_status !== 'rejected',
  )
  const groups = new Map()
  for (const row of open) {
    const vid = String(row.vehicle_id || row.vehicle?.id || '')
    const plate = String(row.vehicle?.plateNo || row.vehicle?.plate_no || '')
      .trim()
      .toUpperCase()
    const key = vid || (plate ? `plate:${plate}` : '')
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const now = new Date().toISOString()
  const toClose = []
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    rows.sort((a, b) => {
      const ta = new Date(a.encoded_at || a.created_at || a.updated_at || 0).getTime()
      const tb = new Date(b.encoded_at || b.created_at || b.updated_at || 0).getTime()
      return tb - ta
    })
    // Keep newest; close older duplicates.
    for (const row of rows.slice(1)) toClose.push(row.id)
  }

  if (!toClose.length) return { closed: 0 }

  const { error: updErr } = await sb
    .from('rentals')
    .update({
      rental_lifecycle: 'completed',
      completed_at: now,
      updated_at: now,
      rejection_reason: 'Auto-closed duplicate open rental',
    })
    .in('id', toClose)
  if (updErr) throwSb(updErr)
  return { closed: toClose.length }
}

export function fetchRentals() {
  const sb = requireSupabase()
  return sb
    .from('rentals')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throwSb(error)
      return (data || []).map(mapRental)
    })
}

function countCarPhotoEntries(carPhotos) {
  if (!carPhotos || typeof carPhotos !== 'object' || Array.isArray(carPhotos)) return 0
  let n = 0
  for (const key of ['front', 'rear', 'left', 'right']) {
    if (carPhotos[key]) n += 1
  }
  if (Array.isArray(carPhotos.extras)) n += carPhotos.extras.filter((x) => x?.uri).length
  return n
}

function dataUrlToBytes(dataUrl) {
  const raw = String(dataUrl || '')
  const match = raw.match(/^data:([^;,]+)?((?:;[^;,]*)*);base64,(.*)$/i)
  if (!match) throw new Error('Could not read image data')
  const mime = match[1] || 'image/jpeg'
  const base64 = match[3] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return { bytes, mime }
}

/** Upload a data-URL image into the public `rentals` bucket; return a stable public URL. */
async function uploadRentalImage(rentalId, fileKey, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return ''
  if (!dataUrl.startsWith('data:')) return dataUrl

  const sb = requireSupabase()
  const { bytes, mime } = dataUrlToBytes(dataUrl)
  const ext = mime.includes('png') ? 'png' : 'jpg'
  const safeKey = String(fileKey || 'photo').replace(/[^\w\-]+/g, '_').slice(0, 40)
  const path = `${String(rentalId)}/${safeKey}-${Date.now()}.${ext}`

  const { error } = await sb.storage.from('rentals').upload(path, bytes, {
    contentType: mime || 'image/jpeg',
    upsert: true,
  })
  if (error) throwSb(error)

  const { data } = sb.storage.from('rentals').getPublicUrl(path)
  return data?.publicUrl || ''
}

/** Convert embedded data-URLs in carPhotos to Storage URLs so the DB row stays small. */
async function materializeCarPhotos(rentalId, carPhotos) {
  const source =
    carPhotos && typeof carPhotos === 'object' && !Array.isArray(carPhotos) ? carPhotos : {}
  const out = { ...source }

  const safeUpload = async (fileKey, dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl || ''
    try {
      return await uploadRentalImage(rentalId, fileKey, dataUrl)
    } catch (err) {
      console.warn(`Car photo upload failed for ${fileKey}; keeping local image`, err)
      return dataUrl
    }
  }

  for (const key of ['front', 'rear', 'left', 'right']) {
    if (typeof out[key] === 'string' && out[key].startsWith('data:')) {
      out[key] = await safeUpload(key, out[key])
    }
  }

  if (Array.isArray(out.extras)) {
    out.extras = await Promise.all(
      out.extras.map(async (item, index) => {
        if (!item || typeof item !== 'object') return item
        if (typeof item.uri !== 'string' || !item.uri.startsWith('data:')) return item
        const uri = await safeUpload(`extra-${item.id || index}`, item.uri)
        return { ...item, uri }
      }),
    )
  }

  return out
}

export async function replaceRentals(rentals, options = {}) {
  const prune = Boolean(options.prune)
  const sb = requireSupabase()
  const vehicleIds = await knownVehicleIdSet(sb)
  let items = (Array.isArray(rentals) ? rentals : [])
    .map(toRentalRow)
    .filter((r) => r.id)
    .map((row) => withSafeVehicleFk(row, vehicleIds))

  // Preserve pending rows omitted from desk autosave payloads
  const { data: pendingRows, error: pendingErr } = await sb
    .from('rentals')
    .select('*')
    .eq('approval_status', 'pending')
  if (pendingErr) throwSb(pendingErr)

  const incomingIds = new Set(items.map((r) => r.id))
  const preserved = (pendingRows || [])
    .filter((r) => !incomingIds.has(r.id))
    .filter(
      (r) =>
        r.approval_status === 'pending' &&
        (r.rental_lifecycle === 'pending_approval' || !r.rental_lifecycle),
    )
    .map((r) =>
      withSafeVehicleFk(
        { ...r, updated_at: r.updated_at || new Date().toISOString() },
        vehicleIds,
      ),
    )

  // Never let a stale desk autosave wipe photos that already exist on the server.
  const { data: existingPhotoRows, error: photoErr } = await sb
    .from('rentals')
    .select('id, car_photos, car_photos_added_by')
  if (photoErr) throwSb(photoErr)
  const photoById = new Map((existingPhotoRows || []).map((r) => [String(r.id), r]))
  items = items.map((row) => {
    const prev = photoById.get(String(row.id))
    if (!prev) return row
    const incomingCount = countCarPhotoEntries(row.car_photos)
    const existingCount = countCarPhotoEntries(prev.car_photos)
    if (existingCount > 0 && incomingCount === 0) {
      return {
        ...row,
        car_photos: prev.car_photos,
        car_photos_added_by: prev.car_photos_added_by ?? row.car_photos_added_by,
      }
    }
    return row
  })

  if (prune) {
    const { data: existing, error: listErr } = await sb.from('rentals').select('id')
    if (listErr) throwSb(listErr)

    const keepIds = new Set([...incomingIds, ...preserved.map((r) => r.id)])
    const toDelete = (existing || []).map((r) => r.id).filter((id) => !keepIds.has(id))

    if (toDelete.length) {
      const { error } = await sb.from('rentals').delete().in('id', toDelete)
      if (error) throwSb(error)
    }
  }

  const upsertRows = [...items, ...preserved]
  if (upsertRows.length) {
    const { error } = await sb.from('rentals').upsert(upsertRows, { onConflict: 'id' })
    if (error) throwSb(error)
  }

  return fetchRentals()
}

/** Shrink rental media for insert — Storage URLs instead of huge base64 in Postgres. */
async function materializeRentalMedia(rental) {
  const id = String(rental?.id || '').trim() || `r-${Date.now()}`
  const next = { ...rental, id }

  const safeUpload = async (fileKey, dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl || ''
    try {
      return await uploadRentalImage(id, fileKey, dataUrl)
    } catch (err) {
      console.warn(`Storage upload failed for ${fileKey}; keeping compressed data URL`, err)
      return dataUrl
    }
  }

  if (typeof next.photo === 'string' && next.photo.startsWith('data:')) {
    next.photo = await safeUpload('customer', next.photo)
  }
  if (typeof next.licensePhoto === 'string' && next.licensePhoto.startsWith('data:')) {
    next.licensePhoto = await safeUpload('license', next.licensePhoto)
  }
  if (typeof next.signature === 'string' && next.signature.startsWith('data:')) {
    next.signature = await safeUpload('signature', next.signature)
  }
  if (next.personal?.optionalPhoto?.startsWith?.('data:')) {
    next.personal = {
      ...next.personal,
      optionalPhoto: await safeUpload('optional', next.personal.optionalPhoto),
    }
  }
  if (next.carPhotos && typeof next.carPhotos === 'object') {
    try {
      next.carPhotos = await materializeCarPhotos(id, next.carPhotos)
    } catch (err) {
      console.warn('Car photo storage upload failed; keeping compressed photos', err)
    }
  }
  if (next.vehicle?.image?.startsWith?.('data:')) {
    next.vehicle = {
      ...next.vehicle,
      image: await safeUpload('vehicle', next.vehicle.image),
    }
  }

  return next
}

export async function addRental(rental) {
  const sb = requireSupabase()
  let vehicleIds = await knownVehicleIdSet(sb)
  const prepared = await materializeRentalMedia(rental)
  const desiredId = prepared.vehicleId || prepared.vehicle?.id || null
  const lifecycle = prepared.rentalLifecycle || 'completed'
  const isOpenBooking = lifecycle === 'active' || lifecycle === 'scheduled'

  // If the desk has a vehicle snapshot that isn't in Supabase yet, create a minimal row.
  if (desiredId && !vehicleIds.has(String(desiredId)) && prepared.vehicle) {
    const v = prepared.vehicle
    const { error: vehicleErr } = await sb.from('vehicles').upsert(
      {
        id: String(desiredId),
        make: v.make ?? null,
        series: v.series ?? null,
        body_type: v.bodyType ?? null,
        plate_no: v.plateNo ?? null,
        engine_no: v.engineNo ?? null,
        chassis_no: v.chassisNo ?? null,
        status: v.status || 'Available',
        image: v.image ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (!vehicleErr) {
      vehicleIds = new Set(vehicleIds).add(String(desiredId))
    }
  }

  // Prevent double-booking the same vehicle (admin auto-approve used to skip this).
  if (desiredId && isOpenBooking) {
    const { data: blocked, error: blockErr } = await sb.rpc('vehicle_is_blocked', {
      p_vehicle_id: String(desiredId),
      p_except_rental_id: prepared.id ? String(prepared.id) : null,
    })
    if (blockErr) throwSb(blockErr)
    if (blocked?.blocked) {
      throw new Error(blocked.reason || 'Vehicle already has an active or scheduled rental.')
    }
  }

  // Also block when another open rental shares the same plate (re-created vehicle ids).
  const plate = String(prepared.vehicle?.plateNo || '').trim().toUpperCase()
  if (plate && isOpenBooking) {
    const { data: openRows, error: openErr } = await sb
      .from('rentals')
      .select('id, vehicle, vehicle_id, rental_lifecycle, approval_status')
      .in('rental_lifecycle', ['active', 'scheduled'])
    if (openErr) throwSb(openErr)
    const clash = (openRows || []).find((row) => {
      if (prepared.id && String(row.id) === String(prepared.id)) return false
      if (row.approval_status === 'pending' || row.approval_status === 'rejected') return false
      const rowPlate = String(row.vehicle?.plateNo || row.vehicle?.plate_no || '')
        .trim()
        .toUpperCase()
      return rowPlate && rowPlate === plate
    })
    if (clash) {
      throw new Error(`Vehicle ${plate} already has an active or scheduled rental.`)
    }
  }

  const row = withSafeVehicleFk(toRentalRow(prepared), vehicleIds)
  const { data, error } = await sb.from('rentals').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error) throwSb(error)

  if (isOpenBooking && desiredId && lifecycle === 'active') {
    await sb
      .from('vehicles')
      .update({ status: 'Rented', updated_at: new Date().toISOString() })
      .eq('id', String(desiredId))
  }

  return mapRental(data)
}

/** Targeted car-photo update — uploads images to Storage, then patches only this rental. */
export async function patchRentalCarPhotos(rentalId, carPhotos, addedBy = '') {
  const sb = requireSupabase()
  const id = String(rentalId || '').trim()
  if (!id) throw new Error('Rental id is required')

  const nextPhotos =
    carPhotos && typeof carPhotos === 'object' && !Array.isArray(carPhotos) ? carPhotos : {}

  const { data: existingRow, error: existingErr } = await sb
    .from('rentals')
    .select('car_photos, car_photos_added_by')
    .eq('id', id)
    .maybeSingle()
  if (existingErr) throwSb(existingErr)
  if (!existingRow) throw new Error('Rental not found — could not save photos')

  const newName = String(addedBy || '').trim()
  const mergedCredit = mergePhotographerCredits(
    existingRow.car_photos_added_by,
    collectPhotographerCredits(existingRow.car_photos),
    collectPhotographerCredits(nextPhotos),
    newName,
  )
  const addedByName = mergedCredit || null

  const materialized = await materializeCarPhotos(id, nextPhotos)
  const stamped = {
    ...materialized,
    ...(addedByName ? { _addedBy: addedByName } : {}),
  }
  const now = new Date().toISOString()

  const { data, error } = await sb
    .from('rentals')
    .update({
      car_photos: stamped,
      car_photos_added_by: addedByName,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throwSb(error)
  if (!data) throw new Error('Rental not found — could not save photos')
  return mapRental(data)
}

export async function submitPendingRental(rental) {
  return addRental({
    ...rental,
    approvalStatus: 'pending',
    rentalLifecycle: 'pending_approval',
    source: rental.source || 'field',
  })
}

export function fetchPendingRentals() {
  const sb = requireSupabase()
  return sb
    .from('rentals')
    .select('*')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throwSb(error)
      return (data || [])
        .map(mapRental)
        .filter(
          (r) =>
            r.approvalStatus === 'pending' &&
            (r.rentalLifecycle === 'pending_approval' || !r.rentalLifecycle),
        )
    })
}

export async function acceptPendingRental(id) {
  const sb = requireSupabase()
  const key = String(id)
  const { data, error } = await sb.rpc('accept_pending_rental', { p_id: key })
  if (!error) return mapRental(data)

  // Fallback when RPC is missing / outdated — still clear the pending queue.
  const now = new Date().toISOString()
  const { data: row, error: fetchErr } = await sb.from('rentals').select('*').eq('id', key).maybeSingle()
  if (fetchErr) throwSb(error)
  if (!row) throwSb(error)
  const periodFrom = row.rental?.periodFrom ? new Date(row.rental.periodFrom).getTime() : NaN
  const startNow = Number.isNaN(periodFrom) || periodFrom <= Date.now()
  const { data: updated, error: updErr } = await sb
    .from('rentals')
    .update({
      approval_status: 'accepted',
      rental_lifecycle: startNow ? 'active' : 'scheduled',
      started_at: startNow ? now : null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq('id', key)
    .select('*')
    .single()
  if (updErr) throwSb(updErr)
  if (startNow && row.vehicle_id) {
    await sb.from('vehicles').update({ status: 'Rented', updated_at: now }).eq('id', row.vehicle_id)
  }
  return mapRental(updated)
}

export async function rejectPendingRental(id, reason = '') {
  const sb = requireSupabase()
  const key = String(id)
  const { data, error } = await sb.rpc('reject_pending_rental', {
    p_id: key,
    p_reason: reason || '',
  })
  if (!error) return mapRental(data)

  const now = new Date().toISOString()
  const { data: updated, error: updErr } = await sb
    .from('rentals')
    .update({
      approval_status: 'rejected',
      rental_lifecycle: 'cancelled',
      rejection_reason: String(reason || '').trim() || null,
      updated_at: now,
    })
    .eq('id', key)
    .select('*')
    .single()
  if (updErr) throwSb(error)
  return mapRental(updated)
}

export async function fetchSystemStatus() {
  if (!isSupabaseConfigured) {
    return {
      mode: 'unconfigured',
      pendingApprovalCount: 0,
      pendingSyncCount: 0,
      online: false,
    }
  }
  try {
    const pending = await fetchPendingRentals()
    return {
      mode: 'supabase',
      pendingApprovalCount: pending.length,
      pendingSyncCount: 0,
      online: true,
      cloudSyncEnabled: false,
    }
  } catch (err) {
    return {
      mode: 'supabase',
      pendingApprovalCount: 0,
      pendingSyncCount: 0,
      online: false,
      error: err?.message || String(err),
    }
  }
}

/** Sync queue removed — Supabase is source of truth. */
export async function fetchSyncQueue() {
  return []
}

export async function flushSyncQueue() {
  return { ok: true, skipped: true, reason: 'Supabase has no sync queue' }
}

export async function pullFromCloudViaBackend() {
  return { ok: true, skipped: true, reason: 'Already on Supabase' }
}

export async function runCloudSync() {
  return { ok: true, skipped: true, reason: 'Supabase is the backend; no Render sync' }
}

export async function fetchAdminProfile() {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_profile')
    .maybeSingle()
  if (error) throwSb(error)
  const value = data?.value || {}
  return {
    displayName: String(value.displayName || '').trim() || 'Alatas Admin',
    photo: typeof value.photo === 'string' ? value.photo : '',
  }
}

export async function saveAdminProfileRemote(profile) {
  const sb = requireSupabase()
  const next = {
    displayName: String(profile?.displayName || '').trim() || 'Alatas Admin',
    photo: typeof profile?.photo === 'string' ? profile.photo : '',
  }
  const { error } = await sb.from('app_settings').upsert({
    key: 'admin_profile',
    value: next,
    updated_at: new Date().toISOString(),
  })
  if (error) throwSb(error)
  return next
}

export async function fetchVehicleReportsRemote() {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'vehicle_reports')
    .maybeSingle()
  if (error) throwSb(error)
  const value = data?.value && typeof data.value === 'object' ? data.value : {}
  return {
    entries: Array.isArray(value.entries) ? value.entries : [],
    submissions: Array.isArray(value.submissions) ? value.submissions : [],
  }
}

export async function saveVehicleReportsRemote(store) {
  const sb = requireSupabase()
  const next = {
    entries: Array.isArray(store?.entries) ? store.entries : [],
    submissions: Array.isArray(store?.submissions) ? store.submissions : [],
  }
  const { error } = await sb.from('app_settings').upsert({
    key: 'vehicle_reports',
    value: next,
    updated_at: new Date().toISOString(),
  })
  if (error) throwSb(error)
  return next
}

/** Update only report_entries for one vehicle — never touch owner/make/plate fields. */
export async function patchVehicleReportEntries(vehicleId, entries) {
  const sb = requireSupabase()
  const key = String(vehicleId || '').trim()
  if (!key) return null
  const { data, error } = await sb
    .from('vehicles')
    .update({
      report_entries: Array.isArray(entries) ? entries : [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', key)
    .select('*')
    .maybeSingle()
  if (error) throwSb(error)
  return data ? mapVehicle(data) : null
}

function isPreservedAdminEmployee(row, currentUserId) {
  const username = String(row?.username || '').trim().toLowerCase()
  const id = String(row?.id || '')
  const role = String(row?.role || '').trim().toLowerCase()
  if (username === 'alatas' || id === 'emp-alatas-admin' || role === 'admin') return true
  if (currentUserId && String(row?.auth_user_id || '') === String(currentUserId)) return true
  return false
}

async function deleteAllRowsById(sb, table) {
  const { data: rows, error: listErr } = await sb.from(table).select('id')
  if (listErr) throwSb(listErr)
  const ids = (rows || []).map((row) => String(row.id)).filter(Boolean)
  if (!ids.length) return 0

  const chunkSize = 200
  let deleted = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { error } = await sb.from(table).delete().in('id', chunk)
    if (error) throwSb(error)
    deleted += chunk.length
  }
  return deleted
}

async function countRows(sb, table) {
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true })
  if (error) throwSb(error)
  return Number(count || 0)
}

async function clearStorageBucket(sb, bucketId) {
  try {
    const { data: entries, error } = await sb.storage.from(bucketId).list('', {
      limit: 1000,
      offset: 0,
    })
    if (error || !Array.isArray(entries) || !entries.length) return 0

    const paths = []
    for (const entry of entries) {
      const name = String(entry?.name || '').trim()
      if (!name) continue
      if (!entry.id) {
        const { data: nested } = await sb.storage.from(bucketId).list(name, {
          limit: 1000,
          offset: 0,
        })
        for (const child of nested || []) {
          const childName = String(child?.name || '').trim()
          if (childName) paths.push(`${name}/${childName}`)
        }
        continue
      }
      paths.push(name)
    }

    if (!paths.length) return 0
    const { error: removeErr } = await sb.storage.from(bucketId).remove(paths)
    if (removeErr) return 0
    return paths.length
  } catch {
    return 0
  }
}

async function clearAppDataClientFallback(sb) {
  const {
    data: { user },
  } = await sb.auth.getUser()
  const currentUserId = user?.id || null

  const rentalsDeleted = await deleteAllRowsById(sb, 'rentals')
  const vehiclesDeleted = await deleteAllRowsById(sb, 'vehicles')

  const { data: employees, error: empListErr } = await sb
    .from('employees')
    .select('id, username, auth_user_id, role')
  if (empListErr) throwSb(empListErr)

  const toDelete = (employees || []).filter((row) => !isPreservedAdminEmployee(row, currentUserId))
  if (toDelete.length) {
    const { error: empDelErr } = await sb
      .from('employees')
      .delete()
      .in(
        'id',
        toDelete.map((row) => row.id),
      )
    if (empDelErr) throwSb(empDelErr)
  }

  const { error: reportsErr } = await sb.from('app_settings').upsert({
    key: 'vehicle_reports',
    value: { entries: [], submissions: [] },
    updated_at: new Date().toISOString(),
  })
  if (reportsErr) throwSb(reportsErr)

  const storageDeleted =
    (await clearStorageBucket(sb, 'vehicles')) +
    (await clearStorageBucket(sb, 'rentals')) +
    (await clearStorageBucket(sb, 'reports'))

  const rentalsLeft = await countRows(sb, 'rentals')
  const vehiclesLeft = await countRows(sb, 'vehicles')
  if (rentalsLeft > 0 || vehiclesLeft > 0) {
    throw new Error(
      `Clear incomplete on Supabase (${vehiclesLeft} vehicles, ${rentalsLeft} rentals still remain). Check table permissions and re-run migration 005.`,
    )
  }

  return {
    ok: true,
    mode: 'client-fallback',
    rentalsDeleted,
    vehiclesDeleted,
    employeesDeleted: toDelete.length,
    storageObjectsDeleted: storageDeleted,
  }
}

/**
 * Wipe fleet / rentals / staff data. Keeps admin Auth credentials + admin employee row.
 * Tries RPC first, then always runs a verified client wipe so Supabase tables are empty.
 */
export async function clearAllAppData() {
  const sb = requireSupabase()

  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not signed in to Supabase. Sign in as admin and try Clear data again.')
  }

  let rpcResult = null
  const { data, error } = await sb.rpc('clear_app_data')
  if (!error) {
    rpcResult = data || { ok: true, mode: 'rpc' }
  } else {
    console.warn('clear_app_data RPC failed; using client wipe', error?.message || error)
  }

  // Always wipe via client too (covers missing/outdated RPC and verifies emptiness).
  const clientResult = await clearAppDataClientFallback(sb)
  return {
    ok: true,
    mode: rpcResult ? 'rpc+client' : 'client-fallback',
    rpc: rpcResult,
    ...clientResult,
  }
}

export function fetchEmployees() {
  const sb = requireSupabase()
  return sb
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throwSb(error)
      return (data || []).map(mapEmployee)
    })
}

export async function createEmployee(employee) {
  const sb = requireSupabase()
  const password = String(employee.password || '')
  if (!password) {
    throw new Error('Password is required to create an employee login')
  }

  const safeUsername = assertSafeDbId(String(employee.username || '').trim(), 'username')

  const { data, error } = await sb.rpc('create_employee_with_auth', {
    p_id: String(employee.id || `e-${Date.now()}`),
    p_name: employee.name ?? '',
    p_username: safeUsername,
    p_phone: employee.phone ?? '',
    p_role: employee.role || 'Staff',
    p_password: password,
  })
  if (error) throwSb(error)
  return mapEmployee(data)
}

export async function updateEmployee(id, patch) {
  const sb = requireSupabase()
  let latest = null

  if (patch.password) {
    const { data, error } = await sb.rpc('update_employee_password', {
      p_employee_id: String(id),
      p_password: String(patch.password),
    })
    if (error) throwSb(error)
    latest = data
  }

  const updates = {}
  if (patch.name !== undefined) updates.name = patch.name
  if (patch.username !== undefined) updates.username = patch.username
  if (patch.phone !== undefined) updates.phone = patch.phone
  if (patch.role !== undefined) updates.role = patch.role
  if (patch.active !== undefined) updates.active = patch.active

  if (Object.keys(updates).length === 0) {
    return mapEmployee(latest)
  }

  updates.updated_at = new Date().toISOString()
  const { data, error } = await sb
    .from('employees')
    .update(updates)
    .eq('id', String(id))
    .select('*')
    .single()
  if (error) throwSb(error)
  return mapEmployee(data)
}

export async function deleteEmployee(id) {
  const sb = requireSupabase()
  const { error } = await sb.from('employees').delete().eq('id', String(id))
  if (error) throwSb(error)
  return { ok: true }
}

/** Prefer Supabase Auth; this remains for legacy employee table checks. */
export async function authenticateEmployee(username, password) {
  const sb = requireSupabase()
  const emailGuess = username.includes('@') ? username.trim() : `${username.trim()}@alatas.local`
  const { data, error } = await sb.auth.signInWithPassword({
    email: emailGuess,
    password,
  })
  if (error) throwSb(error, 'Invalid username or password')

  const { data: emp } = await sb
    .from('employees')
    .select('*')
    .eq('username', username.trim())
    .maybeSingle()

  if (emp) return mapEmployee(emp)

  return {
    id: data.user?.id,
    name: data.user?.user_metadata?.displayName || username,
    username: username.trim(),
    role: data.user?.app_metadata?.role || 'Staff',
    active: true,
  }
}
