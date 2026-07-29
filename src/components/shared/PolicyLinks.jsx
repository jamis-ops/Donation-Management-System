import { useState } from 'react'
import LegalPolicyModal from './LegalPolicyModal'

/**
 * Inline “Data Privacy Policy” / “Terms & Conditions” controls that open modal dialogs
 * instead of navigating away from the current form.
 */
export default function PolicyLinks({
  privacyLabel = 'Data Privacy Policy',
  termsLabel = 'Terms & Conditions',
  connector = ' and ',
}) {
  const [doc, setDoc] = useState(null)

  const open = (type) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDoc(type)
  }

  return (
    <>
      <button type="button" className="policy-link-btn" onClick={open('privacy')}>
        {privacyLabel}
      </button>
      {connector}
      <button type="button" className="policy-link-btn" onClick={open('terms')}>
        {termsLabel}
      </button>
      <LegalPolicyModal doc={doc} onClose={() => setDoc(null)} />
    </>
  )
}
