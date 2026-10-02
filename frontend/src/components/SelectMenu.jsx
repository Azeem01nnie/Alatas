import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

const MENU_MAX_HEIGHT = 288
const MENU_GAP = 6

function findVerticalClipParent(element) {
  let parent = element?.parentElement
  while (parent && parent !== document.body) {
    const { overflow, overflowY } = window.getComputedStyle(parent)
    if (/(auto|scroll|hidden|clip)/.test(`${overflow} ${overflowY}`)) return parent
    parent = parent.parentElement
  }
  return null
}

function IconChevron({ open }) {
  return (
    <svg
      className={`select-menu-chevron${open ? ' is-open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Themed replacement for a native <select>.
 * options: [{ value, label, disabled?, hint? }]
 */
export default function SelectMenu({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  error = false,
  disabled = false,
  ariaLabel,
}) {
  const autoId = useId()
  const listId = `${id || autoId}-list`
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value ?? ''))
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const firstEnabled = (from, step) => {
    let i = from
    for (let n = 0; n < options.length; n += 1) {
      if (i < 0) i = options.length - 1
      if (i >= options.length) i = 0
      if (!options[i].disabled) return i
      i += step
    }
    return -1
  }

  const openMenu = () => {
    if (disabled) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1))
    setOpen(true)
  }

  const closeMenu = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const pick = (index) => {
    const opt = options[index]
    if (!opt || opt.disabled) return
    onChange?.(opt.value)
    closeMenu()
  }

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const clipParent = findVerticalClipParent(wrapRef.current)
    const clipRect = clipParent?.getBoundingClientRect()
    const boundaryTop = Math.max(0, clipRect?.top ?? 0)
    const boundaryBottom = Math.min(window.innerHeight, clipRect?.bottom ?? window.innerHeight)
    const spaceBelow = Math.max(0, boundaryBottom - rect.bottom - MENU_GAP)
    const spaceAbove = Math.max(0, rect.top - boundaryTop - MENU_GAP)
    const menuHeight = Math.min(
      MENU_MAX_HEIGHT,
      listRef.current?.scrollHeight || MENU_MAX_HEIGHT,
    )

    // A modal or drawer can clip the menu before the viewport edge. Prefer the
    // side that can show the full list, then fall back to the roomier side.
    setDropUp(spaceBelow < menuHeight && spaceAbove > spaceBelow)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) closeMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => firstEnabled(i + 1, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => firstEnabled(i - 1, -1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(firstEnabled(0, 1))
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(firstEnabled(options.length - 1, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        pick(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        closeMenu()
        break
      case 'Tab':
        closeMenu(false)
        break
      default:
        if (e.key.length === 1) {
          const ch = e.key.toLowerCase()
          const start = activeIndex + 1
          for (let n = 0; n < options.length; n += 1) {
            const i = (start + n) % options.length
            const opt = options[i]
            if (!opt.disabled && String(opt.label).toLowerCase().startsWith(ch)) {
              setActiveIndex(i)
              break
            }
          }
        }
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`select-menu${open ? ' is-open' : ''}${dropUp ? ' drop-up' : ''}${
        disabled ? ' is-disabled' : ''
      }`}
    >
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select-menu-trigger${error ? ' input-error' : ''}${selected ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-menu-value">{selected ? selected.label : placeholder}</span>
        <IconChevron open={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className="select-menu-list"
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        >
          {options.map((opt, index) => {
            const isSelected = index === selectedIndex
            const isActive = index === activeIndex
            return (
              <li
                key={String(opt.value)}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                className={`select-menu-option${isSelected ? ' is-selected' : ''}${
                  isActive ? ' is-active' : ''
                }${opt.disabled ? ' is-disabled' : ''}`}
                onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(index)}
              >
                <span className="select-menu-option-main">
                  <span className="select-menu-option-label">{opt.label}</span>
                  {opt.hint ? <span className="select-menu-option-hint">{opt.hint}</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
