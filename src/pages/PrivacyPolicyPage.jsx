import { Link } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  return (
    <div className="page legal-page">
      <section className="page-hero">
        <div className="container">
          <h1>Data Privacy Policy</h1>
          <p>How Rise Above Foundation Cebu collects, uses, and protects your information.</p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow legal-content">
          <p>
            Rise Above Foundation Cebu, Inc. (“we”, “our”, “us”) respects your privacy. This policy explains
            what personal data we collect when you create an account, donate, volunteer, or request assistance,
            and how that data is used.
          </p>
          <h2>Information we collect</h2>
          <ul>
            <li>Identity and contact details (name, email, phone, address, organization)</li>
            <li>Account credentials (stored as a secure password hash)</li>
            <li>Donation and assistance records you submit</li>
            <li>Uploaded files such as donation proofs or distribution documentation</li>
          </ul>
          <h2>How we use your information</h2>
          <ul>
            <li>To create and manage your account</li>
            <li>To process donations, volunteer applications, and beneficiary requests</li>
            <li>To communicate about verification, delivery, and program updates</li>
            <li>To meet legal, audit, and reporting obligations</li>
          </ul>
          <h2>Sharing</h2>
          <p>
            We do not sell your personal data. Information may be shared with authorized staff, partner
            organizations involved in program delivery, or when required by law.
          </p>
          <h2>Your rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data by contacting
            {' '}<a href="mailto:riseabove@riseabove-cebu.org">riseabove@riseabove-cebu.org</a>.
          </p>
          <p><Link to="/register">← Back to Sign Up</Link></p>
        </div>
      </section>
    </div>
  )
}
