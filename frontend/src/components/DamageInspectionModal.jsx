import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadDamageReportPdf } from '../utils/damageReportPdf'
import { compressImageDataUrl } from '../utils/storage'

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
  {
    value: 'undetermined',
    label:
      'Repair cost has not yet been determined and the vehicle will be submitted for proper inspection/quotation.',
  },
  { value: 'estimate', label: 'Estimated repair cost' },
  { value: 'final', label: 'Final quotation/assessment attached.' },
]

const SETTLEMENT_OPTIONS = [
  { value: 'for_assessment', label: 'For assessment — amount to be determined' },
  {
    value: 'agrees_final',
    label: 'Renter agrees to pay based on final repair quotation/actual cost',
  },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial payment' },
  { value: 'other', label: 'Other arrangement' },
]

const ACKNOWLEDGMENT_COPY = `I, the undersigned RENTER/LESSEE, acknowledge that I was present during, or was informed of, the return inspection and that the damage/condition described in this document was observed and documented upon return of the vehicle.

My signature below confirms receipt and acknowledgment of this inspection report and the stated condition of the vehicle. Any determination of responsibility and the amount chargeable shall be governed by the Vehicle Rental Agreement and supported, where applicable, by inspection findings, photographs/videos, quotations, receipts, or other relevant records.`

const SETTLEMENT_DISCLAIMER = `Payment or settlement under this document does not cover additional concealed or mechanical damage that could not reasonably have been discovered during the initial return inspection and is subsequently determined to be related to the rental period, subject to the Vehicle Rental Agreement and applicable law.`

const ASSESSMENT_DISCLAIMER = `If the amount stated above is only an estimate, it is not the final amount. The final amount shall be based on the actual inspection, repair quotation, replacement parts, labor, towing, and other reasonable expenses arising from the damage, subject to the Vehicle Rental Agreement.`

const DAMAGE_INTRO = `Upon return of the above-described vehicle to ALATAS CAR RENTAL SERVICES, the vehicle was physically inspected and the following damage, loss, or abnormal condition was observed:`

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
    witnessDate: todayInputValue(),
    witnessTime: '',
    witnessMeridiem: 'PM',
    witnessDateTime: '',
    attachments: [],
    attachmentOther: '',
    mediaFiles: [],
  }
}

function composeWitnessDateTime(form) {
  const date = String(form?.witnessDate || '').trim()
  const time = String(form?.witnessTime || '').trim()
  const mer = String(form?.witnessMeridiem || '').trim()
  if (!date && !time) return String(form?.witnessDateTime || '').trim()
  if (date && time) return `${date} ${time} ${mer}`.trim()
  if (date) return date
  return `${time} ${mer}`.trim()
}

