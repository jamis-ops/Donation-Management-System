<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$token = trim((string) ($_GET['token'] ?? ''));
$wantJson = (isset($_GET['format']) && $_GET['format'] === 'json')
  || (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json'));

/** Verification links expire after 24 hours. */
const VERIFY_TOKEN_TTL_SECONDS = 86400;

/**
 * JSON response helper (legacy clients).
 */
function verify_json(bool $ok, string $title, string $message, int $status = 200): void
{
  json_response([
    'ok' => $ok,
    'title' => $title,
    'message' => $message,
    'loginUrl' => frontend_url('/verified'),
  ], $status);
}

/**
 * HTML result page when redirect is not appropriate (errors).
 */
function verify_page(string $title, string $message, bool $ok): void
{
  $loginUrl = htmlspecialchars(frontend_url($ok ? '/verified' : '/login'), ENT_QUOTES, 'UTF-8');
  $color = $ok ? '#16a34a' : '#dc2626';
  http_response_code($ok ? 200 : 400);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    . '<title>' . htmlspecialchars($title) . '</title></head>'
    . '<body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;display:flex;min-height:100vh;align-items:center;justify-content:center">'
    . '<div style="max-width:460px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:40px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)">'
    . '<div style="width:56px;height:56px;border-radius:50%;background:' . $color . '1a;color:' . $color . ';display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:28px;font-weight:700">'
    . ($ok ? '&#10003;' : '&#33;') . '</div>'
    . '<h1 style="font-size:1.25rem;margin:0 0 10px;color:#0f172a">' . htmlspecialchars($title) . '</h1>'
    . '<p style="color:#475569;line-height:1.5;margin:0 0 22px">' . htmlspecialchars($message) . '</p>'
    . '<a href="' . $loginUrl . '" style="display:inline-block;background:#AF101A;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600">'
    . ($ok ? 'Continue' : 'Go to Sign In') . '</a>'
    . '</div></body></html>';
  exit;
}

function respond(string $title, string $message, bool $ok, bool $wantJson): void
{
  if ($wantJson) {
    verify_json($ok, $title, $message, $ok ? 200 : 400);
  }
  if ($ok) {
    header('Location: ' . frontend_url('/verified'));
    exit;
  }
  verify_page($title, $message, false);
}

if ($token === '') {
  respond('Invalid link', 'This verification link is missing its token. Please use the link from your email.', false, $wantJson);
}

$stmt = $pdo->prepare('SELECT id, full_name, status, email_verified_at, verification_sent_at FROM users WHERE verification_token = ? LIMIT 1');
$stmt->execute([$token]);
$user = $stmt->fetch();

if (!$user) {
  respond(
    'Link not found',
    'This verification link is invalid or has already been used. Try signing in — your account may already be verified.',
    false,
    $wantJson
  );
}

if (!empty($user['email_verified_at']) || $user['status'] === 'ACTIVE') {
  $pdo->prepare('UPDATE users SET verification_token = NULL, status = \'ACTIVE\' WHERE id = ?')->execute([$user['id']]);
  respond('Already verified', 'Your account has already been verified. Sign in with the password you created during registration.', true, $wantJson);
}

$sentAt = $user['verification_sent_at'] ?? null;
if ($sentAt) {
  $sentTs = strtotime((string) $sentAt);
  if ($sentTs !== false && (time() - $sentTs) > VERIFY_TOKEN_TTL_SECONDS) {
    respond(
      'Link expired',
      'This verification link has expired (valid for 24 hours). Please register again or contact support.',
      false,
      $wantJson
    );
  }
}

$pdo->prepare("UPDATE users SET status = 'ACTIVE', email_verified_at = NOW(), verification_token = NULL WHERE id = ?")
  ->execute([$user['id']]);

respond('Email verified', 'Your account has been successfully verified. Sign in with the password you created during registration.', true, $wantJson);
