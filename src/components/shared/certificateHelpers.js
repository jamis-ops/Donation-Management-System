/** Shared copy/layout helpers for on-screen + print certificates. */

export function splitCertTitle(type) {
  const raw = String(type || 'Certificate of Donation').trim()
  if (/^official\s+receipt$/i.test(raw)) {
    return { main: 'OFFICIAL', sub: 'RECEIPT' }
  }
  const ofMatch = raw.match(/^certificate\s+of\s+(.+)$/i)
  if (ofMatch) {
    return { main: 'CERTIFICATE', sub: `OF ${ofMatch[1].toUpperCase()}` }
  }
  if (/^certificate$/i.test(raw)) {
    return { main: 'CERTIFICATE', sub: 'OF RECOGNITION' }
  }
  return { main: 'CERTIFICATE', sub: raw.toUpperCase() }
}

export function defaultCertDetails(cert) {
  const isReceipt = cert?.type === 'Official Receipt'
  if (cert?.details) return cert.details
  if (isReceipt) {
    return 'In acknowledgment of the donation received by Rise Above Foundation Cebu, issued for official record and transparency.'
  }
  return 'In grateful recognition of your generous contribution to Rise Above Foundation Cebu. Your support uplifts communities and brings hope to families in need across Cebu.'
}

export function presentedLine(cert) {
  if (cert?.type === 'Official Receipt') return 'THIS OFFICIAL RECEIPT IS ISSUED TO'
  return 'THIS CERTIFICATE IS PROUDLY PRESENTED TO'
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
