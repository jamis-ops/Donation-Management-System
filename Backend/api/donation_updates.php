<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/**
 * Donation progress updates timeline.
 * GET  ?donationId=  — list updates (Admin/Staff/Donor for own donations)
 * POST { donationId, stage, note? } — Admin/Staff only
 */

$pdo = db();
$method = request_method();

const DONATION_UPDATE_STAGES = [
  'Donation Received',
  'Sorted',
  'Scheduled for Distribution',
  'In Transit',
  'Delivered',
];

function map_donation_update(array $row): array
{
  $ts = strtotime((string) ($row['created_at'] ?? ''));
  return [
    'id' => (int) $row['id'],
    'donationId' => (int) $row['donation_id'],
    'stage' => $row['stage'],
    'note' => $row['note'] ?? '',
    'staffName' => $row['created_by_name'] ?: 'System',
    'staffUserId' => $row['created_by_user_id'] ? (int) $row['created_by_user_id'] : null,
    'createdAt' => $row['created_at'],
    'date' => $ts ? date('M j, Y', $ts) : '',
    'time' => $ts ? date('g:i A', $ts) : '',
    'dateTime' => $ts ? date('M j, Y · g:i A', $ts) : '',
  ];
}

function donation_accessible(PDO $pdo, array $user, int $donationId): ?array
{
  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
  $stmt->execute([$donationId]);
  $row = $stmt->fetch();
  if (!$row) {
    return null;
  }
  if (in_array($user['role'], ['Admin', 'Staff'], true)) {
    return $row;
  }
  if ($user['role'] === 'Donor') {
    $email = strtolower((string) ($user['email'] ?? ''));
    if ($email !== '' && strcasecmp((string) ($row['donor_email'] ?? ''), $email) === 0) {
      return $row;
    }
  }
  return null;
}

/** Resolve the furthest donor-facing stage from the donation and its linked delivery. */
function resolve_donation_progress_status(PDO $pdo, array $donation, array $updates): string
{
  $stored = trim((string) ($donation['status'] ?? '')) ?: 'Pending Verification';
  if (in_array($stored, ['Pending Verification', 'Rejected', 'Cancelled'], true)) return $stored;
  try {
    $resolved = resolve_linked_donation_status($pdo, (int) $donation['id'], (string) ($donation['type'] ?? 'Monetary'));
    if ($resolved !== $stored) {
      $pdo->prepare('UPDATE donations SET status = ? WHERE id = ?')->execute([$resolved, (int) $donation['id']]);
    }
    return $resolved;
  } catch (Throwable $e) {
    return $stored;
  }
}

if (!function_exists('record_donation_update')) {
  // Defined here when API is hit directly; also mirrored in bootstrap for donations.php.
}

$user = require_auth(['Admin', 'Staff', 'Donor']);

if ($method === 'GET') {
  $donationId = (int) ($_GET['donationId'] ?? $_GET['donation_id'] ?? 0);
  if ($donationId <= 0) {
    json_response(['ok' => false, 'error' => 'donationId is required'], 400);
  }
  $donation = donation_accessible($pdo, $user, $donationId);
  if (!$donation) {
    json_response(['ok' => false, 'error' => 'Donation not found or access denied'], 404);
  }
  $stmt = $pdo->prepare('SELECT * FROM donation_updates WHERE donation_id = ? ORDER BY created_at ASC, id ASC');
  $stmt->execute([$donationId]);
  $rows = $stmt->fetchAll();
  json_response([
    'ok' => true,
    'data' => array_map('map_donation_update', $rows),
    'stages' => DONATION_UPDATE_STAGES,
    'currentStatus' => resolve_donation_progress_status($pdo, $donation, $rows),
  ]);
}

