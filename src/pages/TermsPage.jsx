import { Link } from 'react-router-dom'
import { TERMS_CONDITIONS, TermsConditionsBody } from '../content/legalPolicies'

export default function TermsPage() {
  return (
    <div className="page legal-page">
      <section className="page-hero">
        <div className="container">
          <h1>{TERMS_CONDITIONS.title}</h1>
          <p>{TERMS_CONDITIONS.subtitle}</p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow legal-content">
          <TermsConditionsBody />
          <p><Link to="/login">← Back to Log In</Link></p>
        </div>
      </section>
    </div>
  )
}
