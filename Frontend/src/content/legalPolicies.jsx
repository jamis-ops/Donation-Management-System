/** Shared legal policy copy for pages and modal dialogs. */

export const PRIVACY_POLICY = {
  id: 'privacy',
  title: 'Data Privacy Policy (Republic Act No. 10173)',
  subtitle: 'How Rise Above Foundation Cebu, Inc. collects, uses, stores, protects, and processes personal data.',
}

export const TERMS_CONDITIONS = {
  id: 'terms',
  title: 'Terms & Conditions',
  subtitle: 'Please read these terms before creating an account or using our services.',
}

export function PrivacyPolicyBody() {
  return (
    <>
      <p><strong>Last updated: September 28, 2026</strong></p>
      <p>
        Rise Above Foundation Cebu, Inc. (“Rise Above”, “we”, “our”, or “us”) respects your right to
        privacy. This policy applies to the Donation Management System and explains how we process
        personal data belonging to donors, volunteers and interns, staff and administrators, barangay
        representatives, assistance beneficiaries, and other system users.
      </p>
      <h3>1. Legal basis and personal information controller</h3>
      <p>
        This policy is based on <strong>Republic Act No. 10173, the Data Privacy Act of 2012</strong>, its
        Implementing Rules and Regulations, and applicable issuances of the National Privacy Commission
        (“NPC”). For the system records described in this policy, Rise Above Foundation Cebu, Inc. acts as
        the personal information controller.
      </p>
      <p>
        The Act requires personal-data processing to follow the principles of transparency, legitimate
        purpose, and proportionality. You may read the{' '}
        <a href="https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/" target="_blank" rel="noreferrer">
          official text of Republic Act No. 10173
        </a>.
      </p>

      <h3>2. Personal data we collect</h3>
      <p>Depending on how you use the system, we may collect and process:</p>
      <ul>
        <li>Identity and contact details, including name, email address, phone number, address, country, organization or institution, and representative position;</li>
        <li>Account and consent records, including role, account status, password hash, and the date and time when policies were accepted;</li>
        <li>Donation information, including donation type, amount or donated goods, payment channel and reference, donor messages, receipts, and uploaded proof of donation;</li>
        <li>Volunteer or intern information, including selected programs, skills, availability, institution, experience, and an uploaded résumé when provided;</li>
        <li>Staff information entered into the system, such as contact details, birth date, address, emergency-contact details, assigned role, and operational tasks;</li>
        <li>Barangay and assistance information, including representative details, affected-family counts, requested goods or services, priority and calamity information, request notes, and delivery or receipt records;</li>
        <li>Operational records produced while using the system, such as verification results, allocation and distribution progress, notifications, certificates, and uploaded delivery documentation.</li>
      </ul>
      <p>
        Some uploaded documents or free-text fields may contain sensitive personal information. Please
        provide only information that is relevant and necessary for the donation, application, assistance
        request, employment, or program activity concerned.
      </p>

      <h3>3. How we collect personal data</h3>
      <p>
        We collect data directly from you when you submit a donation, application, registration,
        assistance request, uploaded document, or account update. Authorized personnel may also enter or
        update records during verification, inventory intake, allocation, distribution, account
        administration, and program operations. The system generates related status, notification, and
        transaction records as those workflows progress.
      </p>

      <h3>4. Purposes of processing</h3>
      <p>We process personal data only as reasonably necessary to:</p>
      <ul>
        <li>Create, authenticate, secure, and administer user accounts;</li>
        <li>Receive, verify, acknowledge, allocate, track, and report donations and donated goods;</li>
        <li>Review volunteer or intern applications and coordinate approved program participation;</li>
        <li>Register partner barangays, assess assistance requests, manage inventory, and plan and confirm distributions;</li>
        <li>Communicate about applications, verification, credentials, requests, deliveries, certificates, and other service updates;</li>
        <li>Prevent misuse, investigate errors or security incidents, and maintain the integrity of system operations; and</li>
        <li>Comply with applicable legal, regulatory, accounting, and reporting obligations.</li>
      </ul>

      <h3>5. Lawful basis, consent, and withdrawal</h3>
      <p>
        Where consent is the applicable basis, selecting the privacy checkbox is an electronic indication
        that you have read this policy and agree to the stated processing. Under the Act, consent must be
        freely given, specific, and informed. Depending on the activity, processing may also be necessary
        to provide a requested service or perform an agreement, comply with a legal obligation, protect
        vital interests, or pursue a legitimate interest that is not overridden by your rights. Sensitive
        personal information is processed only when a basis permitted by Section 13 of the Act applies.
      </p>
      <p>
        You may withdraw consent for future consent-based processing by contacting us. Withdrawal does
        not invalidate processing already performed lawfully and may not prevent processing that is
        required or permitted on another legal basis. If required information is not provided or consent
        is withdrawn, we may be unable to complete the relevant registration, donation, application, or
        assistance workflow.
      </p>

      <h3>6. Automated assistance</h3>
      <p>
        For uploaded donation proofs, the system may use automated tools to extract details such as an
        amount, payment reference, or payment channel and to flag inconsistencies for review. A donation
        remains subject to authorized staff verification; an automated extraction is not, by itself, a
        final approval or rejection.
      </p>

      <h3>7. Disclosure and service providers</h3>
      <p>
        We do not sell personal data. Access is limited according to system roles and operational need.
        We may disclose only the information reasonably necessary to authorized Rise Above personnel,
        the relevant barangay or program partners involved in fulfilling a request or distribution, and
        service providers that support functions such as system hosting, storage, or email delivery. We
        may also disclose information when required by law, lawful process, or a competent authority.
        Service providers acting for us must process data only for the authorized purpose and must provide
        appropriate protection consistent with applicable data-privacy requirements.
      </p>

      <h3>8. Storage and retention</h3>
      <p>
        Personal data is stored in the system database and, where applicable, in controlled storage for
        uploaded donation proofs, résumés, distribution documents, and similar records. We retain records
        only for as long as reasonably necessary for the purpose for which they were collected, for an
        active account or transaction, and for applicable legal, accounting, reporting, dispute, or
        security requirements. When retention is no longer justified, records are securely deleted,
        destroyed, blocked, or anonymized as appropriate.
      </p>

      <h3>9. Privacy and security</h3>
      <p>
        We use reasonable and appropriate organizational, physical, and technical safeguards intended to
        preserve the confidentiality, integrity, and availability of personal data and protect it from
        accidental loss, unauthorized access, alteration, disclosure, misuse, or destruction. System
        safeguards include account authentication, role-based access restrictions, password hashing, and
        access controls for uploaded records. No method of electronic storage or transmission is entirely
        risk-free, so safeguards are reviewed in proportion to the nature of the data and the risks of the
        processing.
      </p>

      <h3>10. Your rights as a data subject</h3>
      <p>Subject to the conditions and limitations provided by law, you may exercise the right to:</p>
      <ul>
        <li>Be informed about the collection and processing of your personal data;</li>
        <li>Request reasonable access to personal data processed about you;</li>
        <li>Object to processing in applicable circumstances;</li>
        <li>Dispute inaccurate or erroneous data and request its correction;</li>
        <li>Request erasure or blocking when the legal conditions are met;</li>
        <li>Obtain a copy of data in an electronic or structured format when data portability applies;</li>
        <li>Seek indemnification for damage caused by inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of personal data; and</li>
        <li>File a complaint with the National Privacy Commission.</li>
      </ul>

      <h3>11. Requests, questions, and complaints</h3>
      <p>
        To ask a privacy question or request access, correction, objection, withdrawal of consent,
        erasure, blocking, or portability, contact Rise Above Foundation Cebu, Inc. at{' '}
        <a href="mailto:riseabove@riseabove-cebu.org">riseabove@riseabove-cebu.org</a>, call{' '}
        <a href="tel:+63322551063">+63 32 255 1063</a>, or write to 252 I. Limkakeng St., Happy Valley
        Subd., Guadalupe, 6000 Cebu City, Philippines. We may ask for information needed to verify your
        identity and authority before acting on a request.
      </p>
      <p>
        You may also learn about data-subject rights and complaint procedures through the{' '}
        <a href="https://privacy.gov.ph/data-subject-rights/" target="_blank" rel="noreferrer">
          National Privacy Commission
        </a>.
      </p>

      <h3>12. Policy updates</h3>
      <p>
        We may update this policy when system practices or applicable requirements change. Material
        changes will be presented through the system or another appropriate notice before they apply when
        notice or renewed consent is required.
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
