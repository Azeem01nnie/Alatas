import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const MERIDIEMS = ['AM', 'PM']

function pad2(value) {
  return String(value ?? '').padStart(2, '0')
}

function normalizeMinute(value) {
  const n = parseInt(String(value ?? '0'), 10)
  if (Number.isNaN(n)) return '00'
  return String(Math.min(59, Math.max(0, n))).padStart(2, '0')
}

function formatDisplayTime(hour, minute, meridiem) {
  if (!hour || minute === '' || minute == null || !meridiem) return 'Select time'
  return `${hour}:${pad2(minute)} ${meridiem}`
}

function WheelColumn({ label, options, value, onChange }) {
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const active = el.querySelector('[data-active="true"]')
    if (active) {
      active.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [value, options])

  return (
    <div className="premium-time-wheel">
      <span className="premium-time-wheel-label">{label}</span>
      <div className="premium-time-wheel-frame">
        <div className="premium-time-wheel-fade premium-time-wheel-fade-top" aria-hidden="true" />
        <div className="premium-time-wheel-fade premium-time-wheel-fade-bottom" aria-hidden="true" />
        <div className="premium-time-wheel-list" ref={listRef} role="listbox" aria-label={label}>
          {options.map((opt) => {
            const selected = String(value) === String(opt)
            return (
              <button
                key={opt}
                type="button"
                role="option"
                data-active={selected ? 'true' : 'false'}
                aria-selected={selected}
                className={`premium-time-wheel-option${selected ? ' is-selected' : ''}`}
                onClick={() => onChange(opt)}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function PremiumTimePicker({
  hour,
  minute,
  meridiem,
  onChange,
  disabled = false,
  error = false,
  id,
  title = 'Select time',
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    hour: hour || '12',
    minute: normalizeMinute(minute || '0'),
    meridiem: meridiem || 'AM',
  })

  const openModal = () => {
    if (disabled) return
    setDraft({
      hour: hour || '12',
      minute: normalizeMinute(minute === '' || minute == null ? '0' : minute),
      meridiem: meridiem || 'AM',
    })
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

  const confirm = () => {
    onChange({
      hour: draft.hour,
      minute: normalizeMinute(draft.minute),
      meridiem: draft.meridiem,
    })
    closeModal()
  }

  const displayMinute = minute === '' || minute == null ? '' : pad2(minute)

  return (
    <div className={`premium-picker${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
      <button
        type="button"
        id={id}
        className={`premium-picker-trigger${error ? ' input-error' : ''}${hour && meridiem && displayMinute !== '' ? ' has-value' : ''}`}
        onClick={openModal}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="premium-picker-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 8v4.5l2.5 1.5" />
          </svg>
        </span>
        <span className="premium-picker-text">
          {formatDisplayTime(hour, displayMinute, meridiem)}
        </span>
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
              className="picker-modal picker-modal-time"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <header className="picker-modal-header">
                <div>
                  <p className="picker-modal-eyebrow">Time</p>
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

              <div className="picker-time-preview" aria-live="polite">
                <span className="picker-time-digits">
                  {draft.hour}:{normalizeMinute(draft.minute)}
                </span>
                <span className="picker-time-meridiem-tag">{draft.meridiem}</span>
              </div>

              <div className="premium-time-wheels">
                <WheelColumn
                  label="Hour"
                  options={HOURS}
                  value={draft.hour}
                  onChange={(h) => setDraft((d) => ({ ...d, hour: h }))}
                />
                <WheelColumn
                  label="Min"
                  options={MINUTES}
                  value={normalizeMinute(draft.minute)}
                  onChange={(m) => setDraft((d) => ({ ...d, minute: m }))}
                />
                <div className="premium-time-wheel premium-time-ampm">
                  <span className="premium-time-wheel-label">Period</span>
                  <div className="premium-time-ampm-group">
                    {MERIDIEMS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`premium-time-ampm-btn${draft.meridiem === m ? ' is-selected' : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, meridiem: m }))}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="picker-modal-footer picker-modal-footer-end">
                <div className="picker-modal-actions">
                  <button type="button" className="picker-modal-ghost" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary picker-modal-confirm" onClick={confirm}>
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
