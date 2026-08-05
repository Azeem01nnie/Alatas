function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export default function StepSummary({ personal, vehicle, rental, photo }) {
  const fullName = [personal.firstName, personal.middleName, personal.lastName]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="step-panel">
      <h2 className="step-title">Summary</h2>
      <p className="step-subtitle">Review all details before submitting.</p>

      <div className="summary-grid">
        <div className="summary-card">
          <h3>Customer</h3>
          <p>
            <strong>{fullName}</strong>
          </p>
          <p>{personal.address}</p>
          <p>Contact: {personal.contactNo}</p>
          <p>Emergency: {personal.emergencyContact}</p>
        </div>

        <div className="summary-card">
          <h3>Vehicle</h3>
          {vehicle && (
            <>
              <img src={vehicle.image} alt={vehicle.make} className="summary-vehicle-img" />
              <p>
                <strong>
                  {vehicle.make} — {vehicle.series}
                </strong>
              </p>
              <p>{vehicle.bodyType}</p>
              <p>Plate: {vehicle.plateNo}</p>
              <p>Engine: {vehicle.engineNo}</p>
              <p>Chassis: {vehicle.chassisNo}</p>
            </>
          )}
        </div>

        <div className="summary-card">
          <h3>Rental</h3>
          <p>
            Duration:{' '}
            {rental.duration === 'Others' ? rental.durationOther : rental.duration}
          </p>
          <p>Type: {rental.rentalType}</p>
          <p>From: {formatDateTime(rental.periodFrom)}</p>
          <p>To: {formatDateTime(rental.periodTo)}</p>
          <p>Fee: {rental.rentalFee}</p>
        </div>

        <div className="summary-card">
          <h3>Photo</h3>
          {photo ? (
            <img src={photo} alt="Customer" className="summary-photo" />
          ) : (
            <p>No photo</p>
          )}
        </div>
      </div>
    </section>
  )
}
