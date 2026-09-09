<?php
declare(strict_types=1);

/**
 * DATABASE SETTINGS (MySQL) — NOT your website login!
 *
 * These are for connecting PHP to MySQL (phpMyAdmin / XAMPP).
 * XAMPP default is usually:
 *   username: root
 *   password: (leave empty)
 *
 * Your website login (admin@riseabovefoundation.org / admin123) goes in the
 * users table — do NOT put it here.
 */

// Auto-load .env file if present in Backend or project root
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

$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = (int) (getenv('DB_PORT') ?: 3306);
$DB_NAME = getenv('DB_NAME') ?: 'donation_system';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASSWORD') ?: (getenv('DB_PASS') ?: '');
$DB_SSL  = strtolower((string)(getenv('DB_SSL') ?: '')) === 'true' || $DB_PORT === 4000 || str_contains($DB_HOST, 'tidbcloud.com');

/**
 * GOOGLE GEMINI AI CONFIGURATION (ai.google.dev)
 * 
 * Google AI Studio API key for AI Resume/CV matching and program recommendations.
 * Configure via GEMINI_API_KEY environment variable or local api/ai_config.php
 */
$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';
if (file_exists(__DIR__ . '/ai_config.php')) {
  require_once __DIR__ . '/ai_config.php';
}

function db(): PDO {
  global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS, $DB_SSL;

  static $pdoInstance = null;
  if ($pdoInstance !== null) {
    return $pdoInstance;
  }

  $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
  $options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];

  // Enable SSL/TLS for TiDB Cloud or when DB_SSL is enabled
  if ($DB_SSL) {
    $options[PDO::MYSQL_ATTR_SSL_CA] = true;
    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
  }

  try {
    $pdoInstance = new PDO($dsn, $DB_USER, $DB_PASS, $options);
    return $pdoInstance;
  } catch (PDOException $e) {
    if (!headers_sent()) {
      http_response_code(500);
      header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
      'ok' => false,
      'error' => 'Database connection failed: ' . $e->getMessage(),
    ]);
    exit;
  }
}

function json_response($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

function read_json_body(): array {
  // php://input can only be read once — cache so request_method() + handlers
  // can both access the same payload (POST/PUT JSON).
  static $cached = null;
  if ($cached !== null) {
    return $cached;
  }
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') {
    $cached = [];
    return $cached;
  }
  $data = json_decode($raw, true);
  $cached = is_array($data) ? $data : [];
  return $cached;
}
