import { Link } from 'react-router-dom'
import { PRIVACY_POLICY, PrivacyPolicyBody } from '../content/legalPolicies'

export default function PrivacyPolicyPage() {
  return (
    <div className="page legal-page">
      <section className="page-hero">
        <div className="container">
          <h1>{PRIVACY_POLICY.title}</h1>
          <p>{PRIVACY_POLICY.subtitle}</p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow legal-content">
          <PrivacyPolicyBody />
          <p><Link to="/login">← Back to Log In</Link></p>
        </div>
      </section>
    </div>
  )
}
