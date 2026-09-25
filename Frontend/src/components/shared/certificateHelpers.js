import { apiUrl } from '../../api/resources'

/** Shared copy/layout helpers for on-screen + print certificates. */

export const CONTRIBUTION_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 130" width="100%" height="100%">
  <defs>
    <linearGradient id="certBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffefb"/>
      <stop offset="50%" stop-color="#fdfbf5"/>
      <stop offset="100%" stop-color="#f7f2e4"/>
    </linearGradient>
    <linearGradient id="certGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#9a7b1c"/>
      <stop offset="50%" stop-color="#d4af37"/>
      <stop offset="100%" stop-color="#9a7b1c"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="534" height="124" rx="6" fill="url(#certBg)" stroke="url(#certGold)" stroke-width="1.2"/>
  <rect x="7" y="7" width="526" height="116" rx="4" fill="none" stroke="#d4af37" stroke-width="0.7" stroke-dasharray="4 3" opacity="0.6"/>
  <g transform="translate(270, 32)" text-anchor="middle">
    <circle cx="0" cy="0" r="12" fill="#af101a" opacity="0.08"/>
    <path d="M-5,1 C-5,-3 0,-6 0,-6 C0,-6 5,-3 5,1 C5,4 1,7 0,8 C-1,7 -5,4 -5,1 Z" fill="#af101a"/>
    <circle cx="-24" cy="0" r="1.5" fill="#c9a227"/>
    <line x1="-20" y1="0" x2="-8" y2="0" stroke="#c9a227" stroke-width="0.8"/>
    <circle cx="24" cy="0" r="1.5" fill="#c9a227"/>
    <line x1="8" y1="0" x2="20" y2="0" stroke="#c9a227" stroke-width="0.8"/>
  </g>
  <text x="270" y="65" font-family="'Cinzel', Georgia, serif" font-size="11" font-weight="700" fill="#7a0b12" text-anchor="middle" letter-spacing="2">RISE ABOVE FOUNDATION CEBU</text>
  <text x="270" y="84" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="#9a7b1c" text-anchor="middle" letter-spacing="1">OFFICIAL CONTRIBUTION &amp; SERVICE RECORD</text>
  <text x="270" y="104" font-family="'Cormorant Garamond', Georgia, serif" font-size="10.5" font-style="italic" fill="#5e564d" text-anchor="middle">Honoring dedicated community service and humanitarian outreach</text>
</svg>
`)}`

export function resolveCertPhotoUrl(cert) {
  const photo = cert?.photoDisplayUrl || cert?.photoUrl || cert?.photo_url || cert?.photoData || null
  if (!photo) return null
  const str = String(photo).trim()
  if (!str || str === 'null' || str === 'undefined') return null

  // If base64, blob, or full http/https URL
  if (/^(data:|blob:|https?:\/\/)/i.test(str)) {
    return str
  }

  // If already an API path: /api/file.php... or api/file.php...
  if (str.startsWith('/api/') || str.startsWith('api/')) {
    return apiUrl(str)
  }

  // If it's just a file name (e.g. cert_photo_xxx.jpg)
  return apiUrl(`/api/file.php?kind=certificates&name=${encodeURIComponent(str)}`)
}

export function resolveCertSignatureUrl(cert, defaultFlemmingSig) {
  const signName = cert?.signatoryName || cert?.signatory_name || 'Flemming Hansen'
  let sig = cert?.signatureDisplayUrl || cert?.signatureUrl || cert?.signature_url || null

  if (!sig || String(signName).toLowerCase().includes('flemming')) {
    return defaultFlemmingSig
  }

  const str = String(sig).trim()
  if (!str || str === 'null' || str === 'undefined') {
    return defaultFlemmingSig
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(str)) {
    return str
  }

  if (str.startsWith('/api/') || str.startsWith('api/')) {
    return apiUrl(str)
  }

  return apiUrl(`/api/file.php?kind=certificates&name=${encodeURIComponent(str)}`)
}

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
