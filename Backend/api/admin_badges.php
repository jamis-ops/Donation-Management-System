<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$user = current_user();

if (!$user || !in_array($user['role'] ?? '', ['Admin', 'Staff', 'SuperAdmin'], true)) {
  if ($method === 'POST') {
    json_response(['ok' => true]);
  }
  json_response(['ok' => true, 'data' => []]);
}

$userId = (int) ($user['id'] ?? 0);
if ($userId <= 0 && is_super_admin_user($user)) {
  $userId = 999999;
}

function safe_table_exists(PDO $pdo, string $tableName): bool
{
  try {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = ?
    ");
    $stmt->execute([$tableName]);
    return (int) $stmt->fetchColumn() > 0;
  } catch (Throwable $e) {
    return false;
  }
}

// Ensure section views tracking table exists
try {
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS admin_section_views (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      section_key VARCHAR(80) NOT NULL,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_section (user_id, section_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");
} catch (Throwable $e) {
  // table creation fallback
}

function get_last_seen(PDO $pdo, int $userId, string $sectionKey): ?string
{
  try {
    $stmt = $pdo->prepare('SELECT last_seen_at FROM admin_section_views WHERE user_id = ? AND section_key = ?');
    $stmt->execute([$userId, $sectionKey]);
    $val = $stmt->fetchColumn();
    return $val ? (string) $val : null;
  } catch (Throwable $e) {
    return null;
  }
}

// Handle Mark Section as Seen
if ($method === 'POST') {
  $body = read_json_body();
  $section = trim((string) ($body['section'] ?? ($body['path'] ?? '')));
  if ($section !== '') {
    if (!str_starts_with($section, '/admin/')) {
      $section = '/admin/' . ltrim($section, '/');
    }
    // Normalize aliases
    if ($section === '/admin/barangays') {
      $section = '/admin/beneficiaries';
    }
    try {
      $upsert = $pdo->prepare("
        INSERT INTO admin_section_views (user_id, section_key, last_seen_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE last_seen_at = NOW()
      ");
      $upsert->execute([$userId, $section]);
    } catch (Throwable $e) {
      // ignore write error
    }
  }
}

// 1. Pending Volunteers
$pendingVolunteers = 0;
if (safe_table_exists($pdo, 'volunteers')) {
  $seen = get_last_seen($pdo, $userId, '/admin/volunteers');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM volunteers 
      WHERE status IN ('Pending', 'Pending Review') AND created_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingVolunteers = (int) $stmt->fetchColumn();
  } else {
    $pendingVolunteers = (int) $pdo->query("
      SELECT COUNT(*) FROM volunteers 
      WHERE status IN ('Pending', 'Pending Review')
    ")->fetchColumn();
  }
}

// 2. Pending Barangays & Proof Reviews
$pendingBeneficiaries = 0;
$pendingProofs = 0;
$seenBarangays = get_last_seen($pdo, $userId, '/admin/beneficiaries');

if (safe_table_exists($pdo, 'beneficiaries')) {
  if ($seenBarangays) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM beneficiaries 
      WHERE status IN ('Pending', 'Pending Approval', 'Pending Review') AND created_at > ?
    ");
    $stmt->execute([$seenBarangays]);
    $pendingBeneficiaries = (int) $stmt->fetchColumn();
  } else {
    $pendingBeneficiaries = (int) $pdo->query("
      SELECT COUNT(*) FROM beneficiaries 
      WHERE status IN ('Pending', 'Pending Approval', 'Pending Review')
    ")->fetchColumn();
  }
}

if (safe_table_exists($pdo, 'delivery_proofs')) {
  if ($seenBarangays) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM delivery_proofs 
      WHERE status IN ('Pending', 'Pending Review') AND created_at > ?
    ");
    $stmt->execute([$seenBarangays]);
    $pendingProofs = (int) $stmt->fetchColumn();
  } else {
    $pendingProofs = (int) $pdo->query("
      SELECT COUNT(*) FROM delivery_proofs 
      WHERE status IN ('Pending', 'Pending Review')
    ")->fetchColumn();
  }
}
$barangayBadge = $pendingBeneficiaries + $pendingProofs;

// 3. Pending Relief Requests
$pendingRequests = 0;
if (safe_table_exists($pdo, 'assistance_requests')) {
  $seen = get_last_seen($pdo, $userId, '/admin/requests');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM assistance_requests 
      WHERE status IN ('Pending', 'Pending Review') AND created_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingRequests = (int) $stmt->fetchColumn();
  } else {
    $pendingRequests = (int) $pdo->query("
      SELECT COUNT(*) FROM assistance_requests 
      WHERE status IN ('Pending', 'Pending Review')
    ")->fetchColumn();
  }
}

// 4. Pending Donations
$pendingDonations = 0;
if (safe_table_exists($pdo, 'donations')) {
  $seen = get_last_seen($pdo, $userId, '/admin/donations');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM donations 
      WHERE status IN ('Pending', 'Pending Verification') AND created_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingDonations = (int) $stmt->fetchColumn();
  } else {
    $pendingDonations = (int) $pdo->query("
      SELECT COUNT(*) FROM donations 
      WHERE status IN ('Pending', 'Pending Verification')
    ")->fetchColumn();
  }
}

// 5. Pending Certificates
$pendingCertificates = 0;
if (safe_table_exists($pdo, 'certificates')) {
  $seen = get_last_seen($pdo, $userId, '/admin/certificates');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM certificates 
      WHERE status IN ('Requested', 'Pending') AND created_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingCertificates = (int) $stmt->fetchColumn();
  } else {
    $pendingCertificates = (int) $pdo->query("
      SELECT COUNT(*) FROM certificates 
      WHERE status IN ('Requested', 'Pending')
    ")->fetchColumn();
  }
}

// 6. Distributions Awaiting Proof
$pendingDistributions = 0;
if (safe_table_exists($pdo, 'distributions')) {
  $seen = get_last_seen($pdo, $userId, '/admin/distributions');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM distributions 
      WHERE status = 'Awaiting Proof' AND updated_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingDistributions = (int) $stmt->fetchColumn();
  } else {
    $pendingDistributions = (int) $pdo->query("
      SELECT COUNT(*) FROM distributions 
      WHERE status = 'Awaiting Proof'
    ")->fetchColumn();
  }
}

// 7. Pending Allocations
$pendingAllocations = 0;
if (safe_table_exists($pdo, 'allocations')) {
  $seen = get_last_seen($pdo, $userId, '/admin/allocation');
  if ($seen) {
    $stmt = $pdo->prepare("
      SELECT COUNT(*) FROM allocations 
      WHERE status = 'Pending' AND created_at > ?
    ");
    $stmt->execute([$seen]);
    $pendingAllocations = (int) $stmt->fetchColumn();
  } else {
    $pendingAllocations = (int) $pdo->query("
      SELECT COUNT(*) FROM allocations 
      WHERE status = 'Pending'
    ")->fetchColumn();
  }
}

json_response([
  'ok' => true,
  'data' => [
    '/admin/volunteers' => $pendingVolunteers,
    '/admin/beneficiaries' => $barangayBadge,
    '/admin/requests' => $pendingRequests,
    '/admin/donations' => $pendingDonations,
    '/admin/certificates' => $pendingCertificates,
    '/admin/distributions' => $pendingDistributions,
    '/admin/allocation' => $pendingAllocations,
  ],
]);
