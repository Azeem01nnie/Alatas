import { useCallback, useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { CONTRACT_TERMS, LIABILITY_CLAUSE } from '../data/contract'

const PAD_HEIGHT = 180

export default function StepTerms({
  accepted,
  onAcceptedChange,
  signature,
  onSignatureChange,
  error,
  signatureError,
}) {
  const [expanded, setExpanded] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const boxRef = useRef(null)
  const frameRef = useRef(null)
  const sigRef = useRef(null)
  const [isEmpty, setIsEmpty] = useState(!signature)

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
    const id = requestAnimationFrame(checkScrollEnd)
    window.addEventListener('resize', checkScrollEnd)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', checkScrollEnd)
    }
  }, [expanded])

  /** Keep canvas bitmap size in sync with CSS box so strokes follow the cursor. */
  const syncCanvasSize = useCallback(() => {
    const pad = sigRef.current
    const frame = frameRef.current
    if (!pad || !frame) return

    const canvas = pad.getCanvas()
    const width = Math.max(1, Math.floor(frame.clientWidth))
    const height = Math.max(1, Math.floor(frame.clientHeight || PAD_HEIGHT))
    const ratio = Math.max(window.devicePixelRatio || 1, 1)

    const nextW = Math.floor(width * ratio)
    const nextH = Math.floor(height * ratio)
    if (canvas.width === nextW && canvas.height === nextH) return

    const snapshot = pad.isEmpty() ? null : pad.toDataURL('image/png')

    canvas.width = nextW
    canvas.height = nextH
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(ratio, ratio)

    if (snapshot) {
      try {
        pad.fromDataURL(snapshot, { width, height })
        setIsEmpty(false)
      } catch {
        /* ignore restore errors */
      }
    } else {
      pad.clear()
    }
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined

    const run = () => {
      requestAnimationFrame(syncCanvasSize)
    }
    run()

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null
    ro?.observe(frame)
    window.addEventListener('resize', run)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', run)
    }
  }, [syncCanvasSize])

  useEffect(() => {
    const canvas = sigRef.current
    if (!canvas || !signature) return
    try {
      if (canvas.isEmpty()) {
        const frame = frameRef.current
        const width = frame?.clientWidth || 640
        const height = frame?.clientHeight || PAD_HEIGHT
        canvas.fromDataURL(signature, { width, height })
        setIsEmpty(false)
      }
    } catch {
      /* ignore restore errors */
    }
  }, [signature])

  const canAccept = scrolledToEnd || !expanded

  const handleStrokeEnd = () => {
    const canvas = sigRef.current
    if (!canvas || canvas.isEmpty()) return
    const dataUrl = canvas.toDataURL('image/png')
    setIsEmpty(false)
    onSignatureChange(dataUrl)
    if (canAccept) onAcceptedChange(true)
  }

  const handleClear = () => {
    sigRef.current?.clear()
    setIsEmpty(true)
    onSignatureChange('')
    onAcceptedChange(false)
  }

  return (
    <section className="step-panel">
      <h2 className="step-title">Terms &amp; Conditions</h2>
      <p className="step-subtitle">
        A printed copy is available at the counter. Open this only when the customer wants to read
        the full terms on screen, then sign below to accept.
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
              {CONTRACT_TERMS.map((item, index) => (
                <li key={typeof item === 'string' ? item : item.title || index}>
                  {typeof item === 'string' ? (
                    item
                  ) : (
                    <>
                      <strong>{item.title}</strong>
                      <p className="terms-item-body">{item.body}</p>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {!scrolledToEnd && (
              <p className="terms-scroll-hint">Keep scrolling to unlock the confirmation…</p>
            )}
          </div>
        )}
      </div>

      <div className={`signature-block${!canAccept ? ' is-locked' : ''}`}>
        <div className="signature-block-head">
          <span className="field-label">Customer signature *</span>
          {!isEmpty && signature ? (
            <span className="signature-ok-pill">Signed</span>
          ) : (
            <span className="signature-pending-pill">Pending</span>
          )}
        </div>
        <p className="signature-block-note">
          Sign with finger, stylus, or mouse. Signing automatically accepts the terms
          {canAccept ? '' : ' (finish reading or collapse the terms first)'}.
        </p>

        <div
          className={`signature-pad${signatureError ? ' has-error' : ''}${!canAccept ? ' is-disabled' : ''}`}
        >
          <div className="signature-pad-frame" ref={frameRef} style={{ height: PAD_HEIGHT }}>
            <SignatureCanvas
              ref={sigRef}
              penColor="#111"
              minWidth={1.2}
              maxWidth={2.6}
              clearOnResize={false}
              canvasProps={{
                className: 'signature-pad-canvas',
              }}
              onEnd={handleStrokeEnd}
            />
            {isEmpty && !signature && (
              <span className="signature-pad-hint">Sign here</span>
            )}
          </div>
          <div className="signature-pad-bar">
            <span className={`signature-status${!isEmpty || signature ? ' is-signed' : ''}`}>
              {!isEmpty || signature ? 'Signature captured' : 'Awaiting signature'}
            </span>
            <button
              type="button"
              className="btn-ghost signature-clear"
              onClick={handleClear}
              disabled={!canAccept || (isEmpty && !signature)}
            >
              Clear / Re-sign
            </button>
          </div>
        </div>
        {signatureError && <span className="error-msg">{signatureError}</span>}
      </div>

      <label className={`terms-check${!canAccept ? ' locked' : ''}${error ? ' has-error' : ''}`}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={!canAccept || !signature}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          readOnly={Boolean(signature) && accepted}
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
