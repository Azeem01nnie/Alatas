import { useEffect, useMemo, useRef, useState } from 'react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameLocalDay(a, b) {
  return localDateKey(a) === localDateKey(b)
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function overlapsDay(rental, day) {
  const from = parseDate(rental.rental?.periodFrom)
  const to = parseDate(rental.rental?.periodTo) || from
  if (!from) return false
  const dayStart = startOfDay(day).getTime()
  const dayEnd = dayStart + 86400000 - 1
  const fromT = from.getTime()
  const toT = (to || from).getTime()
  return fromT <= dayEnd && toT >= dayStart
}

function customerName(r) {
  const name = `${r.personal?.firstName || ''} ${r.personal?.lastName || ''}`.trim()
  return name || 'Customer'
}

function lifecycleClass(lifecycle) {
  if (lifecycle === 'scheduled') return 'cal-chip-scheduled'
  if (lifecycle === 'active') return 'cal-chip-active'
  return 'cal-chip-completed'
}

function lifecycleLabel(lifecycle) {
  if (lifecycle === 'scheduled') return 'Scheduled'
  if (lifecycle === 'active') return 'On Rent'
  return 'Completed'
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function IconChevron({ open }) {
  return (
    <svg
      className={`cal-dd-chevron${open ? ' is-open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function RentalCalendar({ rentals, vehicles, onOpenRental }) {
  const today = startOfDay(new Date())
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [showCompleted, setShowCompleted] = useState(false)
  const [vehicleFilter, setVehicleFilter] = useState('All')
  const [selectedDay, setSelectedDay] = useState(null)
  const [fleetOpen, setFleetOpen] = useState(false)
  const fleetRef = useRef(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])

  const fleetGrouped = useMemo(() => {
    const groups = new Map()
    ;[...vehicles]
      .sort((a, b) => {
        const byType = (a.bodyType || '').localeCompare(b.bodyType || '')
        if (byType) return byType
        return `${a.make} ${a.series}`.localeCompare(`${b.make} ${b.series}`)
      })
      .forEach((v) => {
        const key = v.bodyType || 'Other'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(v)
      })
    return [...groups.entries()]
  }, [vehicles])

  const selectedVehicle = useMemo(
    () => (vehicleFilter === 'All' ? null : vehicles.find((v) => v.id === vehicleFilter)),
    [vehicleFilter, vehicles],
  )

  const triggerLabel = selectedVehicle
    ? `${selectedVehicle.make} ${selectedVehicle.series}`
    : 'All vehicles'

  const visibleRentals = useMemo(() => {
    return rentals.filter((r) => {
      const life = r.rentalLifecycle || 'completed'
      if (!showCompleted && life === 'completed') return false
      if (vehicleFilter !== 'All' && r.vehicle?.id !== vehicleFilter) return false
      return true
    })
  }, [rentals, showCompleted, vehicleFilter])

  const rentalsByDay = useMemo(() => {
    const map = new Map()
    cells.forEach((day) => {
      if (!day) return
      const key = localDateKey(day)
      map.set(
        key,
        visibleRentals.filter((r) => overlapsDay(r, day)),
      )
    })
    return map
  }, [cells, visibleRentals])

  const selectedKey = selectedDay ? localDateKey(startOfDay(selectedDay)) : null
  const dayRentals = selectedKey ? rentalsByDay.get(selectedKey) || [] : []

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (!fleetOpen) return undefined
    const onPointer = (e) => {
      if (!fleetRef.current?.contains(e.target)) setFleetOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setFleetOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [fleetOpen])

  const pickVehicle = (id) => {
    setVehicleFilter(id)
    setFleetOpen(false)
  }

  return (
    <section className="rental-calendar">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M14.5 5.5L8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="cal-month-label">{monthLabel}</h3>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M9.5 5.5L16 12l-6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="cal-filters" role="group" aria-label="Calendar filters">
          <div className="chip-group cal-status-chips">
            <button
              type="button"
              className={`chip${!showCompleted ? ' selected' : ''}`}
              onClick={() => setShowCompleted(false)}
            >
              Active only
            </button>
            <button
              type="button"
              className={`chip${showCompleted ? ' selected' : ''}`}
              onClick={() => setShowCompleted(true)}
            >
              Include completed
            </button>
          </div>

          <div className={`cal-fleet-dd${fleetOpen ? ' is-open' : ''}`} ref={fleetRef}>
            <button
              type="button"
              className="cal-fleet-trigger"
              aria-haspopup="listbox"
              aria-expanded={fleetOpen}
              onClick={() => setFleetOpen((o) => !o)}
            >
              <span className="cal-fleet-prefix">Vehicle</span>
              <span className="cal-fleet-value">
                <span className="cal-fleet-value-text">{triggerLabel}</span>
              </span>
              <IconChevron open={fleetOpen} />
            </button>

            {fleetOpen && (
              <div className="cal-fleet-menu" role="listbox" aria-label="Filter by vehicle">
                <button
                  type="button"
                  role="option"
                  aria-selected={vehicleFilter === 'All'}
                  className={`cal-fleet-option${vehicleFilter === 'All' ? ' is-selected' : ''}`}
                  onClick={() => pickVehicle('All')}
                >
                  <span className="cal-fleet-option-main">
                    <strong>All vehicles</strong>
                    <span>{vehicles.length} in fleet</span>
                  </span>
                </button>

                {fleetGrouped.map(([bodyType, items]) => (
                  <div key={bodyType} className="cal-fleet-group">
                    <p className="cal-fleet-group-title">{bodyType}</p>
                    {items.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="option"
                        aria-selected={vehicleFilter === v.id}
                        className={`cal-fleet-option${vehicleFilter === v.id ? ' is-selected' : ''}`}
                        onClick={() => pickVehicle(v.id)}
                      >
                        <span className="cal-fleet-option-main">
                          <strong>
                            {v.make} {v.series}
                          </strong>
                          <span>{v.plateNo}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedVehicle && (
        <p className="cal-focus-hint">
          Showing schedule for <strong>{selectedVehicle.make} {selectedVehicle.series}</strong>
        </p>
      )}

      <div className="cal-layout">
        <div className="cal-grid" role="grid" aria-label={monthLabel}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-weekday">
              {d}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="cal-cell cal-cell-empty" />
            }
            const key = localDateKey(day)
            const items = rentalsByDay.get(key) || []
            const isToday = isSameLocalDay(day, today)
            const isSelected = selectedKey === key
            return (
              <button
                key={key}
                type="button"
                className={`cal-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedDay(day)}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className="cal-day-num">{day.getDate()}</span>
                <div className="cal-chips">
                  {items.slice(0, 3).map((r) => (
                    <span
                      key={r.id}
                      className={`cal-chip ${lifecycleClass(r.rentalLifecycle)}`}
                      title={`${r.vehicle?.series || ''} · ${lifecycleLabel(r.rentalLifecycle)}`}
                    >
                      {r.vehicle?.series || r.vehicle?.make || 'Rent'}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="cal-chip cal-chip-more">+{items.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <aside className="cal-day-panel">
          <h4 className="cal-day-title">
            {selectedDay
              ? selectedDay.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Select a day'}
          </h4>
          {!selectedDay && (
            <p className="empty-state cal-empty">Pick a date to see rentals.</p>
          )}
          {selectedDay && dayRentals.length === 0 && (
            <p className="empty-state cal-empty">
              {selectedVehicle
                ? 'This vehicle is free on this day.'
                : 'No rentals on this day.'}
            </p>
          )}
          {selectedDay && dayRentals.length > 0 && (
            <ul className="cal-day-list">
              {dayRentals.map((r) => (
                <li key={r.id} className="cal-day-item">
                  <div className="cal-day-item-main">
                    <strong>
                      {r.vehicle?.make} {r.vehicle?.series}
                    </strong>
                    <span>{r.vehicle?.plateNo}</span>
                    <span>{customerName(r)}</span>
                    <span className="cal-day-time">
                      {r.rental?.periodFromLabel ||
                        (r.rental?.periodFrom
                          ? new Date(r.rental.periodFrom).toLocaleString()
                          : '—')}
                      {' → '}
                      {r.rental?.periodToLabel ||
                        (r.rental?.periodTo
                          ? new Date(r.rental.periodTo).toLocaleString()
                          : '—')}
                    </span>
                  </div>
                  <span className={`status-badge ${lifecycleClass(r.rentalLifecycle)}`}>
                    {lifecycleLabel(r.rentalLifecycle)}
                  </span>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => onOpenRental?.(r)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  )
}
