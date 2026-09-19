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

function ensure_section_views_table(PDO $pdo): void
{
  static $initialized = false;
  if ($initialized) return;
  $initialized = true;
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
}

function get_last_seen(PDO $pdo, int $userId, string $sectionKey): ?string
{
  try {
    $stmt = $pdo->prepare('SELECT last_seen_at FROM admin_section_views WHERE user_id = ? AND section_key = ?');
    $stmt->execute([$userId, $sectionKey]);
    $val = $stmt->fetchColumn();
    return $val ? (string) $val : null;
  } catch (Throwable $e) {
    ensure_section_views_table($pdo);
    return null;
  }
}

function safe_count(PDO $pdo, string $sql, array $params = []): int
{
  try {
    if (empty($params)) {
      return (int) $pdo->query($sql)->fetchColumn();
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
  } catch (Throwable $e) {
    return 0;
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
      ensure_section_views_table($pdo);
      try {
        $upsert = $pdo->prepare("
          INSERT INTO admin_section_views (user_id, section_key, last_seen_at) 
          VALUES (?, ?, NOW()) 
          ON DUPLICATE KEY UPDATE last_seen_at = NOW()
        ");
        $upsert->execute([$userId, $section]);
      } catch (Throwable $e2) {
        // ignore write error
      }
    }
  }
}

// 1. Pending Volunteers
$seen = get_last_seen($pdo, $userId, '/admin/volunteers');
$pendingVolunteers = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM volunteers WHERE status IN ('Pending', 'Pending Review') AND created_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM volunteers WHERE status IN ('Pending', 'Pending Review')");

// 2. Pending Barangays & Proof Reviews
$seenBarangays = get_last_seen($pdo, $userId, '/admin/beneficiaries');
$pendingBeneficiaries = $seenBarangays
  ? safe_count($pdo, "SELECT COUNT(*) FROM beneficiaries WHERE status IN ('Pending', 'Pending Approval', 'Pending Review') AND created_at > ?", [$seenBarangays])
  : safe_count($pdo, "SELECT COUNT(*) FROM beneficiaries WHERE status IN ('Pending', 'Pending Approval', 'Pending Review')");

$pendingProofs = $seenBarangays
  ? safe_count($pdo, "SELECT COUNT(*) FROM delivery_proofs WHERE status IN ('Pending', 'Pending Review') AND created_at > ?", [$seenBarangays])
  : safe_count($pdo, "SELECT COUNT(*) FROM delivery_proofs WHERE status IN ('Pending', 'Pending Review')");

$barangayBadge = $pendingBeneficiaries + $pendingProofs;

// 3. Pending Relief Requests
$seen = get_last_seen($pdo, $userId, '/admin/requests');
$pendingRequests = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM assistance_requests WHERE status IN ('Pending', 'Pending Review') AND created_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM assistance_requests WHERE status IN ('Pending', 'Pending Review')");

// 4. Pending Donations
$seen = get_last_seen($pdo, $userId, '/admin/donations');
$pendingDonations = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM donations WHERE status IN ('Pending', 'Pending Verification') AND created_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM donations WHERE status IN ('Pending', 'Pending Verification')");

// 5. Pending Certificates
$seen = get_last_seen($pdo, $userId, '/admin/certificates');
$pendingCertificates = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM certificates WHERE status IN ('Requested', 'Pending') AND created_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM certificates WHERE status IN ('Requested', 'Pending')");

// 6. Distributions Awaiting Proof
$seen = get_last_seen($pdo, $userId, '/admin/distributions');
$pendingDistributions = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM distributions WHERE status = 'Awaiting Proof' AND updated_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM distributions WHERE status = 'Awaiting Proof'");

// 7. Pending Allocations
$seen = get_last_seen($pdo, $userId, '/admin/allocation');
$pendingAllocations = $seen
  ? safe_count($pdo, "SELECT COUNT(*) FROM allocations WHERE status = 'Pending' AND created_at > ?", [$seen])
  : safe_count($pdo, "SELECT COUNT(*) FROM allocations WHERE status = 'Pending'");

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
