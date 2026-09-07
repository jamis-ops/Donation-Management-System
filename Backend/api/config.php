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

$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_PORT = getenv('DB_PORT') ?: '3306';
$DB_NAME = getenv('DB_NAME') ?: 'donation_system';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$DB_SSL  = filter_var(getenv('DB_SSL') ?: false, FILTER_VALIDATE_BOOLEAN);

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

  $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
  
  $options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];

  // TiDB Cloud / Remote SSL configuration
  if ($DB_SSL || (int)$DB_PORT === 4000 || str_contains($DB_HOST, 'tidbcloud.com')) {
    if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
      $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }
  }

  $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
  return $pdo;
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
