export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  hideCancel = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}) {
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
          <button
            type="button"
            className={danger ? 'btn-primary btn-danger-solid' : 'btn-primary'}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
