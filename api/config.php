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

$DB_HOST = '127.0.0.1';
$DB_NAME = 'donation_system';
$DB_USER = 'root';   // MySQL username (NOT your admin email)
$DB_PASS = '';       // MySQL password (XAMPP default is empty)

function db(): PDO {
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;

  $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
  $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}

function json_response($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}
