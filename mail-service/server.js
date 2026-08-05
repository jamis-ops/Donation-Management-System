import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { credentialsEmailHtml, credentialsPlainText, CREDENTIALS_SUBJECT, verificationEmailHtml, invitationEmailHtml, genericEmailHtml } from './templates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Always load mail-service/.env (not process cwd — npm scripts often start from repo root)
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT = Number(process.env.MAIL_SERVICE_PORT || 8025)
const API_KEY = process.env.MAIL_SERVICE_API_KEY || ''

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = (process.env.SMTP_USER || '').trim()
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'tls').toLowerCase() === 'ssl'
const MAIL_FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || SMTP_USER).trim()
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Rise Above Foundation'
const MAIL_REPLY_TO = (process.env.MAIL_REPLY_TO || MAIL_FROM_EMAIL || SMTP_USER).trim()
const LIST_UNSUBSCRIBE_MAILTO = (process.env.MAIL_LIST_UNSUBSCRIBE || MAIL_REPLY_TO || MAIL_FROM_EMAIL || SMTP_USER).trim()
// Prefer APP_URL / FRONTEND_URL from env. PHP always passes absolute loginUrl/recoveryUrl
// from api/app_url.php — these defaults are fallbacks only.
const FRONTEND_URL = (
  process.env.APP_URL
  || process.env.FRONTEND_URL
  || process.env.PUBLIC_URL
  || 'http://localhost:5173'
).replace(/\/$/, '')
const RECOVERY_URL = process.env.RECOVERY_URL || `${FRONTEND_URL}/login`
const ORG_NAME = process.env.ORG_NAME || 'Rise Above Foundation Cebu'

