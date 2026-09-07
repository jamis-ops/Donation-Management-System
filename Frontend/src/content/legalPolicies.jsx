/** Shared legal policy copy for pages and modal dialogs. */

export const PRIVACY_POLICY = {
  id: 'privacy',
  title: 'Data Privacy Policy',
  subtitle: 'How Rise Above Foundation Cebu collects, uses, and protects your information.',
}

export const TERMS_CONDITIONS = {
  id: 'terms',
  title: 'Terms & Conditions',
  subtitle: 'Please read these terms before creating an account or using our services.',
}

export function PrivacyPolicyBody() {
  return (
    <>
      <p>
        Rise Above Foundation Cebu, Inc. (“we”, “our”, “us”) respects your privacy. This policy explains
        what personal data we collect when you create an account, donate, volunteer, or request assistance,
        and how that data is used.
      </p>
      <h3>Information we collect</h3>
      <ul>
        <li>Identity and contact details (name, email, phone, address, organization)</li>
        <li>Account credentials (stored as a secure password hash)</li>
        <li>Donation and assistance records you submit</li>
        <li>Uploaded files such as donation proofs or distribution documentation</li>
      </ul>
      <h3>How we use your information</h3>
      <ul>
        <li>To create and manage your account</li>
        <li>To process donations, volunteer applications, and beneficiary requests</li>
        <li>To communicate about verification, delivery, and program updates</li>
        <li>To meet legal, audit, and reporting obligations</li>
      </ul>
      <h3>Sharing</h3>
      <p>
        We do not sell your personal data. Information may be shared with authorized staff, partner
        organizations involved in program delivery, or when required by law.
      </p>
      <h3>Your rights</h3>
      <p>
        You may request access, correction, or deletion of your personal data by contacting
        {' '}<a href="mailto:riseabove@riseabove-cebu.org">riseabove@riseabove-cebu.org</a>.
      </p>
    </>
  )
}

export function TermsConditionsBody() {
  return (
    <>
      <p>
        By creating an account or using the Rise Above Foundation Cebu donation system, you agree to
        these Terms &amp; Conditions.
      </p>
      <h3>Accounts</h3>
      <ul>
        <li>You must provide accurate information when registering.</li>
        <li>You are responsible for keeping your login credentials confidential.</li>
        <li>Accounts may be suspended for misuse, fraud, or policy violations.</li>
      </ul>
      <h3>Donations &amp; assistance</h3>
      <ul>
        <li>Submitted donations are subject to verification by foundation staff.</li>
        <li>Assistance requests are reviewed based on need, available resources, and program guidelines.</li>
        <li>Uploaded proofs must be truthful and relevant.</li>
      </ul>
      <h3>Acceptable use</h3>
      <p>
        You agree not to misuse the platform, upload harmful files, impersonate others, or interfere
        with system operations.
      </p>
      <h3>Contact</h3>
      <p>
        Questions about these terms may be sent to
        {' '}<a href="mailto:riseabove@riseabove-cebu.org">riseabove@riseabove-cebu.org</a>.
      </p>
    </>
  )
}
