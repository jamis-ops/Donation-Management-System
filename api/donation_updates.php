<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

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
  'Repacked',
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

if (!function_exists('record_donation_update')) {
  // Defined here when API is hit directly; also mirrored in bootstrap for donations.php.
}

$user = require_auth(['Admin', 'Staff', 'Donor']);

if ($method === 'GET') {
  $donationId = (int) ($_GET['donationId'] ?? $_GET['donation_id'] ?? 0);
  if ($donationId <= 0) {
    json_response(['ok' => false, 'error' => 'donationId is required'], 400);
  }
  if (!donation_accessible($pdo, $user, $donationId)) {
    json_response(['ok' => false, 'error' => 'Donation not found or access denied'], 404);
  }
  $stmt = $pdo->prepare('SELECT * FROM donation_updates WHERE donation_id = ? ORDER BY created_at ASC, id ASC');
  $stmt->execute([$donationId]);
  $rows = $stmt->fetchAll();
  json_response([
    'ok' => true,
    'data' => array_map('map_donation_update', $rows),
    'stages' => DONATION_UPDATE_STAGES,
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

  // Keep donations.status roughly aligned with the latest operational stage.
  $statusMap = [
    'Donation Received' => 'Pending Verification',
    'Sorted' => 'Verified',
    'Repacked' => 'Verified',
    'Scheduled for Distribution' => 'Allocated',
    'In Transit' => 'Distributed',
    'Delivered' => 'Completed',
  ];
  if (isset($statusMap[$stage])) {
    $pdo->prepare('UPDATE donations SET status = ? WHERE id = ?')->execute([$statusMap[$stage], $donationId]);
  }

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
    $uidStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1');
    $uidStmt->execute([strtolower($donorEmail), 'Donor']);
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
  if ($donorEmail !== '' && filter_var($donorEmail, FILTER_VALIDATE_EMAIL)) {
    $safeName = htmlspecialchars($donorName, ENT_QUOTES, 'UTF-8');
    $safeTracking = htmlspecialchars($tracking !== '' ? $tracking : 'your donation', ENT_QUOTES, 'UTF-8');
    $safeStage = htmlspecialchars($stage, ENT_QUOTES, 'UTF-8');
    $safeNote = $note !== '' ? '<p>' . htmlspecialchars($note, ENT_QUOTES, 'UTF-8') . '</p>' : '';
    send_mail(
      $donorEmail,
      $donorName,
      "Donation update" . ($tracking !== '' ? ": {$tracking}" : ''),
      "<p>Hello {$safeName},</p>"
        . "<p>Your donation <strong>{$safeTracking}</strong> was updated to <strong>{$safeStage}</strong>.</p>"
        . $safeNote
        . email_link_html('/donor/donations', 'Track in donor portal')
    );
  }

  $stmt = $pdo->prepare('SELECT * FROM donation_updates WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_donation_update($stmt->fetch())], 201);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
