<?php
declare(strict_types=1);
/**
 * Authenticated file gate for sensitive uploads (donation proofs, distribution proofs).
 * Profile photos remain publicly readable via /api/uploads/profiles/...
 *
 * Usage: /api/file.php?kind=donation_proofs|proofs&name=filename.ext
 */
require_once __DIR__ . '/bootstrap.php';

$kind = preg_replace('/[^a-z_]/', '', strtolower((string) ($_GET['kind'] ?? ''))) ?: '';
$name = basename((string) ($_GET['name'] ?? ''));

// Public assets (certificates logos/signatures, partners, profiles, and payment_methods) — serve them without requiring auth
if (in_array($kind, ['certificates', 'partners', 'payment_methods'], true)) {
  if ($name === '') {
    json_response(['ok' => false, 'error' => "Invalid {$kind} image request"], 400);
  }
  $dir = __DIR__ . '/uploads/' . $kind;
  $path = $dir . '/' . $name;
  if (is_file($path)) {
    $mime = mime_content_type($path) ?: 'image/png';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    readfile($path);
    exit;
  }

  // Database fallback for certificate images & photos (restores from DB if disk storage was wiped)
  if ($kind === 'certificates') {
    try {
      $pdo = db();
      $stmt = $pdo->prepare('SELECT photo_data FROM certificates WHERE photo_url = ? OR photo_url LIKE ? LIMIT 1');
      $stmt->execute([$name, '%' . $name . '%']);
      $photoData = $stmt->fetchColumn();

      if ($photoData && str_starts_with($photoData, 'data:image/')) {
        if (preg_match('/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/', $photoData, $m)) {
          $mime = $m[1];
          $binary = base64_decode($m[2]);
          if ($binary !== false) {
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            @file_put_contents($path, $binary);
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . (string) strlen($binary));
            header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: public, max-age=86400');
            echo $binary;
            exit;
          }
        }
      }

      // Check signatories table if a signatory signature was requested
      $sigStmt = $pdo->prepare('SELECT signature_image FROM certificate_signatories WHERE signature_image = ? OR signature_image LIKE ? LIMIT 1');
      $sigStmt->execute([$name, '%' . $name . '%']);
      $sigData = $sigStmt->fetchColumn();
      if ($sigData && str_starts_with($sigData, 'data:image/')) {
        if (preg_match('/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/', $sigData, $m)) {
          $mime = $m[1];
          $binary = base64_decode($m[2]);
          if ($binary !== false) {
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            @file_put_contents($path, $binary);
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . (string) strlen($binary));
            header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: public, max-age=86400');
            echo $binary;
            exit;
          }
        }
      }
    } catch (Throwable) {}
  }

  json_response(['ok' => false, 'error' => "Asset not found in {$kind}"], 404);
}

// Profile photos are public assets — serve them without requiring auth
if ($kind === 'profiles') {
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Invalid profile photo request'], 400);
  }
  $dir = __DIR__ . '/uploads/profiles';
  $path = $dir . '/' . $name;
  if (is_file($path)) {
    $mime = mime_content_type($path) ?: 'image/jpeg';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    readfile($path);
    exit;
  }

  // Fallback if file was deleted by container restart: check database for user's profile photo
  try {
    $pdo = db();
    $uid = 0;
    if (preg_match('/^profile_(\d+)_/', $name, $matches)) {
      $uid = (int) $matches[1];
    }
    if ($uid === 0) {
      $photoData = get_super_admin_profile_photo();
    } else {
      $stmt = $pdo->prepare('SELECT profile_photo FROM users WHERE id = ? OR profile_photo LIKE ? LIMIT 1');
      $stmt->execute([$uid, '%' . $name . '%']);
      $photoData = $stmt->fetchColumn();
    }
    if ($photoData && str_starts_with($photoData, 'data:image/')) {
      if (preg_match('/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/', $photoData, $m)) {
        $mime = $m[1];
        $binary = base64_decode($m[2]);
        if ($binary !== false) {
          if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
          }
          @file_put_contents($path, $binary);
          header('Content-Type: ' . $mime);
          header('Content-Length: ' . (string) strlen($binary));
          header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
          header('X-Content-Type-Options: nosniff');
          header('Cache-Control: public, max-age=86400');
          echo $binary;
          exit;
        }
      }
    }
  } catch (Throwable) {}

  json_response(['ok' => false, 'error' => 'Profile photo not found'], 404);
}

$user = require_auth();

$allowed = [
  'donation_proofs' => ['Admin', 'Staff', 'Donor'],
  'proofs' => ['Admin', 'Staff', 'Beneficiary', 'Volunteer'],
  'volunteer_resumes' => ['Admin', 'Staff', 'Volunteer'],
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
$downloadName = isset($_GET['download']) && trim((string) $_GET['download']) !== ''
  ? basename((string) $_GET['download'])
  : $name;

$disposition = isset($_GET['download']) ? 'attachment' : 'inline';

header('Content-Type: ' . $mime);
header('Content-Length: ' . (string) filesize($path));
header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode($downloadName) . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=3600');
readfile($path);
exit;
