<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

/**
 * Admin-only mail delivery check (NodeMailer preferred).
 * POST { "email": "someone@gmail.com" } → sends a short test message.
 */
require_auth(['Admin']);

if (request_method() !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$email = strtolower(trim((string) ($body['email'] ?? '')));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'Provide a valid email address to test'], 400);
}

$sent = send_mail(
  $email,
  'Test Recipient',
  'Rise Above Foundation — mail test',
  '<p>This is a test email from the Donation System mailer (NodeMailer).</p>'
    . '<p>If you received this in your Gmail inbox, SMTP is configured correctly in <code>mail-service/.env</code>.</p>'
);
$result = mail_last_result();
$transport = (string) ($result['transport'] ?? '');
$delivered = $sent && in_array($transport, ['nodemailer', 'smtp'], true);

json_response([
  'ok' => $delivered,
  'delivered' => $delivered,
  'transport' => $transport,
  'error' => $result['error'] ?? '',
  'hint' => !$delivered
    ? 'Start the mail service (`npm run mail`), set SMTP_USER/SMTP_PASS in mail-service/.env (Gmail App Password), and set MAIL_TRANSPORT=nodemailer in api/mail_config.php.'
    : '',
]);
