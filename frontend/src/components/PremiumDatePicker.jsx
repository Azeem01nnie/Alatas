import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseYmd(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

function toYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
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

function formatDisplayDate(value) {
  const d = parseYmd(value)
  if (!d) return 'Select date'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatPreviewDate(value) {
  const d = parseYmd(value)
  if (!d) return 'Choose a date'
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PremiumDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  id,
  title = 'Select date',
}) {
  const min = minDate ? parseYmd(minDate) : null
  const max = maxDate ? parseYmd(maxDate) : null
  const today = startOfDay(new Date())
  const todayKey = toYmd(today)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [cursor, setCursor] = useState(() => {
    const base = parseYmd(value) || min || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const openModal = () => {
    if (disabled) return
    const base = parseYmd(value) || min || new Date()
    setDraft(value || '')
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1))
    setOpen(true)
  }

  const closeModal = () => setOpen(false)

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const selected = parseYmd(draft)

  const confirm = () => {
    if (!draft) return
    onChange(draft)
    closeModal()
  }

  return (
    <div className={`premium-picker${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
      <button
        type="button"
        id={id}
        className={`premium-picker-trigger${error ? ' input-error' : ''}${value ? ' has-value' : ''}`}
        onClick={openModal}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="premium-picker-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
          </svg>
        </span>
        <span className="premium-picker-text">{formatDisplayDate(value)}</span>
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            className="picker-modal-overlay"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeModal()
            }}
          >
            <div
              className="picker-modal picker-modal-date"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <header className="picker-modal-header">
                <div>
                  <p className="picker-modal-eyebrow">Date</p>
                  <h3 className="picker-modal-title">{title}</h3>
                </div>
                <button
                  type="button"
                  className="picker-modal-close"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>

              <div className="picker-modal-preview">{formatPreviewDate(draft)}</div>

              <div className="premium-date-nav">
                <button
                  type="button"
                  className="premium-date-nav-btn"
                  onClick={() => setCursor(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className="premium-date-month">{monthLabel}</p>
                <button
                  type="button"
                  className="premium-date-nav-btn"
                  onClick={() => setCursor(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="premium-date-weekdays">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="premium-date-grid">
                {cells.map((day, idx) => {
                  if (!day) return <span key={`e-${idx}`} className="premium-date-empty" />
                  const key = toYmd(day)
                  const dayStart = startOfDay(day).getTime()
                  const disabledDay =
                    (min && dayStart < startOfDay(min).getTime()) ||
                    (max && dayStart > startOfDay(max).getTime())
                  const isSelected = selected && toYmd(selected) === key
                  const isToday = key === todayKey
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`premium-date-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                      disabled={disabledDay}
                      onClick={() => setDraft(key)}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>

              <footer className="picker-modal-footer picker-modal-footer-end">
                <div className="picker-modal-actions">
                  <button type="button" className="picker-modal-ghost" onClick={closeModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary picker-modal-confirm"
                    disabled={!draft}
                    onClick={confirm}
                  >
                    Confirm
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
