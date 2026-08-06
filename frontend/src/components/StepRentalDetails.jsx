import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildRentalAutoPatch,
  formatDurationDaysLabel,
  parseDurationDays,
  parseDurationHours,
} from '../utils/rentalFee'
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
  const hours = useMemo(
    () => parseDurationHours(data.duration, data.durationOther),
    [data.duration, data.durationOther],
  )

  const applyField = (key, value) => {
    const next = { ...data, [key]: value }
    const auto = buildRentalAutoPatch(next, rates)
    onChange({ [key]: value, ...auto })
  }

  const applyFromTime = ({ hour, minute, meridiem }) => {
    const next = {
      ...data,
      fromHour: hour,
      fromMinute: minute,
      fromMeridiem: meridiem,
    }
    const auto = buildRentalAutoPatch(next, rates)
    onChange({
      fromHour: hour,
      fromMinute: minute,
      fromMeridiem: meridiem,
      ...auto,
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

  // Keep fee + auto end time in sync when duration / start / rates change
  useEffect(() => {
    const auto = buildRentalAutoPatch(data, rates)
    const keys = Object.keys(auto)
    if (!keys.length) return
    const changed = keys.some((key) => data[key] !== auto[key])
    if (changed) onChangeRef.current(auto)
  }, [
    data,
    rates,
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

  return (
    <section className="step-panel">
      <h2 className="step-title">Rental Details</h2>
      <p className="step-subtitle">
        Set duration and schedule — fee calculates from the vehicle rate card.
      </p>

      {vehicle && (
        <div className="rental-vehicle-chip">
          <img src={vehicle.image} alt="" className="rental-vehicle-chip-thumb" />
          <div>
            <strong>
              {vehicle.make} — {vehicle.series}
            </strong>
            <span>
              {vehicle.bodyType} · {vehicle.plateNo}
            </span>
          </div>
        </div>
      )}

      <fieldset className="field-group">
        <legend className="sr-only">Duration</legend>
        <div className="duration-row">
          <div className="duration-presets">
            <span className="field-label" id="duration-label">
              Duration
            </span>
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
          </div>
          {data.duration === 'Others' && (
            <label className="field duration-other-field">
              <span className="field-label">Specify</span>
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
      </fieldset>

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
        {durationHintDays ? (
          <p className="period-hint">
            End time is set from start + {durationHintDays} day
            {durationHintDays === 1 ? '' : 's'}.
          </p>
        ) : durationHintHours ? (
          <p className="period-hint">
            End time is set from start + {durationHintHours} hour
            {durationHintHours === 1 ? '' : 's'}.
          </p>
        ) : data.duration === 'Others' ? (
          <p className="period-hint">Enter the number of days to auto-fill the end time.</p>
        ) : null}
      </fieldset>

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
        </div>
        <div className={`rental-fee-amount${errors.rentalFee ? ' input-error' : ''}`}>
          {data.rentalFee || '—'}
        </div>
        {errors.rentalFee && <span className="error-msg">{errors.rentalFee}</span>}
      </div>
    </section>
  )
}
