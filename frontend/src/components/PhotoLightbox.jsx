import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function PhotoLightbox({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [photo, onClose])

  if (!photo?.src) return null

  return createPortal(
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={photo.label || 'Photo'} onClick={onClose}>
      <div className="photo-lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="photo-lightbox-title">{photo.label || 'Photo'}</span>
        <div className="photo-lightbox-actions">
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
      <img
        className="photo-lightbox-img"
        src={photo.src}
        alt={photo.label || 'Photo'}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}
