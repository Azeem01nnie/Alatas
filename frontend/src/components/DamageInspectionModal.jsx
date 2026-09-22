import { useEffect, useMemo, useState } from 'react'

const DAMAGE_TYPES = [
  'Scratch',
  'Dent',
  'Cracked/Broken Part',
  'Collision Damage',
  'Tire/Wheel Damage',
  'Glass/Light Damage',
  'Interior Damage',
  'Missing Item/Accessory',
  'Mechanical/Operational Issue',
  'Other',
]

const ASSESSMENT_OPTIONS = [
  { value: 'undetermined', label: 'Repair cost has not yet been determined and the vehicle will be submitted for proper inspection/quotation.' },
  { value: 'estimate', label: 'Estimated repair cost' },
  { value: 'final', label: 'Final quotation/assessment attached.' },
]

const SETTLEMENT_OPTIONS = [
  { value: 'for_assessment', label: 'For assessment — amount to be determined' },
  { value: 'agrees_final', label: 'Renter agrees to pay based on final repair quotation/actual cost' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial payment' },
  { value: 'other', label: 'Other arrangement' },
]

const ATTACHMENT_OPTIONS = [
  'Vehicle return photographs',
  'Video documentation',
  'Repair quotation',
  'Parts/labor estimate',
  'Copy of Rental Agreement',
  'Other',
]

function todayInputValue() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toUpper(value) {
  return String(value ?? '').toUpperCase()
}

function emptyForm(seed = {}) {
  return {
    inspectionDate: seed.inspectionDate || todayInputValue(),
    rentalAgreementRef: seed.rentalAgreementRef || '',
    renterName: seed.renterName || '',
    renterAddress: seed.renterAddress || '',
    renterContact: seed.renterContact || '',
    makeModel: seed.makeModel || '',
    plateNo: seed.plateNo || '',
    engineNo: seed.engineNo || '',
    chassisNo: seed.chassisNo || '',
    dateReturned: seed.dateReturned || todayInputValue(),
    timeReturned: seed.timeReturned || '',
    timeMeridiem: seed.timeMeridiem || 'PM',
    odometer: seed.odometer || '',
    fuelLevel: seed.fuelLevel || '',
    damageLocation: '',
    damageDescription: '',
    additionalDamage: '',
    damageTypes: [],
    damageOther: '',
    photosTaken: '',
    photosCount: '',
    assessment: 'undetermined',
    estimatedCost: '',
    settlement: 'for_assessment',
    paidAmount: '',
    paidDate: '',
    partialAmount: '',
    balanceAmount: '',
    otherArrangement: '',
    renterLicenseNo: '',
    renterLicenseValidUntil: '',
    renterSignDate: todayInputValue(),
    lessorName: seed.lessorName || '',
    witnessName: '',
    witnessDateTime: '',
    attachments: [],
    attachmentOther: '',
  }
}

function Field({ label, children, full }) {
  return (
    <label className={`field${full ? ' field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export default function DamageInspectionModal({
  open,
  vehicle,
  rental,
  adminName = '',
  onCancel,
  onSubmit,
}) {
  const seed = useMemo(() => {
    const personal = rental?.personal || {}
    const name = [personal.firstName, personal.middleName, personal.lastName]
      .filter(Boolean)
      .join(' ')
    return {
      renterName: name,
      renterAddress: personal.address || '',
      renterContact: personal.contactNo || '',
      makeModel: `${vehicle?.make || rental?.vehicle?.make || ''} ${vehicle?.series || rental?.vehicle?.series || ''}`.trim(),
      plateNo: vehicle?.plateNo || rental?.vehicle?.plateNo || '',
      engineNo: vehicle?.engineNo || rental?.vehicle?.engineNo || '',
      chassisNo: vehicle?.chassisNo || rental?.vehicle?.chassisNo || '',
      rentalAgreementRef: rental?.id || '',
      lessorName: adminName || '',
    }
  }, [vehicle, rental, adminName])

  const [form, setForm] = useState(() => emptyForm(seed))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(emptyForm(seed))
      setErrors({})
      setSubmitting(false)
    }
  }, [open, seed])

  if (!open) return null

  function setField(key, value, { upper = true } = {}) {
    const next = upper && typeof value === 'string' ? toUpper(value) : value
    setForm((prev) => ({ ...prev, [key]: next }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  function toggleList(key, value) {
    setForm((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : []
      const has = list.includes(value)
      return {
        ...prev,
        [key]: has ? list.filter((v) => v !== value) : [...list, value],
      }
    })
  }

  function validate() {
    const next = {}
    if (!String(form.renterName || '').trim()) next.renterName = 'Required'
    if (!String(form.plateNo || '').trim()) next.plateNo = 'Required'
    if (!String(form.dateReturned || '').trim()) next.dateReturned = 'Required'
    if (!String(form.damageLocation || '').trim()) next.damageLocation = 'Required'
    if (!String(form.damageDescription || '').trim()) next.damageDescription = 'Required'
    if (!form.damageTypes.length) next.damageTypes = 'Select at least one damage type'
    if (form.damageTypes.includes('Other') && !String(form.damageOther || '').trim()) {
      next.damageOther = 'Specify other damage'
    }
    if (!form.photosTaken) next.photosTaken = 'Select YES or NO'
    if (form.assessment === 'estimate' && !String(form.estimatedCost || '').trim()) {
      next.estimatedCost = 'Enter estimated cost'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        ...form,
        condition: 'damaged',
        submittedAt: new Date().toISOString(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay damage-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel damage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="damage-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="damage-modal-header">
          <div>
            <p className="damage-modal-eyebrow">Vehicle return</p>
            <h3 id="damage-modal-title" className="modal-title">
              Damage inspection &amp; acknowledgment
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </header>

        <form className="damage-modal-form" onSubmit={handleSubmit}>
          <div className="damage-modal-scroll">
            <section className="damage-section">
              <h4>Document</h4>
              <div className="form-grid">
                <Field label="Date">
                  <input
                    type="date"
                    value={form.inspectionDate}
                    onChange={(e) => setField('inspectionDate', e.target.value, { upper: false })}
                  />
                </Field>
                <Field label="Related rental agreement date/no.">
                  <input
                    type="text"
                    value={form.rentalAgreementRef}
                    onChange={(e) => setField('rentalAgreementRef', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Renter / lessee information</h4>
              <div className="form-grid">
                <Field label="Full name *" full>
                  <input
                    type="text"
                    value={form.renterName}
                    onChange={(e) => setField('renterName', e.target.value)}
                    className={errors.renterName ? 'input-error' : ''}
                  />
                  {errors.renterName ? <span className="error-msg">{errors.renterName}</span> : null}
                </Field>
                <Field label="Address" full>
                  <input
                    type="text"
                    value={form.renterAddress}
                    onChange={(e) => setField('renterAddress', e.target.value)}
                  />
                </Field>
                <Field label="Contact no.">
                  <input
                    type="text"
                    value={form.renterContact}
                    onChange={(e) => setField('renterContact', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Vehicle information</h4>
              <div className="form-grid">
                <Field label="Make / model">
                  <input
                    type="text"
                    value={form.makeModel}
                    onChange={(e) => setField('makeModel', e.target.value)}
                  />
                </Field>
                <Field label="Plate no. *">
                  <input
                    type="text"
                    value={form.plateNo}
                    onChange={(e) => setField('plateNo', e.target.value)}
                    className={errors.plateNo ? 'input-error' : ''}
                  />
                  {errors.plateNo ? <span className="error-msg">{errors.plateNo}</span> : null}
                </Field>
                <Field label="Engine no.">
                  <input
                    type="text"
                    value={form.engineNo}
                    onChange={(e) => setField('engineNo', e.target.value)}
                  />
                </Field>
                <Field label="Chassis no.">
                  <input
                    type="text"
                    value={form.chassisNo}
                    onChange={(e) => setField('chassisNo', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Return details</h4>
              <div className="form-grid">
                <Field label="Date returned *">
                  <input
                    type="date"
                    value={form.dateReturned}
                    onChange={(e) => setField('dateReturned', e.target.value, { upper: false })}
                    className={errors.dateReturned ? 'input-error' : ''}
                  />
                  {errors.dateReturned ? <span className="error-msg">{errors.dateReturned}</span> : null}
                </Field>
                <Field label="Time returned">
                  <div className="damage-time-row">
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={form.timeReturned}
                      onChange={(e) => setField('timeReturned', e.target.value)}
                    />
                    <select
                      value={form.timeMeridiem}
                      onChange={(e) => setField('timeMeridiem', e.target.value, { upper: false })}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </Field>
                <Field label="Odometer reading">
                  <input
                    type="text"
                    value={form.odometer}
                    onChange={(e) => setField('odometer', e.target.value)}
                  />
                </Field>
                <Field label="Fuel level">
                  <input
                    type="text"
                    value={form.fuelLevel}
                    onChange={(e) => setField('fuelLevel', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Damage / condition found upon return</h4>
              <p className="damage-section-copy">
                Upon return of the above-described vehicle to ALATAS CAR RENTAL SERVICES, the vehicle
                was physically inspected and the following damage, loss, or abnormal condition was
                observed:
              </p>
              <div className="form-grid">
                <Field label="Location / part *" full>
                  <input
                    type="text"
                    value={form.damageLocation}
                    onChange={(e) => setField('damageLocation', e.target.value)}
                    className={errors.damageLocation ? 'input-error' : ''}
                  />
                  {errors.damageLocation ? (
                    <span className="error-msg">{errors.damageLocation}</span>
                  ) : null}
                </Field>
                <Field label="Description of damage *" full>
                  <textarea
                    rows={3}
                    value={form.damageDescription}
                    onChange={(e) => setField('damageDescription', e.target.value)}
                    className={errors.damageDescription ? 'input-error' : ''}
                  />
                  {errors.damageDescription ? (
                    <span className="error-msg">{errors.damageDescription}</span>
                  ) : null}
                </Field>
                <Field label="Additional damage / missing item / other issue" full>
                  <textarea
                    rows={2}
                    value={form.additionalDamage}
                    onChange={(e) => setField('additionalDamage', e.target.value)}
                  />
                </Field>
              </div>

              <span className="field-label">Damage type *</span>
              <div className="damage-check-grid">
                {DAMAGE_TYPES.map((type) => (
                  <label key={type} className="damage-check">
                    <input
                      type="checkbox"
                      checked={form.damageTypes.includes(type)}
                      onChange={() => toggleList('damageTypes', type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
              {errors.damageTypes ? <span className="error-msg">{errors.damageTypes}</span> : null}
              {form.damageTypes.includes('Other') ? (
                <Field label="Other (specify)">
                  <input
                    type="text"
                    value={form.damageOther}
                    onChange={(e) => setField('damageOther', e.target.value)}
                    className={errors.damageOther ? 'input-error' : ''}
                  />
                  {errors.damageOther ? <span className="error-msg">{errors.damageOther}</span> : null}
                </Field>
              ) : null}

              <div className="form-grid" style={{ marginTop: '0.85rem' }}>
                <Field label="Photos / videos taken *">
                  <div className="damage-radio-row">
                    {['YES', 'NO'].map((opt) => (
                      <label key={opt} className="damage-check">
                        <input
                          type="radio"
                          name="photosTaken"
                          checked={form.photosTaken === opt}
                          onChange={() => setField('photosTaken', opt, { upper: false })}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.photosTaken ? <span className="error-msg">{errors.photosTaken}</span> : null}
                </Field>
                <Field label="Number of photos / videos">
                  <input
                    type="text"
                    value={form.photosCount}
                    onChange={(e) => setField('photosCount', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Damage assessment</h4>
              <div className="damage-radio-stack">
                {ASSESSMENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="damage-check">
                    <input
                      type="radio"
                      name="assessment"
                      checked={form.assessment === opt.value}
                      onChange={() => setField('assessment', opt.value, { upper: false })}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {form.assessment === 'estimate' ? (
                <Field label="Estimated repair cost (₱)">
                  <input
                    type="text"
                    value={form.estimatedCost}
                    onChange={(e) => setField('estimatedCost', e.target.value.replace(/[^\d.]/g, ''), { upper: false })}
                    className={errors.estimatedCost ? 'input-error' : ''}
                  />
                  {errors.estimatedCost ? (
                    <span className="error-msg">{errors.estimatedCost}</span>
                  ) : null}
                </Field>
              ) : null}
              <p className="damage-section-copy">
                If the amount stated above is only an estimate, it is not the final amount. The final
                amount shall be based on the actual inspection, repair quotation, replacement parts,
                labor, towing, and other reasonable expenses arising from the damage, subject to the
                Vehicle Rental Agreement.
              </p>
            </section>

            <section className="damage-section">
              <h4>Renter&apos;s acknowledgment</h4>
              <p className="damage-section-copy">
                I, the undersigned RENTER/LESSEE, acknowledge that I was present during, or was
                informed of, the return inspection and that the damage/condition described in this
                document was observed and documented upon return of the vehicle. Any determination of
                responsibility and the amount chargeable shall be governed by the Vehicle Rental
                Agreement.
              </p>
              <div className="form-grid">
                <Field label="License no.">
                  <input
                    type="text"
                    value={form.renterLicenseNo}
                    onChange={(e) => setField('renterLicenseNo', e.target.value)}
                  />
                </Field>
                <Field label="License valid until">
                  <input
                    type="date"
                    value={form.renterLicenseValidUntil}
                    onChange={(e) =>
                      setField('renterLicenseValidUntil', e.target.value, { upper: false })
                    }
                  />
                </Field>
                <Field label="Acknowledgment date">
                  <input
                    type="date"
                    value={form.renterSignDate}
                    onChange={(e) => setField('renterSignDate', e.target.value, { upper: false })}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Payment / settlement status</h4>
              <div className="damage-radio-stack">
                {SETTLEMENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="damage-check">
                    <input
                      type="radio"
                      name="settlement"
                      checked={form.settlement === opt.value}
                      onChange={() => setField('settlement', opt.value, { upper: false })}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {form.settlement === 'paid' ? (
                <div className="form-grid">
                  <Field label="Paid amount (₱)">
                    <input
                      type="text"
                      value={form.paidAmount}
                      onChange={(e) =>
                        setField('paidAmount', e.target.value.replace(/[^\d.]/g, ''), {
                          upper: false,
                        })
                      }
                    />
                  </Field>
                  <Field label="Paid on">
                    <input
                      type="date"
                      value={form.paidDate}
                      onChange={(e) => setField('paidDate', e.target.value, { upper: false })}
                    />
                  </Field>
                </div>
              ) : null}
              {form.settlement === 'partial' ? (
                <div className="form-grid">
                  <Field label="Partial payment (₱)">
                    <input
                      type="text"
                      value={form.partialAmount}
                      onChange={(e) =>
                        setField('partialAmount', e.target.value.replace(/[^\d.]/g, ''), {
                          upper: false,
                        })
                      }
                    />
                  </Field>
                  <Field label="Balance (₱)">
                    <input
                      type="text"
                      value={form.balanceAmount}
                      onChange={(e) =>
                        setField('balanceAmount', e.target.value.replace(/[^\d.]/g, ''), {
                          upper: false,
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}
              {form.settlement === 'other' ? (
                <Field label="Other arrangement" full>
                  <input
                    type="text"
                    value={form.otherArrangement}
                    onChange={(e) => setField('otherArrangement', e.target.value)}
                  />
                </Field>
              ) : null}
            </section>

            <section className="damage-section">
              <h4>Lessor / witness</h4>
              <div className="form-grid">
                <Field label="Lessor / authorized representative">
                  <input
                    type="text"
                    value={form.lessorName}
                    onChange={(e) => setField('lessorName', e.target.value)}
                  />
                </Field>
                <Field label="Witness printed name">
                  <input
                    type="text"
                    value={form.witnessName}
                    onChange={(e) => setField('witnessName', e.target.value)}
                  />
                </Field>
                <Field label="Witness date / time">
                  <input
                    type="text"
                    value={form.witnessDateTime}
                    onChange={(e) => setField('witnessDateTime', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="damage-section">
              <h4>Attachments</h4>
              <div className="damage-check-grid">
                {ATTACHMENT_OPTIONS.map((item) => (
                  <label key={item} className="damage-check">
                    <input
                      type="checkbox"
                      checked={form.attachments.includes(item)}
                      onChange={() => toggleList('attachments', item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              {form.attachments.includes('Other') ? (
                <Field label="Other attachment">
                  <input
                    type="text"
                    value={form.attachmentOther}
                    onChange={(e) => setField('attachmentOther', e.target.value)}
                  />
                </Field>
              ) : null}
            </section>
          </div>

          <div className="modal-actions damage-modal-actions">
            <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Submit & complete rental'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
