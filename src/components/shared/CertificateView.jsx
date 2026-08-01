import { logo } from '../../assets'
import { defaultCertDetails, presentedLine, splitCertTitle } from './certificateHelpers'

function CornerFlourish({ position }) {
  const isBl = position === 'bl'
  return (
    <svg
      className={`certificate__flourish certificate__flourish--${position}`}
      viewBox="0 0 220 160"
      aria-hidden="true"
    >
      <path
        className="certificate__flourish-path certificate__flourish-path--gold"
        d={isBl
          ? 'M12 148 C48 120, 70 90, 88 52 C102 28, 130 18, 168 22'
          : 'M208 12 C172 40, 150 70, 132 108 C118 132, 90 142, 52 138'}
        fill="none"
      />
      <path
        className="certificate__flourish-path certificate__flourish-path--crimson"
        d={isBl
          ? 'M28 148 C60 128, 82 102, 98 68 C112 42, 138 34, 176 38'
          : 'M192 12 C160 32, 138 58, 122 92 C108 118, 82 126, 44 122'}
        fill="none"
      />
      <path
        className="certificate__flourish-path certificate__flourish-path--soft"
        d={isBl
          ? 'M44 148 C72 134, 92 114, 106 84 C118 58, 144 50, 180 54'
          : 'M176 12 C148 26, 128 46, 114 76 C102 102, 76 110, 40 106'}
        fill="none"
      />
      <circle className="certificate__flourish-dot" cx={isBl ? 168 : 52} cy={isBl ? 22 : 138} r="3.2" />
      <circle className="certificate__flourish-dot certificate__flourish-dot--sm" cx={isBl ? 176 : 44} cy={isBl ? 38 : 122} r="2" />
    </svg>
  )
}

function BrandSeal() {
  return (
    <svg className="certificate__seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="rafSealGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0d78c" />
          <stop offset="45%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6d12" />
        </linearGradient>
        <linearGradient id="rafSealCrimson" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#d64545" />
          <stop offset="100%" stopColor="#7a0b12" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="url(#rafSealGold)" strokeWidth="3.5" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="url(#rafSealGold)" strokeWidth="1.25" strokeDasharray="2 3" />
      <circle cx="60" cy="60" r="44" fill="#fffdf9" stroke="#af101a" strokeWidth="1.5" />
      <path
        d="M60 78 C48 68, 40 60, 40 50 C40 43, 45 38, 52 38 C56 38, 59 40, 60 44 C61 40, 64 38, 68 38 C75 38, 80 43, 80 50 C80 60, 72 68, 60 78 Z"
        fill="url(#rafSealCrimson)"
      />
      <text x="60" y="96" textAnchor="middle" className="certificate__seal-text">RAF CEBU</text>
    </svg>
  )
}

/**
 * Premium landscape certificate preview — Rise Above Foundation Cebu branding.
 * Print / PDF uses the matching layout in printCertificate().
 */
export default function CertificateView({ cert }) {
  const { main, sub } = splitCertTitle(cert?.type)
  const details = defaultCertDetails(cert)
  const signName = cert?.signatoryName || 'Maria Dela Cruz'
  const signTitle = cert?.signatoryTitle || 'Executive Director'

  return (
    <div className="certificate">
      <div className="certificate__frame">
        <div className="certificate__frame-inner">
          <CornerFlourish position="tl" />
          <CornerFlourish position="br" />

          <header className="certificate__brand">
            <img src={logo} alt="Rise Above Foundation Cebu" className="certificate__logo" />
            <div className="certificate__brand-text">
              <p className="certificate__org">Rise Above Foundation</p>
              <p className="certificate__org-sub">Cebu, Philippines</p>
            </div>
          </header>

          <div className="certificate__heading">
            <h1 className="certificate__main">{main}</h1>
            <p className="certificate__sub">{sub}</p>
          </div>

          <p className="certificate__presented">{presentedLine(cert)}</p>
          <p className="certificate__recipient">{cert?.recipient || '—'}</p>

          <div className="certificate__ornament" aria-hidden="true">
            <span className="certificate__ornament-dot" />
            <span className="certificate__ornament-line" />
            <span className="certificate__ornament-diamond" />
            <span className="certificate__ornament-line" />
            <span className="certificate__ornament-dot" />
          </div>

          <p className="certificate__details">{details}</p>

          <div className="certificate__meta">
            {cert?.reference && (
              <div className="certificate__meta-item">
                <span>Reference</span>
                <strong>{cert.reference}</strong>
              </div>
            )}
            <div className="certificate__meta-item">
              <span>Date Issued</span>
              <strong>{cert?.date || '—'}</strong>
            </div>
            <div className="certificate__meta-item">
              <span>Certificate No.</span>
              <strong>{cert?.id || '—'}</strong>
            </div>
          </div>

          <footer className="certificate__footer">
            <div className="certificate__sign">
              <div className="certificate__sign-line" />
              <p className="certificate__sign-name">{signName}</p>
              <p className="certificate__sign-title">{signTitle}</p>
            </div>

            <div className="certificate__seal-wrap">
              <BrandSeal />
            </div>

            <div className="certificate__sign">
              <div className="certificate__sign-line" />
              <p className="certificate__sign-name">Rise Above Foundation</p>
              <p className="certificate__sign-title">Authorized Signatory</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
