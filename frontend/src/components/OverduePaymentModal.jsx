import { useEffect, useState } from 'react'
import { formatPeso } from '../data/vehicles'
import { formatRentalFee, parseRentalFeeAmount } from '../utils/rentalFee'

function formatDueAt(value) {
  const d = new Date(value || 0)
  if (!value || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatLateBy(value) {
  const due = new Date(value || 0).getTime()
  if (!value || Number.isNaN(due)) return ''
  const mins = Math.max(0, Math.floor((Date.now() - due) / 60_000))
  const days = Math.floor(mins / 1440)
  const hrs = Math.floor((mins % 1440) / 60)
  const rem = mins % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hrs || days) parts.push(`${hrs}h`)
  parts.push(`${rem}m`)
  return parts.join(' ')
}

export default function OverduePaymentModal({
  open,
  vehicle,
  hours = 0,
  chargedAmount = 0,
  exceedRate = 0,
  dueAt = '',
  busy = false,
  onCancel,
  onConfirm,
}) {
  const [amountInput, setAmountInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setAmountInput(chargedAmount > 0 ? String(chargedAmount) : '')
    setError('')
  }, [open, chargedAmount])

  if (!open) return null

  const hourCount = Math.max(0, Number(hours) || 0)
  const hoursLabel = `${hourCount} hour${hourCount === 1 ? '' : 's'}`
  const lateBy = formatLateBy(dueAt)
  const paidPreview = amountInput.trim() === '' ? null : parseRentalFeeAmount(amountInput)
  const diff = paidPreview == null ? 0 : paidPreview - (Number(chargedAmount) || 0)

  const submit = () => {
    const paid = parseRentalFeeAmount(amountInput)
    if (amountInput.trim() === '') {
      setError('Enter the amount the customer paid for the overdue hours')
      return
    }
    if (paid < 0) {
      setError('Amount cannot be negative')
      return
    }
    onConfirm({
      hours: hourCount,
      chargedAmount: Math.max(0, Number(chargedAmount) || 0),
      paidAmount: paid,
      exceedRate: Math.max(0, Number(exceedRate) || 0),
    })
  }

  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overdue-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="overdue-pay-title" className="modal-title">
          Overdue return — {hoursLabel} late
        </h3>
        <p className="confirm-modal-message">
          {vehicle?.make} — {vehicle?.series} ({vehicle?.plateNo || '—'}) was returned after its
          due time. Collect the overdue charge below before completing the return.
        </p>

        <dl className="overdue-breakdown">
          <div>
            <dt>Due back</dt>
            <dd>{formatDueAt(dueAt)}</dd>
          </div>
          <div>
            <dt>Time overdue</dt>
            <dd>
              <strong>{hoursLabel}</strong>
              {lateBy ? <span className="overdue-breakdown-sub">actual {lateBy}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Excess hour rate</dt>
            <dd>{exceedRate > 0 ? `${formatPeso(exceedRate)} / hr` : '—'}</dd>
          </div>
          <div className="is-total">
            <dt>Overdue charge</dt>
            <dd>
              {exceedRate > 0 ? (
                <span className="overdue-breakdown-sub">
                  {hourCount} × {formatPeso(exceedRate)} =
                </span>
              ) : null}
              <strong>{formatRentalFee(chargedAmount)}</strong>
            </dd>
          </div>
        </dl>

        <label className="field">
          <span className="field-label">Amount paid by customer</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '')
              const parts = raw.split('.')
              setAmountInput(
                parts.length <= 1
                  ? raw
                  : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`,
              )
              setError('')
            }}
            placeholder="0"
            autoFocus
          />
          <span className="field-hint">
            {paidPreview == null
              ? 'Every started hour counts as a full hour.'
              : diff < 0
                ? `Short by ${formatRentalFee(-diff)}`
                : diff > 0
                  ? `${formatRentalFee(diff)} more than the charge`
                  : 'Matches the overdue charge'}
          </span>
        </label>

        {error ? <p className="error-msg">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Record payment & return'}
          </button>
        </div>
      </div>
    </div>
  )
}
