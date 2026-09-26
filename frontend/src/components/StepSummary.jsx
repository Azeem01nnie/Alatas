import { formatEmergencyContact } from '../utils/phone'
import { CAR_PHOTO_SLOTS } from './StepCarCondition'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function formatPeriod(rental, which = 'from') {
  if (which === 'from') {
    return (
      rental?.periodFromLabel ||
      [
        rental?.fromDate,
        rental?.fromTime ||
          (rental?.fromHour != null && rental?.fromMinute != null
            ? `${rental.fromHour}:${String(rental.fromMinute).padStart(2, '0')}`
            : ''),
        rental?.fromMeridiem,
      ]
        .filter(Boolean)
        .join(' ') ||
      formatDateTime(rental?.periodFrom)
    )
  }
  return (
    rental?.periodToLabel ||
    [
      rental?.toDate,
      rental?.toTime ||
        (rental?.toHour != null && rental?.toMinute != null
          ? `${rental.toHour}:${String(rental.toMinute).padStart(2, '0')}`
          : ''),
      rental?.toMeridiem,
    ]
      .filter(Boolean)
      .join(' ') ||
    formatDateTime(rental?.periodTo)
  )
}

export default function StepSummary({
  personal,
  vehicle,
  rental,
  photo,
  licensePhoto,
  optionalPhoto,
  signature,
  carPhotos = {},
  termsAccepted,
}) {
  const fullName = [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')

  const durationLabel = rental.duration === 'Others' ? rental.durationOther : rental.duration
  const photosReady = Boolean(photo) && Boolean(licensePhoto)
  const carSidesReady = CAR_PHOTO_SLOTS.every((slot) => Boolean(carPhotos?.[slot.key]))

  return (
    <section className="step-panel">
      <h2 className="step-title">Summary</h2>
      <p className="step-subtitle">Review all details before submitting.</p>

      <div className="summary-shell">
        <section className="summary-hero">
          <div className="summary-hero-copy">
            <span className="summary-kicker">Final Review</span>
            <h3 className="summary-hero-title">{fullName || 'Customer details'}</h3>
            <p className="summary-hero-subtitle">
              {vehicle ? `${vehicle.make} ${vehicle.series}` : 'Vehicle pending'} ·{' '}
              {durationLabel || 'Duration pending'} · {rental.rentalFee || 'Fee pending'}
            </p>
          </div>

          <div className="summary-status-strip">
            <div className="summary-status-pill">
              <span className="summary-status-label">Terms</span>
              <strong>{termsAccepted ? 'Accepted' : 'Pending'}</strong>
            </div>
            <div className="summary-status-pill">
              <span className="summary-status-label">Signature</span>
              <strong>{signature ? 'Signed' : 'Missing'}</strong>
            </div>
            <div className="summary-status-pill">
              <span className="summary-status-label">Photos</span>
              <strong>
                {photosReady ? (optionalPhoto ? 'Ready + optional' : 'Ready') : 'Incomplete'}
              </strong>
            </div>
            <div className="summary-status-pill">
              <span className="summary-status-label">Car photos</span>
              <strong>
                {(() => {
                  const sides = CAR_PHOTO_SLOTS.filter((slot) => Boolean(carPhotos?.[slot.key])).length
                  const extras = Array.isArray(carPhotos?.extras) ? carPhotos.extras.length : 0
                  const total = sides + extras
                  if (!total) return 'Optional · none yet'
                  if (carSidesReady) return `4 sides${extras ? ` · ${extras} extra` : ''}`
                  return `${total} attached`
                })()}
              </strong>
            </div>
          </div>
        </section>

        <div className="summary-main">
          <section className="summary-details">
            <article className="summary-section">
              <div className="summary-section-head">
                <span className="summary-section-index">01</span>
                <div>
                  <h3>Customer</h3>
                  <p>Lessee and emergency contact information</p>
                </div>
              </div>
              <dl className="summary-list">
                <div>
                  <dt>Full name</dt>
                  <dd>{fullName || '—'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{personal.address || '—'}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{personal.contactNo || '—'}</dd>
                </div>
                <div>
                  <dt>Emergency</dt>
                  <dd>{formatEmergencyContact(personal) || '—'}</dd>
                </div>
                <div>
                  <dt>Signature</dt>
                  <dd>
                    {signature ? (
                      <>
                        <span className="summary-signed-status">Signed</span>
                        <div className="summary-signature-frame">
                          <img src={signature} alt="Customer signature" className="summary-signature" />
                        </div>
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="summary-section">
              <div className="summary-section-head">
                <span className="summary-section-index">02</span>
                <div>
                  <h3>Rental</h3>
                  <p>Schedule, duration, and rate confirmation</p>
                </div>
              </div>
              <dl className="summary-list">
                <div>
                  <dt>Duration</dt>
                  <dd>{durationLabel || '—'}</dd>
                </div>
                <div>
                  <dt>Rental type</dt>
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
                {rental.coverage === 'outside_city' && rental.outsideCityFee ? (
                  <div>
                    <dt>Outside-city fee</dt>
                    <dd>{rental.outsideCityFee}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>From</dt>
                  <dd>{formatPeriod(rental, 'from')}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>{formatPeriod(rental, 'to')}</dd>
                </div>
                <div className="summary-fee-row">
                  <dt>City package</dt>
                  <dd>{rental.rentalFee || '—'}</dd>
                </div>
                {rental.discountAmount ? (
                  <div className="summary-fee-row">
                    <dt>Discount</dt>
                    <dd>−{rental.discountAmount}</dd>
                  </div>
                ) : null}
                {rental.rentalType === 'With-driver' ||
                (rental.coverage === 'outside_city' && rental.outsideCityFee) ||
                rental.discountAmount ||
                rental.totalAmount ? (
                  <div className="summary-fee-row">
                    <dt>Total</dt>
                    <dd>{rental.totalAmount || rental.rentalFee || '—'}</dd>
                  </div>
                ) : null}
                {rental.amountPaid != null && rental.amountPaid !== '' ? (
                  <div>
                    <dt>Amount received</dt>
                    <dd>{rental.amountPaid}</dd>
                  </div>
                ) : null}
                {rental.balanceDue != null && rental.balanceDue !== '' ? (
                  <div className="summary-fee-row">
                    <dt>Balance due</dt>
                    <dd>{rental.balanceDue}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          </section>

          <aside className="summary-side">
            <article className="summary-media-panel">
              <div className="summary-media-block">
                <div className="summary-media-head">
                  <h3>Vehicle</h3>
                  {vehicle?.plateNo ? <span>{vehicle.plateNo}</span> : null}
                </div>
                {vehicle ? (
                  <>
                    {vehicle.image ? (
                      <img src={vehicle.image} alt={vehicle.make} className="summary-vehicle-img" />
                    ) : (
                      <div className="summary-vehicle-img summary-vehicle-img--empty" aria-hidden />
                    )}
                    <div className="summary-vehicle-copy">
                      <strong>
                        {vehicle.make} — {vehicle.series}
                      </strong>
                      <span>{vehicle.bodyType}</span>
                      <span>Engine: {vehicle.engineNo}</span>
                      <span>Chassis: {vehicle.chassisNo}</span>
                    </div>
                  </>
                ) : (
                  <p className="summary-empty">No vehicle selected.</p>
                )}
              </div>

              <div className="summary-media-grid summary-media-grid-2">
                <div className="summary-media-card">
                  <div className="summary-media-head">
                    <h3>Holding license</h3>
                  </div>
                  {photo ? (
                    <img src={photo} alt="Customer holding license" className="summary-photo" />
                  ) : (
                    <p className="summary-empty">No photo on file.</p>
                  )}
                </div>
                <div className="summary-media-card">
                  <div className="summary-media-head">
                    <h3>Customer photo</h3>
                  </div>
                  {licensePhoto ? (
                    <img src={licensePhoto} alt="Customer" className="summary-photo" />
                  ) : (
                    <p className="summary-empty">No customer photo.</p>
                  )}
                </div>
                {optionalPhoto ? (
                  <div className="summary-media-card">
                    <div className="summary-media-head">
                      <h3>Optional photo</h3>
                    </div>
                    <img src={optionalPhoto} alt="Optional customer" className="summary-photo" />
                  </div>
                ) : null}
              </div>

              <div className="summary-media-block summary-car-condition">
                <div className="summary-media-head">
                  <h3>Pre-rental car photos</h3>
                  <p className="summary-empty">
                    {carSidesReady
                      ? 'All 4 sides are attached.'
                      : 'Optional — you can add these later from the rental transaction.'}
                  </p>
                </div>
                {CAR_PHOTO_SLOTS.some((slot) => Boolean(carPhotos?.[slot.key])) ||
                (Array.isArray(carPhotos?.extras) && carPhotos.extras.length) ? (
                  <div className="summary-media-grid summary-media-grid-4">
                    {CAR_PHOTO_SLOTS.map((slot) => (
                      <div key={slot.key} className="summary-media-card">
                        <div className="summary-media-head">
                          <h3>{slot.title}</h3>
                        </div>
                        {carPhotos?.[slot.key] ? (
                          <img
                            src={carPhotos[slot.key]}
                            alt={`Car ${slot.title}`}
                            className="summary-photo"
                          />
                        ) : (
                          <p className="summary-empty">Skipped</p>
                        )}
                      </div>
                    ))}
                    {(Array.isArray(carPhotos?.extras) ? carPhotos.extras : []).map((item, index) => (
                      <div key={item.id || `extra-${index}`} className="summary-media-card">
                        <div className="summary-media-head">
                          <h3>{item.label || `Extra ${index + 1}`}</h3>
                        </div>
                        {item.uri ? (
                          <img
                            src={item.uri}
                            alt={item.label || `Extra ${index + 1}`}
                            className="summary-photo"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="summary-empty">No car photos attached yet.</p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </div>
    </section>
  )
}
