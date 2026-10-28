<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/**
 * Admin-only mail delivery check (NodeMailer preferred).
 * POST { "email": "someone@gmail.com" } → sends a short test message.
 */
require_auth(['SuperAdmin', 'Admin']);

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
  '<p>This is a test email from the Rise Above Foundation Donation System.</p>'
    . '<p>If you received this in your inbox, your email provider is connected and delivering successfully!</p>'
);
$result = mail_last_result();
$transport = (string) ($result['transport'] ?? '');
$delivered = $sent && in_array($transport, ['brevo', 'nodemailer', 'smtp'], true);

json_response([
  'ok' => $delivered,
  'delivered' => $delivered,
  'transport' => $transport,
  'error' => $result['error'] ?? '',
  'hint' => !$delivered
    ? 'For production, configure BREVO_API_KEY, a verified MAIL_FROM_EMAIL, and MAIL_TRANSPORT=auto. For local NodeMailer, start `npm run mail` and configure its SMTP credentials.'
    : '',
]);
