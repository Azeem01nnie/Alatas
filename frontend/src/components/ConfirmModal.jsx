export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
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
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn-outline confirm-cancel-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-primary btn-danger-solid' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
