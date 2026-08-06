import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatAddressLabel, searchAddresses } from '../data/barangays'

export default function AddressAutocomplete({
  value,
  onChange,
  error,
  label = 'Address',
  required = true,
}) {
  const listId = useId()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const suggestions = useMemo(() => {
    if (!value || value.trim().length < 1) return []
    return searchAddresses(value, 12)
  }, [value])

  const showList = open && suggestions.length > 0

  useEffect(() => {
    setActiveIndex(suggestions.length ? 0 : -1)
  }, [suggestions])

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const pick = (entry) => {
    onChange(formatAddressLabel(entry))
    setOpen(false)
    setActiveIndex(-1)
  }

  const onKeyDown = (e) => {
    if (!showList) {
      if (e.key === 'ArrowDown' && suggestions.length) setOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pick(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className="field field-full address-autocomplete" ref={wrapRef}>
      <span className="field-label">
        {label}
        {required && <span className="required">*</span>}
      </span>
      <input
        type="text"
        name="address"
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        autoComplete="off"
        className={error ? 'input-error' : ''}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} className="address-suggestions" role="listbox">
          {suggestions.map((entry, index) => (
            <li key={`${entry.type}-${entry.name}-${entry.barangay}-${entry.city}-${index}`}>
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`address-suggestion${index === activeIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(entry)}
              >
                <span className="address-suggestion-main">
                  <strong>{formatAddressLabel(entry)}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="error-msg">{error}</span>}
    </label>
  )
}
