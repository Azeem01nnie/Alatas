import { useState } from 'react'
import { useVehicles } from '../context/VehicleContext'
import VehicleModal from './VehicleModal'

export default function StepVehicle({ selectedId, onSelect, error }) {
  const { vehicles, bookedVehicleIds } = useVehicles()
  const [previewId, setPreviewId] = useState(null)

  const booked = new Set(bookedVehicleIds)
  const available = vehicles.filter(
    (v) => v.status === 'Available' && !booked.has(v.id),
  )
  const preview = available.find((v) => v.id === previewId)

  return (
    <section className="step-panel">
      <h2 className="step-title">Select Vehicle</h2>
      <p className="step-subtitle">
        Only free vehicles are shown. Reserved or rented units are hidden.
      </p>

      <div className="vehicle-grid">
        {available.length === 0 && (
          <p className="empty-state">No available vehicles at the moment.</p>
        )}
        {available.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            className={`vehicle-card${selectedId === vehicle.id ? ' selected' : ''}`}
            onClick={() => setPreviewId(vehicle.id)}
          >
            <span className="vehicle-thumb">
              <img src={vehicle.image} alt={vehicle.make} loading="lazy" />
            </span>
            <span className="vehicle-make">{vehicle.make}</span>
            <span className="vehicle-meta">{vehicle.series}</span>
            <span className="vehicle-meta">{vehicle.bodyType}</span>
            <span className="vehicle-plate">{vehicle.plateNo}</span>
          </button>
        ))}
      </div>

      {error && <span className="error-msg error-center">{error}</span>}

      {selectedId && !previewId && (
        <p className="selected-hint">
          Selected: {available.find((v) => v.id === selectedId)?.make || vehicles.find((v) => v.id === selectedId)?.make}{' '}
          {available.find((v) => v.id === selectedId)?.plateNo || vehicles.find((v) => v.id === selectedId)?.plateNo}
        </p>
      )}

      {preview && (
        <VehicleModal
          vehicle={preview}
          onClose={() => setPreviewId(null)}
          onProceed={() => {
            onSelect(preview.id)
            setPreviewId(null)
          }}
        />
      )}
    </section>
  )
}
