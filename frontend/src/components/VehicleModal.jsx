export default function VehicleModal({ vehicle, onClose, onProceed }) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cancel">
          ×
        </button>

        <div className="modal-image-wrap">
          <img src={vehicle.image} alt={`${vehicle.make} ${vehicle.series}`} />
        </div>

        <h3 id="vehicle-modal-title" className="modal-title">
          {vehicle.make} — {vehicle.series}
        </h3>

        <dl className="modal-details">
          <div className="detail-row">
            <dt>Make</dt>
            <dd>{vehicle.make}</dd>
          </div>
          <div className="detail-row">
            <dt>Engine No.</dt>
            <dd>{vehicle.engineNo}</dd>
          </div>
          <div className="detail-row">
            <dt>Type of Body</dt>
            <dd>{vehicle.bodyType}</dd>
          </div>
          <div className="detail-row">
            <dt>Plate No.</dt>
            <dd>{vehicle.plateNo}</dd>
          </div>
          <div className="detail-row">
            <dt>Series</dt>
            <dd>{vehicle.series}</dd>
          </div>
          <div className="detail-row">
            <dt>Chassis No.</dt>
            <dd>{vehicle.chassisNo}</dd>
          </div>
        </dl>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onProceed}>
            Proceed
          </button>
        </div>
      </div>
    </div>
  )
}
