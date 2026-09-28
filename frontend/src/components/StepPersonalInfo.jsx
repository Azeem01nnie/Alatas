import { useEffect, useId, useMemo, useRef, useState } from 'react'
import AddressAutocomplete from './AddressAutocomplete'
import SelectMenu from './SelectMenu'
import { ensurePhMobilePrefix, formatPhMobile } from '../utils/phone'
import {
  customerDisplayName,
  findCustomerByContact,
  loadCustomers,
} from '../utils/customers'

export const EMERGENCY_RELATIONS = [
  'Parent',
  'Spouse',
  'Sibling',
  'Child',
  'Friend',
  'Colleague',
  'Other',
]

function PhoneInput({ name, value, onChange, error, autoComplete = 'tel' }) {
  const handleChange = (e) => {
    onChange(formatPhMobile(e.target.value))
  }

  const handleKeyDown = (e) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const digits = String(value || '').replace(/\D/g, '')
        const el = e.currentTarget
        const start = el.selectionStart ?? 0
        const end = el.selectionEnd ?? 0
        const prefixLen = String(value || '').startsWith('+63 ') ? 4 : 3
        if (digits.length <= 2 || (start <= prefixLen && end <= prefixLen && e.key === 'Backspace')) {
          e.preventDefault()
          onChange('+63')
        }
      }
      return
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <>
      <input
        type="text"
        name={name}
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onFocus={() => onChange(ensurePhMobilePrefix(value))}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text')
          onChange(formatPhMobile(text))
        }}
        className={error ? 'input-error' : ''}
        autoComplete={autoComplete}
      />
      {error && <span className="error-msg">{error}</span>}
    </>
  )
}

const MAX_CUSTOMER_SUGGESTIONS = 8

function searchCustomers(customers, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const scored = []
  for (const c of customers) {
    const first = String(c.firstName || '').toLowerCase()
    const full = customerDisplayName(c).toLowerCase()
    let score = -1
    if (first.startsWith(q)) score = 0
    else if (full.split(/\s+/).some((part) => part.startsWith(q))) score = 1
    else if (full.includes(q)) score = 2
    if (score >= 0) scored.push({ c, score, full })
  }
  scored.sort((a, b) => a.score - b.score || a.full.localeCompare(b.full))
  return scored.slice(0, MAX_CUSTOMER_SUGGESTIONS).map((s) => s.c)
}

