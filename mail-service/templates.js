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
}) {
  const safe = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const displayName = safe(name || 'there')
  const email = safe(loginEmail)
  const password = safe(temporaryPassword)
  const roleLabel = safe(role || 'Donor')
  const signIn = safe(loginUrl || 'http://localhost:5173/login')
  const recovery = safe(recoveryUrl || '#')
  const brand = safe(orgName || 'Rise Above Foundation Cebu')
  const yr = safe(year || new Date().getFullYear())

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Your ${brand} account</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <!-- Brand header -->
          <tr>
            <td style="background:linear-gradient(135deg,#AF101A 0%,#7A0B12 100%);padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:56px;">
                    <img src="cid:orgLogo" alt="${brand}" width="48" height="48" style="display:block;border-radius:10px;border:2px solid rgba(255,255,255,0.35);background:#fff;" />
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="color:#ffffff;font-size:1.05rem;font-weight:700;letter-spacing:0.01em;">${brand}</div>
                    <div style="color:rgba(255,255,255,0.85);font-size:0.8rem;margin-top:2px;">Donation Management System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#AF101A;">Welcome</p>
              <h1 style="margin:0 0 14px;font-size:1.45rem;line-height:1.3;color:#0f172a;">Your ${roleLabel} account is ready</h1>
              <p style="margin:0 0 18px;font-size:0.98rem;line-height:1.65;color:#475569;">
                Hi ${displayName}, an administrator created a <strong style="color:#0f172a;">${roleLabel}</strong> account for you on the Rise Above Foundation portal.
                Use the temporary password below to sign in, then change it after your first login.
              </p>
            </td>
          </tr>

          <!-- Credentials card -->
          <tr>
            <td style="padding:0 28px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Email address</div>
                    <div style="font-size:1rem;font-weight:600;color:#0f172a;word-break:break-all;">${email}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Temporary password</div>
                    <div style="font-size:1.15rem;font-weight:700;font-family:Consolas,Monaco,monospace;color:#AF101A;letter-spacing:0.04em;">${password}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Recovery number</div>
                    <div style="font-size:0.98rem;font-weight:600;color:#64748b;">None yet</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTAs -->
          <tr>
            <td style="padding:4px 28px 12px;" align="center">
              <a href="${signIn}" style="display:inline-block;background:#AF101A;color:#ffffff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:10px;mso-padding-alt:0;">
                <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
                <span style="mso-text-raise:10pt;">Sign in to your account</span>
                <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i><![endif]-->
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;" align="center">
              <a href="${recovery}" style="display:inline-block;background:#ffffff;color:#AF101A;text-decoration:none;font-weight:700;font-size:0.9rem;padding:12px 22px;border-radius:10px;border:2px solid #AF101A;">
                Add Recovery Number Now
              </a>
              <p style="margin:12px 0 0;font-size:0.8rem;line-height:1.5;color:#94a3b8;max-width:420px;">
                Adding a recovery number helps you regain access if you forget your password. You can set this up later from your account settings.
              </p>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:0 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#9a3412;">
                    <strong>Security tip:</strong> This temporary password is only for your Rise Above Foundation portal account.
                    For your protection, sign in soon and change your password. Never share this email with others.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
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

export function verificationEmailHtml({
  name,
  verifyUrl,
  orgName,
  year,
}) {
  const safe = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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
