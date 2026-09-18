import { useCallback, useEffect, useState } from 'react'
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
  onOpenPhotos,
}) {
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState('')

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

  const photoTakenBy = (rental) =>
    rental?.carPhotosAddedBy ||
    rental?.carPhotos?._addedBy ||
    ''

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

  const renderPhotoBlock = (rental) => {
    if (!canEditCarPhotos) return null

    const photosReady = hasVehiclePhotos(rental)
    const takenBy = photoTakenBy(rental)

    return (
      <div className={`pending-photo-block${photosReady ? ' is-ready' : ''}`}>
        <p className={`pending-photo-note${photosReady ? ' is-ok' : ''}`}>
          {photosReady
            ? `Vehicle photos added (${countVehiclePhotos(rental.carPhotos)})`
            : 'Vehicle photo needs to be added'}
        </p>
        {takenBy ? (
          <p className="pending-photo-credit">Taken by {takenBy}</p>
        ) : photosReady ? (
          <p className="pending-photo-credit">Photographer not recorded</p>
        ) : null}
        <div className="pending-photo-actions">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => onOpenPhotos?.(rental)}
            disabled={typeof onOpenPhotos !== 'function'}
          >
            {photosReady ? 'Add / view photos' : 'Add photo'}
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
