import { useEffect, useMemo, useState } from 'react'
import { BODY_TYPES } from '../data/vehicles'
import { getArchivedIdSet } from '../utils/archivedVehicles'
import { getDisplayStatus } from '../utils/vehicleDisplayStatus'
import {
  formatRentalFee,
  parseRentalFeeAmount,
  resolveAmountPaid,
  resolveBalanceDue,
  resolveInitialPayment,
} from '../utils/rentalFee'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function formatTimeRemaining(target, now = Date.now(), { mode = 'remaining' } = {}) {
  if (!target) return ''
  const end = new Date(target).getTime()
  if (Number.isNaN(end)) return ''
  const diff = end - now
  if (mode === 'untilStart') {
    if (diff <= 0) return ''
  } else if (diff < 0) {
    const late = Math.abs(diff)
    const h = Math.floor(late / 3_600_000)
    const m = Math.floor((late % 3_600_000) / 60_000)
    if (h > 0) return `Overdue ${h}h ${m}m`
    return `Overdue ${m}m`
  }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (mode === 'untilStart') {
    if (h > 0) return `starts in ${h}h ${m}m`
    return `starts in ${m}m`
  }
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function customerName(r) {
  const p = r?.personal || {}
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() || '—'
}

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function VehicleThumb({ vehicle }) {
  return (
    <div className="dash-attn-thumb" aria-hidden="true">
      {vehicle?.image ? (
        <img src={vehicle.image} alt="" />
      ) : (
        <span>
          {(vehicle?.make || '?').slice(0, 1)}
          {(vehicle?.series || '').slice(0, 1)}
        </span>
      )}
    </div>
  )
}

function DetailModal({ rental, vehicle, onClose }) {
  const p = rental?.personal || {}
  const bal = resolveBalanceDue(rental)
  const firstPaid = resolveInitialPayment(rental)
  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel confirm-modal dash-attn-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Rental details"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dash-attn-detail-head">
          <div>
            <p className="dash-attn-detail-eyebrow">Rental details</p>
            <h3 className="modal-title">{customerName(rental)}</h3>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="dash-attn-detail-grid">
          <section>
            <h4>Renter</h4>
            <dl>
              <div>
                <dt>Contact</dt>
                <dd>{p.contactNo || '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{p.address || '—'}</dd>
              </div>
              <div>
                <dt>Emergency</dt>
                <dd>{p.emergencyContact || p.emergencyName || '—'}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h4>Vehicle</h4>
            <div className="dash-attn-detail-vehicle">
              <VehicleThumb vehicle={vehicle} />
              <div>
                <strong>
                  {vehicle?.make} — {vehicle?.series}
                </strong>
                <span>
                  {vehicle?.plateNo} · {vehicle?.bodyType || '—'}
                </span>
                <span>Engine: {vehicle?.engineNo || '—'}</span>
                <span>Chassis: {vehicle?.chassisNo || '—'}</span>
              </div>
            </div>
          </section>
          <section>
            <h4>Payment</h4>
            <dl>
              <div>
                <dt>Total</dt>
                <dd>
                  {rental?.rental?.totalAmount ||
                    formatPeso(parseRentalFeeAmount(rental?.rental?.rentalFee))}
                </dd>
              </div>
              <div>
                <dt>First paid</dt>
                <dd>{formatPeso(firstPaid)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd className={bal > 0 ? 'is-due' : ''}>{formatPeso(bal)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

function ChangeVehicleModal({
  rental,
  currentVehicle,
  vehicles,
  rentals,
  bookedVehicleIds,
  onClose,
  onConfirm,
  busy,
}) {
  const [bodyType, setBodyType] = useState('all')
  const [pickedId, setPickedId] = useState('')
  const [extraPay, setExtraPay] = useState('')
  const [error, setError] = useState('')

  const available = useMemo(() => {
    const booked = new Set(bookedVehicleIds || [])
    const archived = getArchivedIdSet()
    const currentId = String(currentVehicle?.id || rental?.vehicleId || rental?.vehicle?.id || '')
    return (vehicles || []).filter((v) => {
      if (!v?.id) return false
      if (String(v.id) === currentId) return false
      if (archived.has(String(v.id))) return false
      if (booked.has(v.id)) return false
      if (v.status === 'Under Maintenance') return false
      return getDisplayStatus(v, rentals) === 'Available'
    })
  }, [vehicles, rentals, bookedVehicleIds, currentVehicle, rental])

  const typeOptions = useMemo(() => {
    const present = new Set(available.map((v) => String(v.bodyType || 'Other').trim()).filter(Boolean))
    const ordered = [...BODY_TYPES, 'Other'].filter((t) => present.has(t))
    for (const t of present) if (!ordered.includes(t)) ordered.push(t)
    return ordered
  }, [available])

  const filtered = useMemo(() => {
    if (bodyType === 'all') return available
    return available.filter((v) => String(v.bodyType || 'Other').trim() === bodyType)
  }, [available, bodyType])

  const picked = filtered.find((v) => String(v.id) === String(pickedId)) || null

  const currentTotal = parseRentalFeeAmount(
    rental?.rental?.totalAmountValue ??
      rental?.rental?.totalAmount ??
      rental?.rental?.rentalFee ??
      0,
  )
  const firstPaid = resolveInitialPayment(rental)
  const extraPreview = Math.max(0, parseRentalFeeAmount(extraPay))
  const nextTotalPreview = currentTotal + extraPreview
  const nextBalancePreview = Math.max(0, nextTotalPreview - resolveAmountPaid(rental))

  const submit = () => {
    if (!picked) {
      setError('Select a vehicle')
      return
    }
    const extra = parseRentalFeeAmount(extraPay)
    if (extraPay.trim() !== '' && extra < 0) {
      setError('Additional charge cannot be negative')
      return
    }
    onConfirm({ vehicle: picked, extraPayment: extra })
  }

  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel confirm-modal dash-change-vehicle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-vehicle-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dash-change-vehicle-head">
          <div>
            <p className="dash-attn-detail-eyebrow">Swap unit</p>
            <h3 id="change-vehicle-title" className="modal-title">
              Change vehicle
            </h3>
            <p className="dash-change-vehicle-sub">
              Current: {currentVehicle?.make} — {currentVehicle?.series} ({currentVehicle?.plateNo || '—'})
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <label className="field dash-change-type-filter">
          <span className="field-label">Vehicle type</span>
          <select
            value={bodyType}
            onChange={(e) => {
              setBodyType(e.target.value)
              setPickedId('')
            }}
          >
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="dash-change-vehicle-grid">
          {filtered.length === 0 ? (
            <p className="dash-attn-empty">No available vehicles for this type.</p>
          ) : (
            filtered.map((v) => {
              const selected = String(v.id) === String(pickedId)
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`dash-change-vehicle-card${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    setPickedId(v.id)
                    setError('')
                  }}
                >
                  <span className="dash-change-vehicle-thumb">
                    {v.image ? (
                      <img src={v.image} alt="" />
                    ) : (
                      <span>{(v.make || '?').slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="dash-change-vehicle-copy">
                    <strong>
                      {v.make} — {v.series}
                    </strong>
                    <span>
                      {v.plateNo} · {v.bodyType}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>

        <label className="field">
          <span className="field-label">Additional charge</span>
          <input
            type="text"
            inputMode="decimal"
            value={extraPay}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '')
              const parts = raw.split('.')
              setExtraPay(
                parts.length <= 1
                  ? raw
                  : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`,
              )
              setError('')
            }}
            placeholder="0"
          />
          <span className="field-hint">
            Added to the rental total — not counted as cash received.
          </span>
        </label>

        <dl className="dash-change-pay-preview">
          <div>
            <dt>New total</dt>
            <dd>{formatRentalFee(nextTotalPreview)}</dd>
          </div>
          <div>
            <dt>First paid</dt>
            <dd>{formatRentalFee(firstPaid)}</dd>
          </div>
          <div>
            <dt>Balance due</dt>
            <dd>{formatRentalFee(nextBalancePreview)}</dd>
          </div>
        </dl>

        {error ? <p className="error-msg">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || !picked}>
            {busy ? 'Saving…' : 'Confirm change'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NeedsAttentionPanel({
  attentionFilter,
  onFilterChange,
  upcomingScheduled,
  onRentQueue,
  maintenanceVehicles,
  pendingApprovalCount,
  pendingSlot,
  isAdminUser,
  vehicles,
  rentals,
  bookedVehicleIds,
  onCancelRental,
  onCompleteRental,
  onChangeVehicle,
  onManage,
}) {
  const [detail, setDetail] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [changeBusy, setChangeBusy] = useState(false)

  useEffect(() => {
    setDetail(null)
    setChangeTarget(null)
  }, [attentionFilter])

  const openDetail = (rental, vehicle) => setDetail({ rental, vehicle })

  const handleChangeConfirm = async ({ vehicle, extraPayment }) => {
    if (!changeTarget || !onChangeVehicle) return
    setChangeBusy(true)
    try {
      await onChangeVehicle({
        rental: changeTarget.rental,
        fromVehicle: changeTarget.vehicle,
        toVehicle: vehicle,
        extraPayment,
      })
      setChangeTarget(null)
    } finally {
      setChangeBusy(false)
    }
  }

  const stop = (e) => e.stopPropagation()

  return (
    <section className="dash-panel dash-attention">
      <h3 className="dash-panel-title">Needs attention</h3>

      <div className="dash-attn-filters" role="group" aria-label="Needs attention filter">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcomingScheduled.length },
          { id: 'onRent', label: 'On rent', count: onRentQueue.length },
          { id: 'maintenance', label: 'Maintenance', count: maintenanceVehicles.length },
          {
            id: 'pending',
            label: 'Pending',
            fullLabel: 'Waiting for approval',
            count: pendingApprovalCount,
          },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dash-attn-filter-btn${attentionFilter === opt.id ? ' is-active' : ''}`}
            aria-pressed={attentionFilter === opt.id}
            aria-label={
              opt.fullLabel
                ? `${opt.fullLabel}${opt.count > 0 ? `, ${opt.count}` : ''}`
                : undefined
            }
            title={opt.fullLabel || undefined}
            onClick={() => onFilterChange(opt.id)}
          >
            <span className="dash-attn-filter-label">{opt.label}</span>
            {opt.count > 0 ? (
              <span className="dash-attn-filter-count">{opt.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="dash-attn-body">
        {attentionFilter === 'upcoming' &&
          (upcomingScheduled.length === 0 ? (
            <p className="dash-attn-empty">No upcoming rentals.</p>
          ) : (
            <div className="dash-attn-table-wrap">
              <table className="dash-attn-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Renter</th>
                    <th>Starts</th>
                    <th>First paid</th>
                    <th>Balance</th>
                    <th className="dash-attn-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingScheduled.map(({ rental, vehicle, isPastDue }) => {
                    const startLabel =
                      rental.rental?.periodFromLabel || formatDateTime(rental.rental?.periodFrom)
                    const remaining = isPastDue
                      ? null
                      : formatTimeRemaining(rental.rental?.periodFrom, Date.now(), {
                          mode: 'untilStart',
                        })
                    const bal = resolveBalanceDue(rental)
                    const firstPaid = resolveInitialPayment(rental)
                    return (
                      <tr
                        key={rental.id}
                        className="dash-attn-tr"
                        tabIndex={0}
                        onClick={() => openDetail(rental, vehicle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openDetail(rental, vehicle)
                          }
                        }}
                      >
                        <td>
                          <div className="dash-attn-cell-vehicle">
                            <VehicleThumb vehicle={vehicle} />
                            <div>
                              <strong>
                                {vehicle?.make} — {vehicle?.series}
                              </strong>
                              <span>{vehicle?.plateNo || '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td>{customerName(rental)}</td>
                        <td>
                          <div className="dash-attn-cell-time">
                            <span>{startLabel}</span>
                            {isPastDue ? (
                              <span className="dash-attn-remaining">activating…</span>
                            ) : remaining ? (
                              <span className="dash-attn-remaining">{remaining}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="dash-attn-balance">{formatPeso(firstPaid)}</span>
                        </td>
                        <td>
                          <span className={bal > 0 ? 'dash-attn-balance is-due' : 'dash-attn-balance'}>
                            {formatPeso(bal)}
                          </span>
                        </td>
                        <td className="dash-attn-actions-col" onClick={stop}>
                          {isAdminUser ? (
                            <div className="dash-attn-actions">
                              <button
                                type="button"
                                className="btn-outline btn-sm btn-danger-outline"
                                onClick={() => onCancelRental(rental, vehicle)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={() => setChangeTarget({ rental, vehicle })}
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {attentionFilter === 'onRent' &&
          (onRentQueue.length === 0 ? (
            <p className="dash-attn-empty">No active rentals.</p>
          ) : (
            <div className="dash-attn-table-wrap">
              <table className="dash-attn-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Renter</th>
                    <th>Until</th>
                    <th>First paid</th>
                    <th>Balance</th>
                    <th className="dash-attn-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {onRentQueue.map(({ rental, vehicle }) => {
                    const untilLabel =
                      rental.rental?.periodToLabel || formatDateTime(rental.rental?.periodTo)
                    const remaining = formatTimeRemaining(rental.rental?.periodTo)
                    const isOverdue = remaining && remaining.startsWith('Overdue')
                    const bal = resolveBalanceDue(rental)
                    const firstPaid = resolveInitialPayment(rental)
                    return (
                      <tr
                        key={rental.id}
                        className="dash-attn-tr"
                        tabIndex={0}
                        onClick={() => openDetail(rental, vehicle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openDetail(rental, vehicle)
                          }
                        }}
                      >
                        <td>
                          <div className="dash-attn-cell-vehicle">
                            <VehicleThumb vehicle={vehicle} />
                            <div>
                              <strong>
                                {vehicle?.make} — {vehicle?.series}
                              </strong>
                              <span>{vehicle?.plateNo || '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td>{customerName(rental)}</td>
                        <td>
                          <div className="dash-attn-cell-time">
                            <span>{untilLabel}</span>
                            {remaining ? (
                              <span
                                className={
                                  isOverdue
                                    ? 'dash-attn-remaining is-overdue'
                                    : 'dash-attn-remaining'
                                }
                              >
                                {remaining}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="dash-attn-balance">{formatPeso(firstPaid)}</span>
                        </td>
                        <td>
                          <span className={bal > 0 ? 'dash-attn-balance is-due' : 'dash-attn-balance'}>
                            {formatPeso(bal)}
                          </span>
                        </td>
                        <td className="dash-attn-actions-col" onClick={stop}>
                          {isAdminUser || onCompleteRental ? (
                            <div className="dash-attn-actions">
                              {isAdminUser ? (
                                <button
                                  type="button"
                                  className="btn-outline btn-sm btn-danger-outline"
                                  onClick={() => onCancelRental(rental, vehicle)}
                                >
                                  Cancel
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={() => onCompleteRental(vehicle, rental)}
                              >
                                Complete
                              </button>
                              {isAdminUser ? (
                                <button
                                  type="button"
                                  className="btn-outline btn-sm"
                                  onClick={() => setChangeTarget({ rental, vehicle })}
                                >
                                  Change
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {attentionFilter === 'maintenance' &&
          (maintenanceVehicles.length === 0 ? (
            <p className="dash-attn-empty">No units under maintenance.</p>
          ) : (
            <div className="dash-attn-table-wrap">
              <table className="dash-attn-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Type</th>
                    <th>Plate</th>
                    <th className="dash-attn-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceVehicles.map((v) => (
                    <tr key={v.id} className="dash-attn-tr is-static">
                      <td>
                        <div className="dash-attn-cell-vehicle">
                          <VehicleThumb vehicle={v} />
                          <div>
                            <strong>
                              {v.make} — {v.series}
                            </strong>
                          </div>
                        </div>
                      </td>
                      <td>{v.bodyType || '—'}</td>
                      <td>{v.plateNo || '—'}</td>
                      <td className="dash-attn-actions-col">
                        {isAdminUser ? (
                          <button type="button" className="btn-ghost btn-sm" onClick={onManage}>
                            Manage
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {attentionFilter === 'pending' ? pendingSlot : null}
      </div>

      {detail ? (
        <DetailModal
          rental={detail.rental}
          vehicle={detail.vehicle}
          onClose={() => setDetail(null)}
        />
      ) : null}

      {changeTarget ? (
        <ChangeVehicleModal
          rental={changeTarget.rental}
          currentVehicle={changeTarget.vehicle}
          vehicles={vehicles}
          rentals={rentals}
          bookedVehicleIds={bookedVehicleIds}
          busy={changeBusy}
          onClose={() => !changeBusy && setChangeTarget(null)}
          onConfirm={handleChangeConfirm}
        />
      ) : null}
    </section>
  )
}
