import React from 'react'
import {
  certBannerHeader,
  certSealRound,
  certGoldSeal,
  certSigFlemming,
} from '../../assets'
import {
  defaultCertDetails,
  presentedLine,
  splitCertTitle,
  resolveCertPhotoUrl,
  resolveCertSignatureUrl,
  CONTRIBUTION_PLACEHOLDER_SVG,
} from './certificateHelpers'

export default function CertificateView({ cert }) {
  const templateId = cert?.templateId || 'modern_classic'
  const photoLayout = cert?.photoLayout || 'none'
  const { main, sub } = splitCertTitle(cert?.type)
  const details = defaultCertDetails(cert)
  const signName = cert?.signatoryName || 'Flemming Hansen'
  const signTitle = cert?.signatoryTitle || 'CEO and Co-Founder'
  const location = cert?.location || 'Cebu City, Philippines'
  const certDate = cert?.date || cert?.certDate || 'September 25, 2026'

  // Resolve photo URL and fallback placeholder
  const rawPhotoSrc = resolveCertPhotoUrl(cert)
  const [photoError, setPhotoError] = React.useState(false)

  React.useEffect(() => {
    setPhotoError(false)
  }, [cert?.id, cert?.photoUrl, cert?.photoDisplayUrl])

  const showPhoto = photoLayout !== 'none'
  const photoSrc = (!photoError && rawPhotoSrc) ? rawPhotoSrc : CONTRIBUTION_PLACEHOLDER_SVG

  // Resolve signature URL
  const signatureSrc = resolveCertSignatureUrl(cert, certSigFlemming)

  return (
    <div className={`certificate certificate--${templateId} ${showPhoto ? `certificate--has-photo certificate--layout-${photoLayout}` : ''}`}>
      <div className="certificate__frame">
        <div className="certificate__frame-inner">
          {/* Full-Width Background Photo Layer with Glass Scrim for 'backdrop' layout */}
          {showPhoto && photoLayout === 'backdrop' && (
            <div className="certificate__backdrop-layer" aria-hidden="true">
              <img
                src={photoSrc}
                alt=""
                className="certificate__backdrop-img"
                onError={() => setPhotoError(true)}
              />
              <div className="certificate__backdrop-scrim" />
            </div>
          )}

          {/* Subtle Background Watermark Seal */}
          <div className="certificate__watermark" aria-hidden="true">
            <img src={certSealRound} alt="" />
          </div>

          {/* Corner flourish accents for classic / heritage styles */}
          {(templateId === 'modern_classic' || templateId === 'distinguished_heritage') && (
            <>
              <div className="certificate__corner certificate__corner--tl" />
              <div className="certificate__corner certificate__corner--tr" />
              <div className="certificate__corner certificate__corner--bl" />
              <div className="certificate__corner certificate__corner--br" />
            </>
          )}

          {/* Header Brand */}
          <header className="certificate__brand">
            {templateId === 'distinguished_heritage' ? (
              <div className="certificate__banner-wrap">
                <img
                  src={certBannerHeader}
                  alt="Rise Above Foundation Cebu, Inc."
                  className="certificate__banner-img"
                />
              </div>
            ) : (
              <div className="certificate__brand-row">
                <img
                  src={certSealRound}
                  alt="Rise Above Foundation Cebu"
                  className="certificate__logo"
                />
                <div className="certificate__brand-text">
                  <h2 className="certificate__org">Rise Above Foundation Cebu</h2>
                  <p className="certificate__org-sub">Non-Government Organization • Cebu City, Philippines</p>
                </div>
              </div>
            )}
          </header>

          {/* Certificate Title */}
          <div className="certificate__heading">
            <h1 className="certificate__main">{main}</h1>
            <p className="certificate__sub">{sub}</p>
          </div>

          <div className="certificate__divider-ornament">
            <span className="certificate__ornament-line" />
            <span className="certificate__ornament-seal">
              <span className="certificate__ornament-star">✦</span>
            </span>
            <span className="certificate__ornament-line" />
          </div>

          {/* Recipient Spotlight */}
          <div className="certificate__presentation">
            <p className="certificate__presented">{presentedLine(cert)}</p>
            <h2 className="certificate__recipient">{cert?.recipient || 'Valued Supporter'}</h2>
          </div>

          {/* Body Content with Optional Photo Layout */}
          <div className={`certificate__body certificate__body--${photoLayout}`}>
            {showPhoto && photoLayout === 'backdrop' && (
              <div className="certificate__caption-plaque">
                <p className="certificate__details">{details}</p>
              </div>
            )}

            {showPhoto && photoLayout === 'featured' && (
              <>
                <div className="certificate__photo-showcase">
                  <img
                    src={photoSrc}
                    alt="Contribution Activity"
                    className="certificate__photo-showcase-img"
                    onError={() => setPhotoError(true)}
                  />
                </div>
                <p className="certificate__details">{details}</p>
              </>
            )}

            {showPhoto && photoLayout === 'panel' && (
              <div className="certificate__photo-panel-wrap">
                <img
                  src={photoSrc}
                  alt="Contribution Activity"
                  className="certificate__photo-panel-bg"
                  onError={() => setPhotoError(true)}
                />
                <div className="certificate__photo-panel-content">
                  <p className="certificate__details certificate__details--panel">{details}</p>
                </div>
              </div>
            )}

            {showPhoto && photoLayout === 'side' && (
              <div className="certificate__side-grid">
                <div className="certificate__photo-container certificate__photo-container--side">
                  <img
                    src={photoSrc}
                    alt="Contribution Activity"
                    className="certificate__photo"
                    onError={() => setPhotoError(true)}
                  />
                </div>
                <div className="certificate__side-copy">
                  <p className="certificate__details">{details}</p>
                </div>
              </div>
            )}

            {(!showPhoto || photoLayout === 'none') && (
              <p className="certificate__details">{details}</p>
            )}
          </div>

          {/* Meta Information Bar */}
          <div className="certificate__meta">
            {cert?.reference && (
              <div className="certificate__meta-item">
                <span className="certificate__meta-label">Reference</span>
                <strong className="certificate__meta-val">{cert.reference}</strong>
              </div>
            )}
            <div className="certificate__meta-item">
              <span className="certificate__meta-label">Date Issued</span>
              <strong className="certificate__meta-val">{certDate}</strong>
            </div>
            <div className="certificate__meta-item">
              <span className="certificate__meta-label">Location</span>
              <strong className="certificate__meta-val">{location}</strong>
            </div>
            <div className="certificate__meta-item">
              <span className="certificate__meta-label">Certificate No.</span>
              <strong className="certificate__meta-val">{cert?.id || 'CERT-DRAFT'}</strong>
            </div>
          </div>

          {/* Signatures & Official Medallion Seal */}
          <footer className="certificate__footer">
            {/* Primary Signatory: Flemming Hansen / Selected Signatory */}
            <div className="certificate__sign">
              <div className="certificate__sig-img-wrap">
                {signatureSrc ? (
                  <img
                    src={signatureSrc}
                    alt={signName}
                    className="certificate__sig-img"
                  />
                ) : (
                  <div className="certificate__sig-placeholder" />
                )}
              </div>
              <div className="certificate__sign-line" />
              <p className="certificate__sign-name">{signName}</p>
              <p className="certificate__sign-title">{signTitle}</p>
              <p className="certificate__sign-org">Rise Above Foundation Cebu, Inc.</p>
            </div>

            {/* Official Medallion Seal */}
            <div className="certificate__seal-wrap">
              <img
                src={templateId === 'royal_crimson' || templateId === 'distinguished_heritage' ? certGoldSeal : certSealRound}
                alt="Official Seal"
                className="certificate__seal-img"
              />
            </div>

            {/* Secondary Endorsement Signatory */}
            <div className="certificate__sign">
              <div className="certificate__sig-img-wrap">
                <div className="certificate__sign-endorsement-stamp">
                  <span className="certificate__stamp-org">OFFICIAL SEAL</span>
                  <span className="certificate__stamp-date">{certDate}</span>
                </div>
              </div>
              <div className="certificate__sign-line" />
              <p className="certificate__sign-name">Board of Trustees</p>
              <p className="certificate__sign-title">Authorized Endorsement</p>
              <p className="certificate__sign-org">Rise Above Foundation Cebu, Inc.</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
