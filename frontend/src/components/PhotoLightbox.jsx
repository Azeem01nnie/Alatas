import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MIN_ZOOM = 1
const MAX_ZOOM = 6
const STEP = 0.5

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export default function PhotoLightbox({ photo, onClose }) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const stageRef = useRef(null)
  const pointers = useRef(new Map())
  const dragStart = useRef(null)
  const pinchStart = useRef(null)
  const lastTap = useRef(0)
  const moved = useRef(false)

  const reset = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    reset()
    setEnhanced(false)
  }, [photo?.src, reset])

  const applyZoom = useCallback((next) => {
    const z = clampZoom(next)
    setZoom(z)
    if (z === 1) setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (!photo) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') setZoom((z) => clampZoom(z + STEP))
      else if (e.key === '-' || e.key === '_') {
        setZoom((z) => {
          const n = clampZoom(z - STEP)
          if (n === 1) setOffset({ x: 0, y: 0 })
          return n
        })
      } else if (e.key === '0') reset()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [photo, onClose, reset])

  useEffect(() => {
    const el = stageRef.current
    if (!el || !photo) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setZoom((z) => {
        const n = clampZoom(z * factor)
        if (n === 1) setOffset({ x: 0, y: 0 })
        return n
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [photo])

  if (!photo?.src) return null

  const onPointerDown = (e) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      dragStart.current = null
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
      setDragging(zoom > 1)
    }
  }

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const n = clampZoom((pinchStart.current.zoom * dist) / Math.max(pinchStart.current.dist, 1))
      setZoom(n)
      if (n === 1) setOffset({ x: 0, y: 0 })
      moved.current = true
      return
    }
    const start = dragStart.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true
    if (zoom > 1) setOffset({ x: start.ox + dx, y: start.oy + dy })
  }

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      dragStart.current = null
      setDragging(false)
      if (!moved.current) {
        const now = Date.now()
        if (now - lastTap.current < 300) {
          if (zoom > 1) reset()
          else applyZoom(2.5)
          lastTap.current = 0
        } else {
          lastTap.current = now
        }
      }
    }
  }

  const percent = Math.round(zoom * 100)

  return createPortal(
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.label || 'Photo'}
      onClick={onClose}
    >
      <svg className="photo-lightbox-defs" aria-hidden="true" focusable="false">
        <filter id="photo-lightbox-sharpen">
          <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" />
        </filter>
      </svg>
      <div className="photo-lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="photo-lightbox-title">{photo.label || 'Photo'}</span>
        <div className="photo-lightbox-actions">
          <button
            type="button"
            className={`photo-lightbox-btn${enhanced ? ' is-active' : ''}`}
            aria-pressed={enhanced}
            onClick={() => setEnhanced((v) => !v)}
            title="Sharpen and boost contrast for easier reading"
          >
            {enhanced ? 'Enhanced' : 'Enhance'}
          </button>
          <a
            className="photo-lightbox-btn"
            href={photo.src}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            Open original
          </a>
          <button type="button" className="photo-lightbox-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`photo-lightbox-stage${zoom > 1 ? ' is-zoomed' : ''}${dragging ? ' is-dragging' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          className="photo-lightbox-img"
          src={photo.src}
          alt={photo.label || 'Photo'}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            filter: enhanced ? 'url(#photo-lightbox-sharpen) contrast(1.12) brightness(1.03) saturate(1.05)' : 'none',
          }}
        />
      </div>

      <div className="photo-lightbox-zoom" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="photo-lightbox-btn"
          onClick={() => applyZoom(zoom - STEP)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="photo-lightbox-btn photo-lightbox-zoom-level"
          onClick={reset}
          title="Reset zoom"
        >
          {percent}%
        </button>
        <button
          type="button"
          className="photo-lightbox-btn"
          onClick={() => applyZoom(zoom + STEP)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>,
    document.body,
  )
}
