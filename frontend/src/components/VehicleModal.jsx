import { useEffect, useMemo, useState } from 'react'
import { formatPeso } from '../data/vehicles'
import { getInsuranceImages, getVehicleGallery } from '../utils/vehicleImages'

function Detail({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function VehicleModal({
  vehicle,
  onClose,
  onProceed,
  confirmLabel = 'Proceed',
  cancelLabel = 'Cancel',
  eyebrow = 'Selected vehicle',
  large = false,
}) {
  const rates = vehicle.rates || {}
  const gallery = useMemo(() => getVehicleGallery(vehicle), [vehicle])
  const insurance = useMemo(() => getInsuranceImages(vehicle), [vehicle])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [insuranceIndex, setInsuranceIndex] = useState(0)

  useEffect(() => {
    setPhotoIndex(0)
    setInsuranceIndex(0)
  }, [vehicle?.id])

  useEffect(() => {
    if (photoIndex >= gallery.length) setPhotoIndex(0)
  }, [gallery.length, photoIndex])

  useEffect(() => {
    if (insuranceIndex >= insurance.length) setInsuranceIndex(0)
  }, [insurance.length, insuranceIndex])

  const currentPhoto = gallery[photoIndex] || vehicle.image || ''
  const currentInsurance = insurance[insuranceIndex] || ''

  return (
    <div className="modal-overlay vehicle-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`modal-panel vehicle-modal${large ? ' vehicle-modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="vehicle-modal-header">
          <div className="vehicle-modal-header-text">
            <p className="vehicle-modal-eyebrow">{eyebrow}</p>
            <h3 id="vehicle-modal-title" className="modal-title">
              {vehicle.make} — {vehicle.series}
            </h3>
          </div>
          <button
            type="button"
            className="modal-close vehicle-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="vehicle-modal-scroll">
          <div className="modal-image-wrap vehicle-gallery-wrap">
            {currentPhoto ? (
              <img src={currentPhoto} alt={`${vehicle.make} ${vehicle.series}`} />
            ) : (
              <div className="vehicle-gallery-empty">No photo</div>
            )}
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  className="vehicle-gallery-nav vehicle-gallery-prev"
                  aria-label="Previous photo"
                  onClick={() =>
                    setPhotoIndex((i) => (i - 1 + gallery.length) % gallery.length)
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="vehicle-gallery-nav vehicle-gallery-next"
                  aria-label="Next photo"
                  onClick={() => setPhotoIndex((i) => (i + 1) % gallery.length)}
                >
                  ›
                </button>
                <span className="vehicle-gallery-count">
                  {photoIndex + 1} / {gallery.length}
                </span>
              </>
            ) : null}
          </div>

          <div className="vehicle-modal-body">
            <dl className="modal-details">
              <Detail label="Brand" value={vehicle.make} />
              <Detail label="Series" value={vehicle.series} />
              <Detail label="Type of Body" value={vehicle.bodyType} />
              <Detail label="Seats" value={vehicle.seats || '—'} />
              <Detail label="Transmission" value={vehicle.transmission || '—'} />
              <Detail label="Plate No." value={vehicle.plateNo} />
            </dl>

            <div className="vehicle-rate-block">
              <p className="vehicle-rate-heading">City drive rates</p>
              <dl className="modal-details vehicle-rate-grid">
                <Detail label="5 hours" value={formatPeso(rates.hrs5)} />
                <Detail label="12 hours" value={formatPeso(rates.hrs12)} />
                <Detail label="24 hours" value={formatPeso(rates.hrs24)} />
                <Detail label="Exceeding / hr" value={formatPeso(rates.exceedHour)} />
              </dl>
            </div>

            {insurance.length ? (
              <div className="vehicle-insurance-block">
                <p className="vehicle-rate-heading">Insurance</p>
                <div className="vehicle-insurance-wrap">
                  <img
                    src={currentInsurance}
                    alt={`Insurance document ${insuranceIndex + 1}`}
                  />
                  {insurance.length > 1 ? (
                    <div className="vehicle-insurance-nav">
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() =>
                          setInsuranceIndex(
                            (i) => (i - 1 + insurance.length) % insurance.length,
                          )
                        }
                      >
                        ‹
                      </button>
                      <span>
                        {insuranceIndex + 1} / {insurance.length}
                      </span>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() =>
                          setInsuranceIndex((i) => (i + 1) % insurance.length)
                        }
                      >
                        ›
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="modal-actions vehicle-modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary" onClick={onProceed}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
