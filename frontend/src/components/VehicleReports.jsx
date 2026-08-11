import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { loadOwners, purgeOrphanOwners } from '../utils/owners'
import {
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  REPORT_TYPES,
  addReportEntry,
  deleteReportEntry,
  filterEntries,
  loadReportStore,
  sumAmounts,
  updateReportEntry,
} from '../utils/vehicleReports'
import PremiumDatePicker from './PremiumDatePicker'

const EMPTY_ENTRY = {
  date: new Date().toISOString().slice(0, 10),
  type: 'Expense',
  category: 'Parts',
  description: '',
  amount: '',
  status: 'Completed',
  attachment: '',
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function formatPeso(n) {
  const num = Number(n) || 0
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

/* Same stroke style as Manage Vehicle icons */
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconDelete() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M19 6v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function IconChevronDown({ open = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        width: '0.85rem',
        height: '0.85rem',
        marginLeft: '0.35rem',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.15s ease',
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────
function EntryModal({ initial = EMPTY_ENTRY, onSave, onClose, title = 'Add Entry' }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim()) { setError('Description is required'); return }
    if (form.type !== 'Issue' && form.amount === '') { setError('Amount is required for expenses and repairs'); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel reports-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reports-entry-modal-header">
          <h3 id="entry-modal-title" className="modal-title" style={{ marginBottom: 0 }}>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="form-grid reports-entry-form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Date</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Type</span>
            <select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Category</span>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {REPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="field field-full">
            <span className="field-label">Description</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What happened / what was done"
            />
          </label>

          <label className="field">
            <span className="field-label">Amount {form.type === 'Issue' ? '(optional)' : ''}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">Attachment</span>
            <label className="entry-file-btn">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => set('attachment', String(reader.result || ''))
                  reader.readAsDataURL(file)
                  set('_attachmentName', file.name)
                }}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="entry-file-label">
                {form._attachmentName || (form.attachment ? 'File attached' : 'Choose file…')}
              </span>
            </label>
            {form.attachment && (
              <button
                type="button"
                className="entry-file-remove"
                onClick={() => { set('attachment', ''); set('_attachmentName', '') }}
              >
                Remove
              </button>
            )}
          </div>

          <div className="field field-full">
            {error && <span className="error-msg" style={{ display: 'block', marginBottom: '0.5rem' }}>{error}</span>}
            <div className="modal-actions">
              <button type="button" className="btn-outline confirm-cancel-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save Entry</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────
function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay confirm-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel confirm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">Delete Entry</h3>
        <p className="confirm-message">
          Are you sure you want to delete this entry? This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" style={{ background: 'linear-gradient(180deg,#b32025,#7a0000)' }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function VehicleReports({ vehicles = [], adminName = 'Admin' }) {
  const [owners, setOwners] = useState(() => loadOwners())
  const [storeVersion, setStoreVersion] = useState(0)
  const store = useMemo(() => loadReportStore(), [storeVersion])

  const [ownerSearch, setOwnerSearch] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [rangePreset, setRangePreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // modals
  const [addModal, setAddModal] = useState(false)
  const [editRow, setEditRow] = useState(null)    // entry object or null
  const [deleteRow, setDeleteRow] = useState(null) // entry object or null

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const downloadMenuRef = useRef(null)

  useEffect(() => {
    const linkedIds = vehicles.map((v) => v.ownerId).filter(Boolean)
    const cleaned = purgeOrphanOwners(linkedIds)
    setOwners(cleaned)
  }, [vehicles])

  useEffect(() => {
    if (!downloadMenuOpen) return
    const onDocClick = (e) => {
      if (!downloadMenuRef.current?.contains(e.target)) setDownloadMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [downloadMenuOpen])

  const ownersFromVehicles = useMemo(() => {
    const map = new Map()
    vehicles.forEach((v) => {
      if (!v.ownerId) return
      if (!map.has(v.ownerId)) {
        const fromStore = owners.find((o) => o.id === v.ownerId)
        map.set(v.ownerId, {
          id: v.ownerId,
          name: fromStore?.name || v.ownerName || 'Unknown owner',
          ownershipType: fromStore?.ownershipType || (v.ownershipType === 'thirdParty' ? 'thirdParty' : 'company'),
          vehicleCount: 0,
        })
      }
      map.get(v.ownerId).vehicleCount += 1
    })
    return Array.from(map.values()).filter((o) => o.vehicleCount > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [owners, vehicles])

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase()
    if (!q) return ownersFromVehicles
    return ownersFromVehicles.filter((o) => {
      if (o.name.toLowerCase().includes(q)) return true
      return vehicles.some((v) => {
        if (v.ownerId !== o.id) return false
        return `${v.make || ''} ${v.series || ''} ${v.plateNo || ''}`.toLowerCase().includes(q)
      })
    })
  }, [ownersFromVehicles, ownerSearch, vehicles])

  const ownerVehicles = useMemo(() => {
    if (!selectedOwnerId) return []
    return vehicles.filter((v) => v.ownerId === selectedOwnerId)
  }, [vehicles, selectedOwnerId])

  const selectedOwner = ownersFromVehicles.find((o) => o.id === selectedOwnerId)
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId)

  const dateBounds = useMemo(() => {
    if (rangePreset === 'all') return { from: null, to: null }
    if (rangePreset === 'custom') {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59.999`) : null,
      }
    }
    return { from: startOfMonth(), to: endOfMonth() }
  }, [rangePreset, customFrom, customTo])

  const entries = useMemo(() => {
    if (!selectedVehicleId) return []
    return filterEntries(store.entries, {
      vehicleId: selectedVehicleId,
      from: dateBounds.from,
      to: dateBounds.to,
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [store.entries, selectedVehicleId, dateBounds])

  const total = sumAmounts(entries)
  const monthKey = (dateBounds.from || new Date()).toISOString().slice(0, 7)

  const refresh = () => setStoreVersion((n) => n + 1)

  const handleAddSave = (form) => {
    addReportEntry({
      ownerId: selectedOwnerId,
      vehicleId: selectedVehicleId,
      date: form.date,
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount: form.amount === '' ? null : Number(form.amount),
      status: form.status,
      attachment: form.attachment || '',
      recordedBy: adminName,
    })
    setAddModal(false)
    refresh()
  }

  const handleEditSave = (form) => {
    updateReportEntry(editRow.id, {
      date: form.date,
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount: form.amount === '' ? null : Number(form.amount),
      status: form.status,
      attachment: form.attachment || editRow.attachment || '',
    })
    setEditRow(null)
    refresh()
  }

  const handleDeleteConfirm = () => {
    deleteReportEntry(deleteRow.id)
    setDeleteRow(null)
    refresh()
  }

  const exportPdf = () => {
    if (!selectedVehicle) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

    const margin = 40

    const addHeader = () => {
      let y = margin

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Vehicle Reports', margin, y + 14)

      y += 30
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Owner: ${selectedOwner?.name || '—'}`, margin, y)
      y += 14
      doc.text(
        `Vehicle: ${selectedVehicle.make} ${selectedVehicle.series} (${selectedVehicle.plateNo})`,
        margin,
        y,
      )
      y += 14
      doc.text(`Period: ${rangePreset === 'all' ? 'All time' : monthKey}`, margin, y)
      y += 14
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
      y += 18

      doc.setFont('helvetica', 'bold')
      doc.text('Date', margin, y)
      doc.text('Type', margin + 70, y)
      doc.text('Category', margin + 130, y)
      doc.text('Description', margin + 220, y)
      doc.text('Amount', margin + 420, y)
      y += 12
      doc.setFont('helvetica', 'normal')

      return y
    }

    let y = addHeader()
    entries.forEach((row) => {
      if (y > 760) {
        doc.addPage()
        y = addHeader()
      }
      doc.text(String(row.date || ''), margin, y)
      doc.text(String(row.type || ''), margin + 70, y)
      doc.text(String(row.category || '').slice(0, 12), margin + 130, y)
      const desc = doc.splitTextToSize(String(row.description || ''), 180)
      doc.text(desc, margin + 220, y)
      doc.text(row.amount == null ? '—' : formatPeso(row.amount), margin + 420, y)
      y += Math.max(14, desc.length * 12)
    })
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${formatPeso(total)}`, margin, y)
    doc.save(`Vehicle_Report_${selectedVehicle.plateNo || selectedVehicle.id}_${monthKey}.pdf`)
  }

  const exportExcel = () => {
    if (!selectedVehicle) return
    const rows = entries.map((row) => ({
      Date: row.date, Type: row.type, Category: row.category,
      Description: row.description, Amount: row.amount ?? '', Status: row.status, 'Recorded by': row.recordedBy,
    }))
    rows.push({ Date: '', Type: '', Category: '', Description: 'TOTAL', Amount: total, Status: '', 'Recorded by': '' })
    const sheet = XLSX.utils.json_to_sheet(rows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Report')
    XLSX.writeFile(book, `Vehicle_Report_${selectedVehicle.plateNo || selectedVehicle.id}_${monthKey}.xlsx`)
  }

  return (
    <section className="vehicle-reports">

      {/* ── Owner list ── */}
      {!selectedOwnerId && (
        <>
          <label className="field search-field reports-search-field">
            <span className="field-label">Search</span>
            <input
              type="search"
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Search owner, plate, or vehicle…"
            />
          </label>

          <div className="reports-owner-grid">
            {filteredOwners.length === 0 && (
              <p className="empty-state">
                {ownerSearch.trim()
                  ? 'No matching owners or vehicles.'
                  : 'No owners yet. Add a vehicle with an owner in Manage Vehicle.'}
              </p>
            )}
            {filteredOwners.map((owner) => {
              const isThird = owner.ownershipType === 'thirdParty'
              return (
                <button
                  key={owner.id}
                  type="button"
                  className="reports-owner-card"
                  onClick={() => { setSelectedOwnerId(owner.id); setSelectedVehicleId('') }}
                >
                  <span className="reports-owner-card-body">
                    <strong className="reports-owner-name">{owner.name}</strong>
                    <span className="reports-owner-meta">
                      <span className={`reports-owner-badge${isThird ? ' is-third' : ' is-company'}`}>
                        {isThird ? 'Third-party' : 'Company'}
                      </span>
                      <span className="reports-owner-count">
                        {owner.vehicleCount} vehicle{owner.vehicleCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Vehicle list ── */}
      {selectedOwnerId && !selectedVehicleId && (
        <div className="reports-level">
          <button type="button" className="btn-ghost reports-back-btn" onClick={() => setSelectedOwnerId('')}>
            ← Back to owners
          </button>
          <div className="reports-level-head">
            <h3 className="reports-level-title">{selectedOwner?.name}</h3>
            <span className="reports-owner-count">
              {ownerVehicles.length} vehicle{ownerVehicles.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="reports-vehicle-grid">
            {ownerVehicles.length === 0 && <p className="empty-state">No vehicles linked to this owner.</p>}
            {ownerVehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                className="reports-vehicle-card"
                onClick={() => setSelectedVehicleId(v.id)}
              >
                <img src={v.image} alt="" />
                <div className="reports-vehicle-copy">
                  <strong>{v.make} {v.series}</strong>
                  <span className="reports-vehicle-plate">{v.plateNo}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Ledger ── */}
      {selectedVehicleId && selectedVehicle && (
        <div className="reports-level">
          <button type="button" className="btn-ghost reports-back-btn" onClick={() => setSelectedVehicleId('')}>
            ← Back to vehicles
          </button>

          <div className="reports-ledger-head">
            <div>
              <h3 className="reports-level-title">
                {selectedVehicle.make} {selectedVehicle.series} · {selectedVehicle.plateNo}
              </h3>
              <p className="step-subtitle">Owner: {selectedOwner?.name}</p>
            </div>
            <div className="reports-ledger-actions">
              {/* Add Entry */}
              <button type="button" className="btn-outline" onClick={() => setAddModal(true)}>
                Add Entry
              </button>

              {/* Downloadables dropdown */}
              <div className="reports-download-wrap" ref={downloadMenuRef}>
                <button
                  type="button"
                  className="btn-outline reports-download-btn"
                  onClick={() => setDownloadMenuOpen((v) => !v)}
                  aria-expanded={downloadMenuOpen}
                >
                  Downloadables
                  <IconChevronDown open={downloadMenuOpen} />
                </button>
                {downloadMenuOpen && (
                  <div className="reports-download-menu" role="menu">
                    <button type="button" className="reports-download-item" role="menuitem"
                      onClick={() => { setDownloadMenuOpen(false); void exportPdf() }}>
                      Download PDF
                    </button>
                    <button type="button" className="reports-download-item" role="menuitem"
                      onClick={() => { setDownloadMenuOpen(false); exportExcel() }}>
                      Download Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Range filter */}
          <div className="reports-filter-bar">
            <button type="button" className={`btn-ghost${rangePreset === 'month' ? ' is-active' : ''}`} onClick={() => setRangePreset('month')}>
              This Month
            </button>
            <button type="button" className={`btn-ghost${rangePreset === 'custom' ? ' is-active' : ''}`} onClick={() => setRangePreset('custom')}>
              Custom Range
            </button>
            <button type="button" className={`btn-ghost${rangePreset === 'all' ? ' is-active' : ''}`} onClick={() => setRangePreset('all')}>
              All Time
            </button>
            {rangePreset === 'custom' && (
              <>
                <PremiumDatePicker value={customFrom} onChange={setCustomFrom} title="From" />
                <PremiumDatePicker value={customTo} onChange={setCustomTo} title="To" />
              </>
            )}
          </div>

          {/* Table */}
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-type">Type</th>
                  <th className="col-category">Category</th>
                  <th className="col-description">Description</th>
                  <th className="col-amount">Amount</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">No entries for this filter.</td>
                  </tr>
                )}
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td className="col-date">{row.date}</td>
                    <td className="col-type">{row.type}</td>
                    <td className="col-category">{row.category}</td>
                    <td className="col-description">{row.description}</td>
                    <td className="col-amount">{row.amount == null || row.amount === '' ? '—' : formatPeso(row.amount)}</td>
                    <td className="col-status">{row.status}</td>
                    <td className="reports-row-actions col-actions">
                      <div className="manage-row-actions reports-row-actions-inner">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Edit entry"
                          title="Edit"
                          onClick={() =>
                            setEditRow({
                              ...row,
                              amount: row.amount == null ? '' : String(row.amount),
                            })
                          }
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label="Delete entry"
                          title="Delete"
                          onClick={() => setDeleteRow(row)}
                        >
                          <IconDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Running total</td>
                  <td className="col-amount">{formatPeso(total)}</td>
                  <td className="col-status" />
                  <td className="col-actions" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Entry Modal ── */}
      {addModal && (
        <EntryModal
          title="Add Entry"
          onClose={() => setAddModal(false)}
          onSave={handleAddSave}
        />
      )}

      {/* ── Edit Entry Modal ── */}
      {editRow && (
        <EntryModal
          title="Edit Entry"
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSave={handleEditSave}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteRow && (
        <DeleteConfirmModal
          onCancel={() => setDeleteRow(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  )
}
