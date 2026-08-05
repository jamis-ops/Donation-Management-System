<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();

if ($method !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();

$name = trim((string) ($body['name'] ?? $body['fullName'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));
$subject = trim((string) ($body['subject'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));

if ($name === '') {
  json_response(['ok' => false, 'error' => 'Name is required'], 400);
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'A valid email is required'], 400);
}
if ($message === '') {
  json_response(['ok' => false, 'error' => 'Message is required'], 400);
}

$code = generate_code('MSG');
$stmt = $pdo->prepare('INSERT INTO contact_messages (code, full_name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([
  $code,
  $name,
  $email,
  $subject !== '' ? $subject : null,
  $message,
  'New',
]);

notify_admins(
  $pdo,
  'contact',
  'New contact message',
  "{$name}: " . ($subject !== '' ? $subject : 'No subject') . " ({$code})",
  '/admin'
);

// Optional email notify to foundation / admin addresses
$emailNotified = false;
$notifyTo = '';
if (defined('FOUNDATION_EMAIL') && FOUNDATION_EMAIL) {
  $notifyTo = (string) FOUNDATION_EMAIL;
} elseif (defined('MAIL_FROM_EMAIL') && MAIL_FROM_EMAIL) {
  $notifyTo = (string) MAIL_FROM_EMAIL;
}

// Prefer first Admin user's email when available
try {
  $adminEmail = $pdo->query(
    "SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'Admin' AND u.email IS NOT NULL AND u.email != ''
     ORDER BY u.id ASC LIMIT 1"
  )->fetchColumn();
  if ($adminEmail) {
    $notifyTo = (string) $adminEmail;
  }
} catch (Throwable $e) {
  // ignore
}

if ($notifyTo !== '' && function_exists('send_mail')) {
  $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
  $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
  $safeSubject = htmlspecialchars($subject !== '' ? $subject : '(no subject)', ENT_QUOTES, 'UTF-8');
  $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
  $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
  $html = "<p><strong>New contact form message</strong> ({$safeCode})</p>"
    . "<p><strong>From:</strong> {$safeName} &lt;{$safeEmail}&gt;</p>"
    . "<p><strong>Subject:</strong> {$safeSubject}</p>"
    . "<p>{$safeMessage}</p>"
    . email_link_html('/admin', 'Open admin portal');
  $emailNotified = (bool) send_mail($notifyTo, 'Rise Above Admin', "[Contact] {$subject} ({$code})", $html);
}

json_response([
  'ok' => true,
  'data' => [
    'code' => $code,
    'name' => $name,
    'email' => $email,
    'subject' => $subject,
  ],
  'trackingCode' => $code,
  'emailNotified' => $emailNotified,
], 201);