/** Align From with authenticated SMTP mailbox (critical for Gmail inbox delivery). */
function resolvedFromEmail() {
  const smtp = SMTP_USER.trim()
  const configured = MAIL_FROM_EMAIL.trim()
  if (smtp && /@(gmail|googlemail)\.com$/i.test(smtp)) {
    if (configured && configured.toLowerCase() !== smtp.toLowerCase()) {
      console.warn(
        `[mail-service] MAIL_FROM_EMAIL (${configured}) differs from SMTP_USER (${smtp}). `
        + 'Using SMTP_USER as From to improve Gmail deliverability.',
      )
    }
    return smtp
  }
  return configured || smtp
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Transactional headers only — avoid Precedence:bulk / List-Unsubscribe
 * on account emails (those signals are for marketing and can hurt inboxing).
 */
function deliverabilityHeaders({ marketing = false } = {}) {
  const headers = {
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
    'X-Mailer': 'RiseAbove-DonationSystem',
  }
  if (marketing) {
    headers.Precedence = 'bulk'
    const mailto = LIST_UNSUBSCRIBE_MAILTO
    if (mailto && mailto.includes('@')) {
      headers['List-Unsubscribe'] = `<mailto:${mailto}?subject=unsubscribe>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
  }
  return headers
}

function buildMailOptions({ toEmail, toName, subject, html, text, replyTo, marketing = false }) {
  const fromEmail = resolvedFromEmail()
  const plain = (text && String(text).trim()) || htmlToPlainText(html)
  return {
    from: `"${MAIL_FROM_NAME}" <${fromEmail}>`,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    replyTo: replyTo || MAIL_REPLY_TO || fromEmail,
    subject,
    html,
    text: plain,
    headers: deliverabilityHeaders({ marketing }),
    attachments: logoAttachment(),
  }
}

const logoCandidates = [
  path.resolve(__dirname, 'assets/logo.png'),
  path.resolve(__dirname, '../src/assets/images/logo.png'),
  path.resolve(__dirname, '../api/uploads/logo.png'),
]

function resolveLogoPath() {
  return logoCandidates.find((p) => fs.existsSync(p)) || null
}

function createTransport() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in .env (use a Gmail App Password)')
  }
  const placeholderPasswords = new Set([
    'abcdefghijklmnop',
    'your_16_char_app_password',
    'xxxxx xxx xxxx xxxx'.replace(/\s/g, ''),
    'xxxxxxxxxxxx',
  ])
  if (placeholderPasswords.has(SMTP_PASS.toLowerCase()) || /^x{8,}$/i.test(SMTP_PASS)) {
    throw new Error(
      'SMTP_PASS is still the EXAMPLE placeholder (e.g. abcdefghijklmnop). '
      + 'Open https://myaccount.google.com/apppasswords while logged into '
      + SMTP_USER
      + ', create an App Password, paste the real 16-letter password into mail-service/.env as SMTP_PASS, then run npm run mail again.'
    )
  }

  // Prefer Gmail service shortcut when using Google SMTP — clearer auth errors.
  const usingGmail =
    /gmail\.com$/i.test(SMTP_HOST) ||
    /googlemail\.com$/i.test(SMTP_HOST) ||
    SMTP_HOST === 'smtp.gmail.com'

  if (usingGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER.trim(),
        pass: SMTP_PASS, // already stripped of spaces
      },
    })
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // true for 465
    auth: {
      user: SMTP_USER.trim(),
      pass: SMTP_PASS,
    },
  })
}

function friendlySmtpError(err) {
  const msg = String(err?.message || err || '')
  if (/535|BadCredentials|Username and Password not accepted/i.test(msg)) {
    return [
      'Gmail rejected the SMTP login (535 BadCredentials).',
      'In mail-service/.env you must use:',
      '1) SMTP_USER = a real Google account email (Gmail or Google Workspace)',
      '2) SMTP_PASS = a 16-character App Password (NOT your normal email password)',
      'Create one at: https://myaccount.google.com/apppasswords',
      'Then restart: npm run mail',
    ].join(' ')
  }
  return msg
}

function requireApiKey(req, res, next) {
  if (!API_KEY) return next()
  const key = req.get('x-mail-api-key') || req.query.key || ''
  if (key !== API_KEY) {
    return res.status(401).json({ ok: false, error: 'Invalid mail service API key' })
  }
  return next()
}

function logoAttachment() {
  const logoPath = resolveLogoPath()
  if (!logoPath) return []
  return [{
    filename: 'logo.png',
    path: logoPath,
    cid: 'orgLogo',
  }]
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'rafc-mail-service',
    version: '1.2.0',
    routes: ['/send', '/send-credentials', '/send-verification', '/send-invitation', '/verify-smtp'],
    smtpConfigured: Boolean(SMTP_USER && SMTP_PASS),
    smtpUser: SMTP_USER ? SMTP_USER.replace(/(.{2}).+(@.+)/, '$1***$2') : '',
    from: resolvedFromEmail(),
    replyTo: MAIL_REPLY_TO || resolvedFromEmail(),
    logo: Boolean(resolveLogoPath()),
    envFile: path.join(__dirname, '.env'),
  })
})

app.post('/send', requireApiKey, async (req, res) => {
  try {
    const { toEmail, toName, subject, html, text } = req.body || {}
    if (!toEmail || !subject || !html) {
      return res.status(400).json({ ok: false, error: 'toEmail, subject, and html are required' })
    }
    const transporter = createTransport()
    const info = await transporter.sendMail(buildMailOptions({
      toEmail,
      toName,
      subject,
      html: html.includes('cid:orgLogo') ? html : genericEmailHtml({ bodyHtml: html, orgName: ORG_NAME }),
      text,
    }))
    return res.json({
      ok: true,
      transport: 'nodemailer',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  } catch (err) {
    const error = friendlySmtpError(err)
    console.error('[mail-service] /send failed:', error)
    return res.status(500).json({ ok: false, transport: 'nodemailer', error })
  }
})

app.post('/send-credentials', requireApiKey, async (req, res) => {
  try {
    const {
      toEmail,
      toName,
      loginEmail,
      temporaryPassword,
      role,
      loginUrl,
      recoveryUrl,
    } = req.body || {}

    if (!toEmail || !loginEmail || !temporaryPassword) {
      return res.status(400).json({
        ok: false,
        error: 'toEmail, loginEmail, and temporaryPassword are required',
      })
    }

    const signInUrl = loginUrl || `${FRONTEND_URL}/login`
    const recoverUrl = recoveryUrl || RECOVERY_URL
    const roleLabel = role || 'Donor'
    const displayName = toName || loginEmail

    const html = credentialsEmailHtml({
      name: displayName,
      loginEmail,
      temporaryPassword,
      role: roleLabel,
      loginUrl: signInUrl,
      recoveryUrl: recoverUrl,
      orgName: ORG_NAME,
      year: new Date().getFullYear(),
      supportEmail: MAIL_REPLY_TO || resolvedFromEmail(),
    })

    const text = credentialsPlainText({
      name: displayName,
      loginEmail,
      temporaryPassword,
      role: roleLabel,
      loginUrl: signInUrl,
      recoveryUrl: recoverUrl,
      orgName: ORG_NAME,
    })

    const transporter = createTransport()
    const info = await transporter.sendMail(buildMailOptions({
      toEmail,
      toName: displayName,
      subject: CREDENTIALS_SUBJECT,
      html,
      text,
    }))

    console.log(`[mail-service] credentials sent to ${toEmail} (${info.messageId})`)
    return res.json({
      ok: true,
      transport: 'nodemailer',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  } catch (err) {
    const error = friendlySmtpError(err)
    console.error('[mail-service] /send-credentials failed:', error)
    return res.status(500).json({ ok: false, transport: 'nodemailer', error })
  }
})

app.post('/send-verification', requireApiKey, async (req, res) => {
  try {
    const { toEmail, toName, verifyUrl } = req.body || {}
    if (!toEmail || !verifyUrl) {
      return res.status(400).json({
        ok: false,
        error: 'toEmail and verifyUrl are required',
      })
    }

    const html = verificationEmailHtml({
      name: toName || toEmail,
      verifyUrl,
      orgName: ORG_NAME,
      year: new Date().getFullYear(),
    })

    const transporter = createTransport()
    const info = await transporter.sendMail(buildMailOptions({
      toEmail,
      toName,
      subject: `Verify it's you — ${ORG_NAME}`,
      html,
      text: [
        `Hi ${toName || 'there'},`,
        '',
        'Please verify your email to activate your Rise Above Foundation portal account.',
        `Open this link (expires in 24 hours): ${verifyUrl}`,
        '',
        'After verifying, sign in with the password you created during registration.',
        'If you did not create this account, you can ignore this email.',
      ].join('\n'),
    }))

    console.log(`[mail-service] verification sent to ${toEmail} (${info.messageId})`)
    return res.json({
      ok: true,
      transport: 'nodemailer',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  } catch (err) {
    const error = friendlySmtpError(err)
    console.error('[mail-service] /send-verification failed:', error)
    return res.status(500).json({ ok: false, transport: 'nodemailer', error })
  }
})

