<?php
declare(strict_types=1);

/**
 * Lightweight, secure HMAC-SHA256 Token authentication for cross-origin SPA requests.
 * Provides fallback when browser third-party cookie restrictions block PHPSESSID cross-site cookies.
 */

function get_auth_secret(): string
{
  $secret = getenv('APP_KEY') ?: getenv('SESSION_SECRET') ?: getenv('JWT_SECRET') ?: '';
  if (is_string($secret) && trim($secret) !== '') {
    return trim($secret);
  }
  return 'RiseAbove_Auth_Token_Secret_2026_Secure_Key_!#9';
}

function generate_auth_token(array $user, int $lifetime = 2592000): string
{
  $payload = [
    'id' => (int) ($user['id'] ?? 0),
    'email' => (string) ($user['email'] ?? ''),
    'name' => (string) ($user['name'] ?? ''),
    'role' => (string) ($user['role'] ?? ''),
    'isSuperAdmin' => !empty($user['isSuperAdmin']),
    'exp' => time() + $lifetime,
    'iat' => time(),
  ];

  $payloadJson = (string) json_encode($payload, JSON_UNESCAPED_SLASHES);
  $payloadB64 = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');
  $signature = hash_hmac('sha256', $payloadB64, get_auth_secret());

  return $payloadB64 . '.' . $signature;
}

function verify_auth_token(?string $token): ?array
{
  if (!is_string($token) || trim($token) === '') {
    return null;
  }
  $token = trim($token);
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) {
    return null;
  }
  [$payloadB64, $signature] = $parts;
  $expectedSig = hash_hmac('sha256', $payloadB64, get_auth_secret());
  if (!hash_equals($expectedSig, $signature)) {
    return null;
  }

  $json = base64_decode(strtr($payloadB64, '-_', '+/'));
  if (!$json) {
    return null;
  }
  $payload = json_decode($json, true);
  if (!is_array($payload) || empty($payload['exp']) || $payload['exp'] < time()) {
    return null;
  }

  return $payload;
}

function get_bearer_token(): ?string
{
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
  if (!$auth && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? null;
  }
  if (!$auth && isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
    $auth = 'Bearer ' . $_SERVER['HTTP_X_AUTH_TOKEN'];
  }
  if (!$auth && isset($_GET['auth_token'])) {
    $auth = 'Bearer ' . $_GET['auth_token'];
  }

  if (is_string($auth) && preg_match('/Bearer\s+(\S+)/i', $auth, $matches)) {
    return $matches[1];
  }
  return null;
}
