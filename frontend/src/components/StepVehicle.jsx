import { useMemo, useState } from 'react'
import { BODY_TYPES } from '../data/vehicles'
import { useVehicles } from '../context/VehicleContext'
import VehicleModal from './VehicleModal'

export default function StepVehicle({ selectedId, onSelect, error }) {
  const { vehicles, bookedVehicleIds } = useVehicles()
  const [previewId, setPreviewId] = useState(null)

  const available = useMemo(() => {
    const booked = new Set(bookedVehicleIds)
    return vehicles.filter((v) => v.status === 'Available' && !booked.has(v.id))
  }, [vehicles, bookedVehicleIds])

  const grouped = useMemo(() => {
    const groups = {}
    available.forEach((v) => {
      const key = v.bodyType || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    })
    const order = [...BODY_TYPES, 'Other']
    return order
      .filter((key) => groups[key]?.length)
      .map((key) => ({ bodyType: key, items: groups[key] }))
  }, [available])

  const preview = available.find((v) => v.id === previewId)
  const hasSelection = Boolean(selectedId)
  const isChangingSelection = hasSelection && previewId && previewId !== selectedId
  const isReselectingSame = hasSelection && previewId === selectedId

  return (
    <section className="step-panel">
      <h2 className="step-title">Select Vehicle</h2>
      <p className="step-subtitle">
        Only free vehicles are shown. Reserved or rented units are hidden.
      </p>

      {available.length === 0 && (
        <p className="empty-state">No available vehicles at the moment.</p>
      )}

      <div
        className={`vehicle-groups${hasSelection ? ' has-selection' : ''}`}
        onDoubleClick={(e) => {
          if (!selectedId) return
          if (e.target.closest('.vehicle-card')) return
          onSelect('')
          setPreviewId(null)
        }}
      >
        {grouped.map((group) => (
          <section key={group.bodyType} className="vehicle-group">
            <h3 className="vehicle-group-title">
              {group.bodyType}
              <span className="vehicle-group-count">{group.items.length}</span>
            </h3>
            <div className="vehicle-grid">
              {group.items.map((vehicle) => {
                const isSelected = selectedId === vehicle.id
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    className={`vehicle-card${isSelected ? ' selected' : ''}${
                      hasSelection && !isSelected ? ' is-faded' : ''
                    }`}
                    onClick={() => setPreviewId(vehicle.id)}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {isSelected && <span className="vehicle-selected-badge">Selected</span>}
                    <span className="vehicle-thumb">
                      <img src={vehicle.image} alt={vehicle.make} loading="lazy" />
                    </span>
                    <span className="vehicle-make">{vehicle.make}</span>
                    <span className="vehicle-meta">{vehicle.series}</span>
                    <span className="vehicle-meta">
                      {vehicle.seats} seats · {vehicle.transmission}
                    </span>
                    <span className="vehicle-plate">{vehicle.plateNo}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {error && <span className="error-msg error-center">{error}</span>}

      {preview && (
        <VehicleModal
          vehicle={preview}
          confirmLabel={
            isChangingSelection || isReselectingSame ? 'Change' : 'Proceed'
          }
          eyebrow={
            isChangingSelection
              ? 'Change vehicle'
              : isReselectingSame
                ? 'Current selection'
                : 'Selected vehicle'
          }
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
