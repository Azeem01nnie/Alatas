import { useMemo, useState } from 'react'
import {
  addOutsideCityDestination,
  deleteOutsideCityDestination,
  loadOutsideCityDestinations,
  updateOutsideCityDestination,
} from '../utils/outsideCityDestinations'
import { formatRentalFee, parseRentalFeeAmount } from '../utils/rentalFee'

function formatPriceInput(value) {
  const digits = String(value ?? '').replace(/[^\d.]/g, '')
  if (digits === '' || digits === '.') return digits === '.' ? '₱0.' : ''
  const n = Number(digits)
  if (Number.isNaN(n)) return `₱${digits}`
  const [whole, frac] = digits.split('.')
  const withCommas = Number(whole || '0').toLocaleString('en-PH')
  if (frac != null) return `₱${withCommas}.${frac.slice(0, 2)}`
  if (digits.endsWith('.')) return `₱${withCommas}.`
  return `₱${withCommas}`
}

export default function OutsideCityDestinationsPanel() {
  const [version, setVersion] = useState(0)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')

  const destinations = useMemo(() => loadOutsideCityDestinations(), [version])

  const refresh = () => setVersion((n) => n + 1)

  const handleAdd = (e) => {
    e.preventDefault()
    setError('')
    try {
      addOutsideCityDestination({
        name,
        price: parseRentalFeeAmount(price),
      })
      setName('')
      setPrice('')
      refresh()
    } catch (err) {
      setError(err?.message || 'Could not add destination.')
    }
  }

  const startEdit = (row) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditPrice(formatRentalFee(row.price) || '')
    setError('')
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditPrice('')
  }

  const saveEdit = (e) => {
    e.preventDefault()
    if (!editId) return
    setError('')
    try {
      updateOutsideCityDestination(editId, {
        name: editName,
        price: parseRentalFeeAmount(editPrice),
      })
      cancelEdit()
      refresh()
    } catch (err) {
      setError(err?.message || 'Could not update destination.')
    }
  }

  const handleDelete = (id) => {
    if (!window.confirm('Remove this destination?')) return
    deleteOutsideCityDestination(id)
    if (editId === id) cancelEdit()
    refresh()
  }

  const toggleActive = (row) => {
    updateOutsideCityDestination(row.id, { active: !row.active })
    refresh()
  }

  return (
    <article className="settings-card settings-destinations-card">
      <div className="settings-card-head">
        <h4 className="settings-card-title">Outside city destinations</h4>
        <p className="settings-card-copy">
          Places and fees shown when a rental is marked Outside city on Rent Car.
        </p>
      </div>

      <form className="destinations-add-form" onSubmit={handleAdd}>
        <label className="field">
          <span className="field-label">Place</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pagadian City"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Price (₱)</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(formatPriceInput(e.target.value))}
            placeholder="₱0"
            required
          />
        </label>
        <button type="submit" className="btn-primary">
          Add place
        </button>
      </form>

      {error ? (
        <p className="settings-data-message" role="alert">
          {error}
        </p>
      ) : null}

      {destinations.length === 0 ? (
        <p className="destinations-empty">No destinations yet. Add the first place above.</p>
      ) : (
        <ul className="destinations-list">
          {destinations.map((row) => (
            <li key={row.id} className={`destinations-row${!row.active ? ' is-inactive' : ''}`}>
              {editId === row.id ? (
                <form className="destinations-edit-form" onSubmit={saveEdit}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Place name"
                    required
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => setEditPrice(formatPriceInput(e.target.value))}
                    aria-label="Price"
                    required
                  />
                  <button type="submit" className="btn-primary btn-sm">
                    Save
                  </button>
                  <button type="button" className="btn-outline btn-sm" onClick={cancelEdit}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="destinations-meta">
                    <strong>{row.name}</strong>
                    <span>{row.priceLabel}</span>
                    {!row.active ? <em>Hidden</em> : null}
                  </div>
                  <div className="destinations-actions">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => toggleActive(row)}
                    >
                      {row.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => handleDelete(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
