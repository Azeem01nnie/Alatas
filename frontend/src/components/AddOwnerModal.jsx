import { useEffect, useRef, useState } from 'react'

export default function AddOwnerModal({
  ownershipType = 'company',
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState(ownershipType === 'thirdParty' ? 'thirdParty' : 'company')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const capitalizeEachWord = (value) => {
    // Uppercase the first letter of each word, without changing the rest of the text.
    // Keeps the user's typing intent while enforcing "Capitalized words".
    return value.replace(/(^|[\s])([a-zA-Z])/g, (match, leading, letter) => `${leading}${String(letter).toUpperCase()}`)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setType(ownershipType === 'thirdParty' ? 'thirdParty' : 'company')
  }, [ownershipType])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Owner name is required')
      return
    }
    onConfirm({ name: trimmed, ownershipType: type })
  }

  return (
    <div
      className="modal-overlay confirm-modal-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="modal-panel confirm-modal add-owner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-owner-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-owner-title" className="modal-title">
          Add New Owner
        </h3>
        <p className="confirm-message">
          This owner will be linked to the vehicle when you save. They will appear in Vehicle
          Reports after the vehicle is added.
        </p>

        <form className="add-owner-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Owner name *</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(capitalizeEachWord(e.target.value))
                setError('')
              }}
              className={error ? 'input-error' : ''}
            />
            {error && <span className="error-msg">{error}</span>}
          </label>

          <label className="field">
            <span className="field-label">Ownership type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value === 'thirdParty' ? 'thirdParty' : 'company')}
            >
              <option value="company">Company-owned</option>
              <option value="thirdParty">Third-party owned</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Owner
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
