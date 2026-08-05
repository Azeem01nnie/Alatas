const DURATIONS = ['5hrs', '12hrs', '24hrs', 'Others']
const MERIDIEMS = ['AM', 'PM']

function PeriodFields({
  label,
  dateKey,
  hourKey,
  minuteKey,
  meridiemKey,
  data,
  onChange,
  errors,
}) {
  return (
    <div className="period-block">
      <p className="period-block-title">{label}</p>
      <div className="period-fields">
        <label className="field period-date">
          <span className="field-label">Date</span>
          <input
            type="date"
            value={data[dateKey]}
            onChange={(e) => onChange(dateKey, e.target.value)}
            className={errors[dateKey] ? 'input-error' : ''}
          />
          {errors[dateKey] && <span className="error-msg">{errors[dateKey]}</span>}
        </label>

        <div className="period-when">
          <span className="field-label">Time</span>
          <div className="period-time-row">
            <div
              className={`period-time-cell${errors[hourKey] ? ' input-error' : ''}`}
            >
              <input
                type="text"
                value={data[hourKey]}
                onChange={(e) => onChange(hourKey, e.target.value)}
                placeholder="HH"
                inputMode="numeric"
                maxLength={2}
                aria-label="Hour"
                className="period-time-part"
              />
            </div>
            <span className="period-time-sep" aria-hidden="true">
              :
            </span>
            <div
              className={`period-time-cell${errors[minuteKey] ? ' input-error' : ''}`}
            >
              <input
                type="text"
                value={data[minuteKey]}
                onChange={(e) => onChange(minuteKey, e.target.value)}
                placeholder="MM"
                inputMode="numeric"
                maxLength={2}
                aria-label="Minute"
                className="period-time-part"
              />
            </div>
            <div
              className={`period-ampm-group${errors[meridiemKey] ? ' input-error' : ''}`}
              role="group"
              aria-label="AM or PM"
            >
              {MERIDIEMS.map((m) => (
                <label
                  key={m}
                  className={`period-ampm-btn${data[meridiemKey] === m ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={meridiemKey}
                    value={m}
                    checked={data[meridiemKey] === m}
                    onChange={() => onChange(meridiemKey, m)}
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
          {errors[hourKey] && <span className="error-msg">{errors[hourKey]}</span>}
          {errors[minuteKey] && <span className="error-msg">{errors[minuteKey]}</span>}
          {errors[meridiemKey] && <span className="error-msg">{errors[meridiemKey]}</span>}
        </div>
      </div>
    </div>
  )
}

export default function StepRentalDetails({ data, onChange, errors }) {
  return (
    <section className="step-panel">
      <h2 className="step-title">Rental Details</h2>
      <p className="step-subtitle">Specify duration, type, period, and fee.</p>

      <fieldset className="field-group">
        <legend className="field-label">Duration</legend>
        <div className="chip-group">
          {DURATIONS.map((d) => (
            <label key={d} className={`chip${data.duration === d ? ' selected' : ''}`}>
              <input
                type="radio"
                name="duration"
                value={d}
                checked={data.duration === d}
                onChange={() => onChange('duration', d)}
              />
              {d}
            </label>
          ))}
        </div>
        {data.duration === 'Others' && (
          <label className="field field-full">
            <span className="field-label">Specify duration</span>
            <input
              type="text"
              value={data.durationOther}
              onChange={(e) => onChange('durationOther', e.target.value)}
              placeholder="e.g. 48hrs, 3 days"
              className={errors.durationOther ? 'input-error' : ''}
            />
            {errors.durationOther && <span className="error-msg">{errors.durationOther}</span>}
          </label>
        )}
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
                onChange={() => onChange('rentalType', type)}
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
            onChange={onChange}
            errors={errors}
          />
          <PeriodFields
            label="To"
            dateKey="toDate"
            hourKey="toHour"
            minuteKey="toMinute"
            meridiemKey="toMeridiem"
            data={data}
            onChange={onChange}
            errors={errors}
          />
        </div>
      </fieldset>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Rental Fee</span>
          <input
            type="text"
            value={data.rentalFee}
            onChange={(e) => onChange('rentalFee', e.target.value)}
            placeholder="e.g. ₱2,500.00"
            className={errors.rentalFee ? 'input-error' : ''}
          />
          {errors.rentalFee && <span className="error-msg">{errors.rentalFee}</span>}
        </label>
      </div>
    </section>
  )
}
