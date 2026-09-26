import { useEffect, useState } from 'react'
import { formatPeso } from '../data/vehicles'
import { formatRentalFee, parseRentalFeeAmount } from '../utils/rentalFee'

export default function OverduePaymentModal({
  open,
  vehicle,
  hours = 0,
  chargedAmount = 0,
  exceedRate = 0,
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

  const submit = () => {
    const paid = parseRentalFeeAmount(amountInput)
    if (amountInput.trim() === '') {
      setError('Enter the overdue amount collected')
      return
    }
    if (paid < 0) {
      setError('Amount cannot be negative')
      return
    }
    onConfirm({
      hours: Math.max(0, Number(hours) || 0),
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
          Collect overdue payment
        </h3>
        <p className="confirm-modal-message">
          {vehicle?.make} — {vehicle?.series} ({vehicle?.plateNo || '—'}) is overdue by{' '}
          <strong>
            {hours} hour{hours === 1 ? '' : 's'}
          </strong>
          {exceedRate > 0 ? ` at ${formatPeso(exceedRate)}/hr` : ''}. Charge:{' '}
          <strong>{formatRentalFee(chargedAmount)}</strong>. Enter the amount collected before
          completing the return.
        </p>

        <label className="field">
          <span className="field-label">Overdue amount received</span>
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
        </label>

        {error ? <p className="error-msg">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Confirm payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
