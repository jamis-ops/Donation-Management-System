<?php
declare(strict_types=1);

/**
 * Copy this file to mail_config.php and adjust.
 * mail_config.php is git-ignored so credentials stay out of version control.
 *
 * === Recommended setup (NodeMailer → Gmail) ===
 * 1. Copy mail-service/.env.example → mail-service/.env
 * 2. Put your Gmail + App Password in mail-service/.env
 * 3. Run: npm run mail   (keeps NodeMailer listening on port 8025)
 * 4. Keep MAIL_TRANSPORT = 'nodemailer' below
 * 5. Match MAIL_NODE_API_KEY with MAIL_SERVICE_API_KEY in mail-service/.env
 *
 * Gmail App Password: Google Account → Security → 2-Step Verification → App passwords
 */

define('MAIL_FROM_EMAIL', 'your.gmail@gmail.com');
define('MAIL_FROM_NAME', 'Rise Above Foundation');

define('MAIL_ENABLED', true);

/**
 * Transport:
 *   nodemailer — real email via NodeMailer mail-service (recommended)
 *   smtp       — PHP fsockopen SMTP fallback
 *   outbox     — save HTML under api/logs/mail_outbox only
 *   mail       — PHP mail() (rarely works on Windows)
 */
define('MAIL_TRANSPORT', 'nodemailer');

/** URL of the Node mail-service (npm run mail) */
define('MAIL_NODE_URL', 'http://127.0.0.1:8025');
/** Must match MAIL_SERVICE_API_KEY in mail-service/.env (or leave both empty) */
define('MAIL_NODE_API_KEY', 'change-me-to-a-long-random-string');

define('FRONTEND_URL', 'http://localhost:5173');
define('API_PUBLIC_URL', '');
/** “Add Recovery Number Now” button target (update when the page exists) */
define('RECOVERY_URL', 'http://localhost:5173/login');

/** Optional PHP SMTP fallback (usually unused when NodeMailer is running) */
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your.gmail@gmail.com');
define('SMTP_PASS', '');
define('SMTP_SECURE', 'tls');

define('MAIL_OUTBOX_DIR', __DIR__ . '/logs/mail_outbox');
