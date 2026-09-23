import { useEffect, useRef, useState } from 'react'
import { CONTRACT_TERMS, LIABILITY_CLAUSE, getContractClauseNumber } from '../data/contract'
import { formatEmergencyContact } from '../utils/phone'
import { compressImageDataUrl } from '../utils/storage'
import { collectPhotographerCredits, formatTakenByLabel, mergePhotographerCredits } from '../utils/photoCredits'
import { downloadRentalAgreementPdf } from '../utils/rentalAgreementPdf'
import ConfirmModal from './ConfirmModal'

const CAR_SLOTS = [
  { key: 'front', label: 'Front' },
  { key: 'rear', label: 'Rear' },
  { key: 'left', label: 'Left side' },
  { key: 'right', label: 'Right side' },
]

function normalizeCarPhotos(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { extras: [] }
  return {
    ...value,
    extras: Array.isArray(value.extras) ? value.extras : [],
  }
}

async function readAndCompress(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return compressImageDataUrl(dataUrl, 720, 0.72)
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function fullName(personal = {}) {
  return [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')
}

async function downloadContractPdf(transaction) {
  await downloadRentalAgreementPdf(transaction)
}

export default function TransactionPage({
  transaction,
  onBack,
  backLabel = '← Back to History',
  canEditCarPhotos = false,
  addedByName = '',
  onSaveCarPhotos,
}) {
  const {
    personal = {},
    vehicle = {},
    rental = {},
    photo,
    licensePhoto,
    signature,
  } = transaction

  const [carPhotos, setCarPhotos] = useState(() => normalizeCarPhotos(transaction.carPhotos))
  const [photoBusy, setPhotoBusy] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [photoDirty, setPhotoDirty] = useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [customerPhotosOpen, setCustomerPhotosOpen] = useState(true)
  const [carPhotosOpen, setCarPhotosOpen] = useState(true)
  const slotInputRefs = useRef({})
  const extraInputRef = useRef(null)

  useEffect(() => {
    setCarPhotos(normalizeCarPhotos(transaction.carPhotos))
    setPhotoDirty(false)
    setSaveConfirmOpen(false)
    setPhotoSuccess('')
    setPhotoError('')
    // Only re-sync when opening a different rental — not on every parent object refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => {
      if (mq.matches) {
        setCustomerPhotosOpen(false)
        setCarPhotosOpen(false)
      } else {
        setCustomerPhotosOpen(true)
        setCarPhotosOpen(true)
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const optionalPhoto = personal?.optionalPhoto || ''
  const sessionPhotographer =
    String(addedByName || '').trim() ||
    String(transaction.encodedBy || '').trim() ||
    'Staff'
  const photographer = collectPhotographerCredits(
    carPhotos,
    transaction.carPhotosAddedBy || sessionPhotographer,
  )
  const takenByLabel = formatTakenByLabel(photographer)
  const customerPhotoCount =
    (photo ? 1 : 0) + (licensePhoto ? 1 : 0) + (optionalPhoto ? 1 : 0) + (vehicle.image ? 1 : 0)
  const extraPhotos = Array.isArray(carPhotos?.extras)
    ? carPhotos.extras.filter(
        (item) =>
          item?.uri &&
          (String(item.uri).startsWith('data:image') || /^https?:\/\//i.test(String(item.uri))),
      )
    : []
  const carPhotoCount =
    CAR_SLOTS.filter((slot) => Boolean(carPhotos?.[slot.key])).length + extraPhotos.length

  const applyDraftPhotos = (nextPhotos) => {
    const mergedCredit = mergePhotographerCredits(
      transaction.carPhotosAddedBy,
      carPhotos?._addedBy,
      nextPhotos?._addedBy,
      sessionPhotographer,
      Array.isArray(nextPhotos?.extras) ? nextPhotos.extras.map((item) => item?.addedBy) : [],
    )
    const stamped = {
      ...nextPhotos,
      _addedBy: mergedCredit || sessionPhotographer,
    }
    setCarPhotos(stamped)
    setPhotoDirty(true)
    setPhotoError('')
    setPhotoSuccess('')
  }

  const persistCarPhotos = async () => {
    if (!canEditCarPhotos || typeof onSaveCarPhotos !== 'function') return
    // Saver gets credit — always include the signed-in user who pressed Save.
    const mergedCredit = mergePhotographerCredits(
      transaction.carPhotosAddedBy,
      carPhotos?._addedBy,
      sessionPhotographer,
      Array.isArray(carPhotos?.extras) ? carPhotos.extras.map((item) => item?.addedBy) : [],
    )
    const stamped = {
      ...carPhotos,
      _addedBy: mergedCredit || sessionPhotographer,
    }
    setPhotoBusy('save')
    setPhotoError('')
    setPhotoSuccess('')
    try {
      const saved = await onSaveCarPhotos(transaction.id, stamped, sessionPhotographer)
      const next = normalizeCarPhotos(saved?.carPhotos || stamped)
      if (!next._addedBy && (saved?.carPhotosAddedBy || sessionPhotographer)) {
        next._addedBy = saved?.carPhotosAddedBy || sessionPhotographer
      }
      setCarPhotos(next)
      setPhotoDirty(false)
      setSaveConfirmOpen(false)
      setPhotoSuccess(
        `Photos saved${sessionPhotographer ? ` · Taken by: ${sessionPhotographer}` : ''}. They will stay after refresh.`,
      )
    } catch (err) {
      setPhotoError(err?.message || 'Could not save car photos.')
      setSaveConfirmOpen(false)
    } finally {
      setPhotoBusy('')
    }
  }

  const handleSlotFile = async (slotKey, file, inputEl) => {
    if (!file || !canEditCarPhotos) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file')
      return
    }
    setPhotoBusy(slotKey)
    setPhotoError('')
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setPhotoError('Could not process that image. Try another file.')
        return
      }
      applyDraftPhotos({
        ...carPhotos,
        [slotKey]: compressed,
      })
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setPhotoBusy('')
      if (inputEl) inputEl.value = ''
    }
  }

  const handleExtraFile = async (file, inputEl) => {
    if (!file || !canEditCarPhotos) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file')
      return
    }
    setPhotoBusy('extra')
    setPhotoError('')
    try {
      const compressed = await readAndCompress(file)
      if (!compressed) {
        setPhotoError('Could not process that image. Try another file.')
        return
      }
      const extras = Array.isArray(carPhotos.extras) ? carPhotos.extras : []
      applyDraftPhotos({
        ...carPhotos,
        extras: [
          ...extras,
          {
            id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            uri: compressed,
            label: `Extra ${extras.length + 1}`,
            addedBy: sessionPhotographer || undefined,
          },
        ],
      })
    } catch {
      setPhotoError('Upload failed. Please try again.')
    } finally {
      setPhotoBusy('')
      if (inputEl) inputEl.value = ''
    }
  }

  const removeExtra = (id) => {
    if (!canEditCarPhotos) return
    const extras = (Array.isArray(carPhotos.extras) ? carPhotos.extras : []).filter(
      (item) => item.id !== id,
    )
    applyDraftPhotos({ ...carPhotos, extras })
  }

  const removeSlot = (slotKey) => {
    if (!canEditCarPhotos || !slotKey) return
    applyDraftPhotos({ ...carPhotos, [slotKey]: '' })
  }

  return (
    <section className="transaction-page">
      <div className="transaction-toolbar">
        <button type="button" className="btn-ghost" onClick={onBack}>
          {backLabel}
        </button>
        <div className="transaction-toolbar-actions">
          <span className="transaction-id">Transaction ID: {transaction.id}</span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void downloadContractPdf({ ...transaction, carPhotos })
            }}
          >
            Download Contract PDF
          </button>
        </div>
      </div>

      <header className="transaction-header">
        <h2 className="step-title">Rental Transaction</h2>
        <p className="step-subtitle">
          Encoded {formatDateTime(transaction.encodedAt)} · Contract accepted:{' '}
          {transaction.termsAccepted ? 'Yes' : 'No'}
          {signature ? ' · Signed' : ''}
        </p>
      </header>

      <section className={`transaction-collapse${customerPhotosOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="transaction-collapse-toggle"
          aria-expanded={customerPhotosOpen}
          onClick={() => setCustomerPhotosOpen((v) => !v)}
        >
          <span className="transaction-collapse-copy">
            <strong>Customer & vehicle photos</strong>
            <small>
              {customerPhotoCount
                ? `${customerPhotoCount} photo${customerPhotoCount === 1 ? '' : 's'}`
                : 'No photos yet'}
            </small>
          </span>
          <span className={`transaction-collapse-chevron${customerPhotosOpen ? ' is-open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </button>
        <div className="transaction-collapse-body">
          <div className="transaction-photos">
            <figure className="transaction-photo-card">
              {photo ? (
                <img src={photo} alt="Customer holding license" />
              ) : (
                <div className="transaction-photo-empty">No holding-license photo</div>
              )}
              <figcaption>Holding License</figcaption>
            </figure>
            <figure className="transaction-photo-card">
              {licensePhoto ? (
                <img src={licensePhoto} alt="Customer" />
              ) : (
                <div className="transaction-photo-empty">No customer photo</div>
              )}
              <figcaption>Customer Photo</figcaption>
            </figure>
            {optionalPhoto ? (
              <figure className="transaction-photo-card">
                <img src={optionalPhoto} alt="Optional customer" />
                <figcaption>Optional Photo</figcaption>
              </figure>
            ) : null}
            <figure className="transaction-photo-card">
              {vehicle.image ? (
                <img src={vehicle.image} alt={`${vehicle.make || 'Vehicle'}`} />
              ) : (
                <div className="transaction-photo-empty">No vehicle image</div>
              )}
              <figcaption>Vehicle Photo</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section
        className={`transaction-car-photos-block transaction-collapse${carPhotosOpen ? ' is-open' : ''}`}
      >
        <button
          type="button"
          className="transaction-collapse-toggle"
          aria-expanded={carPhotosOpen}
          onClick={() => setCarPhotosOpen((v) => !v)}
        >
          <span className="transaction-collapse-copy">
            <strong>Pre-rental car photos</strong>
            <small>
              {carPhotoCount
                ? `${carPhotoCount} photo${carPhotoCount === 1 ? '' : 's'}${photographer ? ` · ${takenByLabel}` : ''}`
                : photographer
                  ? `None yet · signed in as ${sessionPhotographer || photographer}`
                  : 'Optional — add photos if needed'}
            </small>
          </span>
          <span className={`transaction-collapse-chevron${carPhotosOpen ? ' is-open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </button>

        <div className="transaction-collapse-body">
          <div className="transaction-car-photos-head">
            <div>
              <h3 className="transaction-car-photos-desktop-title">Pre-rental car photos</h3>
              <p>
                {canEditCarPhotos
                  ? 'Optional — click an empty slot or Add photo to attach as many as you need.'
                  : 'Vehicle condition photos for this rental.'}
              </p>
              {takenByLabel ? (
                <p className="transaction-photo-credit">{takenByLabel}</p>
              ) : null}
            </div>
            {canEditCarPhotos ? (
              <div className="transaction-car-photos-actions">
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handleExtraFile(e.target.files?.[0], e.target)}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={Boolean(photoBusy)}
                  onClick={() => extraInputRef.current?.click()}
                >
                  {photoBusy === 'extra' ? 'Adding…' : 'Add photo'}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={Boolean(photoBusy) || !photoDirty}
                  onClick={() => setSaveConfirmOpen(true)}
                >
                  {photoBusy === 'save' ? 'Saving…' : 'Save photo'}
                </button>
              </div>
            ) : null}
          </div>

          {photoError ? <span className="error-msg">{photoError}</span> : null}
          {photoSuccess ? <span className="success-msg">{photoSuccess}</span> : null}

          <div className="transaction-photos transaction-car-photos">
            {CAR_SLOTS.map((slot) => {
              const preview = carPhotos?.[slot.key]
              const empty = !preview
              return (
                <figure key={slot.key} className="transaction-photo-card">
                  {preview ? (
                    <img src={preview} alt={`Car ${slot.label}`} />
                  ) : canEditCarPhotos ? (
                    <button
                      type="button"
                      className="transaction-photo-add"
                      disabled={Boolean(photoBusy)}
                      onClick={() => slotInputRefs.current[slot.key]?.click()}
                    >
                      <span>{photoBusy === slot.key ? 'Adding…' : 'Click to add'}</span>
                      <small>{slot.label}</small>
                    </button>
                  ) : (
                    <div className="transaction-photo-empty">No {slot.label.toLowerCase()} photo</div>
                  )}
                  <figcaption>{slot.label}</figcaption>
                  {canEditCarPhotos && preview ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm transaction-photo-remove"
                      disabled={Boolean(photoBusy)}
                      onClick={() => removeSlot(slot.key)}
                    >
                      Remove
                    </button>
                  ) : null}
                  {canEditCarPhotos && empty ? (
                    <input
                      ref={(el) => {
                        slotInputRefs.current[slot.key] = el
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => handleSlotFile(slot.key, e.target.files?.[0], e.target)}
                    />
                  ) : null}
                </figure>
              )
            })}
            {extraPhotos.map((item, index) => (
              <figure key={item.id || `extra-${index}`} className="transaction-photo-card">
                <img src={item.uri} alt={item.label || `Extra ${index + 1}`} />
                <figcaption>
                  {item.label || `Extra ${index + 1}`}
                  {item.addedBy ? ` · ${item.addedBy}` : ''}
                </figcaption>
                {canEditCarPhotos ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm transaction-photo-remove"
                    disabled={Boolean(photoBusy)}
                    onClick={() => removeExtra(item.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </figure>
            ))}
            {canEditCarPhotos ? (
              <button
                type="button"
                className="transaction-photo-card transaction-photo-add-card"
                disabled={Boolean(photoBusy)}
                onClick={() => extraInputRef.current?.click()}
              >
                <span className="transaction-photo-add">
                  <span>{photoBusy === 'extra' ? 'Adding…' : '+ Add photo'}</span>
                  <small>Unlimited extras</small>
                </span>
                <figcaption>More photos</figcaption>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="transaction-grid">
        <article className="transaction-card">
          <h3>Lessee / Renter</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Full Name</dt>
              <dd>{fullName(personal)}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{personal.address || '—'}</dd>
            </div>
            <div>
              <dt>Contact No.</dt>
              <dd>{personal.contactNo || '—'}</dd>
            </div>
            <div>
              <dt>Emergency Contact</dt>
              <dd>{formatEmergencyContact(personal)}</dd>
            </div>
            {personal.emergencyName && (
              <>
                <div>
                  <dt>Emergency Name</dt>
                  <dd>{personal.emergencyName}</dd>
                </div>
                <div>
                  <dt>Relationship</dt>
                  <dd>
                    {personal.emergencyRelation === 'Other'
                      ? personal.emergencyRelationOther || 'Other'
                      : personal.emergencyRelation || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Emergency No.</dt>
                  <dd>{personal.emergencyPhone || '—'}</dd>
                </div>
              </>
            )}
          </dl>
        </article>

        <article className="transaction-card">
          <h3>Vehicle</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Make</dt>
              <dd>{vehicle.make || '—'}</dd>
            </div>
            <div>
              <dt>Series</dt>
              <dd>{vehicle.series || '—'}</dd>
            </div>
            <div>
              <dt>Type of Body</dt>
              <dd>{vehicle.bodyType || '—'}</dd>
            </div>
            <div>
              <dt>Plate No.</dt>
              <dd>{vehicle.plateNo || '—'}</dd>
            </div>
            <div>
              <dt>Engine No.</dt>
              <dd>{vehicle.engineNo || '—'}</dd>
            </div>
            <div>
              <dt>Chassis No.</dt>
              <dd>{vehicle.chassisNo || '—'}</dd>
            </div>
          </dl>
        </article>

        <article className="transaction-card">
          <h3>Rental Details</h3>
          <dl className="transaction-dl">
            <div>
              <dt>Duration</dt>
              <dd>{rental.duration || '—'}</dd>
            </div>
            <div>
              <dt>Rental Type</dt>
              <dd>{rental.rentalType || '—'}</dd>
            </div>
            {rental.rentalType === 'With-driver' ? (
              <div>
                <dt>Driver wage</dt>
                <dd>
                  {rental.driverFee || '—'}
                  {rental.driverBillableHours
                    ? ` · ${rental.driverBillableHours} hrs`
                    : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Coverage</dt>
              <dd>
                {rental.coverage === 'outside_city'
                  ? `Outside city${
                      rental.outsideCityDestinationName
                        ? ` · ${rental.outsideCityDestinationName}`
                        : ''
                    }`
                  : 'Within city'}
              </dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{rental.periodFromLabel || formatDateTime(rental.periodFrom)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{rental.periodToLabel || formatDateTime(rental.periodTo)}</dd>
            </div>
            <div>
              <dt>City package</dt>
              <dd>{rental.rentalFee || '—'}</dd>
            </div>
            {rental.coverage === 'outside_city' && rental.outsideCityFee ? (
              <div>
                <dt>Outside-city fee</dt>
                <dd>{rental.outsideCityFee}</dd>
              </div>
            ) : null}
          </dl>
        </article>
      </div>

      <article className="transaction-contract">
        <div className="contract-heading-row">
          <h3>Rental Contract</h3>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => {
              void downloadContractPdf({ ...transaction, carPhotos })
            }}
          >
            Download PDF
          </button>
        </div>
        <p className="contract-intro">
          This agreement was acknowledged by <strong>{fullName(personal)}</strong> for the rental
          of <strong>
            {vehicle.make} {vehicle.series}
          </strong>{' '}
          ({vehicle.plateNo}) covering {rental.periodFromLabel || formatDateTime(rental.periodFrom)} to{' '}
          {rental.periodToLabel || formatDateTime(rental.periodTo)}.
        </p>

        <ol className="contract-terms">
          {CONTRACT_TERMS.map((item, index) => {
            if (item?.type === 'section') {
              return (
                <li key={item.title || index} className="terms-section-heading">
                  <strong>{item.title}</strong>
                </li>
              )
            }
            const num = getContractClauseNumber(CONTRACT_TERMS, index)
            return (
              <li key={item.title || index} value={num}>
                <strong>
                  {num}. {item.title}
                </strong>
                <p className="terms-item-body">{item.body}</p>
              </li>
            )
          })}
        </ol>

        <div className="contract-liability">
          <span className="contract-check">{transaction.termsAccepted ? '✓' : '—'}</span>
          <p>{LIABILITY_CLAUSE}</p>
        </div>

        <div className="contract-signature">
          <div>
            <span className="field-label">Lessee Acknowledgment</span>
            {signature ? (
              <div className="summary-signature-frame">
                <img src={signature} alt="Customer signature" className="summary-signature" />
              </div>
            ) : (
              <p className="signature-line">{fullName(personal)}</p>
            )}
            <small>Electronically accepted on {formatDateTime(transaction.encodedAt)}</small>
          </div>
          <div>
            <span className="field-label">Transaction Reference</span>
            <p className="signature-line">{transaction.id}</p>
            <small>System-generated rental contract record</small>
          </div>
        </div>
      </article>

      {saveConfirmOpen ? (
        <ConfirmModal
          title="Save vehicle photos?"
          message={`This photo is taken by ${sessionPhotographer}. Do you want to save it?`}
          confirmLabel={photoBusy === 'save' ? 'Saving…' : 'Yes, save'}
          cancelLabel="Cancel"
          confirmDisabled={photoBusy === 'save'}
          onCancel={() => {
            if (photoBusy === 'save') return
            setSaveConfirmOpen(false)
          }}
          onConfirm={() => {
            void persistCarPhotos()
          }}
        />
      ) : null}
    </section>
  )
}
