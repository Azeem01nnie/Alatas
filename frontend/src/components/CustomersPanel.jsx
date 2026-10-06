import { useEffect, useMemo, useState } from 'react'
import {
  countCustomerRentals,
  customerDisplayName,
  deleteCustomer,
  isCountableCustomerRental,
  loadCustomers,
  rentalBelongsToCustomer,
  setCustomerBlacklisted,
  syncCustomersFromRentals,
  pullCustomerDeletions,
  updateCustomer,
} from '../utils/customers'
import { formatPhMobile } from '../utils/phone'
import { formatRentalFee, parseRentalFeeAmount } from '../utils/rentalFee'
import { compressImageDataUrl } from '../utils/storage'
import PhotoLightbox from './PhotoLightbox'

const EDIT_PHOTO_SLOTS = [
  { key: 'holdingPhoto', label: 'Holding license' },
  { key: 'licensePhoto', label: 'Customer / license photo' },
  { key: 'optionalPhoto', label: 'Optional photo' },
]

const EDIT_TRACKED_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'address',
  'contactNo',
  'emergencyName',
  'emergencyRelation',
  'emergencyRelationOther',
  'emergencyPhone',
  ...EDIT_PHOTO_SLOTS.map((slot) => slot.key),
]

async function readAndCompressPhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return compressImageDataUrl(dataUrl, 1600, 0.88)
}

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function lifecycleLabel(rental) {
  const life = String(rental?.rentalLifecycle || '').toLowerCase()
  if (life === 'active') return 'Active'
  if (life === 'scheduled') return 'Scheduled'
  if (life === 'completed') return 'Completed'
  if (life === 'cancelled') return 'Cancelled'
  if (life === 'pending_approval') return 'Pending'
  const approval = String(rental?.approvalStatus || '').toLowerCase()
  if (approval === 'pending') return 'Pending'
  if (approval === 'rejected') return 'Rejected'
  return life || '—'
}

function listCustomerRentals(rentals = [], customer) {
  if (!customer) return []
  return (Array.isArray(rentals) ? rentals : [])
    .filter((r) => isCountableCustomerRental(r) && rentalBelongsToCustomer(r, customer))
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.encodedAt || a.createdAt || a.rental?.periodFrom || 0).getTime()
      const tb = new Date(b.encodedAt || b.createdAt || b.rental?.periodFrom || 0).getTime()
      return tb - ta
    })
}

