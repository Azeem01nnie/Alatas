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
  const [withinCityInput, setWithinCityInput] = useState('')
  const [outsideCityInput, setOutsideCityInput] = useState('')
  const [message, setMessage] = useState('')
  const [savedRates, setSavedRates] = useState({
    withinCityWagePerHour: 0,
    outsideCityWagePerHour: 0,
  })

  useEffect(() => {
    const loaded = loadDriverWageSettings()
    setSavedRates(loaded)
    setWithinCityInput(
      loaded.withinCityWagePerHour > 0 ? formatRentalFee(loaded.withinCityWagePerHour) : '',
    )
    setOutsideCityInput(
      loaded.outsideCityWagePerHour > 0 ? formatRentalFee(loaded.outsideCityWagePerHour) : '',
    )
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    const next = saveDriverWageSettings({
      withinCityWagePerHour: parseRentalFeeAmount(withinCityInput),
      outsideCityWagePerHour: parseRentalFeeAmount(outsideCityInput),
    })
    setSavedRates(next)
    setWithinCityInput(
      next.withinCityWagePerHour > 0 ? formatRentalFee(next.withinCityWagePerHour) : '',
    )
    setOutsideCityInput(
      next.outsideCityWagePerHour > 0 ? formatRentalFee(next.outsideCityWagePerHour) : '',
    )
    setMessage('Driver wages saved.')
    window.setTimeout(() => setMessage(''), 2200)
  }

  const hasSavedRate =
    savedRates.withinCityWagePerHour > 0 || savedRates.outsideCityWagePerHour > 0

  return (
    <article className="settings-card settings-driver-wage-card">
      <div className="settings-card-head">
        <h4 className="settings-card-title">Driver wages</h4>
        <p className="settings-card-copy">
          Separate hourly wages for in-city and outside-city With-driver rentals. Always billed
          at least {DRIVER_MIN_HOURS} hours (even on a 5-hour package).
        </p>
      </div>

      <form className="driver-wage-form" onSubmit={handleSave}>
        <label className="field">
          <span className="field-label">In city / hour (₱)</span>
          <input
            type="text"
            inputMode="decimal"
            value={withinCityInput}
            onChange={(e) => setWithinCityInput(formatPriceInput(e.target.value))}
            placeholder="₱0"
          />
        </label>
        <label className="field">
          <span className="field-label">Outside city / hour (₱)</span>
          <input
            type="text"
            inputMode="decimal"
            value={outsideCityInput}
            onChange={(e) => setOutsideCityInput(formatPriceInput(e.target.value))}
            placeholder="₱0"
          />
        </label>
        <button type="submit" className="btn-primary">
          Save wages
        </button>
      </form>

      {hasSavedRate ? (
        <ul className="driver-wage-examples">
          <li>
            <span>In-city min charge ({DRIVER_MIN_HOURS} hrs)</span>
            <strong>
              {savedRates.withinCityWagePerHour > 0
                ? formatRentalFee(savedRates.withinCityWagePerHour * DRIVER_MIN_HOURS)
                : 'Not set'}
            </strong>
          </li>
          <li>
            <span>Outside-city min charge ({DRIVER_MIN_HOURS} hrs)</span>
            <strong>
              {savedRates.outsideCityWagePerHour > 0
                ? formatRentalFee(savedRates.outsideCityWagePerHour * DRIVER_MIN_HOURS)
                : 'Not set'}
            </strong>
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
