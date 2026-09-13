<?php
declare(strict_types=1);

/**
 * Production CORS for the Rise Above Foundation SPA.
 * Allows configured frontend origin(s), any Vercel deployment (*.vercel.app), plus local Vite ports.
 */

// Start output buffering immediately to prevent any accidental output from breaking HTTP headers / JSON responses
if (ob_get_level() === 0) {
  ob_start();
}

// Auto-load .env file if present
(function() {
  $envFiles = [
    dirname(__DIR__) . '/.env',
    __DIR__ . '/.env',
    dirname(__DIR__, 2) . '/.env',
  ];
  foreach ($envFiles as $file) {
    if (is_file($file) && is_readable($file)) {
      $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
      if ($lines !== false) {
        foreach ($lines as $line) {
          $line = trim($line);
          if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
          }
          [$key, $value] = explode('=', $line, 2);
          $key = trim($key);
          $value = trim($value, " \t\n\r\0\x0B\"'");
          if ($key !== '' && getenv($key) === false) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
          }
        }
      }
      break;
    }
  }
})();

$corsConfig = __DIR__ . '/mail_config.php';
if (is_file($corsConfig)) {
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
  } elseif (preg_match('#^https://[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$#i', $normalized)) {
    // Vercel production & preview domains
    $allowOrigin = $requestOrigin;
  } else {
    // Allow request origin if configured or valid HTTPS
    $allowOrigin = $requestOrigin;
  }
}

if ($allowOrigin === null && $allowedOrigins !== []) {
  $allowOrigin = $allowedOrigins[0];
}
if ($allowOrigin === null) {
  $allowOrigin = '*';
}

header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Vary: Origin');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