export default function CustomersPanel({ rentals = [] }) {
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | blacklisted
  const [viewRow, setViewRow] = useState(null)
  const [viewPhoto, setViewPhoto] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [editOriginal, setEditOriginal] = useState(null)
  const [clearPhotoSlot, setClearPhotoSlot] = useState(null)
  const [confirmDiscardEdit, setConfirmDiscardEdit] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [blacklistRow, setBlacklistRow] = useState(null)
  const [blacklistReason, setBlacklistReason] = useState('')

  const [deletionsPulled, setDeletionsPulled] = useState(false)

  useEffect(() => {
    let alive = true
    pullCustomerDeletions().finally(() => {
      if (alive) setDeletionsPulled(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    syncCustomersFromRentals(rentals)
    setVersion((n) => n + 1)
  }, [rentals, deletionsPulled])

  const customers = useMemo(() => {
    const list = loadCustomers()
    return list.map((c) => ({
      ...c,
      rentalCount: countCustomerRentals(rentals, c),
    }))
  }, [version, rentals])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (statusFilter === 'blacklisted' && !c.blacklisted) return false
      if (statusFilter === 'active' && c.blacklisted) return false
      if (!q) return true
      const hay = `${customerDisplayName(c)} ${c.contactNo} ${c.address}`.toLowerCase()
      return hay.includes(q)
    })
  }, [customers, search, statusFilter])

  const viewHistory = useMemo(
    () => (viewRow ? listCustomerRentals(rentals, viewRow) : []),
    [rentals, viewRow],
  )

  const refresh = () => setVersion((n) => n + 1)

  const openEdit = (row) => {
    setEditRow({ ...row })
    setEditOriginal({ ...row })
  }

  const closeEdit = () => {
    setEditRow(null)
    setEditOriginal(null)
    setClearPhotoSlot(null)
    setConfirmDiscardEdit(false)
  }

  const isEditDirty =
    Boolean(editRow && editOriginal) &&
    EDIT_TRACKED_FIELDS.some(
      (key) => String(editRow[key] ?? '') !== String(editOriginal[key] ?? ''),
    )

  const requestCloseEdit = () => {
    if (isEditDirty) setConfirmDiscardEdit(true)
    else closeEdit()
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editRow?.id) return
    const saved = updateCustomer(editRow.id, {
      firstName: editRow.firstName,
      middleName: editRow.middleName,
      lastName: editRow.lastName,
      address: editRow.address,
      contactNo: editRow.contactNo,
      emergencyName: editRow.emergencyName,
      emergencyRelation: editRow.emergencyRelation,
      emergencyRelationOther: editRow.emergencyRelationOther,
      emergencyPhone: editRow.emergencyPhone,
      holdingPhoto: editRow.holdingPhoto || '',
      licensePhoto: editRow.licensePhoto || '',
      optionalPhoto: editRow.optionalPhoto || '',
    })
    closeEdit()
    refresh()
    if (saved && viewRow && String(viewRow.id) === String(saved.id)) {
      setViewRow({ ...saved, rentalCount: countCustomerRentals(rentals, saved) })
    }
  }

  const handleEditPhotoPick = async (key, file) => {
    if (!file) return
    try {
      const compressed = await readAndCompressPhoto(file)
      if (!compressed) return
      setEditRow((p) => (p ? { ...p, [key]: compressed } : p))
    } catch {
      // ignore read failures
    }
  }

  const confirmBlacklist = () => {
    if (!blacklistRow?.id) return
    const saved = setCustomerBlacklisted(blacklistRow.id, true, blacklistReason)
    setBlacklistRow(null)
    setBlacklistReason('')
    refresh()
    if (saved && viewRow && String(viewRow.id) === String(saved.id)) {
      setViewRow({ ...saved, rentalCount: countCustomerRentals(rentals, saved) })
    }
  }

  const clearBlacklist = (row) => {
    if (!row?.id) return
    const saved = setCustomerBlacklisted(row.id, false)
    refresh()
    if (saved && viewRow && String(viewRow.id) === String(saved.id)) {
      setViewRow({ ...saved, rentalCount: countCustomerRentals(rentals, saved) })
    }
  }

  return (
    <section className="customers-panel">
      <header className="customers-panel-header">
        <div>
          <h2 className="customers-panel-title">Customers</h2>
          <p className="customers-panel-sub">
            Saved from rentals. Click a row for full profile, ID photos, and rental history.
            Blacklisted customers cannot start a new rental.
          </p>
        </div>
        <div className="customers-toolbar">
          <div className="chip-group customers-status-filters" role="group" aria-label="Customer status">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'blacklisted', label: 'Blacklisted' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`chip${statusFilter === opt.id ? ' selected' : ''}`}
                onClick={() => setStatusFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="field search-field customers-search">
            <span className="field-label">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, address…"
            />
          </label>
        </div>
      </header>

      <div className="customers-table-wrap">
        <table className="customers-table customers-table--slim">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Rentals</th>
              <th>Status</th>
              <th className="customers-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No customers yet. Complete a rental to save the first profile.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`customers-row${c.blacklisted ? ' is-blacklisted' : ''}`}
                  tabIndex={0}
                  onClick={() => setViewRow(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setViewRow(c)
                    }
                  }}
                >
                  <td className="customers-cell-name">
                    <strong className="customers-row-name">{customerDisplayName(c)}</strong>
                  </td>
                  <td className="customers-cell-contact" data-label="Contact">
                    {c.contactNo || '—'}
                  </td>
                  <td className="customers-cell-rentals" data-label="Rentals">
                    {c.rentalCount || 0}
                  </td>
                  <td className="customers-cell-status">
                    {c.blacklisted ? (
                      <span className="customers-status-badge is-blacklisted">Blacklisted</span>
                    ) : (
                      <span className="customers-status-badge is-active">Active</span>
                    )}
                  </td>
                  <td className="customers-actions-col">
                    <div
                      className="customers-row-actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="customers-action-btn"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      {c.blacklisted ? (
                        <button
                          type="button"
                          className="customers-action-btn"
                          onClick={() => clearBlacklist(c)}
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="customers-action-btn"
                          onClick={() => {
                            setBlacklistRow(c)
                            setBlacklistReason(c.blacklistReason || '')
                          }}
                        >
                          Blacklist
                        </button>
                      )}
                      <button
                        type="button"
                        className="customers-action-btn is-danger"
                        onClick={() => setDeleteRow(c)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewRow ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => setViewRow(null)}
        >
          <div
            className="modal-panel confirm-modal customers-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="customers-detail-head">
              <div>
                <p className="customers-detail-eyebrow">Customer profile</p>
                <h3 id="customer-detail-title" className="modal-title">
                  {customerDisplayName(viewRow)}
                </h3>
                <p className="customers-detail-sub">
                  {viewRow.contactNo || 'No contact'} · {viewRow.rentalCount || 0} rental
                  {(viewRow.rentalCount || 0) === 1 ? '' : 's'}
                </p>
              </div>
              {viewRow.blacklisted ? (
                <span className="customers-status-badge is-blacklisted">Blacklisted</span>
              ) : (
                <span className="customers-status-badge is-active">Active</span>
              )}
            </header>

            <div className="customers-detail-body">
              <section className="customers-detail-section">
                <h4 className="customers-detail-section-title">Contact</h4>
                <dl className="customers-detail-grid">
                  <div>
                    <dt>Address</dt>
                    <dd>{viewRow.address || '—'}</dd>
                  </div>
                  <div>
                    <dt>Emergency</dt>
                    <dd>
                      {viewRow.emergencyName
                        ? `${viewRow.emergencyName}${
                            viewRow.emergencyPhone ? ` · ${viewRow.emergencyPhone}` : ''
                          }${
                            viewRow.emergencyRelation
                              ? ` (${viewRow.emergencyRelation}${
                                  viewRow.emergencyRelation === 'Other' &&
                                  viewRow.emergencyRelationOther
                                    ? `: ${viewRow.emergencyRelationOther}`
                                    : ''
                                })`
                              : ''
                          }`
                        : '—'}
                    </dd>
                  </div>
                  {viewRow.blacklisted && viewRow.blacklistReason ? (
                    <div>
                      <dt>Blacklist reason</dt>
                      <dd>{viewRow.blacklistReason}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="customers-detail-section">
                <h4 className="customers-detail-section-title">ID photos</h4>
                <PhotoLightbox photo={viewPhoto} onClose={() => setViewPhoto(null)} />
                {viewRow.holdingPhoto || viewRow.licensePhoto || viewRow.optionalPhoto ? (
                  <div className="customers-detail-photos">
                    {viewRow.holdingPhoto ? (
                      <figure>
                        <img src={viewRow.holdingPhoto} alt="Holding license" className="is-zoomable" onClick={() => setViewPhoto({ src: viewRow.holdingPhoto, label: 'Holding license' })} />
                        <figcaption>Holding license</figcaption>
                      </figure>
                    ) : null}
                    {viewRow.licensePhoto ? (
                      <figure>
                        <img src={viewRow.licensePhoto} alt="Customer photo" className="is-zoomable" onClick={() => setViewPhoto({ src: viewRow.licensePhoto, label: 'Customer photo' })} />
                        <figcaption>Customer photo</figcaption>
                      </figure>
                    ) : null}
                    {viewRow.optionalPhoto ? (
                      <figure>
                        <img src={viewRow.optionalPhoto} alt="Optional photo" className="is-zoomable" onClick={() => setViewPhoto({ src: viewRow.optionalPhoto, label: 'Optional photo' })} />
                        <figcaption>Optional</figcaption>
                      </figure>
                    ) : null}
                  </div>
                ) : (
                  <p className="customers-detail-empty">No ID photos saved yet.</p>
                )}
              </section>

              <section className="customers-detail-section">
                <h4 className="customers-detail-section-title">Rental history</h4>
                <div className="customers-history-wrap">
                  <table className="customers-history-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Vehicle</th>
                        <th>Plate</th>
                        <th>Rental</th>
                        <th>Period</th>
                        <th>Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            No rentals linked to this customer yet.
                          </td>
                        </tr>
                      ) : (
                        viewHistory.map((r) => {
                          const v = r.vehicle || {}
                          const fee =
                            parseRentalFeeAmount(r.rental?.rentalFee) > 0
                              ? formatRentalFee(parseRentalFeeAmount(r.rental.rentalFee))
                              : r.rental?.rentalFee || '—'
                          const desk =
                            String(r.rental?.deskMode || '').toLowerCase() === 'booking'
                              ? 'Booking'
                              : String(r.rental?.deskMode || '').toLowerCase() === 'check_in'
                                ? 'Check In'
                                : ''
                          const carBits = [
                            v.bodyType,
                            v.engineNo ? `Eng ${v.engineNo}` : '',
                            v.chassisNo ? `Ch ${v.chassisNo}` : '',
                          ].filter(Boolean)
                          return (
                            <tr key={r.id}>
                              <td>{formatWhen(r.encodedAt || r.createdAt)}</td>
                              <td>
                                <div>
                                  {[v.make, v.series].filter(Boolean).join(' — ') || '—'}
                                </div>
                                {carBits.length ? (
                                  <div className="customers-history-meta">{carBits.join(' · ')}</div>
                                ) : null}
                              </td>
                              <td>{v.plateNo || '—'}</td>
                              <td>
                                <div>{r.rental?.rentalType || '—'}</div>
                                {desk ? (
                                  <div className="customers-history-meta">{desk}</div>
                                ) : null}
                              </td>
                              <td>
                                {r.rental?.periodFromLabel || formatWhen(r.rental?.periodFrom)}
                                {' → '}
                                {r.rental?.periodToLabel || formatWhen(r.rental?.periodTo)}
                              </td>
                              <td>{fee}</td>
                              <td>{lifecycleLabel(r)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="modal-actions customers-detail-actions">
              <button type="button" className="btn-outline" onClick={() => setViewRow(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => openEdit(viewRow)}
              >
                Edit
              </button>
              {viewRow.blacklisted ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => clearBlacklist(viewRow)}
                >
                  Unblock
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setBlacklistRow(viewRow)
                    setBlacklistReason(viewRow.blacklistReason || '')
                  }}
                >
                  Blacklist
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteRow(viewRow)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={requestCloseEdit}
        >
          <div
            className="modal-panel confirm-modal customers-edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Edit customer</h3>
            <form className="form-grid" onSubmit={handleSaveEdit}>
              <label className="field">
                <span className="field-label">First name</span>
                <input
                  value={editRow.firstName || ''}
                  onChange={(e) => setEditRow((p) => ({ ...p, firstName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Middle name</span>
                <input
                  value={editRow.middleName || ''}
                  onChange={(e) => setEditRow((p) => ({ ...p, middleName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Last name</span>
                <input
                  value={editRow.lastName || ''}
                  onChange={(e) => setEditRow((p) => ({ ...p, lastName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Contact</span>
                <input
                  value={editRow.contactNo || ''}
                  onChange={(e) =>
                    setEditRow((p) => ({ ...p, contactNo: formatPhMobile(e.target.value) }))
                  }
                />
              </label>
              <label className="field field-full">
                <span className="field-label">Address</span>
                <input
                  value={editRow.address || ''}
                  onChange={(e) => setEditRow((p) => ({ ...p, address: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Emergency name</span>
                <input
                  value={editRow.emergencyName || ''}
                  onChange={(e) => setEditRow((p) => ({ ...p, emergencyName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Emergency phone</span>
                <input
                  value={editRow.emergencyPhone || ''}
                  onChange={(e) =>
                    setEditRow((p) => ({
                      ...p,
                      emergencyPhone: formatPhMobile(e.target.value),
                    }))
                  }
                />
              </label>

              <div className="field field-full customers-edit-photos">
                <span className="field-label">ID photos</span>
                <div className="customers-edit-photo-grid">
                  {EDIT_PHOTO_SLOTS.map((slot) => {
                    const preview = editRow[slot.key] || ''
                    return (
                      <div key={slot.key} className="customers-edit-photo-slot">
                        <div className="customers-edit-photo-stage">
                          {preview ? (
                            <img src={preview} alt={slot.label} />
                          ) : (
                            <span>No photo</span>
                          )}
                        </div>
                        <p className="customers-edit-photo-label">{slot.label}</p>
                        <div className="customers-edit-photo-actions">
                          <label className="customers-edit-photo-upload">
                            {preview ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ''
                                handleEditPhotoPick(slot.key, file)
                              }}
                            />
                          </label>
                          {preview ? (
                            <button
                              type="button"
                              className="customers-edit-photo-clear"
                              onClick={() => setClearPhotoSlot(slot)}
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions field-full">
                <button type="button" className="btn-outline" onClick={requestCloseEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editRow && clearPhotoSlot ? (
        <div
          className="modal-overlay confirm-modal-overlay customers-stacked-overlay"
          role="presentation"
          onClick={() => setClearPhotoSlot(null)}
        >
          <div
            className="modal-panel confirm-modal"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Remove this photo?</h3>
            <p className="confirm-message">
              The {clearPhotoSlot.label.toLowerCase()} photo will be removed from this customer
              once you save.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => setClearPhotoSlot(null)}>
                Keep photo
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const key = clearPhotoSlot.key
                  setEditRow((p) => (p ? { ...p, [key]: '' } : p))
                  setClearPhotoSlot(null)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editRow && confirmDiscardEdit ? (
        <div
          className="modal-overlay confirm-modal-overlay customers-stacked-overlay"
          role="presentation"
          onClick={() => setConfirmDiscardEdit(false)}
        >
          <div
            className="modal-panel confirm-modal"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Discard changes?</h3>
            <p className="confirm-message">
              You have unsaved changes to {customerDisplayName(editRow) || 'this customer'}. If you
              leave now, they will be lost.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmDiscardEdit(false)}
              >
                Keep editing
              </button>
              <button type="button" className="btn-primary" onClick={closeEdit}>
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {blacklistRow ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => {
            setBlacklistRow(null)
            setBlacklistReason('')
          }}
        >
          <div
            className="modal-panel confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Blacklist customer?</h3>
            <p className="confirm-message">
              {customerDisplayName(blacklistRow)} will be blocked from new rentals.
            </p>
            <div className="confirm-modal-body">
              <label className="field">
                <span className="field-label">Reason (optional)</span>
                <input
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="e.g. unpaid damage, abuse…"
                  maxLength={160}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setBlacklistRow(null)
                  setBlacklistReason('')
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={confirmBlacklist}>
                Blacklist
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteRow ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => setDeleteRow(null)}
        >
          <div
            className="modal-panel confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Delete customer?</h3>
            <p className="confirm-message">
              Remove {customerDisplayName(deleteRow)} from the saved customers list. Past rentals
              stay in history.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => setDeleteRow(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  deleteCustomer(deleteRow.id)
                  setDeleteRow(null)
                  setViewRow(null)
                  refresh()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
