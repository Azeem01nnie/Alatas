import { useEffect, useRef, useState } from 'react'
import { CONTRACT_TERMS, LIABILITY_CLAUSE } from '../data/contract'

export default function StepTerms({ accepted, onAcceptedChange, error }) {
  const [expanded, setExpanded] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const boxRef = useRef(null)

  const checkScrollEnd = () => {
    const el = boxRef.current
    if (!el) return
    const canScroll = el.scrollHeight > el.clientHeight + 4
    if (!canScroll || el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setScrolledToEnd(true)
    }
  }

  useEffect(() => {
    if (!expanded) {
      setScrolledToEnd(true)
      return undefined
    }
    // Re-check when opened; keep unlocked if already reached end before
    const id = requestAnimationFrame(checkScrollEnd)
    window.addEventListener('resize', checkScrollEnd)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', checkScrollEnd)
    }
  }, [expanded])

  const canAccept = scrolledToEnd || !expanded

  return (
    <section className="step-panel">
      <h2 className="step-title">Terms &amp; Conditions</h2>
      <p className="step-subtitle">
        A printed copy is available at the counter. Open this only when the customer wants to read
        the full terms on screen, then confirm below.
      </p>

      <div className={`terms-accordion${expanded ? ' is-open' : ' is-collapsed'}`}>
        <button
          type="button"
          className="terms-accordion-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="terms-panel"
        >
          <span className="terms-accordion-copy">
            <span className="terms-accordion-title">Rental Agreement</span>
            <span className="terms-accordion-meta">
              {expanded ? 'Hide terms' : 'Show terms'} · Printed version available
            </span>
          </span>
          <span className="terms-accordion-chevron" aria-hidden="true">
            {expanded ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 15l6-6 6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </span>
        </button>

        {expanded && (
          <div
            id="terms-panel"
            className="terms-scroll"
            ref={boxRef}
            onScroll={checkScrollEnd}
            tabIndex={0}
            role="region"
            aria-label="Terms and conditions"
          >
            <h3>Rental Agreement</h3>
            <ol>
              {CONTRACT_TERMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            {!scrolledToEnd && (
              <p className="terms-scroll-hint">Keep scrolling to unlock the confirmation…</p>
            )}
          </div>
        )}
      </div>

      <label className={`terms-check${!canAccept ? ' locked' : ''}${error ? ' has-error' : ''}`}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={!canAccept}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span>{LIABILITY_CLAUSE}</span>
      </label>

      {expanded && !scrolledToEnd && (
        <span className="error-msg">
          Finish scrolling the terms, or collapse this panel if using the printed copy.
        </span>
      )}
      {error && <span className="error-msg">{error}</span>}
    </section>
  )
}
