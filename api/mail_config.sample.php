<?php
declare(strict_types=1);

/**
 * Copy this file to mail_config.php and adjust.
 * mail_config.php is git-ignored so credentials stay out of version control.
 */

define('MAIL_FROM_EMAIL', 'no-reply@riseabovefoundation.org');
define('MAIL_FROM_NAME', 'Rise Above Foundation');

// Enable sending (required for verification emails).
define('MAIL_ENABLED', true);

/**
 * Transport:
 *   outbox — saves HTML under api/logs/mail_outbox (works offline / XAMPP)
 *   smtp   — real email via SMTP (fill SMTP_* below)
 *   mail   — PHP mail() (rarely works on Windows/XAMPP)
 */
define('MAIL_TRANSPORT', 'outbox');

// Frontend URL used in verification links (Vite default shown).
define('FRONTEND_URL', 'http://localhost:5173');

// Optional public API base (leave empty to auto-detect). Example for Apache:
// define('API_PUBLIC_URL', 'http://localhost/DonationSystem/api');
define('API_PUBLIC_URL', '');

// --- SMTP (only needed when MAIL_TRANSPORT = 'smtp') ---
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', '');          // your Gmail address
define('SMTP_PASS', '');          // Gmail App Password (not your normal password)
define('SMTP_SECURE', 'tls');     // tls | ssl | ''

define('MAIL_OUTBOX_DIR', __DIR__ . '/logs/mail_outbox');
