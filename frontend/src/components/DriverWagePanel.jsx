import { useEffect, useState } from 'react'
import {
  DRIVER_MIN_HOURS,
  loadDriverWageSettings,
  saveDriverWageSettings,
} from '../utils/driverWage'
import { formatRentalFee, parseRentalFeeAmount } from '../utils/rentalFee'

function formatPriceInput(value) {
  const digits = String(value ?? '').replace(/[^\d.]/g, '')
  if (digits === '' || digits === '.') return digits === '.' ? '₱0.' : ''
  const n = Number(digits)
  if (Number.isNaN(n)) return `₱${digits}`
  const [whole, frac] = digits.split('.')
  const withCommas = Number(whole || '0').toLocaleString('en-PH')
  if (frac != null) return `₱${withCommas}.${frac.slice(0, 2)}`
  if (digits.endsWith('.')) return `₱${withCommas}.`
  return `₱${withCommas}`
}

export default function DriverWagePanel() {
  const [wageInput, setWageInput] = useState('')
  const [message, setMessage] = useState('')
  const [savedRate, setSavedRate] = useState(0)

  useEffect(() => {
    const loaded = loadDriverWageSettings()
    setSavedRate(loaded.wagePerHour || 0)
    setWageInput(loaded.wagePerHour > 0 ? formatRentalFee(loaded.wagePerHour) : '')
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    const wagePerHour = parseRentalFeeAmount(wageInput)
    const next = saveDriverWageSettings({ wagePerHour })
    setSavedRate(next.wagePerHour)
    setWageInput(next.wagePerHour > 0 ? formatRentalFee(next.wagePerHour) : '')
    setMessage(
      next.wagePerHour > 0
        ? `Saved · ${formatRentalFee(next.wagePerHour)}/hr · min ${DRIVER_MIN_HOURS} hrs`
        : 'Driver wage cleared.',
    )
    window.setTimeout(() => setMessage(''), 2200)
  }

  const example12 = savedRate > 0 ? formatRentalFee(savedRate * DRIVER_MIN_HOURS) : null
  const example24 = savedRate > 0 ? formatRentalFee(savedRate * 24) : null

  return (
    <article className="settings-card settings-driver-wage-card">
      <div className="settings-card-head">
        <h4 className="settings-card-title">Driver wage</h4>
        <p className="settings-card-copy">
          Hourly wage for With-driver rentals. Always billed at least {DRIVER_MIN_HOURS}{' '}
          hours (even on a 5-hour package).
        </p>
      </div>

      <form className="driver-wage-form" onSubmit={handleSave}>
        <label className="field">
          <span className="field-label">Wage / hour (₱)</span>
          <input
            type="text"
            inputMode="decimal"
            value={wageInput}
            onChange={(e) => setWageInput(formatPriceInput(e.target.value))}
            placeholder="₱0"
          />
        </label>
        <button type="submit" className="btn-primary">
          Save wage
        </button>
      </form>

      {savedRate > 0 ? (
        <ul className="driver-wage-examples">
          <li>
            <span>Min charge ({DRIVER_MIN_HOURS} hrs)</span>
            <strong>{example12}</strong>
          </li>
          <li>
            <span>24-hour rental</span>
            <strong>{example24}</strong>
          </li>
        </ul>
      ) : (
        <p className="destinations-empty">
          No wage set yet. With-driver rentals will ask you to configure this first.
        </p>
      )}

      {message ? (
        <p className="settings-data-message" role="status">
          {message}
        </p>
      ) : null}
    </article>
  )
}
