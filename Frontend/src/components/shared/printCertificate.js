import {
  certBannerHeader,
  certSealRound,
  certGoldSeal,
  certSigFlemming,
} from '../../assets'
import { notify } from '../../utils/confirm'
import {
  defaultCertDetails,
  escapeHtml,
  presentedLine,
  splitCertTitle,
} from './certificateHelpers'

function toAbsoluteUrl(src) {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:')) return src
  try {
    return new URL(src, window.location.origin).href
  } catch {
    return src
  }
}

/**
 * Opens the certificate in a new window (A4 landscape) and triggers print /
 * Save as PDF matching the exact selected template, photo layout, and official branding.
 */
export function printCertificate(cert) {
  const templateId = cert?.templateId || 'modern_classic'
  const photoLayout = cert?.photoLayout || 'none'
  const { main, sub } = splitCertTitle(cert?.type)
  const details = defaultCertDetails(cert)
  const signName = cert?.signatoryName || 'Flemming Hansen'
  const signTitle = cert?.signatoryTitle || 'CEO and Co-Founder'
  const recipient = cert?.recipient || 'Valued Supporter'
  const location = cert?.location || 'Cebu City, Philippines'
  const certDate = cert?.date || cert?.certDate || 'September 25, 2026'

  // Resolve assets to absolute URLs
  const bannerUrl = toAbsoluteUrl(certBannerHeader)
  const sealRoundUrl = toAbsoluteUrl(certSealRound)
  const sealGoldUrl = toAbsoluteUrl(certGoldSeal)

  let sigUrl = cert?.signatureDisplayUrl || cert?.signatureUrl || null
  if (!sigUrl || String(signName).toLowerCase().includes('flemming')) {
    sigUrl = certSigFlemming
  } else if (sigUrl && !sigUrl.startsWith('http') && !sigUrl.startsWith('data:') && !sigUrl.startsWith('/')) {
    sigUrl = `/api/file.php?kind=certificates&name=${encodeURIComponent(sigUrl)}`
  }
  const signatureUrl = toAbsoluteUrl(sigUrl)

  const photoRaw = cert?.photoDisplayUrl || cert?.photoUrl || null
  const photoUrl = (photoLayout !== 'none' && photoRaw) ? toAbsoluteUrl(photoRaw) : null

  // Chosen Seal for bottom
  const bottomSealUrl = (templateId === 'royal_crimson' || templateId === 'distinguished_heritage')
    ? sealGoldUrl
    : sealRoundUrl

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cert?.type || 'Certificate')} — ${escapeHtml(recipient)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Great+Vibes&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; width: 100%; }
  body {
    font-family: 'Cormorant Garamond', Georgia, serif;
    background: #e5e5e5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .certificate {
    --c-crimson: #af101a;
    --c-crimson-dark: #7a0b12;
    --c-gold: #c9a227;
    --c-ink: #1a1512;
    --c-muted: #5e564d;
    --c-paper: #fffefb;
    --c-border-outer: var(--c-crimson-dark);
    --c-border-inner: var(--c-gold);
    width: 297mm;
    height: 210mm;
    max-width: 100%;
    background: var(--c-paper);
    box-shadow: 0 10px 40px rgba(0,0,0,0.18);
    position: relative;
    overflow: hidden;
  }

  /* Template theme styling */
  .certificate--royal_crimson {
    --c-paper: #fefcf9;
    --c-border-outer: #5e060d;
    --c-border-inner: #b38f20;
  }
  .certificate--clean_minimalist {
    --c-paper: #ffffff;
    --c-border-outer: #1e1b18;
    --c-border-inner: #d4af37;
  }
  .certificate--distinguished_heritage {
    --c-paper: #fcfbf7;
    --c-border-outer: #8a0d18;
    --c-border-inner: #c9a227;
  }

  .frame {
    height: 100%;
    border: 3.5mm solid var(--c-border-outer);
    padding: 2.5mm;
  }
  .certificate--clean_minimalist .frame { border-width: 1.5mm; }

  .inner {
    position: relative;
    height: 100%;
    border: 1.2mm solid var(--c-border-inner);
    padding: 9mm 16mm 7mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 55% at 50% 0%, rgba(175, 16, 26, 0.025), transparent 70%),
      var(--c-paper);
  }

  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -46%);
    width: 95mm;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
  .watermark img { width: 100%; height: auto; }

  .corner { position: absolute; width: 6mm; height: 6mm; pointer-events: none; z-index: 1; }
  .corner--tl { top: 2mm; left: 2mm; border-top: 1.5px solid var(--c-gold); border-left: 1.5px solid var(--c-gold); }
  .corner--tr { top: 2mm; right: 2mm; border-top: 1.5px solid var(--c-gold); border-right: 1.5px solid var(--c-gold); }
  .corner--bl { bottom: 2mm; left: 2mm; border-bottom: 1.5px solid var(--c-gold); border-left: 1.5px solid var(--c-gold); }
  .corner--br { bottom: 2mm; right: 2mm; border-bottom: 1.5px solid var(--c-gold); border-right: 1.5px solid var(--c-gold); }

  /* Brand Header */
  .brand { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
  .brand-row { display: flex; align-items: center; gap: 3.5mm; }
  .brand-logo { width: 16mm; height: 16mm; object-fit: contain; border-radius: 50%; }
  .brand-text { text-align: left; }
  .brand-org {
    font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif;
    font-size: 11pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-crimson-dark);
  }
  .brand-sub {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 6pt; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-muted); margin-top: 0.5mm;
  }
  .banner-wrap { width: 75mm; }
  .banner-wrap img { width: 100%; height: auto; display: block; }

  /* Title */
  .heading { position: relative; z-index: 2; margin-top: 2.5mm; }
  .main-title {
    font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif;
    font-size: 26pt; font-weight: 700; letter-spacing: 0.1em; color: var(--c-ink); line-height: 1;
  }
  .sub-title {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 8.5pt; font-weight: 600; letter-spacing: 0.36em; color: var(--c-gold); text-transform: uppercase; margin-top: 1.5mm;
  }
  .ornament {
    position: relative; z-index: 2; display: flex; align-items: center; justify-content: center;
    gap: 3mm; width: 55mm; margin: 2mm 0;
  }
  .ornament-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--c-gold), transparent); }
  .ornament-star { color: var(--c-crimson); font-size: 8pt; line-height: 1; }

  /* Recipient */
  .presentation { position: relative; z-index: 2; }
  .presented-line {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 6.5pt; font-weight: 600; letter-spacing: 0.22em; color: var(--c-muted); text-transform: uppercase;
  }
  .recipient-name {
    font-family: 'Great Vibes', 'Alex Brush', cursive;
    font-size: 34pt; color: var(--c-crimson-dark); line-height: 1.15; margin-top: 1mm;
  }
  .certificate--clean_minimalist .recipient-name {
    font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif; font-size: 22pt; color: #1a1512; font-weight: 700;
  }

  /* Body & Photos */
  .body { position: relative; z-index: 2; width: 100%; max-width: 185mm; margin: 2mm auto 0; }
  .details-text {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 10pt; font-weight: 500; line-height: 1.55; color: #38322c; max-width: 175mm; margin: 0 auto;
  }

  .photo-featured { margin-bottom: 2mm; display: flex; justify-content: center; }
  .photo-featured img {
    max-height: 22mm; max-width: 45mm; object-fit: cover; border-radius: 4px; border: 1px solid var(--c-gold);
  }

  .side-grid { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4mm; text-align: left; }
  .side-grid img { width: 34mm; max-height: 24mm; object-fit: cover; border-radius: 4px; border: 1px solid var(--c-gold); }
  .side-grid .details-text { text-align: left; }

  .photo-card { display: inline-flex; flex-direction: column; align-items: center; background: rgba(201, 162, 39, 0.05); border: 1px solid rgba(201, 162, 39, 0.4); border-radius: 4px; padding: 2px; margin-top: 1.5mm; }
  .photo-card img { max-height: 20mm; max-width: 42mm; object-fit: cover; border-radius: 3px; }
  .photo-card span { font-family: 'DM Sans', system-ui, sans-serif; font-size: 5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-crimson-dark); margin-top: 1px; }

  /* Meta */
  .meta {
    position: relative; z-index: 2; display: flex; justify-content: center; align-items: center;
    gap: 8mm; width: 160mm; margin: 2.5mm auto 0; padding-top: 2mm;
    border-top: 1px solid rgba(201, 162, 39, 0.45);
  }
  .meta-item { display: flex; flex-direction: column; gap: 0.5mm; min-width: 22mm; }
  .meta-label { font-family: 'DM Sans', system-ui, sans-serif; font-size: 5.5pt; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-muted); }
  .meta-val { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 9.5pt; font-weight: 700; color: var(--c-ink); }

  /* Footer & Signatures */
  .footer {
    position: relative; z-index: 2; display: grid; grid-template-columns: 1fr auto 1fr;
    align-items: flex-end; gap: 5mm; width: 100%; max-width: 180mm; margin-top: auto; padding-top: 2.5mm;
  }
  .sign { display: flex; flex-direction: column; align-items: center; }
  .sig-img-wrap { height: 12mm; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 1mm; }
  .sig-img { max-height: 100%; max-width: 42mm; object-fit: contain; }
  .sign-line { width: 44mm; margin: 0 auto 1.5mm; border-bottom: 1.5px solid var(--c-gold); }
  .sign-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 9.5pt; font-weight: 700; color: var(--c-ink); }
  .sign-title { font-family: 'DM Sans', system-ui, sans-serif; font-size: 6pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-gold); font-weight: 600; margin-top: 0.5mm; }
  .sign-org { font-family: 'DM Sans', system-ui, sans-serif; font-size: 5pt; color: var(--c-muted); margin-top: 0.5mm; }
  .seal-img { width: 18mm; height: 18mm; object-fit: contain; }

  @media print {
    body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
    .certificate { box-shadow: none !important; width: 297mm !important; height: 210mm !important; }
  }
