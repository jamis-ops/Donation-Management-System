<?php
declare(strict_types=1);
/**
 * Authenticated file gate for sensitive uploads (donation proofs, distribution proofs).
 * Profile photos remain publicly readable via /api/uploads/profiles/...
 *
 * Usage: /api/file.php?kind=donation_proofs|proofs&name=filename.ext
 */
require_once __DIR__ . '/bootstrap.php';

$user = require_auth();
$kind = preg_replace('/[^a-z_]/', '', strtolower((string) ($_GET['kind'] ?? ''))) ?: '';
$name = basename((string) ($_GET['name'] ?? ''));

$allowed = [
  'donation_proofs' => ['Admin', 'Staff', 'Donor'],
  'proofs' => ['Admin', 'Staff', 'Beneficiary', 'Volunteer'],
];

if ($kind === '' || $name === '' || !isset($allowed[$kind])) {
  json_response(['ok' => false, 'error' => 'Invalid file request'], 400);
}
if (!in_array((string) ($user['role'] ?? ''), $allowed[$kind], true)
  && empty($user['isSuperAdmin'])) {
  json_response(['ok' => false, 'error' => 'Access denied'], 403);
}

$path = __DIR__ . '/uploads/' . $kind . '/' . $name;
if (!is_file($path)) {
  json_response(['ok' => false, 'error' => 'File not found'], 404);
}

$mime = mime_content_type($path) ?: 'application/octet-stream';
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string) filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=3600');
readfile($path);
exit;
