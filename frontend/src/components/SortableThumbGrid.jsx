import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const LONG_PRESS_MS = 300
const TOUCH_SLOP = 8
const MOUSE_DRAG_THRESHOLD = 5

function moveItem(list, from, to) {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Thumbnail grid with drag-to-reorder.
 * Touch: long-press then drag (short swipes still scroll the page). Mouse: click and drag.
 * The first item gets the "Main" badge.
 */
export default function SortableThumbGrid({ items, onReorder, onRemove, altPrefix = 'Photo' }) {
  const [order, setOrder] = useState(null)
  const [dragKey, setDragKey] = useState(null)
  const [pressKey, setPressKey] = useState(null)
  const [ghost, setGhost] = useState(null)
  const cardRefs = useRef(new Map())
  const pressRef = useRef(null)
  const orderRef = useRef(null)

  const displayOrder = order || items.map((_, i) => i)

  useEffect(() => {
    orderRef.current = order
  }, [order])

  useEffect(() => {
    if (!dragKey && order) setOrder(null)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(pressRef.current?.timer), [])

  const startDrag = (press, x, y) => {
    const el = cardRefs.current.get(press.key)
    if (!el) return
    const rect = el.getBoundingClientRect()
    press.started = true
    const initial = items.map((_, i) => i)
    orderRef.current = initial
    setOrder(initial)
    setDragKey(press.key)
    setPressKey(null)
    setGhost({
      src: items[press.key],
      width: rect.width,
      height: rect.height,
      offsetX: x - rect.left,
      offsetY: y - rect.top,
      x,
      y,
    })
    if (press.pointerType === 'touch') navigator.vibrate?.(12)
  }

  const updateHover = (key, x, y) => {
    const current = orderRef.current
    if (!current) return
    for (const [otherKey, el] of cardRefs.current) {
      if (otherKey === key || !el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const from = current.indexOf(key)
        const to = current.indexOf(otherKey)
        if (from !== -1 && to !== -1 && from !== to) {
          const next = moveItem(current, from, to)
          orderRef.current = next
          setOrder(next)
        }
        break
      }
    }
  }

  const finish = (commit) => {
    const press = pressRef.current
    clearTimeout(press?.timer)
    pressRef.current = null
    setPressKey(null)
    if (press?.started) {
      const final = orderRef.current
      if (commit && final && final.some((k, i) => k !== i)) {
        onReorder(final.map((k) => items[k]))
      }
      setDragKey(null)
      setGhost(null)
      setOrder(null)
      orderRef.current = null
    }
  }

  useEffect(() => {
    const onMove = (e) => {
      const press = pressRef.current
      if (!press || e.pointerId !== press.pointerId) return
      const dx = e.clientX - press.startX
      const dy = e.clientY - press.startY
      const dist = Math.hypot(dx, dy)

      if (!press.started) {
        if (press.pointerType === 'touch') {
          if (dist > TOUCH_SLOP) finish(false)
          return
        }
        if (dist > MOUSE_DRAG_THRESHOLD) startDrag(press, e.clientX, e.clientY)
        else return
      }

      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
      updateHover(press.key, e.clientX, e.clientY)
    }
    const onUp = (e) => {
      if (pressRef.current && e.pointerId === pressRef.current.pointerId) finish(true)
    }
    const onCancel = (e) => {
      if (pressRef.current && e.pointerId === pressRef.current.pointerId) finish(false)
    }
    const onTouchMove = (e) => {
      if (pressRef.current?.started) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
    }
  })

  const onPointerDown = (e, key) => {
    if (e.button !== undefined && e.button !== 0) return
    if (e.target.closest('button')) return
    if (items.length < 2) return
    clearTimeout(pressRef.current?.timer)
    const press = {
      key,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      timer: null,
    }
    pressRef.current = press
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      setPressKey(key)
      press.timer = setTimeout(() => {
        if (pressRef.current === press) startDrag(press, press.startX, press.startY)
      }, LONG_PRESS_MS)
    }
  }

  const moveByKeyboard = (from, delta) => {
    const to = from + delta
    if (to < 0 || to >= items.length) return
    onReorder(moveItem(items, from, to))
    requestAnimationFrame(() => cardRefs.current.get(to)?.focus())
  }

  return (
    <>
      <div className={`vehicle-thumb-grid${dragKey !== null ? ' is-sorting' : ''}`}>
        {displayOrder.map((key, position) => (
          <div
            key={key}
            ref={(el) => {
              if (el) cardRefs.current.set(key, el)
              else cardRefs.current.delete(key)
            }}
            className={`vehicle-thumb-card is-sortable${dragKey === key ? ' is-placeholder' : ''}${
              pressKey === key ? ' is-pressing' : ''
            }`}
            tabIndex={items.length > 1 ? 0 : undefined}
            aria-label={`${altPrefix} ${position + 1}${position === 0 ? ' (main)' : ''}. Use left and right arrow keys to reorder.`}
            onPointerDown={(e) => onPointerDown(e, key)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (dragKey !== null) return
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                moveByKeyboard(key, -1)
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                moveByKeyboard(key, 1)
              }
            }}
          >
            <img src={items[key]} alt="" draggable={false} />
            <button
              type="button"
              className="vehicle-thumb-remove"
              aria-label={`Remove ${altPrefix.toLowerCase()} ${position + 1}`}
              onClick={() => onRemove(key)}
            >
              ×
            </button>
            {position === 0 ? <span className="vehicle-thumb-badge">Main</span> : null}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <p className="vehicle-thumb-hint">
          Long-press (or click and drag) a photo to reorder. The first photo is the main thumbnail.
        </p>
      ) : null}
      {ghost
        ? createPortal(
            <div
              className="vehicle-thumb-ghost"
              style={{
                width: ghost.width,
                height: ghost.height,
                transform: `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0)`,
              }}
              aria-hidden="true"
            >
              <img src={ghost.src} alt="" draggable={false} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
