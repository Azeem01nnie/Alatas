const DURATIONS = ['5hrs', '12hrs', '24hrs', 'Others']

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
        <div className="form-grid">
          <label className="field">
            <span className="field-label">From (Date &amp; Time)</span>
            <input
              type="datetime-local"
              value={data.periodFrom}
              onChange={(e) => onChange('periodFrom', e.target.value)}
              className={errors.periodFrom ? 'input-error' : ''}
            />
            {errors.periodFrom && <span className="error-msg">{errors.periodFrom}</span>}
          </label>
          <label className="field">
            <span className="field-label">To (Date &amp; Time)</span>
            <input
              type="datetime-local"
              value={data.periodTo}
              onChange={(e) => onChange('periodTo', e.target.value)}
              className={errors.periodTo ? 'input-error' : ''}
              min={data.periodFrom || undefined}
            />
            {errors.periodTo && <span className="error-msg">{errors.periodTo}</span>}
          </label>
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
