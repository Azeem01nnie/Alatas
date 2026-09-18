import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acceptPendingRental as acceptPendingRentalApi,
  rejectPendingRental as rejectPendingRentalApi,
  fetchPendingRentals,
  fetchRentals,
} from '../api/backend'
import {
  acceptCloudPendingRental,
  fetchCloudPendingRentals,
  isCloudConfigured,
  rejectCloudPendingRental,
} from '../api/cloudSync'
import ConfirmModal from './ConfirmModal'
import { compressImageDataUrl } from '../utils/storage'

function customerName(rental) {
  const p = rental?.personal
  if (!p) return 'Customer'
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName || 'Customer'
}

function accountProof(rental) {
  return (
    rental?.submittedBy ||
    rental?.personal?.submittedBy ||
    rental?.carPhotosAddedBy ||
    rental?.carPhotos?._addedBy ||
    ''
  )
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function isStillPending(rental) {
  if (!rental) return false
  return rental.approvalStatus === 'pending' || rental.rentalLifecycle === 'pending_approval'
}

function normalizeCarPhotos(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { extras: [] }
  return {
    ...value,
    extras: Array.isArray(value.extras) ? value.extras : [],
  }
}

function countVehiclePhotos(carPhotos) {
  const cp = normalizeCarPhotos(carPhotos)
  const sides = ['front', 'rear', 'left', 'right'].filter((key) => Boolean(cp[key])).length
  const extras = cp.extras.filter((item) => item?.uri).length
  return sides + extras
}

function hasVehiclePhotos(rental) {
  return countVehiclePhotos(rental?.carPhotos) > 0
}

async function readAndCompress(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return compressImageDataUrl(dataUrl, 960, 0.8)
}

/** Merge pending lists without letting stale cloud rows revive locally approved rentals. */
function mergePendingLists(localPending, cloudPending, localRentals) {
  const localById = new Map(
    (Array.isArray(localRentals) ? localRentals : [])
      .filter((r) => r?.id)
      .map((r) => [String(r.id), r]),
  )
  const byId = new Map()

  for (const row of Array.isArray(cloudPending) ? cloudPending : []) {
    if (!row?.id) continue
    const key = String(row.id)
    const local = localById.get(key)
    if (local && !isStillPending(local)) {
      const localStatus = local.approvalStatus
      const localTs = new Date(local.updatedAt || local.createdAt || 0).getTime() || 0
      const cloudTs = new Date(row.updatedAt || row.createdAt || 0).getTime() || 0
      if (
        (localStatus === 'accepted' || localStatus === 'rejected') &&
        localTs >= cloudTs
      ) {
        continue
      }
    }
    byId.set(key, row)
  }

  for (const row of Array.isArray(localPending) ? localPending : []) {
    if (row?.id) byId.set(String(row.id), row)
  }

  return [...byId.values()]
}

export default function PendingApprovals({
  vehicles,
  onChanged,
  compact = false,
  embedded = false,
  canApprove = true,
  canEditCarPhotos = true,
  addedByName = '',
  onSaveCarPhotos,
}) {
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState('')
  const [photoDrafts, setPhotoDrafts] = useState({})
  const [photoBusyId, setPhotoBusyId] = useState('')
  const [photoErrorById, setPhotoErrorById] = useState({})
  const fileInputRefs = useRef({})

  const loadPending = useCallback(async () => {
    try {
      let rows = []
      if (isCloudConfigured()) {
        const [localRows, cloudRows, localRentals] = await Promise.all([
          fetchPendingRentals().catch(() => []),
          fetchCloudPendingRentals().catch(() => []),
          fetchRentals().catch(() => []),
        ])
        rows = mergePendingLists(localRows, cloudRows, localRentals)
      } else {
        rows = await fetchPendingRentals()
      }
      setPending(Array.isArray(rows) ? rows : [])
      setError('')
    } catch (err) {
      setError(err?.message || 'Could not load pending rentals.')
    }
  }, [])

  useEffect(() => {
    loadPending()
    const timer = window.setInterval(loadPending, 5_000)
    return () => window.clearInterval(timer)
  }, [loadPending])

  const vehicleFor = (rental) => {
    const vid = rental.vehicleId || rental.vehicle?.id
    return vehicles.find((v) => String(v.id) === String(vid)) || rental.vehicle
  }

  const closeConfirm = () => {
    if (busyId) return
    setConfirm(null)
    setRejectReason('')
  }

  const openAcceptConfirm = (rental) => {
    if (!canApprove || busyId) return
    setRejectReason('')
    setConfirm({ type: 'accept', rental })
  }

  const openRejectConfirm = (rental) => {
    if (!canApprove || busyId) return
    setRejectReason('')
    setConfirm({ type: 'reject', rental })
  }

  const handleAccept = async (id) => {
    if (!canApprove) return
    setBusyId(id)
    setError('')
    try {
      try {
        await acceptPendingRentalApi(id)
      } catch (localErr) {
        if (!isCloudConfigured()) throw localErr
        await acceptCloudPendingRental(id)
      }
      if (isCloudConfigured()) {
        try {
          await acceptCloudPendingRental(id)
        } catch {
          // Already accepted locally; cloud may lag or already be accepted.
        }
      }
      setConfirm(null)
      await loadPending()
      if (onChanged) await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not accept rental.')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (id) => {
    if (!canApprove) return
    setBusyId(id)
    setError('')
    try {
      try {
        await rejectPendingRentalApi(id, rejectReason)
      } catch (localErr) {
        if (!isCloudConfigured()) throw localErr
        await rejectCloudPendingRental(id, rejectReason)
      }
      if (isCloudConfigured()) {
        try {
          await rejectCloudPendingRental(id, rejectReason)
        } catch {
          // ignore cloud mirror failures after local success
        }
      }
      setConfirm(null)
      setRejectReason('')
      await loadPending()
      if (onChanged) await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not reject rental.')
    } finally {
      setBusyId(null)
    }
  }

  const addDraftPhotos = async (rentalId, fileList) => {
    const files = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'))
    if (!files.length) {
      setPhotoErrorById((prev) => ({
        ...prev,
        [rentalId]: 'Please choose an image file',
      }))
      return
    }

    setPhotoBusyId(rentalId)
    setPhotoErrorById((prev) => ({ ...prev, [rentalId]: '' }))
    try {
      const nextItems = []
      for (const file of files) {
        const compressed = await readAndCompress(file)
        if (!compressed) continue
        nextItems.push({
          id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          uri: compressed,
          label: `Photo ${Date.now().toString().slice(-4)}`,
        })
      }
      if (!nextItems.length) {
        setPhotoErrorById((prev) => ({
          ...prev,
          [rentalId]: 'Could not process that image. Try another file.',
        }))
        return
      }
      setPhotoDrafts((prev) => ({
        ...prev,
        [rentalId]: [...(prev[rentalId] || []), ...nextItems],
      }))
    } catch {
      setPhotoErrorById((prev) => ({
        ...prev,
        [rentalId]: 'Upload failed. Please try again.',
      }))
    } finally {
      setPhotoBusyId('')
      const input = fileInputRefs.current[rentalId]
      if (input) input.value = ''
    }
  }

  const removeDraftPhoto = (rentalId, photoId) => {
    setPhotoDrafts((prev) => ({
      ...prev,
      [rentalId]: (prev[rentalId] || []).filter((item) => item.id !== photoId),
    }))
  }

  const saveDraftPhotos = async (rental) => {
    if (!canEditCarPhotos || typeof onSaveCarPhotos !== 'function') return
    const draft = photoDrafts[rental.id] || []
    if (!draft.length) {
      setPhotoErrorById((prev) => ({
        ...prev,
        [rental.id]: 'Add at least one photo before saving.',
      }))
      return
    }

    setPhotoBusyId(rental.id)
    setPhotoErrorById((prev) => ({ ...prev, [rental.id]: '' }))
    try {
      const existing = normalizeCarPhotos(rental.carPhotos)
      const nextPhotos = {
        ...existing,
        extras: [...existing.extras, ...draft],
      }
      await onSaveCarPhotos(rental.id, nextPhotos, addedByName)
      setPhotoDrafts((prev) => {
        const next = { ...prev }
        delete next[rental.id]
        return next
      })
      setPending((prev) =>
        prev.map((row) =>
          String(row.id) === String(rental.id)
            ? {
                ...row,
                carPhotos: nextPhotos,
                carPhotosAddedBy: addedByName || row.carPhotosAddedBy || null,
              }
            : row,
        ),
      )
      if (onChanged) await onChanged()
    } catch (err) {
      setPhotoErrorById((prev) => ({
        ...prev,
        [rental.id]: err?.message || 'Could not save vehicle photos.',
      }))
    } finally {
      setPhotoBusyId('')
    }
  }

  const renderPhotoBlock = (rental) => {
    if (!canEditCarPhotos) return null

    const photosReady = hasVehiclePhotos(rental)
    const draft = photoDrafts[rental.id] || []
    const isPhotoBusy = photoBusyId === rental.id
    const photoError = photoErrorById[rental.id] || ''

    return (
      <div className={`pending-photo-block${photosReady ? ' is-ready' : ''}`}>
        <p className={`pending-photo-note${photosReady ? ' is-ok' : ''}`}>
          {photosReady
            ? `Vehicle photos added${countVehiclePhotos(rental.carPhotos) ? ` (${countVehiclePhotos(rental.carPhotos)})` : ''}.`
            : 'Vehicle photo needs to be added'}
        </p>

        {draft.length > 0 ? (
          <div className="pending-photo-drafts">
            {draft.map((item, index) => (
              <figure key={item.id} className="pending-photo-draft">
                <img src={item.uri} alt={item.label || `Draft ${index + 1}`} />
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={isPhotoBusy}
                  onClick={() => removeDraftPhoto(rental.id, item.id)}
                >
                  Remove
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        {photoError ? <span className="error-msg">{photoError}</span> : null}

        <div className="pending-photo-actions">
          <input
            ref={(el) => {
              fileInputRefs.current[rental.id] = el
            }}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => addDraftPhotos(rental.id, e.target.files)}
          />
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={isPhotoBusy}
            onClick={() => fileInputRefs.current[rental.id]?.click()}
          >
            {isPhotoBusy ? 'Working…' : 'Add photo'}
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={isPhotoBusy || draft.length === 0}
            onClick={() => saveDraftPhotos(rental)}
          >
            {isPhotoBusy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  const renderActions = (rental, isBusy) => {
    if (!canApprove) {
      return (
        <div className="pending-approvals-actions">
          <button type="button" className="btn-primary btn-sm" disabled title="Only admin can approve">
            Accept
          </button>
          <button type="button" className="btn-outline btn-sm" disabled title="Only admin can reject">
            Reject
          </button>
          <span className="pending-approvals-readonly-note">View only — admin approves</span>
        </div>
      )
    }

    return (
      <div className="pending-approvals-actions">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={isBusy}
          onClick={() => openAcceptConfirm(rental)}
        >
          {isBusy ? 'Working…' : 'Accept'}
        </button>
        <button
          type="button"
          className="btn-outline btn-sm"
          disabled={isBusy}
          onClick={() => openRejectConfirm(rental)}
        >
          Reject
        </button>
      </div>
    )
  }

  const confirmRental = confirm?.rental
  const confirmVehicle = confirmRental ? vehicleFor(confirmRental) : null
  const confirmName = confirmRental ? customerName(confirmRental) : ''
  const confirmVehicleLabel = confirmVehicle
    ? `${confirmVehicle.make || 'Vehicle'} — ${confirmVehicle.series || ''} (${confirmVehicle.plateNo || '—'})`
    : 'this rental'
  const confirmBusy = confirmRental ? busyId === confirmRental.id : false

  const confirmModal = confirmRental ? (
    <ConfirmModal
      title={confirm.type === 'accept' ? 'Accept this rental?' : 'Reject this rental?'}
      message={
        confirm.type === 'accept'
          ? `Accept the pending rental for ${confirmVehicleLabel} with ${confirmName}? It will become an active or scheduled rental.`
          : `Reject the pending rental for ${confirmVehicleLabel} with ${confirmName}? This cannot be undone.`
      }
      confirmLabel={
        confirmBusy
          ? confirm.type === 'accept'
            ? 'Accepting…'
            : 'Rejecting…'
          : confirm.type === 'accept'
            ? 'Yes, accept'
            : 'Yes, reject'
      }
      cancelLabel="Cancel"
      danger={confirm.type === 'reject'}
      confirmDisabled={confirmBusy}
      onCancel={closeConfirm}
      onConfirm={() => {
        if (confirm.type === 'accept') void handleAccept(confirmRental.id)
        else void handleReject(confirmRental.id)
      }}
    >
      {confirm.type === 'reject' ? (
        <label className="field confirm-reject-reason">
          <span className="field-label">Reason (optional)</span>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this being rejected?"
            disabled={confirmBusy}
          />
        </label>
      ) : null}
    </ConfirmModal>
  ) : null

  const renderItem = (rental, { showTime = true } = {}) => {
    const vehicle = vehicleFor(rental)
    const isBusy = busyId === rental.id
    return (
      <li key={rental.id} className="pending-approvals-item dash-attn-row">
        <div className="pending-approvals-main">
          <div className="pending-approvals-meta dash-attn-meta">
            <strong>
              {vehicle?.make || 'Vehicle'} — {vehicle?.series || ''}
            </strong>
            <span>
              {vehicle?.plateNo || 'No plate'} · {customerName(rental)}
              {accountProof(rental) ? ` · by ${accountProof(rental)}` : ''}
            </span>
            {showTime ? (
              <span className="dash-attn-time">{formatDateTime(rental.rental?.periodFrom)}</span>
            ) : null}
          </div>
          {renderPhotoBlock(rental)}
        </div>
        {renderActions(rental, isBusy)}
      </li>
    )
  }

  if (embedded) {
    if (pending.length === 0) {
      return (
        <>
          <p className="dash-attn-empty">No rentals waiting for approval.</p>
          {confirmModal}
        </>
      )
    }

    return (
      <>
        {error ? <p className="pending-approvals-error">{error}</p> : null}
        {!canApprove ? (
          <p className="pending-approvals-readonly-banner">
            You can view the queue. Only an admin can accept or reject.
          </p>
        ) : null}
        <ul className="pending-approvals-list">{pending.map((rental) => renderItem(rental))}</ul>
        {confirmModal}
      </>
    )
  }

  if (compact && pending.length === 0) {
    return confirmModal
  }

  if (compact) {
    return (
      <>
        <header className="dash-attn-head">
          <div className="dash-attn-head-copy">
            <h4 className="dash-attn-title">Waiting for approval</h4>
            <p className="dash-attn-note">
              {canApprove
                ? 'Accept or reject before the rental becomes active.'
                : 'Queue is visible; only admin can accept or reject.'}
            </p>
          </div>
          <span className="dash-attn-count" aria-label={`${pending.length} items`}>
            {pending.length}
          </span>
        </header>
        {error ? <p className="pending-approvals-error">{error}</p> : null}
        <ul className="pending-approvals-list pending-approvals-list-compact">
          {pending.slice(0, 2).map((rental) => renderItem(rental, { showTime: false }))}
        </ul>
        {pending.length > 2 ? (
          <p className="dash-attn-empty">+ {pending.length - 2} more in queue</p>
        ) : null}
        {confirmModal}
      </>
    )
  }

  return (
    <section className={`pending-approvals${compact ? ' pending-approvals-compact' : ''}`}>
      {!compact ? (
        <header className="pending-approvals-head">
          <div>
            <h3>Waiting for approval</h3>
            <p>
              {canApprove
                ? 'Review field, mobile, or desktop submissions before they become active rentals.'
                : 'View submissions waiting for an admin to accept or reject.'}
            </p>
          </div>
          <span className="pending-approvals-badge">{pending.length}</span>
        </header>
      ) : null}

      {error ? <p className="pending-approvals-error">{error}</p> : null}

      {pending.length === 0 ? (
        <p className="pending-approvals-empty">No rentals waiting for approval.</p>
      ) : (
        <ul className="pending-approvals-list">
          {pending.map((rental) => {
            const vehicle = vehicleFor(rental)
            const isBusy = busyId === rental.id
            return (
              <li key={rental.id} className="pending-approvals-item">
                <div className="pending-approvals-main">
                  <div className="pending-approvals-meta">
                    <strong>
                      {vehicle?.make || 'Vehicle'} — {vehicle?.series || ''}
                    </strong>
                    <span>
                      {vehicle?.plateNo || 'No plate'} · {customerName(rental)}
                      {accountProof(rental) ? ` · by ${accountProof(rental)}` : ''}
                    </span>
                    <span className="pending-approvals-time">
                      From {formatDateTime(rental.rental?.periodFrom)} · source:{' '}
                      {rental.source || 'field'}
                    </span>
                  </div>
                  {renderPhotoBlock(rental)}
                </div>
                {renderActions(rental, isBusy)}
              </li>
            )
          })}
        </ul>
      )}
      {confirmModal}
    </section>
  )
}

export { customerName as pendingCustomerName, formatDateTime as pendingFormatDateTime }
