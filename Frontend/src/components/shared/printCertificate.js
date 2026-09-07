import { logo } from '../../assets'
import { notify } from '../../utils/toast'
import {
  defaultCertDetails,
  escapeHtml,
  presentedLine,
  splitCertTitle,
} from './certificateHelpers'

/**
 * Opens the certificate in a new window (A4 landscape) and triggers print /
 * Save as PDF using the same premium RAF Cebu layout as CertificateView.
 */
export function printCertificate(cert) {
  const logoUrl = new URL(logo, window.location.origin).href
  const { main, sub } = splitCertTitle(cert?.type)
  const details = defaultCertDetails(cert)
  const signName = cert?.signatoryName || 'Maria Dela Cruz'
  const signTitle = cert?.signatoryTitle || 'Executive Director'
  const recipient = cert?.recipient || '—'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cert?.type || 'Certificate')} — ${escapeHtml(recipient)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&family=Great+Vibes&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    background: #e8e6e1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .certificate {
    --crimson: #af101a;
    --crimson-dark: #7a0b12;
    --gold: #c9a227;
    --gold-soft: #e8d48a;
    --ink: #1a1512;
    --muted: #6b6357;
    --paper: #fffefb;
    width: 297mm;
    height: 210mm;
    max-width: 100%;
    background: var(--paper);
    box-shadow: 0 10px 40px rgba(0,0,0,0.16);
  }
  .frame {
    height: 100%;
    border: 2.5px solid var(--crimson);
    padding: 7px;
  }
  .inner {
    position: relative;
    height: 100%;
    border: 1px solid var(--gold);
    padding: 18mm 22mm 14mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 55% at 50% 0%, rgba(175, 16, 26, 0.035), transparent 70%),
      var(--paper);
  }
  .flourish {
    position: absolute;
    width: 52mm;
    height: auto;
    pointer-events: none;
    opacity: 0.92;
  }
  .flourish--tl { top: 3mm; left: 3mm; }
  .flourish--br { bottom: 3mm; right: 3mm; }
  .brand { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 3mm; }
  .logo {
    width: 22mm; height: 22mm; object-fit: contain; border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .org {
    font-size: 13pt; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--crimson-dark);
  }
  .org-sub {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted); margin-top: 1mm;
  }
  .heading { position: relative; z-index: 1; margin-top: 5mm; }
  .main {
    font-size: 34pt; font-weight: 700; letter-spacing: 0.08em;
    color: var(--ink); line-height: 1;
  }
  .sub {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 10pt; font-weight: 600; letter-spacing: 0.38em;
    color: var(--gold); text-transform: uppercase; margin-top: 2.5mm;
  }
  .presented {
    position: relative; z-index: 1;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 7.5pt; font-weight: 500; letter-spacing: 0.2em;
    color: var(--ink); margin-top: 7mm;
  }
  .recipient {
    position: relative; z-index: 1;
    font-family: 'Great Vibes', 'Segoe Script', cursive;
    font-size: 38pt; color: var(--ink); line-height: 1.15;
    margin-top: 2mm; padding: 0 4mm;
  }
  .ornament {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    gap: 3mm; margin-top: 3.5mm; width: 70mm;
  }
  .ornament-line {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
  }
  .ornament-dot {
    width: 4px; height: 4px; border-radius: 50%; background: var(--gold);
  }
  .ornament-diamond {
    width: 6px; height: 6px; background: var(--crimson); transform: rotate(45deg);
  }
  .details {
    position: relative; z-index: 1;
    max-width: 165mm; margin-top: 3.5mm;
    font-size: 11pt; font-weight: 500; line-height: 1.55; color: #3f3a34;
  }
  .meta {
    position: relative; z-index: 1;
    display: flex; justify-content: center; flex-wrap: wrap; gap: 12mm;
    margin-top: 6mm; padding-top: 3.5mm;
    border-top: 1px solid rgba(201, 162, 39, 0.35);
    width: 150mm;
  }
  .meta-item { display: flex; flex-direction: column; gap: 1mm; min-width: 28mm; }
  .meta-item span {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 6.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
  }
  .meta-item strong { font-size: 10pt; font-weight: 700; color: var(--ink); }
  .footer {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 1fr auto 1fr;
    align-items: end; gap: 8mm;
    width: 100%; max-width: 180mm;
    margin-top: auto; padding-top: 7mm;
  }
  .sign-line {
    width: 48mm; margin: 0 auto 2mm;
    border-bottom: 1.5px solid var(--gold);
  }
  .sign-name { font-size: 10.5pt; font-weight: 700; color: var(--ink); }
  .sign-title {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 7pt; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--gold); margin-top: 0.8mm;
  }
  .seal { width: 24mm; height: auto; }
  .seal-text {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; fill: var(--crimson-dark);
  }
  @media print {
    body { background: #fff; padding: 0; }
    .certificate { box-shadow: none; width: 297mm; height: 210mm; }
  }
</style>
</head>
<body>
  <div class="certificate">
    <div class="frame">
      <div class="inner">
        <svg class="flourish flourish--tl" viewBox="0 0 220 160" aria-hidden="true">
          <path d="M208 12 C172 40, 150 70, 132 108 C118 132, 90 142, 52 138" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M192 12 C160 32, 138 58, 122 92 C108 118, 82 126, 44 122" fill="none" stroke="#af101a" stroke-width="1.15" stroke-linecap="round" opacity="0.75"/>
          <path d="M176 12 C148 26, 128 46, 114 76 C102 102, 76 110, 40 106" fill="none" stroke="#e8d48a" stroke-width="0.9" stroke-linecap="round"/>
          <circle cx="52" cy="138" r="3.2" fill="#c9a227"/>
          <circle cx="44" cy="122" r="2" fill="#af101a" opacity="0.8"/>
        </svg>
        <svg class="flourish flourish--br" viewBox="0 0 220 160" aria-hidden="true">
          <path d="M12 148 C48 120, 70 90, 88 52 C102 28, 130 18, 168 22" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M28 148 C60 128, 82 102, 98 68 C112 42, 138 34, 176 38" fill="none" stroke="#af101a" stroke-width="1.15" stroke-linecap="round" opacity="0.75"/>
          <path d="M44 148 C72 134, 92 114, 106 84 C118 58, 144 50, 180 54" fill="none" stroke="#e8d48a" stroke-width="0.9" stroke-linecap="round"/>
          <circle cx="168" cy="22" r="3.2" fill="#c9a227"/>
          <circle cx="176" cy="38" r="2" fill="#af101a" opacity="0.8"/>
        </svg>

        <header class="brand">
          <img class="logo" src="${logoUrl}" alt="Rise Above Foundation Cebu" />
          <div>
            <div class="org">Rise Above Foundation</div>
            <div class="org-sub">Cebu, Philippines</div>
          </div>
        </header>

        <div class="heading">
          <div class="main">${escapeHtml(main)}</div>
          <div class="sub">${escapeHtml(sub)}</div>
        </div>

        <div class="presented">${escapeHtml(presentedLine(cert))}</div>
        <div class="recipient">${escapeHtml(recipient)}</div>

        <div class="ornament" aria-hidden="true">
          <span class="ornament-dot"></span>
          <span class="ornament-line"></span>
          <span class="ornament-diamond"></span>
          <span class="ornament-line"></span>
          <span class="ornament-dot"></span>
        </div>

        <div class="details">${escapeHtml(details)}</div>

        <div class="meta">
          ${cert?.reference ? `<div class="meta-item"><span>Reference</span><strong>${escapeHtml(cert.reference)}</strong></div>` : ''}
          <div class="meta-item"><span>Date Issued</span><strong>${escapeHtml(cert?.date || '—')}</strong></div>
          <div class="meta-item"><span>Certificate No.</span><strong>${escapeHtml(cert?.id || '—')}</strong></div>
        </div>

        <footer class="footer">
          <div class="sign">
            <div class="sign-line"></div>
            <div class="sign-name">${escapeHtml(signName)}</div>
            <div class="sign-title">${escapeHtml(signTitle)}</div>
          </div>
          <div>
            <svg class="seal" viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#f0d78c"/><stop offset="45%" stop-color="#c9a227"/><stop offset="100%" stop-color="#8a6d12"/>
                </linearGradient>
                <linearGradient id="gCrimson" x1="20%" y1="0%" x2="80%" y2="100%">
                  <stop offset="0%" stop-color="#d64545"/><stop offset="100%" stop-color="#7a0b12"/>
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="56" fill="none" stroke="url(#gGold)" stroke-width="3.5"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#gGold)" stroke-width="1.25" stroke-dasharray="2 3"/>
              <circle cx="60" cy="60" r="44" fill="#fffdf9" stroke="#af101a" stroke-width="1.5"/>
              <path d="M60 78 C48 68, 40 60, 40 50 C40 43, 45 38, 52 38 C56 38, 59 40, 60 44 C61 40, 64 38, 68 38 C75 38, 80 43, 80 50 C80 60, 72 68, 60 78 Z" fill="url(#gCrimson)"/>
              <text x="60" y="96" text-anchor="middle" class="seal-text">RAF CEBU</text>
            </svg>
          </div>
          <div class="sign">
            <div class="sign-line"></div>
            <div class="sign-name">Rise Above Foundation</div>
            <div class="sign-title">Authorized Signatory</div>
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
      document.fonts.ready.then(function () { setTimeout(goPrint, 200); });
    } else {
      window.addEventListener('load', function () { setTimeout(goPrint, 450); });
    }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=850')
  if (!win) {
    notify.warning('Please allow pop-ups to print or download the certificate.')
    return
  }
  win.document.write(html)
  win.document.close()
}
