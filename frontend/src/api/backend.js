import { isSupabaseConfigured, requireSupabase } from './supabaseClient'
import { collectPhotographerCredits, mergePhotographerCredits } from '../utils/photoCredits'

function mapVehicle(row) {
  if (!row) return null
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
    image: row.image,
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
    image: vehicle.image ?? null,
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
    started_at: rental.startedAt ?? null,
    completed_at: rental.completedAt ?? null,
    encoded_at: rental.encodedAt ?? null,
    created_at: rental.createdAt || now,
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

export async function replaceVehicles(vehicles) {
  const sb = requireSupabase()
  const items = (Array.isArray(vehicles) ? vehicles : [])
    .map(toVehicleRow)
    .filter((v) => v.id)

  const { data: existing, error: listErr } = await sb.from('vehicles').select('id')
  if (listErr) throwSb(listErr)

  const nextIds = new Set(items.map((v) => v.id))
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id))

  if (toDelete.length) {
    const { error } = await sb.from('vehicles').delete().in('id', toDelete)
    if (error) throwSb(error)
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

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  if (!res.ok) throw new Error('Could not read image data')
  return res.blob()
}

/** Upload a data-URL image into the public `rentals` bucket; return a stable public URL. */
async function uploadRentalImage(rentalId, fileKey, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return ''
  if (!dataUrl.startsWith('data:')) return dataUrl

  const sb = requireSupabase()
  const blob = await dataUrlToBlob(dataUrl)
  const ext = (blob.type || '').includes('png') ? 'png' : 'jpg'
  const safeKey = String(fileKey || 'photo').replace(/[^\w\-]+/g, '_').slice(0, 40)
  const path = `${String(rentalId)}/${safeKey}-${Date.now()}.${ext}`

  const { error } = await sb.storage.from('rentals').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
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

  for (const key of ['front', 'rear', 'left', 'right']) {
    if (typeof out[key] === 'string' && out[key].startsWith('data:')) {
      out[key] = await uploadRentalImage(rentalId, key, out[key])
    }
  }

  if (Array.isArray(out.extras)) {
    out.extras = await Promise.all(
      out.extras.map(async (item, index) => {
        if (!item || typeof item !== 'object') return item
        if (typeof item.uri !== 'string' || !item.uri.startsWith('data:')) return item
        const uri = await uploadRentalImage(rentalId, `extra-${item.id || index}`, item.uri)
        return { ...item, uri }
      }),
    )
  }

  return out
}

export async function replaceRentals(rentals) {
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
    .or('approval_status.eq.pending,rental_lifecycle.eq.pending_approval')
  if (pendingErr) throwSb(pendingErr)

  const incomingIds = new Set(items.map((r) => r.id))
  const preserved = (pendingRows || [])
    .filter((r) => !incomingIds.has(r.id))
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

  const { data: existing, error: listErr } = await sb.from('rentals').select('id')
  if (listErr) throwSb(listErr)

  const keepIds = new Set([...incomingIds, ...preserved.map((r) => r.id)])
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !keepIds.has(id))

  if (toDelete.length) {
    const { error } = await sb.from('rentals').delete().in('id', toDelete)
    if (error) throwSb(error)
  }

  const upsertRows = [...items, ...preserved]
  if (upsertRows.length) {
    const { error } = await sb.from('rentals').upsert(upsertRows, { onConflict: 'id' })
    if (error) throwSb(error)
  }

  return fetchRentals()
}

export async function addRental(rental) {
  const sb = requireSupabase()
  let vehicleIds = await knownVehicleIdSet(sb)
  const desiredId = rental.vehicleId || rental.vehicle?.id || null

  // If the desk has a vehicle snapshot that isn't in Supabase yet, create a minimal row.
  if (desiredId && !vehicleIds.has(String(desiredId)) && rental.vehicle) {
    const v = rental.vehicle
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

  const row = withSafeVehicleFk(toRentalRow(rental), vehicleIds)
  const { data, error } = await sb.from('rentals').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error) throwSb(error)
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
    .or('approval_status.eq.pending,rental_lifecycle.eq.pending_approval')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throwSb(error)
      return (data || []).map(mapRental)
    })
}

export async function acceptPendingRental(id) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('accept_pending_rental', { p_id: String(id) })
  if (error) throwSb(error)
  return mapRental(data)
}

export async function rejectPendingRental(id, reason = '') {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('reject_pending_rental', {
    p_id: String(id),
    p_reason: reason || '',
  })
  if (error) throwSb(error)
  return mapRental(data)
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

function isPreservedAdminEmployee(row, currentUserId) {
  const username = String(row?.username || '').trim().toLowerCase()
  const id = String(row?.id || '')
  if (username === 'alatas' || id === 'emp-alatas-admin') return true
  if (currentUserId && String(row?.auth_user_id || '') === String(currentUserId)) return true
  return false
}

async function clearAppDataClientFallback(sb) {
  const {
    data: { user },
  } = await sb.auth.getUser()
  const currentUserId = user?.id || null

  const { error: rentalsErr } = await sb.from('rentals').delete().neq('id', '')
  if (rentalsErr) throwSb(rentalsErr)

  const { error: vehiclesErr } = await sb.from('vehicles').delete().neq('id', '')
  if (vehiclesErr) throwSb(vehiclesErr)

  const { data: employees, error: empListErr } = await sb.from('employees').select('id, username, auth_user_id')
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

  return {
    ok: true,
    mode: 'client-fallback',
    rentalsDeleted: true,
    vehiclesDeleted: true,
    employeesDeleted: toDelete.length,
  }
}

/**
 * Wipe fleet / rentals / staff data. Keeps admin Auth credentials + admin employee row.
 * Prefers RPC `clear_app_data` (migration 005); falls back to direct table deletes.
 */
export async function clearAllAppData() {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('clear_app_data')
  if (!error) {
    return data || { ok: true, mode: 'rpc' }
  }

  const msg = String(error?.message || '')
  const missingFn =
    /could not find the function/i.test(msg) ||
    /function .*clear_app_data/i.test(msg) ||
    error?.code === 'PGRST202'

  if (!missingFn) throwSb(error)

  return clearAppDataClientFallback(sb)
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

  const { data, error } = await sb.rpc('create_employee_with_auth', {
    p_id: String(employee.id || `e-${Date.now()}`),
    p_name: employee.name ?? '',
    p_username: employee.username ?? '',
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
