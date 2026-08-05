export default function StepPersonalInfo({ data, onChange, errors }) {
  const fields = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'middleName', label: 'Middle Name (optional)', required: false },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'address', label: 'Address', required: true, full: true },
    { key: 'contactNo', label: 'Contact No.', required: true },
    { key: 'emergencyContact', label: 'Emergency Contact / No.', required: true, full: true },
  ]

  return (
    <section className="step-panel">
      <h2 className="step-title">Lessee / Renter Information</h2>
      <p className="step-subtitle">Enter the customer&apos;s personal details.</p>

      <div className="form-grid">
        {fields.map(({ key, label, required, full }) => (
          <label key={key} className={`field${full ? ' field-full' : ''}`}>
            <span className="field-label">
              {label}
              {required && <span className="required">*</span>}
            </span>
            <input
              type="text"
              name={key}
              value={data[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className={errors[key] ? 'input-error' : ''}
              autoComplete="off"
            />
            {errors[key] && <span className="error-msg">{errors[key]}</span>}
          </label>
        ))}
      </div>
    </section>
  )
}
