import { useCallback, useEffect, useState } from 'react'
import {
  acceptPendingRental as acceptPendingRentalApi,
  rejectPendingRental as rejectPendingRentalApi,
  fetchPendingRentals,
} from '../api/backend'
import {
  acceptCloudPendingRental,
  fetchCloudPendingRentals,
  isCloudConfigured,
  rejectCloudPendingRental,
} from '../api/cloudSync'

function customerName(rental) {
  const p = rental?.personal
  if (!p) return 'Customer'
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName || 'Customer'
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export default function PendingApprovals({ vehicles, onChanged, compact = false, embedded = false }) {
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')

  const loadPending = useCallback(async () => {
    try {
      let rows = []
      if (isCloudConfigured()) {
        const [localRows, cloudRows] = await Promise.all([
          fetchPendingRentals().catch(() => []),
          fetchCloudPendingRentals().catch(() => []),
        ])
        const byId = new Map()
        ;[...(Array.isArray(localRows) ? localRows : []), ...(Array.isArray(cloudRows) ? cloudRows : [])]
          .forEach((r) => {
            if (r?.id) byId.set(String(r.id), r)
          })
        rows = [...byId.values()]
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
    const timer = window.setInterval(loadPending, 30_000)
    return () => window.clearInterval(timer)
  }, [loadPending])

  const vehicleFor = (rental) => {
    const vid = rental.vehicleId || rental.vehicle?.id
    return vehicles.find((v) => String(v.id) === String(vid)) || rental.vehicle
  }

  const handleAccept = async (id) => {
    setBusyId(id)
    setError('')
    try {
      if (isCloudConfigured()) {
        try {
          await acceptCloudPendingRental(id)
        } catch {
          await acceptPendingRentalApi(id)
        }
      } else {
        await acceptPendingRentalApi(id)
      }
      await loadPending()
      if (onChanged) await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not accept rental.')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (id) => {
    setBusyId(id)
    setError('')
    try {
      if (isCloudConfigured()) {
        try {
          await rejectCloudPendingRental(id, rejectReason)
        } catch {
          await rejectPendingRentalApi(id, rejectReason)
        }
      } else {
        await rejectPendingRentalApi(id, rejectReason)
      }
      setRejectId(null)
      setRejectReason('')
      await loadPending()
      if (onChanged) await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not reject rental.')
    } finally {
      setBusyId(null)
    }
  }

  if (embedded) {
    if (pending.length === 0) {
      return <p className="dash-attn-empty">No rentals waiting for approval.</p>
    }

    return (
      <>
        {error ? <p className="pending-approvals-error">{error}</p> : null}
        <ul className="pending-approvals-list">
          {pending.map((rental) => {
            const vehicle = vehicleFor(rental)
            const isBusy = busyId === rental.id
            return (
              <li key={rental.id} className="pending-approvals-item dash-attn-row">
                <div className="pending-approvals-meta dash-attn-meta">
                  <strong>
                    {vehicle?.make || 'Vehicle'} — {vehicle?.series || ''}
                  </strong>
                  <span>
                    {vehicle?.plateNo || 'No plate'} · {customerName(rental)}
                  </span>
                  <span className="dash-attn-time">
                    {formatDateTime(rental.rental?.periodFrom)}
                  </span>
                </div>
                {rejectId === rental.id ? (
                  <div className="pending-approvals-reject-form">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                    />
                    <button type="button" className="btn-outline btn-sm" disabled={isBusy} onClick={() => { setRejectId(null); setRejectReason('') }}>Cancel</button>
                    <button type="button" className="btn-danger btn-sm" disabled={isBusy} onClick={() => handleReject(rental.id)}>Reject</button>
                  </div>
                ) : (
                  <div className="pending-approvals-actions">
                    <button type="button" className="btn-primary btn-sm" disabled={isBusy} onClick={() => handleAccept(rental.id)}>Accept</button>
                    <button type="button" className="btn-outline btn-sm" disabled={isBusy} onClick={() => setRejectId(rental.id)}>Reject</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </>
    )
  }

  if (compact && pending.length === 0) {
    return null
  }

  if (compact) {
    return (
      <>
        <header className="dash-attn-head">
          <div className="dash-attn-head-copy">
            <h4 className="dash-attn-title">Waiting for approval</h4>
            <p className="dash-attn-note">Accept or reject before the rental becomes active.</p>
          </div>
          <span className="dash-attn-count" aria-label={`${pending.length} items`}>
            {pending.length}
          </span>
        </header>
        {error ? <p className="pending-approvals-error">{error}</p> : null}
        <ul className="pending-approvals-list pending-approvals-list-compact">
          {pending.slice(0, 2).map((rental) => {
            const vehicle = vehicleFor(rental)
            const isBusy = busyId === rental.id
            return (
              <li key={rental.id} className="pending-approvals-item dash-attn-row">
                <div className="pending-approvals-meta dash-attn-meta">
                  <strong>
                    {vehicle?.make || 'Vehicle'} — {vehicle?.series || ''}
                  </strong>
                  <span>
                    {vehicle?.plateNo || 'No plate'} · {customerName(rental)}
                  </span>
                </div>
                {rejectId === rental.id ? (
                  <div className="pending-approvals-reject-form">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                    />
                    <button type="button" className="btn-outline btn-sm" disabled={isBusy} onClick={() => { setRejectId(null); setRejectReason('') }}>Cancel</button>
                    <button type="button" className="btn-danger btn-sm" disabled={isBusy} onClick={() => handleReject(rental.id)}>Reject</button>
                  </div>
                ) : (
                  <div className="pending-approvals-actions">
                    <button type="button" className="btn-primary btn-sm" disabled={isBusy} onClick={() => handleAccept(rental.id)}>Accept</button>
                    <button type="button" className="btn-outline btn-sm" disabled={isBusy} onClick={() => setRejectId(rental.id)}>Reject</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {pending.length > 2 ? (
          <p className="dash-attn-empty">+ {pending.length - 2} more in queue</p>
        ) : null}
      </>
    )
  }

  return (
    <section className={`pending-approvals${compact ? ' pending-approvals-compact' : ''}`}>
      {!compact ? (
        <header className="pending-approvals-head">
          <div>
            <h3>Waiting for approval</h3>
            <p>Review field, mobile, or desktop submissions before they become active rentals.</p>
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
                <div className="pending-approvals-meta">
                  <strong>
                    {vehicle?.make || 'Vehicle'} — {vehicle?.series || ''}
                  </strong>
                  <span>
                    {vehicle?.plateNo || 'No plate'} · {customerName(rental)}
                  </span>
                  <span className="pending-approvals-time">
                    From {formatDateTime(rental.rental?.periodFrom)} · source:{' '}
                    {rental.source || 'field'}
                  </span>
                </div>

                {rejectId === rental.id ? (
                  <div className="pending-approvals-reject-form">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Optional rejection reason"
                    />
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={isBusy}
                      onClick={() => {
                        setRejectId(null)
                        setRejectReason('')
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      disabled={isBusy}
                      onClick={() => handleReject(rental.id)}
                    >
                      Confirm reject
                    </button>
                  </div>
                ) : (
                  <div className="pending-approvals-actions">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={isBusy}
                      onClick={() => handleAccept(rental.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={isBusy}
                      onClick={() => setRejectId(rental.id)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export { customerName as pendingCustomerName, formatDateTime as pendingFormatDateTime }
