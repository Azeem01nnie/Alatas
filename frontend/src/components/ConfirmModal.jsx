import { useEffect, useState } from 'react'

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  secondaryLabel = '',
  danger = false,
  hideCancel = false,
  confirmDisabled = false,
  countdownSeconds = 0,
  children,
  onConfirm,
  onCancel,
  onSecondary,
}) {
  const [remaining, setRemaining] = useState(() =>
    countdownSeconds > 0 ? Math.ceil(countdownSeconds) : 0,
  )

  useEffect(() => {
    if (!(countdownSeconds > 0)) {
      setRemaining(0)
      return undefined
    }
    setRemaining(Math.ceil(countdownSeconds))
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [countdownSeconds, title])

  const waiting = remaining > 0
  const label = waiting ? `${confirmLabel} (${remaining})` : confirmLabel

  return (
    <div
      className="modal-overlay confirm-modal-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="modal-panel confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="modal-title">
          {title}
        </h3>
        {message ? <p className="confirm-message">{message}</p> : null}
        {children ? <div className="confirm-modal-body">{children}</div> : null}
        <div className="modal-actions">
          {!hideCancel && (
            <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className="btn-outline"
              disabled={confirmDisabled || waiting}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={danger ? 'btn-primary btn-danger-solid' : 'btn-primary'}
            disabled={confirmDisabled || waiting}
            onClick={onConfirm}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  )
}