function parseWitnessDateTime(raw = '') {
  const s = String(raw || '').trim()
  if (!s) {
    return { witnessDate: todayInputValue(), witnessTime: '', witnessMeridiem: 'PM' }
  }
  // Prefer ISO / yyyy-mm-dd
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2})\s*(AM|PM)?)?/i)
  if (iso) {
    return {
      witnessDate: iso[1],
      witnessTime: iso[2] || '',
      witnessMeridiem: (iso[3] || 'PM').toUpperCase(),
    }
  }
  return { witnessDate: todayInputValue(), witnessTime: '', witnessMeridiem: 'PM', witnessDateTime: s }
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
  readOnly = false,
  initialInspection = null,
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
  const [mediaBusy, setMediaBusy] = useState(false)
  const mediaInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const base = emptyForm(seed)
    if (initialInspection && typeof initialInspection === 'object') {
      const parsedWitness = parseWitnessDateTime(initialInspection.witnessDateTime)
      setForm({
        ...base,
        ...initialInspection,
        damageTypes: Array.isArray(initialInspection.damageTypes)
          ? initialInspection.damageTypes
          : [],
        attachments: Array.isArray(initialInspection.attachments)
          ? initialInspection.attachments
          : [],
        mediaFiles: Array.isArray(initialInspection.mediaFiles)
          ? initialInspection.mediaFiles
          : [],
        witnessDate: initialInspection.witnessDate || parsedWitness.witnessDate,
        witnessTime: initialInspection.witnessTime || parsedWitness.witnessTime,
        witnessMeridiem: initialInspection.witnessMeridiem || parsedWitness.witnessMeridiem,
      })
    } else {
      setForm(base)
    }
    setErrors({})
    setSubmitting(false)
  }, [open, seed, initialInspection])

  if (!open) return null

  function setField(key, value, { upper = true } = {}) {
    if (readOnly) return
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
    if (readOnly) return
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
    if (readOnly || !validate() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        ...form,
        witnessDateTime: composeWitnessDateTime(form),
        condition: 'damaged',
        submittedAt: new Date().toISOString(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPdf() {
    try {
      await downloadDamageReportPdf(
        {
          ...form,
          witnessDateTime: composeWitnessDateTime(form),
        },
        {
          plateNo: form.plateNo || seed.plateNo,
          makeModel: form.makeModel || seed.makeModel,
          rentalId: rental?.id || form.rentalAgreementRef,
        },
      )
    } catch (err) {
      console.error(err)
      window.alert(err?.message || 'Could not generate PDF.')
    }
  }

  async function handleMediaFiles(e) {
    if (readOnly) return
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setMediaBusy(true)
    try {
      const nextItems = []
      for (const file of files) {
        const isImage = String(file.type || '').startsWith('image/')
        const isVideo = String(file.type || '').startsWith('video/')
        if (!isImage && !isVideo) continue
        // Skip very large videos in the form (keep under ~12MB for local save)
        if (isVideo && file.size > 12 * 1024 * 1024) {
          console.warn('Video too large to embed; skipped', file.name)
          continue
        }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Could not read file'))
          reader.readAsDataURL(file)
        })
        let stored = dataUrl
        if (isImage) {
          stored = (await compressImageDataUrl(dataUrl, 1280, 0.8)) || dataUrl
        }
        nextItems.push({
          id: `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name || (isImage ? 'photo.jpg' : 'video.mp4'),
          kind: isImage ? 'image' : 'video',
          mime: file.type || '',
          dataUrl: stored,
        })
      }
      if (nextItems.length) {
        setForm((prev) => ({
          ...prev,
          mediaFiles: [...(Array.isArray(prev.mediaFiles) ? prev.mediaFiles : []), ...nextItems],
          photosTaken: prev.photosTaken || 'YES',
          photosCount: String(
            (Array.isArray(prev.mediaFiles) ? prev.mediaFiles.length : 0) + nextItems.length,
          ),
        }))
      }
    } catch (err) {
      console.warn('Damage media upload failed', err)
    } finally {
      setMediaBusy(false)
      if (e.target) e.target.value = ''
    }
  }

  function removeMedia(id) {
    if (readOnly) return
    setForm((prev) => {
      const mediaFiles = (prev.mediaFiles || []).filter((m) => m.id !== id)
      return {
        ...prev,
        mediaFiles,
        photosCount: mediaFiles.length ? String(mediaFiles.length) : prev.photosCount,
      }
    })
  }

  return (
    <div className="modal-overlay damage-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className={`modal-panel damage-modal${readOnly ? ' damage-modal--view' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="damage-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="damage-modal-header">
          <div>
            <p className="damage-modal-eyebrow">ALATAS Car Rental Services</p>
            <h3 id="damage-modal-title" className="modal-title">
              Vehicle Return Damage Inspection &amp; Acknowledgment
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </header>

        <form className="damage-modal-form" onSubmit={handleSubmit}>
          <div className="damage-modal-scroll">
            <fieldset className="damage-modal-fieldset" disabled={readOnly}>
              <section className="damage-section">
                <h4>Form details</h4>
                <div className="form-grid">
                  <Field label="Date">
                    <input
                      type="date"
                      value={form.inspectionDate}
                      onChange={(e) => setField('inspectionDate', e.target.value, { upper: false })}
                    />
                  </Field>
                  <Field label="Related Rental Agreement Date/No.">
                    <input
                      type="text"
                      value={form.rentalAgreementRef}
                      onChange={(e) => setField('rentalAgreementRef', e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="damage-section">
                <h4>Renter / Lessee Information</h4>
                <div className="form-grid">
                  <Field label="Full Name *">
                    <input
                      type="text"
                      value={form.renterName}
                      onChange={(e) => setField('renterName', e.target.value)}
                      className={errors.renterName ? 'input-error' : ''}
                    />
                    {errors.renterName ? (
                      <span className="error-msg">{errors.renterName}</span>
                    ) : null}
                  </Field>
                  <Field label="Contact No.">
                    <input
                      type="text"
                      value={form.renterContact}
                      onChange={(e) => setField('renterContact', e.target.value)}
                    />
                  </Field>
                  <Field label="Address" full>
                    <input
                      type="text"
                      value={form.renterAddress}
                      onChange={(e) => setField('renterAddress', e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="damage-section">
                <h4>Vehicle Information</h4>
                <div className="form-grid">
                  <Field label="Make/Model">
                    <input
                      type="text"
                      value={form.makeModel}
                      onChange={(e) => setField('makeModel', e.target.value)}
                    />
                  </Field>
                  <Field label="Plate No. *">
                    <input
                      type="text"
                      value={form.plateNo}
                      onChange={(e) => setField('plateNo', e.target.value)}
                      className={errors.plateNo ? 'input-error' : ''}
                    />
                    {errors.plateNo ? <span className="error-msg">{errors.plateNo}</span> : null}
                  </Field>
                  <Field label="Engine No.">
                    <input
                      type="text"
                      value={form.engineNo}
                      onChange={(e) => setField('engineNo', e.target.value)}
                    />
                  </Field>
                  <Field label="Chassis No.">
                    <input
                      type="text"
                      value={form.chassisNo}
                      onChange={(e) => setField('chassisNo', e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="damage-section">
                <h4>Return Details</h4>
                <div className="form-grid">
                  <Field label="Date Returned *">
                    <input
                      type="date"
                      value={form.dateReturned}
                      onChange={(e) => setField('dateReturned', e.target.value, { upper: false })}
                      className={errors.dateReturned ? 'input-error' : ''}
                    />
                    {errors.dateReturned ? (
                      <span className="error-msg">{errors.dateReturned}</span>
                    ) : null}
                  </Field>
                  <Field label="Time Returned">
                    <div className="damage-time-row">
                      <input
                        type="text"
                        value={form.timeReturned}
                        onChange={(e) =>
                          setField('timeReturned', e.target.value, { upper: false })
                        }
                        placeholder="e.g. 3:30"
                      />
                      <select
                        value={form.timeMeridiem}
                        onChange={(e) =>
                          setField('timeMeridiem', e.target.value, { upper: false })
                        }
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </Field>
                  <Field label="Odometer Reading">
                    <input
                      type="text"
                      value={form.odometer}
                      onChange={(e) => setField('odometer', e.target.value)}
                    />
                  </Field>
                  <Field label="Fuel Level">
                    <input
                      type="text"
                      value={form.fuelLevel}
                      onChange={(e) => setField('fuelLevel', e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="damage-section">
                <h4>Damage / Condition Found Upon Return</h4>
                <p className="damage-section-copy">{DAMAGE_INTRO}</p>
                <div className="form-grid">
                  <Field label="Location/Part *" full>
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
                  <Field label="Description of Damage *" full>
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
                  <Field label="Additional Damage / Missing Item / Other Issue" full>
                    <textarea
                      rows={2}
                      value={form.additionalDamage}
                      onChange={(e) => setField('additionalDamage', e.target.value)}
                    />
                  </Field>
                </div>
                <p className="damage-subsection-label">Damage Type</p>
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
                    {errors.damageOther ? (
                      <span className="error-msg">{errors.damageOther}</span>
                    ) : null}
                  </Field>
                ) : null}
                <Field label="Photos/Videos Taken *">
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
                  {errors.photosTaken ? (
                    <span className="error-msg">{errors.photosTaken}</span>
                  ) : null}
                </Field>
                {form.photosTaken === 'YES' ? (
                  <Field label="Number of Photos/Videos">
                    <input
                      type="text"
                      value={form.photosCount}
                      onChange={(e) => setField('photosCount', e.target.value, { upper: false })}
                    />
                  </Field>
                ) : null}
              </section>

              <section className="damage-section">
                <h4>Damage Assessment</h4>
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
                      onChange={(e) => setField('estimatedCost', e.target.value, { upper: false })}
                      className={errors.estimatedCost ? 'input-error' : ''}
                    />
                    {errors.estimatedCost ? (
                      <span className="error-msg">{errors.estimatedCost}</span>
                    ) : null}
                  </Field>
                ) : null}
                <p className="damage-section-copy">{ASSESSMENT_DISCLAIMER}</p>
              </section>

              <section className="damage-section">
                <h4>Renter&apos;s Acknowledgment</h4>
                <p className="damage-section-copy damage-ack-copy">{ACKNOWLEDGMENT_COPY}</p>
              </section>

              <section className="damage-section">
                <h4>Payment / Settlement Status</h4>
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
                    <Field label="Paid ₱">
                      <input
                        type="text"
                        value={form.paidAmount}
                        onChange={(e) => setField('paidAmount', e.target.value, { upper: false })}
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
                    <Field label="Partial payment ₱">
                      <input
                        type="text"
                        value={form.partialAmount}
                        onChange={(e) =>
                          setField('partialAmount', e.target.value, { upper: false })
                        }
                      />
                    </Field>
                    <Field label="Balance ₱">
                      <input
                        type="text"
                        value={form.balanceAmount}
                        onChange={(e) =>
                          setField('balanceAmount', e.target.value, { upper: false })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                {form.settlement === 'other' ? (
                  <Field label="Other arrangement" full>
                    <textarea
                      rows={2}
                      value={form.otherArrangement}
                      onChange={(e) => setField('otherArrangement', e.target.value)}
                    />
                  </Field>
                ) : null}
                <p className="damage-section-copy">{SETTLEMENT_DISCLAIMER}</p>
              </section>

              <section className="damage-section">
                <h4>Lessee / Renter</h4>
                <div className="form-grid">
                  <Field label="License No.">
                    <input
                      type="text"
                      value={form.renterLicenseNo}
                      onChange={(e) => setField('renterLicenseNo', e.target.value)}
                    />
                  </Field>
                  <Field label="License Valid Until">
                    <input
                      type="date"
                      value={form.renterLicenseValidUntil}
                      onChange={(e) =>
                        setField('renterLicenseValidUntil', e.target.value, { upper: false })
                      }
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      value={form.renterSignDate}
                      onChange={(e) => setField('renterSignDate', e.target.value, { upper: false })}
                    />
                  </Field>
                </div>
                <p className="damage-section-copy">Signature over printed name (on paper copy / PDF).</p>
              </section>

              <section className="damage-section">
                <h4>Lessor / Authorized Representative</h4>
                <div className="form-grid">
                  <Field label="Printed Name">
                    <input
                      type="text"
                      value={form.lessorName}
                      onChange={(e) => setField('lessorName', e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="damage-section">
                <h4>Witness</h4>
                <div className="form-grid">
                  <Field label="Printed Name">
                    <input
                      type="text"
                      value={form.witnessName}
                      onChange={(e) => setField('witnessName', e.target.value)}
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      value={form.witnessDate || ''}
                      onChange={(e) => setField('witnessDate', e.target.value, { upper: false })}
                    />
                  </Field>
                  <Field label="Time">
                    <div className="damage-time-row">
                      <input
                        type="text"
                        value={form.witnessTime || ''}
                        onChange={(e) =>
                          setField('witnessTime', e.target.value, { upper: false })
                        }
                        placeholder="e.g. 3:30"
                      />
                      <select
                        value={form.witnessMeridiem || 'PM'}
                        onChange={(e) =>
                          setField('witnessMeridiem', e.target.value, { upper: false })
                        }
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
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

                <div className="damage-media-block">
                  <p className="damage-section-copy">
                    Upload photos or short videos of the damage. Images are included in the PDF;
                    videos are listed by filename.
                  </p>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    onChange={handleMediaFiles}
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      className="btn-outline entry-file-btn"
                      disabled={mediaBusy}
                      onClick={() => mediaInputRef.current?.click()}
                    >
                      {mediaBusy ? 'Uploading…' : 'Attach photo / video'}
                    </button>
                  ) : null}
                  <div className="damage-media-grid">
                    {(form.mediaFiles || []).map((m) => (
                      <div key={m.id} className="damage-media-card">
                        {m.kind === 'image' ? (
                          <img src={m.dataUrl} alt={m.name} />
                        ) : (
                          <video src={m.dataUrl} controls preload="metadata" />
                        )}
                        <div className="damage-media-meta">
                          <span title={m.name}>{m.name}</span>
                          {!readOnly ? (
                            <button type="button" className="btn-ghost" onClick={() => removeMedia(m.id)}>
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </fieldset>
          </div>

          <div className="modal-actions damage-modal-actions">
            {readOnly ? (
              <>
                <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
                  Close
                </button>
                <button type="button" className="btn-primary" onClick={handleDownloadPdf}>
                  Download PDF
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Submit & complete rental'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