</style>
</head>
<body>
  <div class="certificate certificate--${templateId}">
    <div class="frame">
      <div class="inner">
        <div class="watermark"><img src="${sealRoundUrl}" alt="" /></div>

        <div class="corner corner--tl"></div>
        <div class="corner corner--tr"></div>
        <div class="corner corner--bl"></div>
        <div class="corner corner--br"></div>

        <header class="brand">
          ${templateId === 'distinguished_heritage'
            ? `<div class="banner-wrap"><img src="${bannerUrl}" alt="Rise Above Foundation Cebu, Inc." /></div>`
            : `<div class="brand-row">
                 <img class="brand-logo" src="${sealRoundUrl}" alt="Rise Above Foundation Cebu" />
                 <div class="brand-text">
                   <div class="brand-org">Rise Above Foundation Cebu</div>
                   <div class="brand-sub">Non-Government Organization • Cebu City, Philippines</div>
                 </div>
               </div>`
          }
        </header>

        <div class="heading">
          <div class="main-title">${escapeHtml(main)}</div>
          <div class="sub-title">${escapeHtml(sub)}</div>
        </div>

        <div class="ornament">
          <span class="ornament-line"></span>
          <span class="ornament-star">✦</span>
          <span class="ornament-line"></span>
        </div>

        <div class="presentation">
          <div class="presented-line">${escapeHtml(presentedLine(cert))}</div>
          <div class="recipient-name">${escapeHtml(recipient)}</div>
        </div>

        <div class="body">
          ${photoUrl && photoLayout === 'featured'
            ? `<div class="photo-featured"><img src="${photoUrl}" alt="Contribution" /></div>`
            : ''
          }

          ${photoUrl && photoLayout === 'side'
            ? `<div class="side-grid">
                 <img src="${photoUrl}" alt="Contribution" />
                 <div class="details-text">${escapeHtml(details)}</div>
               </div>`
            : `<div class="details-text">${escapeHtml(details)}</div>`
          }

          ${photoUrl && photoLayout === 'card'
            ? `<div class="photo-card"><img src="${photoUrl}" alt="Contribution" /><span>Official Contribution Record</span></div>`
            : ''
          }
        </div>

        <div class="meta">
          ${cert?.reference ? `<div class="meta-item"><span class="meta-label">Reference</span><strong class="meta-val">${escapeHtml(cert.reference)}</strong></div>` : ''}
          <div class="meta-item"><span class="meta-label">Date Issued</span><strong class="meta-val">${escapeHtml(certDate)}</strong></div>
          <div class="meta-item"><span class="meta-label">Location</span><strong class="meta-val">${escapeHtml(location)}</strong></div>
          <div class="meta-item"><span class="meta-label">Certificate No.</span><strong class="meta-val">${escapeHtml(cert?.id || '—')}</strong></div>
        </div>

        <footer class="footer">
          <div class="sign">
            <div class="sig-img-wrap">
              ${signatureUrl ? `<img class="sig-img" src="${signatureUrl}" alt="${escapeHtml(signName)}" />` : ''}
            </div>
            <div class="sign-line"></div>
            <div class="sign-name">${escapeHtml(signName)}</div>
            <div class="sign-title">${escapeHtml(signTitle)}</div>
            <div class="sign-org">Rise Above Foundation Cebu, Inc.</div>
          </div>

          <div>
            <img class="seal-img" src="${bottomSealUrl}" alt="Official Seal" />
          </div>

          <div class="sign">
            <div class="sig-img-wrap" style="align-items: center;">
              <span style="font-family:'DM Sans',sans-serif; font-size: 5.5pt; font-weight:700; color:var(--c-crimson-dark); border:1px dashed var(--c-gold); padding:2px 8px; border-radius:3px;">OFFICIAL SEAL</span>
            </div>
            <div class="sign-line"></div>
            <div class="sign-name">Board of Trustees</div>
            <div class="sign-title">Authorized Endorsement</div>
            <div class="sign-org">Rise Above Foundation Cebu, Inc.</div>
          </div>
        </footer>
      </div>
    </div>
  </div>

  <script>
    function goPrint() {
      try { window.focus(); } catch (e) {}
      window.print();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(goPrint, 250); });
    } else {
      window.addEventListener('load', function () { setTimeout(goPrint, 500); });
    }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1240,height=880')
  if (!win) {
    notify.warning('Please allow pop-ups to print or download the certificate.')
    return
  }
  win.document.write(html)
  win.document.close()
}
