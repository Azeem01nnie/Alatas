import { useMemo, useRef, useState } from 'react'
import { useVehicles } from '../context/VehicleContext'
import { VEHICLE_STATUSES } from '../data/vehicles'
import AdminLogin, { clearAdminSession, isAdminLoggedIn } from './AdminLogin'
import ConfirmModal from './ConfirmModal'
import TransactionPage from './TransactionPage'

const EDIT_STATUSES = ['Available', 'Under Maintenance']

const EMPTY = {
  make: '',
  series: '',
  bodyType: '',
  plateNo: '',
  engineNo: '',
  chassisNo: '',
  image: '',
  status: 'Available',
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'add', label: 'Add Vehicle' },
  { id: 'fleet', label: 'Current Vehicles' },
  { id: 'history', label: 'Rental History' },
]

function statusClass(status) {
  if (status === 'Available') return 'status-available'
  if (status === 'Rented') return 'status-rented'
  return 'status-maintenance'
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export default function AdminPanel({ onBack }) {
  const {
    vehicles,
    rentals,
    addVehicle,
    updateVehicle,
    removeVehicle,
    updateVehicleStatus,
    startRental,
    completeRentalForVehicle,
    getScheduledRental,
  } = useVehicles()
  const [authed, setAuthed] = useState(() => isAdminLoggedIn())
  const [tab, setTab] = useState('dashboard')
  const [form, setForm] = useState(EMPTY)
  const [editForm, setEditForm] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [confirm, setConfirm] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const fileRef = useRef(null)
  const editFileRef = useRef(null)

  const counts = useMemo(() => {
    const base = { Available: 0, Rented: 0, 'Under Maintenance': 0 }
    vehicles.forEach((v) => {
      if (base[v.status] !== undefined) base[v.status] += 1
    })
    return base
  }, [vehicles])

  const filteredByStatus = useMemo(() => {
    return vehicles.filter(
      (v) => statusFilter === 'All' || v.status === statusFilter,
    )
  }, [vehicles, statusFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (!q) return true
      const haystack = `${v.make} ${v.series} ${v.plateNo} ${v.bodyType}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [vehicles, search])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return rentals
    return rentals.filter((r) => {
      const name = `${r.personal?.firstName || ''} ${r.personal?.middleName || ''} ${r.personal?.lastName || ''}`
      return name.toLowerCase().includes(q)
    })
  }, [rentals, historySearch])

  const historyWithImages = useMemo(() => {
    return filteredHistory.map((r) => {
      if (r.vehicle?.image) return r
      const fleetMatch = vehicles.find((v) => v.id === r.vehicle?.id)
      if (!fleetMatch?.image) return r
      return {
        ...r,
        vehicle: { ...r.vehicle, image: fleetMatch.image },
      }
    })
  }, [filteredHistory, vehicles])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateEdit = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
    setEditErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const handleImageFile = (e, forEdit = false) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (forEdit) updateEdit('image', reader.result)
      else update('image', reader.result)
    }
    reader.readAsDataURL(file)
  }

  const validateFields = (data) => {
    const next = {}
    ;['make', 'series', 'bodyType', 'plateNo', 'engineNo', 'chassisNo', 'image'].forEach(
      (key) => {
        if (!String(data[key] || '').trim()) next[key] = 'Required'
      },
    )
    return next
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const next = validateFields(form)
    setErrors(next)
    if (Object.keys(next).length) return

    setConfirm({
      type: 'add',
      title: 'Add vehicle?',
      message: `Add ${form.make.trim()} — ${form.series.trim()} (${form.plateNo.trim()}) to the fleet?`,
      confirmLabel: 'Add Vehicle',
    })
  }

  const openEdit = (vehicle) => {
    const status = EDIT_STATUSES.includes(vehicle.status)
      ? vehicle.status
      : 'Available'
    setEditForm({ ...vehicle, status })
    setEditErrors({})
  }

  const requestSaveEdit = () => {
    if (!editForm) return
    const next = validateFields(editForm)
    setEditErrors(next)
    if (Object.keys(next).length) return

    setConfirm({
      type: 'edit',
      title: 'Save vehicle changes?',
      message: `Update information for ${editForm.make} — ${editForm.series}?`,
      confirmLabel: 'Save changes',
    })
  }

  const requestRentCompleted = (vehicle) => {
    setConfirm({
      type: 'complete-rental',
      title: 'Mark rent as completed?',
      message: `Confirm that the rental for ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) is completed? The vehicle will be set back to Available.`,
      confirmLabel: 'Rent Completed',
      vehicleId: vehicle.id,
    })
  }

  const requestStartRental = (vehicle, scheduled) => {
    const startLabel =
      scheduled?.rental?.periodFromLabel ||
      (scheduled?.rental?.periodFrom
        ? new Date(scheduled.rental.periodFrom).toLocaleString()
        : 'the scheduled time')
    setConfirm({
      type: 'start-rental',
      title: 'Start rental now?',
      message: `Manually start the rental for ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo})? Scheduled start: ${startLabel}. Status will change to Rented.`,
      confirmLabel: 'Start Rental',
      rentalId: scheduled.id,
    })
  }

  const requestRemove = (vehicle) => {
    setConfirm({
      type: 'remove',
      title: 'Remove vehicle?',
      message: `Permanently remove ${vehicle.make} — ${vehicle.series} (${vehicle.plateNo}) from the fleet?`,
      confirmLabel: 'Remove',
      danger: true,
      vehicleId: vehicle.id,
    })
  }

  const requestLogout = () => {
    setConfirm({
      type: 'logout',
      title: 'Log out?',
      message: 'You will need to sign in again to access the admin panel.',
      confirmLabel: 'Log out',
      danger: true,
    })
  }

  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.type === 'logout') {
      clearAdminSession()
      setAuthed(false)
    }
    if (confirm.type === 'status') {
      updateVehicleStatus(confirm.vehicleId, confirm.status)
    }
    if (confirm.type === 'start-rental') {
      startRental(confirm.rentalId, false)
    }
    if (confirm.type === 'complete-rental') {
      completeRentalForVehicle(confirm.vehicleId)
    }
    if (confirm.type === 'add') {
      addVehicle({
        make: form.make.trim(),
        series: form.series.trim(),
        bodyType: form.bodyType.trim(),
        plateNo: form.plateNo.trim(),
        engineNo: form.engineNo.trim(),
        chassisNo: form.chassisNo.trim(),
        image: form.image.trim(),
        status: form.status,
      })
      setForm(EMPTY)
      setMessage('Vehicle added successfully.')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setMessage(''), 2500)
      setTab('dashboard')
    }
    if (confirm.type === 'remove') {
      removeVehicle(confirm.vehicleId)
    }
    if (confirm.type === 'edit' && editForm) {
      const nextStatus = EDIT_STATUSES.includes(editForm.status)
        ? editForm.status
        : 'Available'
      updateVehicle(editForm.id, {
        make: editForm.make.trim(),
        series: editForm.series.trim(),
        bodyType: editForm.bodyType.trim(),
        plateNo: editForm.plateNo.trim(),
        engineNo: editForm.engineNo.trim(),
        chassisNo: editForm.chassisNo.trim(),
        image: editForm.image.trim(),
        status: nextStatus,
      })
      setEditForm(null)
      setMessage('Vehicle updated.')
      setTimeout(() => setMessage(''), 2500)
    }
    setConfirm(null)
  }

  if (!authed) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Admin Panel</h1>
          <div className="header-actions">
            <button type="button" className="btn-outline" onClick={onBack}>
              Back to Customer Panel
            </button>
          </div>
        </header>
        <AdminLogin onSuccess={() => setAuthed(true)} />
      </div>
    )
  }

  return (
    <div className="app admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h1>Admin</h1>
          <p>Fleet control</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${tab === item.id ? ' active' : ''}`}
              onClick={() => {
                setTab(item.id)
                if (item.id !== 'history') setSelectedTransaction(null)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="btn-ghost sidebar-btn" onClick={onBack}>
            Back to Customer Panel
          </button>
          <button type="button" className="btn-outline sidebar-btn" onClick={requestLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-content-header">
          <h2>
            {selectedTransaction && tab === 'history'
              ? 'Transaction'
              : NAV.find((n) => n.id === tab)?.label}
          </h2>
          {message && <span className="admin-success">{message}</span>}
        </header>

        <main className="admin-main-panel">
          {tab === 'history' && selectedTransaction ? (
            <TransactionPage
              transaction={selectedTransaction}
              onBack={() => setSelectedTransaction(null)}
            />
          ) : (
            <>
          {tab === 'dashboard' && (
            <section className="admin-dashboard">
              <div className="dashboard-stats">
                <article className="stat-card">
                  <span className="stat-label">Available</span>
                  <strong className="stat-value">{counts.Available}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Rented</span>
                  <strong className="stat-value">{counts.Rented}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Under Maintenance</span>
                  <strong className="stat-value">{counts['Under Maintenance']}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Total Fleet</span>
                  <strong className="stat-value">{vehicles.length}</strong>
                </article>
              </div>

              <div className="dashboard-filters">
                <div className="chip-group status-filter-chips">
                  {['All', ...VEHICLE_STATUSES].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip${statusFilter === s ? ' selected' : ''}`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-vehicle-list dashboard-list">
                {filteredByStatus.length === 0 && (
                  <p className="empty-state">No vehicles match your filter.</p>
                )}
                {filteredByStatus.map((v) => {
                  const scheduled = getScheduledRental(v.id)
                  return (
                  <article key={v.id} className="admin-vehicle-card">
                    <img src={v.image} alt={v.make} className="admin-vehicle-thumb" />
                    <div className="admin-vehicle-meta">
                      <strong>
                        {v.make} — {v.series}
                      </strong>
                      <span>
                        {v.bodyType} · {v.plateNo}
                      </span>
                      {scheduled && (
                        <span className="scheduled-hint">
                          Scheduled{' '}
                          {scheduled.rental?.periodFromLabel ||
                            new Date(scheduled.rental?.periodFrom).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span
                      className={`status-badge ${
                        scheduled && v.status === 'Available'
                          ? 'status-reserved'
                          : statusClass(v.status)
                      }`}
                    >
                      {scheduled && v.status === 'Available' ? 'Reserved' : v.status}
                    </span>
                    <div className="admin-vehicle-card-actions">
                      {scheduled && v.status !== 'Rented' ? (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => requestStartRental(v, scheduled)}
                        >
                          Start Rental
                        </button>
                      ) : null}
                      {v.status === 'Rented' ? (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => requestRentCompleted(v)}
                        >
                          Rent Completed
                        </button>
                      ) : null}
                    </div>
                  </article>
                  )
                })}
              </div>
            </section>
          )}

          {tab === 'add' && (
            <section className="admin-form-section">
              <form className="form-grid" onSubmit={handleSubmit}>
                <VehicleFields
                  data={form}
                  errors={errors}
                  onChange={update}
                  fileRef={fileRef}
                  onFile={(e) => handleImageFile(e, false)}
                  statusOptions={EDIT_STATUSES}
                />
                <div className="field field-full admin-form-actions">
                  <button type="submit" className="btn-primary">
                    Add Vehicle
                  </button>
                </div>
              </form>
            </section>
          )}

          {tab === 'fleet' && (
            <section className="admin-list-section">
              <label className="field search-field">
                <span className="field-label">Search</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type vehicle name..."
                />
              </label>

              <div className="admin-vehicle-list" style={{ marginTop: '1.25rem' }}>
                {filtered.length === 0 && <p className="empty-state">No vehicles found.</p>}
                {filtered.map((v) => (
                  <article key={v.id} className="admin-vehicle-row">
                    <img src={v.image} alt={v.make} className="admin-vehicle-thumb" />
                    <div className="admin-vehicle-meta">
                      <strong>
                        {v.make} — {v.series}
                      </strong>
                      <span>
                        {v.bodyType} · {v.plateNo}
                      </span>
                    </div>
                    <span className={`status-badge ${statusClass(v.status)}`}>{v.status}</span>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => openEdit(v)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-danger btn-sm"
                      onClick={() => requestRemove(v)}
                    >
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === 'history' && (
            <section className="admin-history-section">
              <label className="field search-field">
                <span className="field-label">Search history</span>
                <input
                  type="search"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Customer name..."
                />
              </label>

              <div className="history-list" style={{ marginTop: '1.25rem' }}>
                {historyWithImages.length === 0 && (
                  <p className="empty-state">No rental history yet.</p>
                )}
                {historyWithImages.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="history-row history-row-btn"
                    onClick={() => {
                      const fleetMatch = vehicles.find((v) => v.id === r.vehicle?.id)
                      setSelectedTransaction({
                        ...r,
                        vehicle: {
                          ...r.vehicle,
                          image: r.vehicle?.image || fleetMatch?.image || '',
                        },
                      })
                    }}
                  >
                    <div className="history-main">
                      <strong>
                        {r.personal?.firstName} {r.personal?.middleName} {r.personal?.lastName}
                      </strong>
                      <span>
                        {r.vehicle?.make} {r.vehicle?.series} · {r.vehicle?.plateNo}
                      </span>
                    </div>
                    <div className="history-meta">
                      <span>{r.rental?.rentalType}</span>
                      <span>{r.rental?.duration}</span>
                      <span>{r.rental?.rentalFee}</span>
                      <span>
                        {r.rental?.periodFromLabel || formatDateTime(r.rental?.periodFrom)} →{' '}
                        {r.rental?.periodToLabel || formatDateTime(r.rental?.periodTo)}
                      </span>
                      <span className="history-encoded">
                        Encoded {formatDateTime(r.encodedAt)}
                      </span>
                    </div>
                    <span className="history-open-hint">View transaction →</span>
                  </button>
                ))}
              </div>
            </section>
          )}
            </>
          )}
        </main>
      </div>

      {editForm && (
        <div className="modal-overlay" role="presentation" onClick={() => setEditForm(null)}>
          <div
            className="modal-panel edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditForm(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="modal-title">Edit Vehicle</h3>
            <div className="form-grid">
              <VehicleFields
                data={editForm}
                errors={editErrors}
                onChange={updateEdit}
                fileRef={editFileRef}
                onFile={(e) => handleImageFile(e, true)}
                statusOptions={EDIT_STATUSES}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setEditForm(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={requestSaveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}

function VehicleFields({
  data,
  errors,
  onChange,
  fileRef,
  onFile,
  statusOptions = VEHICLE_STATUSES,
}) {
  return (
    <>
      <label className="field">
        <span className="field-label">Make *</span>
        <input
          type="text"
          value={data.make}
          onChange={(e) => onChange('make', e.target.value)}
          className={errors.make ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Series *</span>
        <input
          type="text"
          value={data.series}
          onChange={(e) => onChange('series', e.target.value)}
          className={errors.series ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Type of Body *</span>
        <input
          type="text"
          value={data.bodyType}
          onChange={(e) => onChange('bodyType', e.target.value)}
          className={errors.bodyType ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Plate No. *</span>
        <input
          type="text"
          value={data.plateNo}
          onChange={(e) => onChange('plateNo', e.target.value)}
          className={errors.plateNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Engine No. *</span>
        <input
          type="text"
          value={data.engineNo}
          onChange={(e) => onChange('engineNo', e.target.value)}
          className={errors.engineNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Chassis No. *</span>
        <input
          type="text"
          value={data.chassisNo}
          onChange={(e) => onChange('chassisNo', e.target.value)}
          className={errors.chassisNo ? 'input-error' : ''}
        />
      </label>
      <label className="field">
        <span className="field-label">Status</span>
        <select
          className="status-select full"
          value={statusOptions.includes(data.status) ? data.status : statusOptions[0]}
          onChange={(e) => onChange('status', e.target.value)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="field field-full">
        <span className="field-label">Image URL *</span>
        <input
          type="text"
          value={data.image?.startsWith('data:') ? '' : data.image}
          onChange={(e) => onChange('image', e.target.value)}
          placeholder="https://..."
          className={errors.image ? 'input-error' : ''}
        />
      </label>
      <div className="field field-full">
        <span className="field-label">Or upload image</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="file-input"
        />
        {data.image && (
          <div className="admin-image-preview">
            <img src={data.image} alt="Preview" />
          </div>
        )}
        {errors.image && <span className="error-msg">{errors.image}</span>}
      </div>
    </>
  )
}
