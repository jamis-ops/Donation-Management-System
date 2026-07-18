import { logo } from '../../assets'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Opens the certificate in a new window styled for A4 landscape and triggers
 * the browser print dialog. Users can print directly or choose
 * "Save as PDF" to download.
 */
export function printCertificate(cert) {
  const isReceipt = cert.type === 'Official Receipt'
  const logoUrl = new URL(logo, window.location.origin).href

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cert.type)} — ${escapeHtml(cert.recipient)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .certificate {
    width: 1050px;
    max-width: 100%;
    background: #fffdf7;
    padding: 18px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.18);
  }
  .border {
    border: 3px solid #AF101A;
    padding: 6px;
  }
  .inner {
    border: 1px solid #d4a017;
    padding: 48px 64px;
    text-align: center;
    position: relative;
  }
  .logo { width: 88px; height: 88px; object-fit: contain; margin-bottom: 8px; }
  .org { font-size: 26px; letter-spacing: 0.06em; color: #7A0B12; text-transform: uppercase; }
  .org-sub { font-size: 12px; color: #8a8378; margin-top: 4px; letter-spacing: 0.08em; }
  .title {
    font-size: 40px;
    color: #AF101A;
    margin-top: 30px;
    font-weight: 400;
    letter-spacing: 0.02em;
  }
  .rule {
    width: 160px; height: 3px; margin: 14px auto 26px;
    background: linear-gradient(90deg, transparent, #d4a017, transparent);
  }
  .presented { font-size: 15px; color: #6b6357; font-style: italic; }
  .recipient {
    font-size: 44px;
    color: #1f2937;
    margin: 14px 0 6px;
    font-family: 'Segoe Script', 'Brush Script MT', cursive;
  }
  .details {
    font-size: 15px;
    color: #4b5563;
    max-width: 720px;
    margin: 14px auto 0;
    line-height: 1.7;
  }
  .meta {
    display: flex;
    justify-content: center;
    gap: 36px;
    flex-wrap: wrap;
    margin-top: 30px;
    font-size: 12.5px;
    color: #6b6357;
  }
  .signature { margin-top: 44px; display: inline-block; }
  .sign-line { width: 260px; border-bottom: 1.5px solid #4b5563; margin: 0 auto 8px; }
  .sign-name { font-size: 16px; font-weight: bold; color: #1f2937; }
  .sign-title { font-size: 12.5px; color: #6b6357; margin-top: 2px; }
  @media print {
    body { background: #fff; padding: 0; }
    .certificate { box-shadow: none; width: 100%; }
  }
</style>
</head>
<body>
  <div class="certificate">
    <div class="border">
      <div class="inner">
        <img class="logo" src="${logoUrl}" alt="Rise Above Foundation" />
        <div class="org">Rise Above Foundation</div>
        <div class="org-sub">CEBU, PHILIPPINES · RISEABOVEFOUNDATION.ORG</div>
        <div class="title">${escapeHtml(cert.type || 'Certificate of Donation')}</div>
        <div class="rule"></div>
        <div class="presented">${isReceipt ? 'This official receipt is issued to' : 'This certificate is proudly presented to'}</div>
        <div class="recipient">${escapeHtml(cert.recipient)}</div>
        <div class="details">${escapeHtml(
          cert.details ||
          (isReceipt
            ? 'In acknowledgment of the donation received by Rise Above Foundation.'
            : 'In grateful recognition of your generous support, which uplifts communities and brings hope to families in need.')
        )}</div>
        <div class="meta">
          ${cert.reference ? `<span>Reference: <strong>${escapeHtml(cert.reference)}</strong></span>` : ''}
          <span>Date Issued: <strong>${escapeHtml(cert.date || '—')}</strong></span>
          <span>Certificate No: <strong>${escapeHtml(cert.id)}</strong></span>
        </div>
        <div class="signature">
          <div class="sign-line"></div>
          <div class="sign-name">${escapeHtml(cert.signatoryName || 'Maria Dela Cruz')}</div>
          <div class="sign-title">${escapeHtml(cert.signatoryTitle || 'Executive Director')}</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=850')
  if (!win) {
    alert('Please allow pop-ups to print or download the certificate.')
    return
  }
  win.document.write(html)
  win.document.close()
}