function FirstNameAutocomplete({ value, onChange, error, customers, onPick }) {
  const listId = useId()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const suggestions = useMemo(() => searchCustomers(customers, value), [customers, value])
  const showList = open && suggestions.length > 0

  useEffect(() => {
    setActiveIndex(suggestions.findIndex((c) => !c.blacklisted))
  }, [suggestions])

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const pick = (customer) => {
    if (!customer || customer.blacklisted) return
    onPick(customer)
    setOpen(false)
    setActiveIndex(-1)
  }

  const step = (from, dir) => {
    for (let n = 1; n <= suggestions.length; n += 1) {
      const i = (from + dir * n + suggestions.length) % suggestions.length
      if (!suggestions[i].blacklisted) return i
    }
    return from
  }

  const onKeyDown = (e) => {
    if (!showList) {
      if (e.key === 'ArrowDown' && suggestions.length) setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => step(i, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => step(i < 0 ? 0 : i, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pick(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="field customer-name-autocomplete" ref={wrapRef}>
      <label className="field-label" htmlFor={`${listId}-input`}>
        First Name
        <span className="required">*</span>
      </label>
      <input
        id={`${listId}-input`}
        type="text"
        name="firstName"
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        autoComplete="off"
        autoCapitalize="characters"
        className={error ? 'input-error' : ''}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} className="address-suggestions customer-suggestions" role="listbox">
          <li className="customer-suggestions-head" aria-hidden="true">
            Returning customers
          </li>
          {suggestions.map((c, index) => (
            <li key={c.id}>
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={c.blacklisted || undefined}
                disabled={Boolean(c.blacklisted)}
                className={`address-suggestion customer-suggestion${
                  index === activeIndex ? ' is-active' : ''
                }${c.blacklisted ? ' is-blacklisted' : ''}`}
                onMouseEnter={() => !c.blacklisted && setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <span className="address-suggestion-main">
                  <strong>{customerDisplayName(c)}</strong>
                  <span className="customer-suggestion-meta">
                    {formatPhMobile(c.contactNo) || c.contactNo || 'No contact'}
                    {c.blacklisted ? ' · Blacklisted' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="error-msg">{error}</span>}
    </div>
  )
}

export default function StepPersonalInfo({ data, onChange, errors, embedded = false, onCustomerLoaded }) {
  const customers = useMemo(() => loadCustomers(), [])
  const matched = findCustomerByContact(data.contactNo)

  const nameFields = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'middleName', label: 'Middle Name', required: false },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'suffix', label: 'Suffix', required: false },
  ]

  const applyCustomer = (customer) => {
    if (!customer) return
    if (customer.blacklisted) {
      onChange('firstName', '')
      onChange('middleName', '')
      onChange('lastName', '')
      onChange('suffix', '')
      onChange('address', '')
      onChange('contactNo', customer.contactNo || '')
      onChange('emergencyName', '')
      onChange('emergencyRelation', '')
      onChange('emergencyRelationOther', '')
      onChange('emergencyPhone', '')
      onCustomerLoaded?.(customer)
      return
    }
    onChange('firstName', customer.firstName || '')
    onChange('middleName', customer.middleName || '')
    onChange('lastName', customer.lastName || '')
    onChange('suffix', customer.suffix || '')
    onChange('address', customer.address || '')
    onChange('contactNo', customer.contactNo || '')
    onChange('emergencyName', customer.emergencyName || '')
    onChange('emergencyRelation', customer.emergencyRelation || '')
    onChange('emergencyRelationOther', customer.emergencyRelationOther || '')
    onChange('emergencyPhone', customer.emergencyPhone || '')
    onCustomerLoaded?.(customer)
  }

  return (
    <section className={`step-panel${embedded ? ' step-personal-embedded' : ''}`}>
      {!embedded ? (
        <>
          <h2 className="step-title">Lessee / Renter Information</h2>
          <p className="step-subtitle">Enter the customer&apos;s personal details.</p>
        </>
      ) : null}

      {matched?.blacklisted ? (
        <p className="error-msg returning-customer-note">
          This contact is blacklisted
          {matched.blacklistReason ? ` — ${matched.blacklistReason}` : ''}. Rentals are blocked.
        </p>
      ) : matched ? (
        <p className="returning-customer-hint returning-customer-note">
          Returning customer — details and ID photos filled from their last rental.
        </p>
      ) : null}

      <div className="form-grid">
        {nameFields.map(({ key, label, required }) =>
          key === 'firstName' ? (
            <FirstNameAutocomplete
              key={key}
              value={data.firstName}
              onChange={(val) => onChange('firstName', val)}
              error={errors.firstName}
              customers={customers}
              onPick={applyCustomer}
            />
          ) : (
          <label key={key} className="field">
            <span className="field-label">
              {label}
              {required && <span className="required">*</span>}
            </span>
            <input
              type="text"
              name={key}
              value={data[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className={errors[key] ? 'input-error' : ''}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {errors[key] && <span className="error-msg">{errors[key]}</span>}
          </label>
          ),
        )}

        <AddressAutocomplete
          value={data.address}
          onChange={(val) => onChange('address', val)}
          error={errors.address}
        />

        <label className="field">
          <span className="field-label">
            Contact No.
            <span className="required">*</span>
          </span>
          <PhoneInput
            name="contactNo"
            value={data.contactNo}
            onChange={(val) => {
              onChange('contactNo', val)
              const found = findCustomerByContact(val)
              if (found && !found.blacklisted) applyCustomer(found)
              else if (found?.blacklisted) applyCustomer(found)
            }}
            error={errors.contactNo}
          />
        </label>

        <div className="field-full emergency-block">
          <p className="emergency-heading">Emergency Contact</p>
          <div
            className={`form-grid emergency-grid${
              data.emergencyRelation === 'Other' ? ' has-other' : ''
            }`}
          >
            <label className="field">
              <span className="field-label">
                Full Name
                <span className="required">*</span>
              </span>
              <input
                type="text"
                name="emergencyName"
                value={data.emergencyName}
                onChange={(e) => onChange('emergencyName', e.target.value)}
                className={errors.emergencyName ? 'input-error' : ''}
                autoComplete="off"
                autoCapitalize="characters"
              />
              {errors.emergencyName && (
                <span className="error-msg">{errors.emergencyName}</span>
              )}
            </label>

            <div className="field">
              <span className="field-label">
                Relationship
                <span className="required">*</span>
              </span>
              <SelectMenu
                id="emergency-relation"
                name="emergencyRelation"
                ariaLabel="Relationship"
                value={data.emergencyRelation}
                placeholder="Select relationship"
                options={EMERGENCY_RELATIONS.map((rel) => ({ value: rel, label: rel }))}
                error={Boolean(errors.emergencyRelation)}
                onChange={(next) => {
                  onChange('emergencyRelation', next)
                  if (next !== 'Other') onChange('emergencyRelationOther', '')
                }}
              />
              {errors.emergencyRelation && (
                <span className="error-msg">{errors.emergencyRelation}</span>
              )}
            </div>

            {data.emergencyRelation === 'Other' && (
              <label className="field emergency-other-field">
                <span className="field-label">
                  Specify
                  <span className="required">*</span>
                </span>
                <input
                  type="text"
                  name="emergencyRelationOther"
                  value={data.emergencyRelationOther}
                  onChange={(e) => onChange('emergencyRelationOther', e.target.value)}
                  className={errors.emergencyRelationOther ? 'input-error' : ''}
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                {errors.emergencyRelationOther && (
                  <span className="error-msg">{errors.emergencyRelationOther}</span>
                )}
              </label>
            )}

            <label className="field">
              <span className="field-label">
                Contact No.
                <span className="required">*</span>
              </span>
              <PhoneInput
                name="emergencyPhone"
                value={data.emergencyPhone}
                onChange={(val) => onChange('emergencyPhone', val)}
                error={errors.emergencyPhone}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
