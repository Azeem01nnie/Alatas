import AddressAutocomplete from './AddressAutocomplete'
import { ensurePhMobilePrefix, formatPhMobile } from '../utils/phone'

export const EMERGENCY_RELATIONS = [
  'Parent',
  'Spouse',
  'Sibling',
  'Child',
  'Friend',
  'Colleague',
  'Other',
]

function PhoneInput({ name, value, onChange, error, autoComplete = 'tel' }) {
  const handleChange = (e) => {
    onChange(formatPhMobile(e.target.value))
  }

  const handleKeyDown = (e) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const digits = String(value || '').replace(/\D/g, '')
        const el = e.currentTarget
        const start = el.selectionStart ?? 0
        const end = el.selectionEnd ?? 0
        const prefixLen = String(value || '').startsWith('+63 ') ? 4 : 3
        if (digits.length <= 2 || (start <= prefixLen && end <= prefixLen && e.key === 'Backspace')) {
          e.preventDefault()
          onChange('+63')
        }
      }
      return
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <>
      <input
        type="text"
        name={name}
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onFocus={() => onChange(ensurePhMobilePrefix(value))}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text')
          onChange(formatPhMobile(text))
        }}
        className={error ? 'input-error' : ''}
        autoComplete={autoComplete}
      />
      {error && <span className="error-msg">{error}</span>}
    </>
  )
}

export default function StepPersonalInfo({ data, onChange, errors }) {
  const nameFields = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'middleName', label: 'Middle Name (optional)', required: false },
    { key: 'lastName', label: 'Last Name', required: true },
  ]

  return (
    <section className="step-panel">
      <h2 className="step-title">Lessee / Renter Information</h2>
      <p className="step-subtitle">Enter the customer&apos;s personal details.</p>

      <div className="form-grid">
        {nameFields.map(({ key, label, required }) => (
          <label key={key} className="field">
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
              autoCapitalize="words"
            />
            {errors[key] && <span className="error-msg">{errors[key]}</span>}
          </label>
        ))}

        <AddressAutocomplete
          value={data.address}
          onChange={(val) => onChange('address', val)}
          error={errors.address}
        />

        <label className="field">
          <span className="field-label">
            Contact No.
            <span className="required">*</span>
          </span>
          <PhoneInput
            name="contactNo"
            value={data.contactNo}
            onChange={(val) => onChange('contactNo', val)}
            error={errors.contactNo}
          />
        </label>

        <div className="field-full emergency-block">
          <p className="emergency-heading">Emergency Contact</p>
          <div
            className={`form-grid emergency-grid${
              data.emergencyRelation === 'Other' ? ' has-other' : ''
            }`}
          >
            <label className="field">
              <span className="field-label">
                Full Name
                <span className="required">*</span>
              </span>
              <input
                type="text"
                name="emergencyName"
                value={data.emergencyName}
                onChange={(e) => onChange('emergencyName', e.target.value)}
                className={errors.emergencyName ? 'input-error' : ''}
                autoComplete="off"
                autoCapitalize="words"
              />
              {errors.emergencyName && (
                <span className="error-msg">{errors.emergencyName}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">
                Relationship
                <span className="required">*</span>
              </span>
              <select
                name="emergencyRelation"
                value={data.emergencyRelation}
                onChange={(e) => {
                  const next = e.target.value
                  onChange('emergencyRelation', next)
                  if (next !== 'Other') onChange('emergencyRelationOther', '')
                }}
                className={errors.emergencyRelation ? 'input-error' : ''}
              >
                <option value="">Select relationship</option>
                {EMERGENCY_RELATIONS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
              {errors.emergencyRelation && (
                <span className="error-msg">{errors.emergencyRelation}</span>
              )}
            </label>

            {data.emergencyRelation === 'Other' && (
              <label className="field emergency-other-field">
                <span className="field-label">
                  Specify
                  <span className="required">*</span>
                </span>
                <input
                  type="text"
                  name="emergencyRelationOther"
                  value={data.emergencyRelationOther}
                  onChange={(e) => onChange('emergencyRelationOther', e.target.value)}
                  className={errors.emergencyRelationOther ? 'input-error' : ''}
                  autoComplete="off"
                  autoCapitalize="words"
                />
                {errors.emergencyRelationOther && (
                  <span className="error-msg">{errors.emergencyRelationOther}</span>
                )}
              </label>
            )}

            <label className="field">
              <span className="field-label">
                Contact No.
                <span className="required">*</span>
              </span>
              <PhoneInput
                name="emergencyPhone"
                value={data.emergencyPhone}
                onChange={(val) => onChange('emergencyPhone', val)}
                error={errors.emergencyPhone}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
