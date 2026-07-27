import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="page legal-page">
      <section className="page-hero">
        <div className="container">
          <h1>Terms &amp; Conditions</h1>
          <p>Please read these terms before creating an account or using our services.</p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow legal-content">
          <p>
            By creating an account or using the Rise Above Foundation Cebu donation system, you agree to
            these Terms &amp; Conditions.
          </p>
          <h2>Accounts</h2>
          <ul>
            <li>You must provide accurate information when registering.</li>
            <li>You are responsible for keeping your login credentials confidential.</li>
            <li>Accounts may be suspended for misuse, fraud, or policy violations.</li>
          </ul>
          <h2>Donations &amp; assistance</h2>
          <ul>
            <li>Submitted donations are subject to verification by foundation staff.</li>
            <li>Assistance requests are reviewed based on need, available resources, and program guidelines.</li>
            <li>Uploaded proofs must be truthful and relevant.</li>
          </ul>
          <h2>Acceptable use</h2>
          <p>
            You agree not to misuse the platform, upload harmful files, impersonate others, or interfere
            with system operations.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about these terms may be sent to
            {' '}<a href="mailto:riseabove@riseabove-cebu.org">riseabove@riseabove-cebu.org</a>.
          </p>
          <p><Link to="/login">← Back to Log In</Link></p>
        </div>
      </section>
    </div>
  )
}