if ($method === 'POST') {
  if (!in_array($user['role'], ['Admin', 'Staff'], true)) {
    json_response(['ok' => false, 'error' => 'Only Admin or Staff can post donation updates'], 403);
  }
  $body = read_json_body();
  $donationId = (int) ($body['donationId'] ?? $body['donation_id'] ?? 0);
  $stage = trim((string) ($body['stage'] ?? ''));
  $note = trim((string) ($body['note'] ?? ''));

  if ($donationId <= 0) {
    json_response(['ok' => false, 'error' => 'donationId is required'], 400);
  }
  if ($stage === '') {
    json_response(['ok' => false, 'error' => 'Update stage is required'], 400);
  }
  if (!donation_accessible($pdo, $user, $donationId)) {
    json_response(['ok' => false, 'error' => 'Donation not found'], 404);
  }

  $stmt = $pdo->prepare('
    INSERT INTO donation_updates (donation_id, stage, note, created_by_user_id, created_by_name)
    VALUES (?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $donationId,
    $stage,
    $note !== '' ? $note : null,
    (int) $user['id'],
    (string) ($user['name'] ?? 'Staff'),
  ]);
  $newId = (int) $pdo->lastInsertId();

  // Timeline notes are informational. Operational status is derived from the
  // linked allocation, request, and distribution workflow.

  $donationStmt = $pdo->prepare('SELECT tracking_code, donor_name, donor_email, donor_id FROM donations WHERE id = ? LIMIT 1');
  $donationStmt->execute([$donationId]);
  $donation = $donationStmt->fetch() ?: [];
  $tracking = (string) ($donation['tracking_code'] ?? '');
  $donorName = (string) ($donation['donor_name'] ?? 'Donor');
  $donorEmail = trim((string) ($donation['donor_email'] ?? ''));

  notify_admins(
    $pdo,
    'donation',
    'Donation progress update',
    ($tracking !== '' ? "{$tracking}: " : '') . $stage,
    '/admin/donations'
  );

  $donorUserId = null;
  if (!empty($donation['donor_id'])) {
    $uidStmt = $pdo->prepare('SELECT user_id FROM donors WHERE id = ? LIMIT 1');
    $uidStmt->execute([(int) $donation['donor_id']]);
    $donorUserId = (int) ($uidStmt->fetchColumn() ?: 0) ?: null;
  }
  if (!$donorUserId && $donorEmail !== '') {
    $uidStmt = $pdo->prepare(
      "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? AND r.name = 'Donor' LIMIT 1"
    );
    $uidStmt->execute([strtolower($donorEmail)]);
    $donorUserId = (int) ($uidStmt->fetchColumn() ?: 0) ?: null;
  }
  if ($donorUserId) {
    create_notification(
      $pdo,
      'donation',
      'Donation progress update',
      ($tracking !== '' ? "{$tracking}: " : '') . $stage . ($note !== '' ? " — {$note}" : ''),
      '/donor/donations',
      $donorUserId
    );
  }
  // Email only for high-value lifecycle stages.
  if (
    lifecycle_mail_allowed('donation_stage', $stage)
    && $donorEmail !== ''
    && filter_var($donorEmail, FILTER_VALIDATE_EMAIL)
  ) {
    $safeNote = $note !== ''
      ? '<p style="margin:0 0 12px;line-height:1.6;color:#475569">' . htmlspecialchars($note, ENT_QUOTES, 'UTF-8') . '</p>'
      : '';
    $safeTracking = htmlspecialchars($tracking !== '' ? $tracking : 'your donation', ENT_QUOTES, 'UTF-8');
    $safeStage = htmlspecialchars($stage, ENT_QUOTES, 'UTF-8');
    send_lifecycle_email(
      $donorEmail,
      $donorName,
      'Update on your donation' . ($tracking !== '' ? ": {$tracking}" : ''),
      "Progress: {$stage}",
      "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Your donation <strong>{$safeTracking}</strong> was updated to <strong>{$safeStage}</strong>.</p>"
        . $safeNote,
      '/donor/donations',
      'Track in donor portal'
    );
  }

  $stmt = $pdo->prepare('SELECT * FROM donation_updates WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_donation_update($stmt->fetch())], 201);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
