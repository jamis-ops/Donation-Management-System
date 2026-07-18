<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_beneficiary(PDO $pdo, array $row): array
{
  $req = $pdo->prepare('SELECT COUNT(*) FROM assistance_requests WHERE beneficiary_id = ?');
  $req->execute([$row['id']]);
  $requestCount = (int) $req->fetchColumn();

  $last = $pdo->prepare('SELECT MAX(request_date) FROM assistance_requests WHERE beneficiary_id = ? AND status IN ("Approved","Allocated","Completed")');
  $last->execute([$row['id']]);
  $lastDate = $last->fetchColumn();

  $proofs = $pdo->prepare('SELECT COUNT(*) FROM distribution_proofs WHERE beneficiary_id = ?');
  $proofs->execute([$row['id']]);
  $proofCount = (int) $proofs->fetchColumn();

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'barangay' => $row['barangay'] ?? $row['full_name'],
    'municipality' => $row['municipality'] ?? '',
    'affectedFamilies' => (int) ($row['affected_families'] ?? 0),
    'representativeName' => $row['representative_name'] ?? '',
    'representativePhone' => $row['representative_phone'] ?? '',
    'representativeEmail' => $row['representative_email'] ?? '',
    'category' => $row['category'],
    'status' => $row['status'],
    'notes' => $row['notes'] ?? '',
    'requests' => $requestCount,
    'proofsSubmitted' => $proofCount,
    'lastAssistance' => format_date($lastDate ?: null),
  ];
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['ok' => true, 'data' => $row ? [map_beneficiary($pdo, $row)] : []]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_beneficiary($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM beneficiaries ORDER BY municipality ASC, full_name ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_beneficiary($pdo, $r), $rows)]);
}

if ($user['role'] === 'Beneficiary') {
  json_response(['ok' => false, 'error' => 'Access denied'], 403);
}

$body = read_json_body();

if ($method === 'POST') {
  $barangay = trim((string) ($body['barangay'] ?? $body['name'] ?? ''));
  if ($barangay === '') {
    json_response(['ok' => false, 'error' => 'Barangay name is required'], 400);
  }
  $code = generate_code('BEN');
  $stmt = $pdo->prepare('
    INSERT INTO beneficiaries (code, full_name, category, barangay, municipality, affected_families, representative_name, representative_phone, representative_email, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $code,
    $barangay,
    $body['category'] ?? 'Disaster Relief',
    $barangay,
    $body['municipality'] ?? null,
    (int) ($body['affectedFamilies'] ?? 0),
    $body['representativeName'] ?? null,
    $body['representativePhone'] ?? null,
    $body['representativeEmail'] ?? null,
    $body['notes'] ?? null,
    $body['status'] ?? 'Pending Approval',
  ]);
  $newId = (int) $pdo->lastInsertId();
  notify_admins($pdo, 'beneficiary', 'New barangay registered', "{$barangay} registered with " . ($body['affectedFamilies'] ?? 0) . ' affected families', '/admin/beneficiaries');
  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
  }

  $barangay = trim((string) ($body['barangay'] ?? $body['name'] ?? $existing['full_name']));
  $newStatus = $body['status'] ?? $existing['status'];

  $update = $pdo->prepare('
    UPDATE beneficiaries SET full_name = ?, category = ?, barangay = ?, municipality = ?, affected_families = ?,
    representative_name = ?, representative_phone = ?, representative_email = ?, notes = ?, status = ?
    WHERE id = ?
  ');
  $update->execute([
    $barangay,
    $body['category'] ?? $existing['category'],
    $barangay,
    $body['municipality'] ?? $existing['municipality'],
    (int) ($body['affectedFamilies'] ?? $existing['affected_families']),
    $body['representativeName'] ?? $existing['representative_name'],
    $body['representativePhone'] ?? $existing['representative_phone'],
    $body['representativeEmail'] ?? $existing['representative_email'],
    $body['notes'] ?? $existing['notes'],
    $newStatus,
    $id,
  ]);

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Barangay status updated', "{$barangay} status changed to {$newStatus}", '/admin/beneficiaries');
  }

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $pdo->prepare('DELETE FROM beneficiaries WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
