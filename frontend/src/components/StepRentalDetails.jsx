import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildRentalAutoPatch,
  formatDurationDaysLabel,
  formatRentalFee,
  parseDurationDays,
  parseDurationHours,
  parseRentalFeeAmount,
} from '../utils/rentalFee'
import { listActiveOutsideCityDestinations } from '../utils/outsideCityDestinations'
import { buildDriverFeePatch, DRIVER_MIN_HOURS } from '../utils/driverWage'
import PremiumDatePicker from './PremiumDatePicker'
import PremiumTimePicker from './PremiumTimePicker'

const DURATIONS = ['5hrs', '12hrs', '24hrs', 'Others']

function todayDateValue() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function PeriodFields({
  label,
  dateKey,
  hourKey,
  minuteKey,
  meridiemKey,
  data,
  onField,
  onTime,
  errors,
  minDate,
  readOnly,
}) {
  const timeError = Boolean(errors[hourKey] || errors[minuteKey] || errors[meridiemKey])

  return (
    <div className={`period-card${readOnly ? ' is-auto' : ''}`}>
      <div className="period-card-head">
        <p className="period-block-title">{label}</p>
        {readOnly && <span className="period-auto-tag">Auto</span>}
      </div>

      <div className="period-pickers">
        <div className="period-picker-field">
          <span className="field-label">Date</span>
          <PremiumDatePicker
            value={data[dateKey]}
            minDate={minDate}
            disabled={readOnly}
            error={Boolean(errors[dateKey])}
            onChange={(next) => onField(dateKey, next)}
          />
          {errors[dateKey] && <span className="error-msg">{errors[dateKey]}</span>}
        </div>

        <div className="period-picker-field">
          <span className="field-label">Time</span>
          <PremiumTimePicker
            hour={data[hourKey]}
            minute={data[minuteKey]}
            meridiem={data[meridiemKey]}
            disabled={readOnly}
            error={timeError}
            onChange={onTime}
          />
          {errors[hourKey] && <span className="error-msg">{errors[hourKey]}</span>}
          {errors[minuteKey] && <span className="error-msg">{errors[minuteKey]}</span>}
          {errors[meridiemKey] && <span className="error-msg">{errors[meridiemKey]}</span>}
        </div>
      </div>
    </div>
  )
}

