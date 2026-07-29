import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  PRIVACY_POLICY,
  TERMS_CONDITIONS,
  PrivacyPolicyBody,
  TermsConditionsBody,
} from '../../content/legalPolicies'

const DOCS = {
  privacy: {
    ...PRIVACY_POLICY,
    Body: PrivacyPolicyBody,
  },
  terms: {
    ...TERMS_CONDITIONS,
    Body: TermsConditionsBody,
  },
}

/**
 * Scrollable legal policy dialog. Renders via portal so it works above nested forms/modals.
 * @param {'privacy' | 'terms' | null} doc
 */
export default function LegalPolicyModal({ doc, onClose }) {
  const active = doc && DOCS[doc] ? DOCS[doc] : null

  useEffect(() => {
    if (!active) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [active, onClose])

  if (!active || typeof document === 'undefined') return null

  const Body = active.Body

  return createPortal(
    <div
      className="legal-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="legal-modal__header">
          <div className="legal-modal__heading">
            <p className="legal-modal__eyebrow">Legal</p>
            <h2 id="legal-modal-title">{active.title}</h2>
            {active.subtitle ? <p className="legal-modal__subtitle">{active.subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="legal-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="legal-modal__body legal-content">
          <Body />
        </div>

        <footer className="legal-modal__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
