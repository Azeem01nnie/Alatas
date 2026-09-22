import { useEffect, useMemo, useState } from 'react'
import {
  customerDisplayName,
  deleteCustomer,
  loadCustomers,
  syncCustomersFromRentals,
  updateCustomer,
} from '../utils/customers'
import { formatPhMobile } from '../utils/phone'

export default function CustomersPanel({ rentals = [] }) {
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState(null)
  const [deleteRow, setDeleteRow] = useState(null)

  useEffect(() => {
    syncCustomersFromRentals(rentals)
    setVersion((n) => n + 1)
  }, [rentals])

  const customers = useMemo(() => loadCustomers(), [version, rentals])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => {
      const hay = `${customerDisplayName(c)} ${c.contactNo} ${c.address}`.toLowerCase()
      return hay.includes(q)
    })
  }, [customers, search])

  const refresh = () => setVersion((n) => n + 1)

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editRow?.id) return
    updateCustomer(editRow.id, {
      firstName: editRow.firstName,
      middleName: editRow.middleName,
      lastName: editRow.lastName,
      address: editRow.address,
      contactNo: editRow.contactNo,
      emergencyName: editRow.emergencyName,
      emergencyRelation: editRow.emergencyRelation,
      emergencyRelationOther: editRow.emergencyRelationOther,
      emergencyPhone: editRow.emergencyPhone,
    })
    setEditRow(null)
    refresh()
  }

  return (
    <section className="customers-panel">
      <header className="customers-panel-header">
        <div>
          <h2 className="customers-panel-title">Customers</h2>
          <p className="customers-panel-sub">
            Saved from rentals. Returning customers autofill on Rent Car using their contact number.
          </p>
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
      </header>

      <div className="customers-table-wrap">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Emergency</th>
              <th>Rentals</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No customers yet. Complete a rental to save the first profile.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>{customerDisplayName(c)}</td>
                  <td>{c.contactNo || '—'}</td>
                  <td>{c.address || '—'}</td>
                  <td>
                    {c.emergencyName
                      ? `${c.emergencyName}${c.emergencyPhone ? ` · ${c.emergencyPhone}` : ''}`
                      : '—'}
                  </td>
                  <td>{c.rentalCount || 0}</td>
                  <td className="customers-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEditRow({ ...c })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDeleteRow(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editRow ? (
        <div
          className="modal-overlay confirm-modal-overlay"
          role="presentation"
          onClick={() => setEditRow(null)}
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
              <div className="modal-actions field-full">
                <button type="button" className="btn-outline" onClick={() => setEditRow(null)}>
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
              Remove {customerDisplayName(deleteRow)} from the customers list? Past rentals are kept.
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
