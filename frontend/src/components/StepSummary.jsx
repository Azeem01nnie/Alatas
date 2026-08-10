import { formatEmergencyContact } from '../utils/phone'

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
  termsAccepted,
}) {
  const fullName = [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')

  const durationLabel = rental.duration === 'Others' ? rental.durationOther : rental.duration
  const photosReady = Boolean(photo) && Boolean(licensePhoto)

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
              <span className="summary-status-label">Photos</span>
              <strong>{photosReady ? 'Ready' : 'Incomplete'}</strong>
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
                <div>
                  <dt>From</dt>
                  <dd>{formatPeriod(rental, 'from')}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>{formatPeriod(rental, 'to')}</dd>
                </div>
                <div className="summary-fee-row">
                  <dt>Rental fee</dt>
                  <dd>{rental.rentalFee || '—'}</dd>
                </div>
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
                    <img src={vehicle.image} alt={vehicle.make} className="summary-vehicle-img" />
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
              </div>
            </article>
          </aside>
        </div>
      </div>
    </section>
  )
}
