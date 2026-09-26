import { useEffect, useMemo, useState } from 'react'

/** Shared scopes for Download data / Clear data pickers. */
export const DATA_SCOPE_OPTIONS = [
  {
    id: 'vehicles',
    label: 'Vehicles & fleet',
    description: 'Active vehicles and archived vehicles',
  },
  {
    id: 'rentals',
    label: 'Rentals & revenue',
    description: 'Rental history, X&Z readings, and customer profiles from rentals',
  },
  {
    id: 'owners',
    label: 'Owners',
    description: 'Owner list and investor share settings',
  },
  {
    id: 'reports',
    label: 'Reports & desk expenses',
    description: 'Vehicle report ledger and desk expenses',
  },
  {
    id: 'employees',
    label: 'Employees',
    description: 'Staff accounts (admin login is always kept)',
    clearOnly: true,
  },
  {
    id: 'rates',
    label: 'Rates & extras',
    description: 'Outside-city destinations and driver wage',
  },
  {
    id: 'settings',
    label: 'App settings & profile',
    description: 'Theme, notifications, and admin display profile',
  },
]

export const ALL_DOWNLOAD_SCOPE_IDS = DATA_SCOPE_OPTIONS.filter((o) => !o.clearOnly).map(
  (o) => o.id,
)
export const ALL_CLEAR_SCOPE_IDS = DATA_SCOPE_OPTIONS.map((o) => o.id)

export function DataScopeModal({
  mode = 'download',
  busy = false,
  onCancel,
  onConfirm,
}) {
  const options = useMemo(
    () =>
      DATA_SCOPE_OPTIONS.filter((opt) => (mode === 'download' ? !opt.clearOnly : true)),
    [mode],
  )
  const allIds = useMemo(() => options.map((o) => o.id), [options])
  const [selected, setSelected] = useState(() => new Set(allIds))

  useEffect(() => {
    setSelected(new Set(allIds))
  }, [allIds, mode])

  const selectedList = allIds.filter((id) => selected.has(id))
  const allSelected = selectedList.length === allIds.length
  const noneSelected = selectedList.length === 0

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Clearing vehicles without rentals leaves orphan history — keep rentals with vehicles.
      if (mode === 'clear' && id === 'vehicles' && next.has('vehicles')) {
        next.add('rentals')
      }
      if (mode === 'clear' && id === 'rentals' && !next.has('rentals') && next.has('vehicles')) {
        next.delete('vehicles')
      }
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  const isClear = mode === 'clear'
  const title = isClear ? 'Choose what to clear' : 'Choose what to download'
  const copy = isClear
    ? 'Select categories to permanently delete. Admin login is never removed.'
    : 'Select categories to include in the backup JSON file.'
  const confirmLabel = isClear
    ? noneSelected
      ? 'Select at least one'
      : 'Continue to confirm'
    : noneSelected
      ? 'Select at least one'
      : 'Download selected'

  return (
    <div
      className="modal-overlay confirm-modal-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel?.()
      }}
    >
      <div
        className="modal-panel data-scope-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-scope-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="data-scope-modal-head">
          <div>
            <h3 id="data-scope-title" className="modal-title">
              {title}
            </h3>
            <p className="data-scope-modal-copy">{copy}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={() => {
              if (!busy) onCancel?.()
            }}
            aria-label="Close"
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className="data-scope-toolbar">
          <button type="button" className="btn-ghost" onClick={toggleAll} disabled={busy}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span className="data-scope-count">
            {selectedList.length} of {allIds.length} selected
          </span>
        </div>

        <ul className="data-scope-list">
          {options.map((opt) => {
            const checked = selected.has(opt.id)
            return (
              <li key={opt.id}>
                <label className={`data-scope-item${checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggle(opt.id)}
                  />
                  <span className="data-scope-item-text">
                    <strong>{opt.label}</strong>
                    <span>{opt.description}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {isClear && selected.has('vehicles') ? (
          <p className="data-scope-note">
            Clearing vehicles also clears rentals so the fleet history stays consistent.
          </p>
        ) : null}

        <div className="modal-actions data-scope-actions">
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={isClear ? 'btn-primary settings-clear-data-btn' : 'btn-primary'}
            disabled={busy || noneSelected}
            onClick={() => onConfirm?.(selectedList)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataScopeModal
