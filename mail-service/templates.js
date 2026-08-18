/**
 * Shared helpers for transactional mail (deliverability-focused).
 */

export function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Soft subject — avoid spam triggers like “password” / “credentials”. */
export const CREDENTIALS_SUBJECT = 'Your Rise Above Foundation Cebu portal account is ready'

export function credentialsPlainText({
  name,
  loginEmail,
  temporaryPassword,
  role,
  loginUrl,
  recoveryUrl,
  orgName,
}) {
  const brand = orgName || 'Rise Above Foundation Cebu'
  const isSpecialRole = ['staff', 'donor', 'volunteer'].includes((role || '').toLowerCase())
  const heading = isSpecialRole ? 'Welcome to Rise Above Foundation Cebu!' : 'Your portal account is ready'
  
  let intro = `An administrator created a ${role || 'Donor'} account for you on the ${brand} portal.`
  if ((role || '').toLowerCase() === 'staff') {
    intro = `Welcome to the ${brand} team! Your Staff Portal account is ready for managing assigned tasks and supporting operations.`
  } else if ((role || '').toLowerCase() === 'donor') {
    intro = `Welcome and thank you for being a valued donor and partner! Your Donor Portal allows you to manage and track your donations.`
  } else if ((role || '').toLowerCase() === 'volunteer') {
    intro = `Welcome as a volunteer! Your Volunteer Portal allows you to view assigned tasks, schedules, and support relief operations.`
  }

  return [
    `Hi ${name || 'there'},`,
    '',
    heading,
    '--------------------------------------------------',
    '',
    intro,
    '',
    `Sign-in email: ${loginEmail}`,
    `One-time sign-in code: ${temporaryPassword}`,
    '',
    `Open the portal: ${loginUrl}`,
    `Add a recovery number (optional): ${recoveryUrl}`,
    '',
    'After you sign in, please choose a new password for your account.',
    'If you did not expect this message, contact the foundation and do not share this email.',
    '',
    `— ${brand}`,
    'This is an automated message from the Donation Management System.',
  ].join('\n')
}

/**
 * Professional HTML email templates for Rise Above Foundation.
 */

