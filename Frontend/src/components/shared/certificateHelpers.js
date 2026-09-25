/** Shared copy/layout helpers for on-screen + print certificates. */

export const CERTIFICATE_TEMPLATES = [
  {
    id: 'modern_classic',
    name: 'Classic Executive',
    description: 'Ivory parchment tone with elegant gold and crimson double filigree borders and circular seal',
    badge: 'Popular',
    accentColor: '#c9a227',
  },
  {
    id: 'royal_crimson',
    name: 'Royal Crimson',
    description: 'Prestige crimson framing accents, regal gold ornamentation, and official medallion seal',
    badge: 'Formal',
    accentColor: '#8a0d18',
  },
  {
    id: 'clean_minimalist',
    name: 'Clean Minimalist',
    description: 'Contemporary spacious design with high contrast, crisp modern typography, and refined whitespace',
    badge: 'Modern',
    accentColor: '#1a1512',
  },
  {
    id: 'distinguished_heritage',
    name: 'Distinguished Heritage',
    description: 'Features the official Rise Above Foundation Cebu header banner, address crest, and heritage border',
    badge: 'Official',
    accentColor: '#af101a',
  },
]

export const PHOTO_LAYOUTS = [
  {
    id: 'backdrop',
    name: 'Full Background',
    badge: 'Hero Backdrop',
    description: 'Expansive full-width background photo with elegant readability scrim',
  },
  {
    id: 'featured',
    name: 'Large Centerpiece',
    badge: 'Prominent',
    description: 'Prominent large showcase photo between recipient and recognition copy',
  },
  {
    id: 'panel',
    name: 'Glassmorphic Banner',
    badge: 'Overlay Plaque',
    description: 'Wide mission photo banner with frosted glass caption overlay',
  },
  {
    id: 'side',
    name: 'Side-by-Side',
    badge: 'Balanced',
    description: 'Photo placed beside recognition copy for a balanced two-column flow',
  },
  {
    id: 'none',
    name: 'No Photo',
    badge: 'Classic',
    description: 'Text-focused official certificate with traditional parchment layout',
  },
]

export const CAPTION_TEMPLATES = [
  {
    id: 'Professional',
    name: 'Professional',
    hint: 'Balanced, dignified, and clear recognition suitable for general corporate and individual donors',
  },
  {
    id: 'Formal',
    name: 'Formal',
    hint: 'Solemn, official citation language with distinguished phrasing for institutions and partners',
  },
  {
    id: 'Heartfelt',
    name: 'Heartfelt',
    hint: 'Warm, touching, and emotionally appreciative of humanitarian impact',
  },
  {
    id: 'Short & Simple',
    name: 'Short & Simple',
    hint: 'Concise 2-sentence summary perfectly balanced for certificates with photos',
  },
  {
    id: 'Volunteer Recognition',
    name: 'Volunteer Recognition',
    hint: 'Celebrates selfless volunteer service, hours rendered, and community impact',
  },
  {
    id: 'Monetary Donation',
    name: 'Monetary Donation',
    hint: 'Focuses on the financial contribution, donation amount, and supported program',
  },
  {
    id: 'In-Kind Donation',
    name: 'In-Kind Donation',
    hint: 'Highlights specific donated goods, materials, and distribution relief',
  },
  {
    id: 'Disaster Relief',
    name: 'Disaster Relief',
    hint: 'Specially honors emergency aid, flash flood, and calamity relief response',
  },
  {
    id: 'Custom',
    name: 'Custom',
    hint: 'Admin-written customized text or freehand editing',
  },
]

export function splitCertTitle(type) {
  const raw = String(type || 'Certificate of Donation').trim()
  if (/^official\s+receipt$/i.test(raw)) {
    return { main: 'OFFICIAL', sub: 'RECEIPT' }
  }
  if (/^acknowledgment\s+of\s+(.+)$/i.test(raw)) {
    const m = raw.match(/^acknowledgment\s+of\s+(.+)$/i)
    return { main: 'ACKNOWLEDGMENT', sub: `OF ${m[1].toUpperCase()}` }
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
  if (cert?.details && String(cert.details).trim() !== '') return cert.details

  const recipient = cert?.recipient || 'Our Generous Partner'
  const isReceipt = cert?.type === 'Official Receipt'
  if (isReceipt) {
    return 'In acknowledgment of the donation received by Rise Above Foundation Cebu, issued for official record and transparency.'
  }

  const type = String(cert?.type || '').toLowerCase()
  if (type.includes('volunteer')) {
    return `In grateful recognition of ${recipient} for dedicated volunteer service and invaluable contribution to the community outreach programs of Rise Above Foundation Cebu, touching lives and bringing hope to families across Cebu.`
  }

  if (type.includes('appreciation')) {
    return `In sincere appreciation of ${recipient} for continuous support and active partnership with Rise Above Foundation Cebu, fostering positive change and empowering underprivileged communities.`
  }

  return `In grateful recognition of ${recipient} for the generous and heartfelt contribution to the community empowerment programs of Rise Above Foundation Cebu, helping uplift families and build stronger communities.`
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
