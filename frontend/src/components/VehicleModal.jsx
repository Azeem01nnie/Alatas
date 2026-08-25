import { formatPeso } from '../data/vehicles'

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
          <div className="modal-image-wrap">
            <img src={vehicle.image} alt={`${vehicle.make} ${vehicle.series}`} />
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

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {cancelLabel}
              </button>
              <button type="button" className="btn-primary" onClick={onProceed}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