export default function StepRentalDetails({ data, onChange, errors, vehicle }) {
  const minDate = todayDateValue()
  const toMinDate = data.fromDate && data.fromDate > minDate ? data.fromDate : minDate
  const rates = vehicle?.rates
  const ratesKey = rates
    ? [rates.hrs5, rates.hrs12, rates.hrs24, rates.exceedHour].join('|')
    : ''
  const hours = useMemo(
    () => parseDurationHours(data.duration, data.durationOther),
    [data.duration, data.durationOther],
  )
  const destinations = listActiveOutsideCityDestinations()
  const coverage = data.coverage === 'outside_city' ? 'outside_city' : 'within_city'
  const withDriver = data.rentalType === 'With-driver'
  const cityFee = parseRentalFeeAmount(data.rentalFee)
  const outsideFee =
    coverage === 'outside_city' ? parseRentalFeeAmount(data.outsideCityFee) : 0
  const driverFee = withDriver ? parseRentalFeeAmount(data.driverFee) : 0
  const totalFee = cityFee + outsideFee + driverFee
  const totalFeeLabel = totalFee > 0 ? formatRentalFee(totalFee) : ''

  const syncDriverPatch = (nextData, feeHours = null) => {
    const hrs =
      feeHours ??
      parseDurationHours(nextData.duration, nextData.durationOther) ??
      nextData.feeHours
    return buildDriverFeePatch(nextData.rentalType, hrs)
  }

  const applyField = (key, value) => {
    const next = { ...data, [key]: value }
    const auto = buildRentalAutoPatch(next, rates)
    const driver = syncDriverPatch({ ...next, ...auto }, auto.feeHours ?? next.feeHours)
    onChange({ [key]: value, ...auto, ...driver })
  }

  const applyCoverage = (nextCoverage) => {
    if (nextCoverage === 'within_city') {
      onChange({
        coverage: 'within_city',
        outsideCityDestinationId: '',
        outsideCityDestinationName: '',
        outsideCityFee: '',
      })
      return
    }
    onChange({ coverage: 'outside_city' })
  }

  const applyDestination = (destinationId) => {
    const dest = destinations.find((d) => d.id === destinationId)
    if (!dest) {
      onChange({
        coverage: 'outside_city',
        outsideCityDestinationId: '',
        outsideCityDestinationName: '',
        outsideCityFee: '',
      })
      return
    }
    onChange({
      coverage: 'outside_city',
      outsideCityDestinationId: dest.id,
      outsideCityDestinationName: dest.name,
      outsideCityFee: dest.priceLabel || formatRentalFee(dest.price),
    })
  }

  const applyFromTime = ({ hour, minute, meridiem }) => {
    const next = {
      ...data,
      fromHour: hour,
      fromMinute: minute,
      fromMeridiem: meridiem,
    }
    const auto = buildRentalAutoPatch(next, rates)
    const driver = syncDriverPatch({ ...next, ...auto }, auto.feeHours ?? next.feeHours)
    onChange({
      fromHour: hour,
      fromMinute: minute,
      fromMeridiem: meridiem,
      ...auto,
      ...driver,
    })
  }

  const applyToTime = ({ hour, minute, meridiem }) => {
    onChange({
      toHour: hour,
      toMinute: minute,
      toMeridiem: meridiem,
    })
  }

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Keep fee + auto end time + driver wage in sync when duration / start / rates change
  useEffect(() => {
    const auto = buildRentalAutoPatch(data, rates)
    const driver = syncDriverPatch(
      { ...data, ...auto },
      auto.feeHours ?? data.feeHours,
    )
    const patch = { ...auto, ...driver }
    const keys = Object.keys(patch)
    if (!keys.length) return
    const changed = keys.some((key) => data[key] !== patch[key])
    if (changed) onChangeRef.current(patch)
  }, [
    data.duration,
    data.durationOther,
    data.fromDate,
    data.fromHour,
    data.fromMinute,
    data.fromMeridiem,
    data.rentalFee,
    data.feeNote,
    data.feeHours,
    data.rentalType,
    data.driverFee,
    data.driverFeeNote,
    data.driverBillableHours,
    data.driverWagePerHour,
    data.toDate,
    data.toHour,
    data.toMinute,
    data.toMeridiem,
    ratesKey,
  ])

  const toLocked = Boolean(
    hours && data.fromDate && data.fromHour && data.fromMinute !== '' && data.fromMeridiem,
  )

  const [editingDays, setEditingDays] = useState(false)

  useEffect(() => {
    if (data.duration !== 'Others') setEditingDays(false)
  }, [data.duration])

  const parsedDays = parseDurationDays(data.durationOther)
  const daysInputValue = editingDays
    ? String(data.durationOther || '').replace(/\D/g, '')
    : parsedDays
      ? formatDurationDaysLabel(data.durationOther)
      : String(data.durationOther || '')

  const commitDays = () => {
    setEditingDays(false)
    const digits = String(data.durationOther || '').replace(/\D/g, '')
    if (!digits) {
      if (data.durationOther) applyField('durationOther', '')
      return
    }
    const labeled = formatDurationDaysLabel(digits)
    if (labeled && labeled !== data.durationOther) {
      applyField('durationOther', labeled)
    }
  }

  const onDaysChange = (raw) => {
    const digits = String(raw).replace(/\D/g, '').slice(0, 3)
    applyField('durationOther', digits)
  }

  const durationHintHours = hours
  const durationHintDays = data.duration === 'Others' ? parsedDays : null

  const periodHint = durationHintDays
    ? `+${durationHintDays} day${durationHintDays === 1 ? '' : 's'}`
    : durationHintHours
      ? `+${durationHintHours}h`
      : data.duration === 'Others'
        ? 'Enter days'
        : ''

  const showFeeStack =
    (coverage === 'outside_city' && outsideFee > 0) ||
    (withDriver && (driverFee > 0 || data.driverFeeNote))

  return (
    <section className="step-panel step-rental">
      <header className="step-rental-head">
        <div>
          <h2 className="step-title">Rental Details</h2>
          <p className="step-subtitle">Duration, schedule, and coverage.</p>
        </div>
        {vehicle ? (
          <div className="rental-vehicle-chip">
            {vehicle.image ? (
              <img src={vehicle.image} alt="" className="rental-vehicle-chip-thumb" />
            ) : (
              <div className="rental-vehicle-chip-thumb rental-vehicle-chip-thumb--empty" aria-hidden />
            )}
            <div>
              <strong>
                {vehicle.make} — {vehicle.series}
              </strong>
              <span>
                {vehicle.bodyType} · {vehicle.plateNo}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      <div className="step-rental-grid">
        <div className="step-rental-col">
          <fieldset className="field-group">
            <legend className="field-label" id="duration-label">
              Duration
            </legend>
            <div className="duration-row">
              <div className="chip-group" role="group" aria-labelledby="duration-label">
                {DURATIONS.map((d) => (
                  <label key={d} className={`chip${data.duration === d ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value={d}
                      checked={data.duration === d}
                      onChange={() => applyField('duration', d)}
                    />
                    {d}
                  </label>
                ))}
              </div>
              {data.duration === 'Others' && (
                <label className="field duration-other-field">
                  <span className="field-label">Days</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={daysInputValue}
                    onFocus={() => {
                      setEditingDays(true)
                      if (parsedDays) applyField('durationOther', String(parsedDays))
                    }}
                    onBlur={commitDays}
                    onChange={(e) => onDaysChange(e.target.value)}
                    placeholder="e.g. 3"
                    className={errors.durationOther ? 'input-error' : ''}
                  />
                  {errors.durationOther && (
                    <span className="error-msg">{errors.durationOther}</span>
                  )}
                </label>
              )}
            </div>
            {errors.duration && <span className="error-msg">{errors.duration}</span>}
          </fieldset>

          <fieldset className="field-group">
            <legend className="field-label">Rental Type</legend>
            <div className="chip-group">
              {['Self-drive', 'With-driver'].map((type) => (
                <label key={type} className={`chip${data.rentalType === type ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="rentalType"
                    value={type}
                    checked={data.rentalType === type}
                    onChange={() => applyField('rentalType', type)}
                  />
                  {type}
                </label>
              ))}
            </div>
            {errors.rentalType && <span className="error-msg">{errors.rentalType}</span>}
            {withDriver ? (
              <p className="period-hint">Min {DRIVER_MIN_HOURS} hrs driver wage</p>
            ) : null}
            {errors.driverFee && <span className="error-msg">{errors.driverFee}</span>}
          </fieldset>

          <fieldset className="field-group">
            <legend className="field-label">Coverage</legend>
            <div className="chip-group">
              {[
                { id: 'within_city', label: 'Within city' },
                { id: 'outside_city', label: 'Outside city' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`chip${coverage === opt.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="coverage"
                    value={opt.id}
                    checked={coverage === opt.id}
                    onChange={() => applyCoverage(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {errors.coverage && <span className="error-msg">{errors.coverage}</span>}
            {coverage === 'outside_city' ? (
              <label className="field rental-destination-field">
                <span className="field-label">Destination</span>
                <select
                  value={data.outsideCityDestinationId || ''}
                  onChange={(e) => applyDestination(e.target.value)}
                  className={errors.outsideCityDestinationId ? 'input-error' : ''}
                >
                  <option value="">Select destination</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.priceLabel}
                    </option>
                  ))}
                </select>
                {destinations.length === 0 ? (
                  <span className="field-hint">Add destinations in Settings → Rates &amp; extras.</span>
                ) : null}
                {errors.outsideCityDestinationId && (
                  <span className="error-msg">{errors.outsideCityDestinationId}</span>
                )}
              </label>
            ) : null}
          </fieldset>
        </div>

        <div className="step-rental-col">
          <fieldset className="field-group">
            <legend className="field-label">Rental Period</legend>
            <div className="period-stack">
              <PeriodFields
                label="From"
                dateKey="fromDate"
                hourKey="fromHour"
                minuteKey="fromMinute"
                meridiemKey="fromMeridiem"
                data={data}
                onField={applyField}
                onTime={applyFromTime}
                errors={errors}
                minDate={minDate}
              />
              <PeriodFields
                label="To"
                dateKey="toDate"
                hourKey="toHour"
                minuteKey="toMinute"
                meridiemKey="toMeridiem"
                data={data}
                onField={applyField}
                onTime={applyToTime}
                errors={errors}
                minDate={toMinDate}
                readOnly={toLocked}
              />
            </div>
            {periodHint ? <p className="period-hint">{periodHint} from start</p> : null}
          </fieldset>
        </div>
      </div>

      <div className="rental-fee-panel">
        <div className="rental-fee-copy">
          <span className="field-label">Rental Fee</span>
          <p className="rental-fee-note">
            {data.feeNote
              ? data.feeNote
              : rates
                ? 'Select duration to calculate'
                : 'Select a vehicle first'}
          </p>
          {showFeeStack ? (
            <ul className="rental-fee-stack">
              <li>
                <span>City package</span>
                <strong>{data.rentalFee || '—'}</strong>
              </li>
              {coverage === 'outside_city' && outsideFee > 0 ? (
                <li>
                  <span>
                    Outside city
                    {data.outsideCityDestinationName
                      ? ` · ${data.outsideCityDestinationName}`
                      : ''}
                  </span>
                  <strong>{data.outsideCityFee || '—'}</strong>
                </li>
              ) : null}
              {withDriver ? (
                <li>
                  <span>Driver wage</span>
                  <strong>{data.driverFee || '—'}</strong>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <div className={`rental-fee-amount${errors.rentalFee ? ' input-error' : ''}`}>
          {totalFeeLabel || data.rentalFee || '—'}
        </div>
        {errors.rentalFee && <span className="error-msg">{errors.rentalFee}</span>}
      </div>
    </section>
  )
}
