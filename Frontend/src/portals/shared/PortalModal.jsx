import { createPortal } from 'react-dom'

/**
 * Mount portal-role dialogs directly under document.body so fixed overlays are
 * never constrained by animated/scrollable page containers.
 */
export default function PortalModal({ children }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="staff-modal-portal-root" data-staff-modal-root="true">
      {children}
    </div>,
    document.body,
  )
}