export function credentialsEmailHtml({
  name,
  loginEmail,
  temporaryPassword,
  role,
  loginUrl,
  recoveryUrl,
  orgName,
  year,
  supportEmail,
}) {
  const safe = escapeHtml

  const displayName = safe(name || 'there')
  const email = safe(loginEmail)
  const password = safe(temporaryPassword)
  const roleLabel = safe(role || 'Donor')
  const signIn = safe(loginUrl)
  const recovery = safe(recoveryUrl || loginUrl)
  const brand = safe(orgName || 'Rise Above Foundation Cebu')
  const yr = safe(year || new Date().getFullYear())
  const support = safe(supportEmail || '')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>Your ${brand} portal account</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    Your ${roleLabel} portal account with ${brand} is ready. Sign in to get started.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;width:100%;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Brand header -->
          <tr>
            <td style="background:#AF101A;padding:20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:56px;vertical-align:middle;">
                    <img src="cid:orgLogo" alt="Rise Above Foundation Cebu" width="48" height="48" style="display:block;border-radius:50%;border:2px solid rgba(255,255,255,0.45);background:#ffffff;" />
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="margin:0;color:#ffffff;font-size:1.08rem;font-weight:700;line-height:1.25;">Rise Above Foundation Cebu</div>
                    <div style="margin:3px 0 0;color:rgba(255,255,255,0.88);font-size:0.82rem;line-height:1.3;">Donation Management System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td style="padding:30px 28px 6px;">
              <p style="margin:0 0 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#AF101A;">Account ready</p>
              <h1 style="margin:0 0 14px;font-size:1.45rem;line-height:1.3;font-weight:750;color:#0f172a;">
                ${['staff', 'donor', 'volunteer'].includes((role || '').toLowerCase()) ? 'Welcome to Rise Above Foundation Cebu!' : 'Your portal account is ready'}
              </h1>
              <p style="margin:0 0 8px;font-size:0.98rem;line-height:1.65;color:#475569;">
                ${(role || '').toLowerCase() === 'staff'
                  ? `Hi ${displayName}, welcome to the Rise Above Foundation Cebu team! Your Staff Portal account is ready for managing assigned tasks and supporting operations. Use the one-time sign-in details below, then choose a new password after your first login.`
                  : (role || '').toLowerCase() === 'donor'
                  ? `Hi ${displayName}, welcome and thank you for being a valued donor and partner! Your Donor Portal allows you to manage and track your donations. Use the one-time sign-in details below, then choose a new password after your first login.`
                  : (role || '').toLowerCase() === 'volunteer'
                  ? `Hi ${displayName}, welcome as a volunteer! Your Volunteer Portal allows you to view assigned tasks, schedules, and support relief operations. Use the one-time sign-in details below, then choose a new password after your first login.`
                  : `Hi ${displayName}, an administrator created a <strong style="color:#0f172a;">${roleLabel}</strong> account for you on the Rise Above Foundation Cebu portal. Use the one-time sign-in details below, then choose a new password after your first login.`
                }
              </p>
            </td>
          </tr>

          <!-- Sign-in details -->
          <tr>
            <td style="padding:16px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2e8f0;">
                    <div style="margin:0 0 6px;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Sign-in email</div>
                    <div style="margin:0;font-size:1rem;font-weight:650;color:#0f172a;word-break:break-all;">${email}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="margin:0 0 6px;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">One-time sign-in code</div>
                    <div style="margin:0;font-size:1.15rem;font-weight:750;font-family:Consolas,Monaco,'Courier New',monospace;color:#AF101A;letter-spacing:0.04em;word-break:break-all;">${password}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Login button -->
          <tr>
            <td style="padding:22px 28px 8px;" align="center">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${signIn}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="#AF101A">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:700;">Open portal sign-in</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${signIn}" style="display:inline-block;background:#AF101A;color:#ffffff;text-decoration:none;font-weight:750;font-size:1rem;line-height:1.2;padding:15px 32px;border-radius:10px;mso-hide:all;">
                Open portal sign-in
              </a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td style="padding:10px 28px 8px;" align="center">
              <a href="${recovery}" style="display:inline-block;background:#ffffff;color:#AF101A;text-decoration:none;font-weight:700;font-size:0.9rem;padding:12px 22px;border-radius:10px;border:2px solid #AF101A;">
                Add recovery number
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;" align="center">
              <p style="margin:0;font-size:0.78rem;line-height:1.5;color:#94a3b8;word-break:break-all;max-width:420px;">
                Or open this link: <a href="${signIn}" style="color:#2563eb;text-decoration:underline;">${signIn}</a>
              </p>
            </td>
          </tr>

          <!-- Security tip -->
          <tr>
            <td style="padding:0 28px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#475569;">
                    <strong style="color:#0f172a;">Security note:</strong> This one-time code is only for your Rise Above Foundation Cebu portal account.
                    Sign in soon, set your own password, and never forward this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;" align="center">
              <p style="margin:0 0 4px;font-size:0.82rem;font-weight:650;color:#475569;">Rise Above Foundation Cebu</p>
              <p style="margin:0;font-size:0.75rem;line-height:1.55;color:#94a3b8;">
                © ${yr} ${brand}. All rights reserved.<br />
                This transactional message was sent because an administrator created a portal account for you.
                ${support ? `<br />Questions? Contact <a href="mailto:${support}" style="color:#2563eb;text-decoration:underline;">${support}</a>.` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function verificationEmailHtml({
  name,
  verifyUrl,
  orgName,
  year,
}) {
  const safe = escapeHtml

  const displayName = safe(name || 'there')
  const link = safe(verifyUrl || '#')
  const brand = safe(orgName || 'Rise Above Foundation Cebu')
  const yr = safe(year || new Date().getFullYear())

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Verify your ${brand} account</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#AF101A 0%,#7A0B12 100%);padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:56px;">
                    <img src="cid:orgLogo" alt="${brand}" width="48" height="48" style="display:block;border-radius:10px;border:2px solid rgba(255,255,255,0.35);background:#fff;" />
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="color:#ffffff;font-size:1.05rem;font-weight:700;">${brand}</div>
                    <div style="color:rgba(255,255,255,0.85);font-size:0.8rem;margin-top:2px;">Account verification</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#AF101A;">Confirm your email</p>
              <h1 style="margin:0 0 14px;font-size:1.45rem;line-height:1.3;color:#0f172a;">Verify it&apos;s you</h1>
              <p style="margin:0 0 18px;font-size:0.98rem;line-height:1.65;color:#475569;">
                Hi ${displayName}, we received a request to create a portal account with this email address.
                Click the button below to verify your email and activate your account.
                After that, sign in with the <strong>same password you created during registration</strong> — you will not be asked to set a new one.
                This link expires in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 12px;" align="center">
              <a href="${link}" style="display:inline-block;background:#AF101A;color:#ffffff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:10px;">
                Verify it&apos;s you
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <p style="margin:0 0 8px;font-size:0.8rem;color:#94a3b8;">Or copy and paste this link into your browser:</p>
              <p style="margin:0;word-break:break-all;font-size:0.82rem;line-height:1.5;">
                <a href="${link}" style="color:#2563eb;text-decoration:underline;">${link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#9a3412;">
                    If you did not create a Rise Above Foundation account, you can safely ignore this email. Your address will not be activated.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:0.78rem;line-height:1.55;color:#94a3b8;text-align:center;">
                © ${yr} ${brand}. All rights reserved.<br />
                This is an automated message from the Donation Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function formatBarangayLabel(name) {
  const raw = String(name || '').trim()
  if (!raw) return 'your barangay'
  if (/^(barangay|brgy\.?)\b/i.test(raw)) return raw
  return `Barangay ${raw}`
}

export function invitationEmailHtml({
  barangayName,
  inviteUrl,
  orgName,
  year,
  expiresInDays = 7,
}) {
  const safe = escapeHtml

  const barangay = safe(formatBarangayLabel(barangayName))
  const link = safe(inviteUrl || '#')
  const brand = safe(orgName || 'Rise Above Foundation Cebu')
  const yr = safe(year || new Date().getFullYear())
  const days = Number(expiresInDays) || 7

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Partnership invitation — Rise Above Foundation Cebu</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Rise Above Foundation Cebu invites ${barangay} to join as an official partner community.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#AF101A;padding:20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:56px;vertical-align:middle;">
                    <img src="cid:orgLogo" alt="Rise Above Foundation Cebu" width="48" height="48" style="display:block;border-radius:50%;border:2px solid rgba(255,255,255,0.45);background:#ffffff;" />
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="color:#ffffff;font-size:1.08rem;font-weight:700;">Rise Above Foundation Cebu</div>
                    <div style="color:rgba(255,255,255,0.88);font-size:0.82rem;margin-top:3px;">Barangay partnership invitation</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;">
              <p style="margin:0 0 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#AF101A;">Barangay invitation</p>
              <h1 style="margin:0 0 14px;font-size:1.55rem;line-height:1.3;color:#0f172a;">Partner with Rise Above Foundation Cebu</h1>
              <p style="margin:0 0 14px;font-size:0.98rem;line-height:1.65;color:#475569;">
                Dear Barangay Representative,
              </p>
              <p style="margin:0 0 14px;font-size:0.98rem;line-height:1.65;color:#475569;">
                Rise Above Foundation Cebu invites <strong style="color:#0f172a;">${barangay}</strong> to join our Donation Management System as an official partner community.
              </p>
              <p style="margin:0 0 14px;font-size:0.98rem;line-height:1.65;color:#475569;">
                Through this partnership, your barangay can request relief assistance, track distributions, submit delivery proofs, and coordinate with our team more efficiently — so aid reaches families who need it most.
              </p>
              <p style="margin:0 0 8px;font-size:0.98rem;line-height:1.65;color:#475569;">
                To accept on behalf of your barangay, please complete the short registration form. Our administrators will review the application. Once approved, login credentials will be emailed to this address.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 10px;" align="center">
              <a href="${link}" style="display:inline-block;background:#AF101A;color:#ffffff;text-decoration:none;font-weight:750;font-size:1rem;padding:15px 32px;border-radius:10px;">
                Accept Invitation
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 22px;" align="center">
              <p style="margin:0;font-size:0.8rem;line-height:1.5;color:#94a3b8;">This invitation expires in <strong style="color:#64748b;">${days} days</strong>.</p>
              <p style="margin:10px 0 0;font-size:0.78rem;line-height:1.5;color:#94a3b8;word-break:break-all;">
                Or open: <a href="${link}" style="color:#2563eb;text-decoration:underline;">${link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#9a3412;">
                    If you were not expecting this invitation for your barangay, you can ignore this email. No account is created until an administrator approves the application.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:0.82rem;font-weight:650;color:#475569;">Rise Above Foundation Cebu</p>
              <p style="margin:0;font-size:0.75rem;line-height:1.55;color:#94a3b8;">
                © ${yr} ${brand}. All rights reserved.<br />
                This is an automated message from the Donation Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function genericEmailHtml({ title, bodyHtml, orgName }) {
  const brand = orgName || 'Rise Above Foundation Cebu'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#AF101A;padding:18px 24px;color:#fff;font-weight:700;display:flex;align-items:center;gap:12px">
      <img src="cid:orgLogo" alt="" width="40" height="40" style="border-radius:8px;background:#fff" />
      <span>${brand}</span>
    </div>
    <div style="padding:28px 24px;line-height:1.55;font-size:0.95rem">
      ${title ? `<h1 style="margin:0 0 12px;font-size:1.25rem">${title}</h1>` : ''}
      ${bodyHtml || ''}
    </div>
  </div>
</body></html>`
}

