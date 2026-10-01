import { useEffect, useState } from 'react'
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import LegalPolicyModal from './LegalPolicyModal'
import Req from './Req'

/**
 * Required dual policy consent box for Terms & Conditions and Data Privacy Policy.
 * Checkboxes are disabled initially until the user clicks or visits each agreement document.
 * Once visited/opened, the checkbox is automatically enabled/allowed for checking.
 * The submit button remains disabled/gray until both checkboxes are checked.
 */
export default function PolicyConsentBox({
  acceptedTerms = false,
  onTermsChange,
  acceptedPrivacy = false,
  onPrivacyChange,
  title = 'Data Privacy & Terms Agreement',
  description = 'Please read and accept the Data Privacy Policy and Terms & Conditions before creating credentials.',
  actionLabel = 'create credentials',
}) {
  const [activeModal, setActiveModal] = useState(null) // 'privacy' | 'terms' | null
  const [reviewedTerms, setReviewedTerms] = useState(() => Boolean(acceptedTerms))
  const [reviewedPrivacy, setReviewedPrivacy] = useState(() => Boolean(acceptedPrivacy))

  useEffect(() => {
    if (acceptedTerms && !reviewedTerms) {
      setReviewedTerms(true)
    }
  }, [acceptedTerms, reviewedTerms])

  useEffect(() => {
    if (acceptedPrivacy && !reviewedPrivacy) {
      setReviewedPrivacy(true)
    }
  }, [acceptedPrivacy, reviewedPrivacy])

  const isBothAccepted = Boolean(acceptedTerms && acceptedPrivacy)

  const openModal = (type) => (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // Automatically allow/enable the checkbox when the user clicks or visits the document
    if (type === 'terms') {
      setReviewedTerms(true)
    } else if (type === 'privacy') {
      setReviewedPrivacy(true)
    }
    setActiveModal(type)
  }

  const handleReviewed = (type) => {
    if (type === 'terms') {
      setReviewedTerms(true)
    } else if (type === 'privacy') {
      setReviewedPrivacy(true)
    }
  }

  const handleCheckboxClick = (type) => (e) => {
    if (type === 'terms' && !reviewedTerms) {
      e.preventDefault()
      openModal('terms')(e)
    } else if (type === 'privacy' && !reviewedPrivacy) {
      e.preventDefault()
      openModal('privacy')(e)
    }
  }

  return (
    <div className={`policy-consent-box ${isBothAccepted ? 'policy-consent-box--accepted' : 'policy-consent-box--pending'}`}>
      <div className="policy-consent-box__header">
        <span className="policy-consent-box__icon" aria-hidden="true">
          {isBothAccepted ? <ShieldCheck size={18} /> : <Lock size={18} />}
        </span>
        <div className="policy-consent-box__header-text">
          <strong className="policy-consent-box__title">{title}</strong>
          <p className="policy-consent-box__sub">{description}</p>
        </div>
      </div>

      <div className="policy-consent-box__items">
        {/* 1. Terms & Conditions */}
        <label className="policy-consent-item">
          <input
            type="checkbox"
            className="policy-consent-item__checkbox"
            checked={Boolean(acceptedTerms)}
            disabled={!reviewedTerms}
            onClick={handleCheckboxClick('terms')}
            onChange={(e) => onTermsChange?.(e.target.checked)}
            required
          />
          <span className="policy-consent-item__label">
            <span>
              I have read and agree to the{' '}
              <button
                type="button"
                className="policy-link-btn"
                onClick={openModal('terms')}
                title="Click to view and review Terms & Conditions"
              >
                Terms & Conditions
              </button>
              <Req required />
            </span>
          </span>
        </label>

        {/* 2. Data Privacy Policy */}
        <label className="policy-consent-item">
          <input
            type="checkbox"
            className="policy-consent-item__checkbox"
            checked={Boolean(acceptedPrivacy)}
            disabled={!reviewedPrivacy}
            onClick={handleCheckboxClick('privacy')}
            onChange={(e) => onPrivacyChange?.(e.target.checked)}
            required
          />
          <span className="policy-consent-item__label">
            <span>
              I have read and agree to the{' '}
              <button
                type="button"
                className="policy-link-btn"
                onClick={openModal('privacy')}
                title="Click to view and review Data Privacy Policy"
              >
                Data Privacy Policy
              </button>
              <Req required />
            </span>
          </span>
        </label>
      </div>

      <div className="policy-consent-box__footer">
        {isBothAccepted ? (
          <span className="policy-consent-status policy-consent-status--ready">
            <CheckCircle2 size={14} />
            <span>Data Privacy Policy and Terms & Conditions accepted. Ready to {actionLabel}.</span>
          </span>
        ) : (
          <span className="policy-consent-status policy-consent-status--locked">
            <Lock size={14} />
            <span>
              {!reviewedTerms && !reviewedPrivacy
                ? `Click each policy to view and enable its checkbox, then check both to ${actionLabel}.`
                : !acceptedTerms || !acceptedPrivacy
                ? `Please check both agreements above to ${actionLabel}.`
                : 'Please complete both requirements above.'}
            </span>
          </span>
        )}
      </div>

      <LegalPolicyModal
        doc={activeModal}
        onClose={() => setActiveModal(null)}
        onReviewed={handleReviewed}
      />
    </div>
  )
}
