import { logo } from '../../assets'

/**
 * Professional certificate layout used for on-screen preview.
 * Printing/downloading uses printCertificate() which renders the same design
 * in a standalone window.
 */
export default function CertificateView({ cert }) {
  const isReceipt = cert.type === 'Official Receipt'

  return (
    <div className="certificate">
      <div className="certificate__border">
        <div className="certificate__inner">
          <img src={logo} alt="Rise Above Foundation" className="certificate__logo" />
          <h1 className="certificate__org">Rise Above Foundation</h1>
          <p className="certificate__org-sub">Cebu, Philippines · riseabovefoundation.org</p>

          <h2 className="certificate__title">{cert.type || 'Certificate of Donation'}</h2>
          <div className="certificate__rule" />

          <p className="certificate__presented">
            {isReceipt ? 'This official receipt is issued to' : 'This certificate is proudly presented to'}
          </p>
          <p className="certificate__recipient">{cert.recipient}</p>

          <p className="certificate__details">
            {cert.details ||
              (isReceipt
                ? 'In acknowledgment of the donation received by Rise Above Foundation.'
                : 'In grateful recognition of your generous support, which uplifts communities and brings hope to families in need.')}
          </p>

          <div className="certificate__meta">
            {cert.reference && <span>Reference: <strong>{cert.reference}</strong></span>}
            <span>Date Issued: <strong>{cert.date || '—'}</strong></span>
            <span>Certificate No: <strong>{cert.id}</strong></span>
          </div>

          <div className="certificate__signature">
            <div className="certificate__sign-line" />
            <p className="certificate__sign-name">{cert.signatoryName || 'Maria Dela Cruz'}</p>
            <p className="certificate__sign-title">{cert.signatoryTitle || 'Executive Director'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
