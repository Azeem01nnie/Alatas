import { useEffect, useMemo, useState } from 'react'
import { BODY_TYPES } from '../data/vehicles'
import { getArchivedIdSet } from '../utils/archivedVehicles'
import { getDisplayStatus } from '../utils/vehicleDisplayStatus'
import { resolveVehicleDisplayImage } from '../utils/vehicleImages'
import SelectMenu from './SelectMenu'
import StepPhoto from './StepPhoto'
import StepTerms from './StepTerms'
import StepCarCondition from './StepCarCondition'
import ConfirmModal from './ConfirmModal'
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

function deskModeLabel(rental) {
  const mode = String(rental?.deskMode || rental?.rental?.deskMode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return mode === 'booking' ? 'Booking' : 'Check-in'
}

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function paymentEntryLabel(type) {
  const labels = {
    additional_charge: 'Additional charge',
    overdue_collection: 'Overdue collection',
    deposit: 'Deposit',
    payment: 'Payment',
    refund: 'Refund',
    discount: 'Discount',
  }
  return labels[type] || 'Payment'
}

function paymentMethodLabel(entry) {
  if (entry?.type === 'additional_charge' || entry?.type === 'discount') return 'Adjustment'
  const methods = {
    cash: 'Cash',
    gcash: 'GCash',
    bank: 'Bank transfer',
    card: 'Card',
    adjustment: 'Adjustment',
  }
  return methods[String(entry?.method || '').toLowerCase()] || 'Method not recorded'
}

function VehicleThumb({ vehicle }) {
  return (
    <div className="dash-attn-thumb" aria-hidden="true">
      <img src={resolveVehicleDisplayImage(vehicle)} alt="" />
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
            {Array.isArray(rental?.rental?.paymentLedger) && rental.rental.paymentLedger.length ? (
              <div className="dash-attn-payment-ledger">
                <h4>Ledger entries</h4>
                <ul>
                  {[...rental.rental.paymentLedger].reverse().map((entry) => (
                    <li key={entry.id} className={`is-${entry.type || 'payment'}`}>
                      <span className="dash-attn-ledger-label">
                        <strong>{paymentEntryLabel(entry.type)}</strong>
                        <small>{paymentMethodLabel(entry)}</small>
                      </span>
                      <strong className="dash-attn-ledger-amount">
                        {entry.direction === 'out' ? '−' : '+'}&nbsp;{formatPeso(entry.amount)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}

function ProcessPickupModal({ rental, vehicle, onClose, onConfirm, busy, submitError }) {
  const [photo, setPhoto] = useState(rental?.photo || '')
  const [licensePhoto, setLicensePhoto] = useState(rental?.licensePhoto || '')
  const [optionalPhoto, setOptionalPhoto] = useState(rental?.personal?.optionalPhoto || '')
  const [carPhotos, setCarPhotos] = useState(rental?.carPhotos || {})
  const [signature, setSignature] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState({})

  const submit = () => {
    const next = {}
    if (!photo) next.photo = 'Add a photo of the customer holding their license'
    if (!licensePhoto) next.licensePhoto = 'Add a clear customer photo'
    if (!signature) next.signature = 'Customer signature is required'
    if (!termsAccepted) next.terms = 'Customer must accept the agreement'
    setErrors(next)
    if (Object.keys(next).length) return
    onConfirm({ photo, licensePhoto, optionalPhoto, carPhotos, signature, termsAccepted })
  }

  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel confirm-modal booking-pickup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-pickup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dash-attn-detail-head booking-pickup-head">
          <div>
            <p className="dash-attn-detail-eyebrow">Advance booking</p>
            <h3 id="booking-pickup-title" className="modal-title">Confirmation</h3>
            <p className="booking-pickup-subtitle">
              {customerName(rental)} · {vehicle?.make} {vehicle?.series} ({vehicle?.plateNo || '—'})
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        <div className="booking-pickup-body">
          <section className="booking-pickup-section">
            <h4>1. Verify customer ID</h4>
            <StepPhoto
              holdingPreview={photo}
              licensePreview={licensePhoto}
              optionalPreview={optionalPhoto}
              onHoldingChange={(value) => {
                setPhoto(value)
                setErrors((prev) => ({ ...prev, photo: '' }))
              }}
              onLicenseChange={(value) => {
                setLicensePhoto(value)
                setErrors((prev) => ({ ...prev, licensePhoto: '' }))
              }}
              onOptionalChange={setOptionalPhoto}
              errors={errors}
              compact
            />
          </section>

          <section className="booking-pickup-section">
            <h4>2. Record vehicle condition</h4>
            <StepCarCondition
              photos={carPhotos}
              onChange={(key, value) => setCarPhotos((prev) => ({ ...prev, [key]: value }))}
            />
          </section>

          <section className="booking-pickup-section">
            <h4>3. Review and sign agreement</h4>
            <StepTerms
              accepted={termsAccepted}
              onAcceptedChange={(value) => {
                setTermsAccepted(value)
                setErrors((prev) => ({ ...prev, terms: '' }))
              }}
              signature={signature}
              onSignatureChange={(value) => {
                setSignature(value)
                setErrors((prev) => ({ ...prev, signature: '', terms: '' }))
              }}
              error={errors.terms}
              signatureError={errors.signature}
              compact
            />
          </section>
        </div>

        <div className="modal-actions booking-pickup-actions">
          {submitError ? <span className="error-msg booking-pickup-error">{submitError}</span> : null}
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Starting rental…' : 'Confirm & start rental'}
          </button>
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
  const [confirmPayload, setConfirmPayload] = useState(null)

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
    setConfirmPayload({ vehicle: picked, extraPayment: extra })
  }

  return (
    <>
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

        <div className="field dash-change-type-filter">
          <span className="field-label">Vehicle type</span>
          <SelectMenu
            value={bodyType}
            onChange={(v) => {
              setBodyType(v)
              setPickedId('')
            }}
            ariaLabel="Vehicle type"
            options={[
              { value: 'all', label: 'All types' },
              ...typeOptions.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>

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
                    <img src={resolveVehicleDisplayImage(v)} alt="" />
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
      {confirmPayload ? (
        <ConfirmModal
          title="Confirm vehicle change"
          message={`Change from ${currentVehicle?.make || ''} ${currentVehicle?.series || ''} (${currentVehicle?.plateNo || '—'}) to ${confirmPayload.vehicle.make || ''} ${confirmPayload.vehicle.series || ''} (${confirmPayload.vehicle.plateNo || '—'})?`}
          confirmLabel="Yes, change vehicle"
          cancelLabel="Go back"
          confirmDisabled={busy}
          onCancel={() => setConfirmPayload(null)}
          onConfirm={() => {
            const payload = confirmPayload
            setConfirmPayload(null)
            onConfirm(payload)
          }}
        >
          <dl className="dash-change-confirm-summary">
            <div>
              <dt>Additional charge</dt>
              <dd>{formatRentalFee(confirmPayload.extraPayment)}</dd>
            </div>
            <div>
              <dt>New total</dt>
              <dd>{formatRentalFee(currentTotal + confirmPayload.extraPayment)}</dd>
            </div>
            <div>
              <dt>Balance due</dt>
              <dd>{formatRentalFee(Math.max(0, currentTotal + confirmPayload.extraPayment - resolveAmountPaid(rental)))}</dd>
            </div>
          </dl>
        </ConfirmModal>
      ) : null}
    </>
  )
}

function PaymentEntryModal({ rental, onClose, onConfirm, busy, submitError }) {
  const [type, setType] = useState('payment')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState('')
  const balance = resolveBalanceDue(rental)
  const paid = resolveAmountPaid(rental)
  const isRefund = type === 'refund'

  const submit = () => {
    const value = parseRentalFeeAmount(amount)
    if (!value) {
      setError('Enter an amount greater than zero')
      return
    }
    if (isRefund && value > paid) {
      setError(`Refund cannot exceed ${formatPeso(paid)} already paid`)
      return
    }
    if (!isRefund && value > balance) {
      setError(`Payment cannot exceed the ${formatPeso(balance)} balance`)
      return
    }
    onConfirm({ type, amount: value, method })
  }

  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal-panel confirm-modal payment-entry-modal" role="dialog" aria-modal="true" aria-labelledby="payment-entry-title" onClick={(e) => e.stopPropagation()}>
        <header className="dash-attn-detail-head">
          <div>
            <p className="dash-attn-detail-eyebrow">Payment ledger</p>
            <h3 id="payment-entry-title" className="modal-title">Record payment or refund</h3>
            <p className="payment-entry-customer">{customerName(rental)}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Close</button>
        </header>
        <div className="field">
          <span className="field-label">Entry type</span>
          <SelectMenu value={type} onChange={setType} ariaLabel="Entry type" options={[
            { value: 'payment', label: 'Additional payment' },
            { value: 'refund', label: 'Refund', disabled: paid <= 0 },
          ]} />
        </div>
        <dl className="payment-entry-summary">
          <div><dt>Total paid</dt><dd>{formatPeso(paid)}</dd></div>
          <div><dt>Balance due</dt><dd className={balance > 0 ? 'is-due' : ''}>{formatPeso(balance)}</dd></div>
        </dl>
        <label className="field">
          <span className="field-label">{isRefund ? 'Refund amount' : 'Amount received'}</span>
          <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setError('') }} placeholder="Example: 1,000" />
        </label>
        <div className="field">
          <span className="field-label">{isRefund ? 'Refund method' : 'Payment method'}</span>
          <SelectMenu value={method} onChange={setMethod} ariaLabel="Payment method" options={[
            { value: 'cash', label: 'Cash' },
            { value: 'gcash', label: 'GCash' },
            { value: 'bank', label: 'Bank transfer' },
            { value: 'card', label: 'Card' },
          ]} />
        </div>
        <div className="payment-entry-example" role="note">
          <strong>Example</strong>
          <span>
            {isRefund
              ? `Refunding ${formatPeso(Math.min(500, paid))} reduces total paid and increases the balance by the same amount.`
              : `Receiving ${formatPeso(Math.min(1000, balance))} reduces the balance from ${formatPeso(balance)} to ${formatPeso(Math.max(0, balance - Math.min(1000, balance)))}.`}
          </span>
        </div>
        {error || submitError ? <p className="error-msg">{error || submitError}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
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
  onProcessPickup,
  onChangeVehicle,
  onRecordPayment,
  onManage,
}) {
  const [detail, setDetail] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [changeBusy, setChangeBusy] = useState(false)
  const [pickupTarget, setPickupTarget] = useState(null)
  const [pickupBusy, setPickupBusy] = useState(false)
  const [pickupError, setPickupError] = useState('')
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    setDetail(null)
    setChangeTarget(null)
    setPickupTarget(null)
    setPickupError('')
    setPaymentTarget(null)
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

  const handlePickupConfirm = async (pickup) => {
    if (!pickupTarget || !onProcessPickup) return
    setPickupBusy(true)
    setPickupError('')
    try {
      await onProcessPickup(pickupTarget.rental, pickup)
      setPickupTarget(null)
    } catch (err) {
      setPickupError(err?.message || 'Could not process this booking pickup.')
    } finally {
      setPickupBusy(false)
    }
  }

  const handlePaymentConfirm = async (entry) => {
    if (!paymentTarget || !onRecordPayment) return
    setPaymentBusy(true)
    setPaymentError('')
    try {
      await onRecordPayment(paymentTarget.rental, entry)
      setPaymentTarget(null)
    } catch (err) {
      setPaymentError(err?.message || 'Could not save this payment entry.')
    } finally {
      setPaymentBusy(false)
    }
  }

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
                    const isUnsignedBooking =
                      String(rental?.deskMode || rental?.rental?.deskMode || '')
                        .trim()
                        .toLowerCase()
                        .replace(/[\s-]+/g, '_') === 'booking' &&
                      (!rental.signature || !rental.termsAccepted)
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
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                            openDetail(rental, vehicle)
                          }
                        }}
                      >
                        <td data-label="Vehicle" className="dash-attn-cell-wide">
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
                        <td data-label="Renter" className="dash-attn-cell-wide">
                          <div className="dash-attn-renter">
                            <span>{customerName(rental)}</span>
                            <span className={`dash-attn-mode-badge is-${deskModeLabel(rental).toLowerCase()}`}>
                              {deskModeLabel(rental)}
                            </span>
                          </div>
                        </td>
                        <td data-label="Starts" className="dash-attn-cell-wide">
                          <div className="dash-attn-cell-time">
                            <span>{startLabel}</span>
                            {isPastDue ? (
                              <span className="dash-attn-remaining">
                                {isUnsignedBooking ? 'awaiting pickup' : 'activating…'}
                              </span>
                            ) : remaining ? (
                              <span className="dash-attn-remaining">{remaining}</span>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="First paid">
                          <span className="dash-attn-balance">{formatPeso(firstPaid)}</span>
                        </td>
                        <td data-label="Balance">
                          <span className={bal > 0 ? 'dash-attn-balance is-due' : 'dash-attn-balance'}>
                            {formatPeso(bal)}
                          </span>
                        </td>
                        <td className="dash-attn-actions-col" onClick={stop}>
                          {isAdminUser || (bal > 0 && onRecordPayment) || (isUnsignedBooking && onProcessPickup) ? (
                            <div className="dash-attn-actions">
                              {isUnsignedBooking && onProcessPickup ? (
                                <button
                                  type="button"
                                  className="btn-primary btn-sm"
                                  onClick={() => {
                                    setPickupError('')
                                    setPickupTarget({ rental, vehicle })
                                  }}
                                >
                                  Confirmation
                                </button>
                              ) : null}
                              {bal > 0 && onRecordPayment ? <button type="button" className="btn-outline btn-sm" onClick={() => setPaymentTarget({ rental, vehicle })}>Payment</button> : null}
                              {isAdminUser ? (
                                <>
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
                                </>
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
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                            openDetail(rental, vehicle)
                          }
                        }}
                      >
                        <td data-label="Vehicle" className="dash-attn-cell-wide">
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
                        <td data-label="Renter" className="dash-attn-cell-wide">
                          <div className="dash-attn-renter">
                            <span>{customerName(rental)}</span>
                            <span className={`dash-attn-mode-badge is-${deskModeLabel(rental).toLowerCase()}`}>
                              {deskModeLabel(rental)}
                            </span>
                          </div>
                        </td>
                        <td data-label="Until" className="dash-attn-cell-wide">
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
                        <td data-label="First paid">
                          <span className="dash-attn-balance">{formatPeso(firstPaid)}</span>
                        </td>
                        <td data-label="Balance">
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
                              {bal > 0 && onRecordPayment ? <button type="button" className="btn-outline btn-sm" onClick={() => setPaymentTarget({ rental, vehicle })}>Payment</button> : null}
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
              <table className="dash-attn-table dash-attn-table--maintenance">
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
                      <td data-label="Vehicle" className="dash-attn-cell-wide">
                        <div className="dash-attn-cell-vehicle">
                          <VehicleThumb vehicle={v} />
                          <div>
                            <strong>
                              {v.make} — {v.series}
                            </strong>
                          </div>
                        </div>
                      </td>
                      <td data-label="Type">{v.bodyType || '—'}</td>
                      <td data-label="Plate">{v.plateNo || '—'}</td>
                      <td className="dash-attn-actions-col">
                        {isAdminUser ? (
                          <button type="button" className="btn-outline btn-sm" onClick={onManage}>
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
      {paymentTarget ? (
        <PaymentEntryModal rental={paymentTarget.rental} onClose={() => !paymentBusy && setPaymentTarget(null)} onConfirm={handlePaymentConfirm} busy={paymentBusy} submitError={paymentError} />
      ) : null}

      {detail ? (
        <DetailModal
          rental={detail.rental}
          vehicle={detail.vehicle}
          onClose={() => setDetail(null)}
        />
      ) : null}

      {pickupTarget ? (
        <ProcessPickupModal
          rental={pickupTarget.rental}
          vehicle={pickupTarget.vehicle}
          busy={pickupBusy}
          submitError={pickupError}
          onClose={() => {
            if (!pickupBusy) setPickupTarget(null)
          }}
          onConfirm={handlePickupConfirm}
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
