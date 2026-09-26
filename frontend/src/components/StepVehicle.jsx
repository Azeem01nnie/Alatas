import { useEffect, useMemo, useState } from 'react'
import { BODY_TYPES } from '../data/vehicles'
import { useVehicles } from '../context/VehicleContext'
import { ARCHIVE_EVENT, getArchivedIdSet } from '../utils/archivedVehicles'
import { getDisplayStatus } from '../utils/vehicleDisplayStatus'
import { resolveVehicleDisplayImage } from '../utils/vehicleImages'
import VehicleModal from './VehicleModal'

export default function StepVehicle({ selectedId, onSelect, error }) {
  const { vehicles, bookedVehicleIds, rentals } = useVehicles()
  const [previewId, setPreviewId] = useState(null)
  const [archiveTick, setArchiveTick] = useState(0)
  const [bodyTypeFilter, setBodyTypeFilter] = useState('all')

  useEffect(() => {
    const onArchive = () => setArchiveTick((t) => t + 1)
    window.addEventListener(ARCHIVE_EVENT, onArchive)
    return () => window.removeEventListener(ARCHIVE_EVENT, onArchive)
  }, [])

  const available = useMemo(() => {
    const booked = new Set(bookedVehicleIds)
    const archived = getArchivedIdSet()
    return vehicles.filter((v) => {
      if (archived.has(String(v.id))) return false
      if (booked.has(v.id)) return false
      if (v.status === 'Under Maintenance') return false
      return getDisplayStatus(v, rentals) === 'Available'
    })
  }, [vehicles, bookedVehicleIds, rentals, archiveTick])

  const typeOptions = useMemo(() => {
    const present = new Set(
      available.map((v) => String(v.bodyType || 'Other').trim()).filter(Boolean),
    )
    const ordered = [...BODY_TYPES, 'Other'].filter((t) => present.has(t))
    for (const t of present) {
      if (!ordered.includes(t)) ordered.push(t)
    }
    return ordered
  }, [available])

  useEffect(() => {
    if (bodyTypeFilter === 'all') return
    if (!typeOptions.includes(bodyTypeFilter)) setBodyTypeFilter('all')
  }, [bodyTypeFilter, typeOptions])

  const filtered = useMemo(() => {
    if (bodyTypeFilter === 'all') return available
    return available.filter(
      (v) => String(v.bodyType || 'Other').trim() === bodyTypeFilter,
    )
  }, [available, bodyTypeFilter])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach((v) => {
      const key = v.bodyType || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    })
    const order = [...BODY_TYPES, 'Other']
    return order
      .filter((key) => groups[key]?.length)
      .map((key) => ({ bodyType: key, items: groups[key] }))
      .concat(
        Object.keys(groups)
          .filter((key) => !order.includes(key))
          .map((key) => ({ bodyType: key, items: groups[key] })),
      )
  }, [filtered])

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

      <label className="field step-vehicle-type-filter">
        <span className="field-label">Vehicle type</span>
        <select
          value={bodyTypeFilter}
          disabled={available.length === 0}
          onChange={(e) => setBodyTypeFilter(e.target.value)}
        >
          <option value="all">All types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {available.length === 0 && (
        <p className="empty-state">No available vehicles at the moment.</p>
      )}

      {available.length > 0 && filtered.length === 0 && (
        <p className="empty-state">No available vehicles for this type.</p>
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
            <div className="vehicle-grid vehicle-grid--list">
              {group.items.map((vehicle) => {
                const isSelected = selectedId === vehicle.id
                const thumb = resolveVehicleDisplayImage(vehicle)
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    className={`vehicle-card vehicle-card--list${isSelected ? ' selected' : ''}${
                      hasSelection && !isSelected ? ' is-faded' : ''
                    }`}
                    onClick={() => setPreviewId(vehicle.id)}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {isSelected && <span className="vehicle-selected-badge">Selected</span>}
                    <span className="vehicle-thumb">
                      <img src={thumb} alt="" loading="lazy" />
                    </span>
                    <span className="vehicle-card-copy">
                      <span className="vehicle-make">{vehicle.make}</span>
                      <span className="vehicle-meta">{vehicle.series}</span>
                      <span className="vehicle-meta vehicle-meta--specs">
                        {vehicle.seats} seats · {vehicle.transmission}
                      </span>
                      <span className="vehicle-plate">{vehicle.plateNo}</span>
                    </span>
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
          vehicle={{
            ...preview,
            image: resolveVehicleDisplayImage(preview),
          }}
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
            requestAnimationFrame(() => {
              document
                .getElementById('rental-details-anchor')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
          }}
        />
      )}
    </section>
  )
}
