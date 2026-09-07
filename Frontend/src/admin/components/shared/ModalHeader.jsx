import { X } from 'lucide-react'

/**
 * Shared modal chrome: title + visible X close button.
 * Use inside an overlay that already handles click-outside close.
 */
export default function ModalHeader({ title, onClose, subtitle }) {
  return (
    <div className="admin-modal__header">
      <div className="admin-modal__header-text">
        <h2>{title}</h2>
        {subtitle ? <p className="admin-modal__subtitle">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        className="admin-modal__close"
        onClick={onClose}
        aria-label="Close"
        title="Close"
      >
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