app.post('/send-invitation', requireApiKey, async (req, res) => {
  try {
    const {
      toEmail,
      toName,
      barangayName,
      inviteUrl,
      expiresInDays,
    } = req.body || {}

    if (!toEmail || !inviteUrl) {
      return res.status(400).json({
        ok: false,
        error: 'toEmail and inviteUrl are required',
      })
    }

    const barangay = barangayName || 'your barangay'
    const html = invitationEmailHtml({
      barangayName: barangay,
      inviteUrl,
      orgName: ORG_NAME,
      year: new Date().getFullYear(),
      expiresInDays: expiresInDays || 7,
    })

    const barangayLabel = /^(barangay|brgy\.?)\b/i.test(String(barangay).trim())
      ? String(barangay).trim()
      : `Barangay ${String(barangay).trim()}`

    const transporter = createTransport()
    const info = await transporter.sendMail(buildMailOptions({
      toEmail,
      toName: 'Barangay Representative',
      subject: `Barangay partnership invitation — ${ORG_NAME}`,
      html,
      text: [
        'Dear Barangay Representative,',
        '',
        `Rise Above Foundation Cebu invites ${barangayLabel} to join our Donation Management System as an official partner community.`,
        '',
        'Through this partnership, your barangay can request relief assistance, track distributions, submit delivery proofs, and coordinate with our team.',
        '',
        `To accept on behalf of your barangay, open this link (expires in ${expiresInDays || 7} days): ${inviteUrl}`,
        '',
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n'),
    }))

    console.log(`[mail-service] invitation sent to ${toEmail} (${info.messageId})`)
    return res.json({
      ok: true,
      transport: 'nodemailer',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  } catch (err) {
    const error = friendlySmtpError(err)
    console.error('[mail-service] /send-invitation failed:', error)
    return res.status(500).json({ ok: false, transport: 'nodemailer', error })
  }
})

app.post('/verify-smtp', requireApiKey, async (_req, res) => {
  try {
    const transporter = createTransport()
    await transporter.verify()
    return res.json({ ok: true, transport: 'nodemailer', user: SMTP_USER })
  } catch (err) {
    return res.status(500).json({ ok: false, transport: 'nodemailer', error: friendlySmtpError(err) })
  }
})

const server = app.listen(PORT, () => {
  console.log(`RAFC mail service listening on http://localhost:${PORT}`)
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('WARNING: SMTP_USER / SMTP_PASS are empty. Copy .env.example to .env and fill Gmail App Password.')
  }
})

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`)
    console.error('Run: npm run mail   (it will stop the old process and restart)')
    console.error(`Or manually: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`)
    process.exit(1)
  }
  throw err
})
