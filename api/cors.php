<?php
declare(strict_types=1);

/**
 * CORS for the Rise Above Foundation SPA.
 * Allows the configured frontend origin(s) plus local Vite ports.
 */

$corsConfig = __DIR__ . '/mail_config.php';
if (is_file($corsConfig)) {
  // Load URL constants early (idempotent if mailer.php loads them again).
  require_once $corsConfig;
}

$allowedOrigins = [];
foreach (['APP_URL', 'FRONTEND_URL', 'PUBLIC_URL'] as $envKey) {
  $val = getenv($envKey);
  if (is_string($val) && trim($val) !== '') {
    $allowedOrigins[] = rtrim(trim($val), '/');
  }
}
if (defined('FRONTEND_URL') && is_string(FRONTEND_URL) && trim((string) FRONTEND_URL) !== '') {
  $allowedOrigins[] = rtrim((string) FRONTEND_URL, '/');
}
$allowedOrigins = array_values(array_unique(array_filter($allowedOrigins)));

$requestOrigin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));

$allowOrigin = null;
if ($requestOrigin !== '') {
  $normalized = rtrim($requestOrigin, '/');
  if (in_array($normalized, $allowedOrigins, true)) {
    $allowOrigin = $requestOrigin;
  } elseif (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $normalized)) {
    // Local Vite / preview ports
    $allowOrigin = $requestOrigin;
  }
}

if ($allowOrigin === null && $allowedOrigins !== []) {
  $allowOrigin = $allowedOrigins[0];
}
if ($allowOrigin === null) {
  $allowOrigin = 'http://localhost:5173';
}

header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Vary: Origin');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
