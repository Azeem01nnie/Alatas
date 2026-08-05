import { useEffect, useRef, useState } from 'react'
import { CONTRACT_TERMS, LIABILITY_CLAUSE } from '../data/contract'

export default function StepTerms({ accepted, onChange, error }) {
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
    checkScrollEnd()
    window.addEventListener('resize', checkScrollEnd)
    return () => window.removeEventListener('resize', checkScrollEnd)
  }, [])

  return (
    <section className="step-panel">
      <h2 className="step-title">Terms &amp; Conditions</h2>
      <p className="step-subtitle">
        Scroll through the full agreement. The checkbox unlocks when you reach the end.
      </p>

      <div
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

      <label
        className={`terms-check${!scrolledToEnd ? ' locked' : ''}${error ? ' has-error' : ''}`}
      >
        <input
          type="checkbox"
          checked={accepted}
          disabled={!scrolledToEnd}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{LIABILITY_CLAUSE}</span>
      </label>

      {!scrolledToEnd && (
        <span className="error-msg">Finish scrolling the terms before you can check this box.</span>
      )}
      {error && <span className="error-msg">{error}</span>}
    </section>
  )
}
