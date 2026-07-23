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

  $needs = [];
  if (!empty($row['needs'])) {
    $decoded = json_decode((string) $row['needs'], true);
    $needs = is_array($decoded) ? $decoded : [];
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'barangay' => $row['barangay'] ?? $row['full_name'],
    'barangayType' => $row['barangay_type'] ?? '',
    'municipality' => $row['municipality'] ?? '',
    'address' => $row['address'] ?? '',
    'affectedFamilies' => (int) ($row['affected_families'] ?? 0),
    'representativeName' => $row['representative_name'] ?? '',
    'representativeFirstName' => $row['representative_first_name'] ?? '',
    'representativeLastName' => $row['representative_last_name'] ?? '',
    'representativeMiddleInitial' => $row['representative_middle_initial'] ?? '',
    'representativePosition' => $row['representative_position'] ?? '',
    'representativePhone' => $row['representative_phone'] ?? '',
    'representativeEmail' => $row['representative_email'] ?? '',
    'category' => $row['category'],
    'needs' => $needs,
    'status' => $row['status'],
    'notes' => $row['notes'] ?? '',
    'requests' => $requestCount,
    'proofsSubmitted' => $proofCount,
    'lastAssistance' => format_date($lastDate ?: null),
  ];
}

function encode_needs($needs): ?string
{
  if (!is_array($needs) || count($needs) === 0) {
    return null;
  }
  return json_encode(array_values(array_filter(array_map('strval', $needs), fn($n) => $n !== '')));
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
  $needsArr = is_array($body['needs'] ?? null) ? array_values(array_map('strval', $body['needs'])) : [];
  // The "Category" now represents the beneficiary's needs.
  $category = count($needsArr) > 0 ? implode(', ', $needsArr) : ($body['category'] ?? null);
  [$repLast, $repFirst, $repMi, $repName] = read_name_parts([
    'lastName' => $body['representativeLastName'] ?? $body['representative_last_name'] ?? $body['lastName'] ?? '',
    'firstName' => $body['representativeFirstName'] ?? $body['representative_first_name'] ?? $body['firstName'] ?? '',
    'middleInitial' => $body['representativeMiddleInitial'] ?? $body['representative_middle_initial'] ?? $body['middleInitial'] ?? '',
    'name' => $body['representativeName'] ?? $body['representative_name'] ?? '',
  ]);
  $repMiDb = $repMi !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $repMi) ?: '', 0, 1))
    : null;
  $stmt = $pdo->prepare('
    INSERT INTO beneficiaries (code, full_name, category, barangay_type, barangay, municipality, address, affected_families, representative_name, representative_first_name, representative_last_name, representative_middle_initial, representative_position, representative_phone, representative_email, needs, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $code,
    $barangay,
    $category,
    $body['barangayType'] ?? null,
    $barangay,
    $body['municipality'] ?? null,
    $body['address'] ?? null,
    (int) ($body['affectedFamilies'] ?? 0),
    $repName !== '' ? $repName : null,
    $repFirst !== '' ? $repFirst : null,
    $repLast !== '' ? $repLast : null,
    $repMiDb,
    $body['representativePosition'] ?? null,
    $body['representativePhone'] ?? null,
    $body['representativeEmail'] ?? null,
    encode_needs($body['needs'] ?? null),
    $body['notes'] ?? null,
    $body['status'] ?? 'Pending Approval',
  ]);
  $newId = (int) $pdo->lastInsertId();
  notify_admins($pdo, 'beneficiary', 'New barangay registered', "{$barangay} registered with " . ($body['affectedFamilies'] ?? 0) . ' affected families', '/admin/beneficiaries');

  audit_log($pdo, 'create', 'beneficiary', $code, "Registered barangay {$barangay}");

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

  $needsValue = array_key_exists('needs', $body) ? encode_needs($body['needs']) : $existing['needs'];
  // Keep the category in sync with the selected needs.
  if (array_key_exists('needs', $body) && is_array($body['needs']) && count($body['needs']) > 0) {
    $category = implode(', ', array_values(array_map('strval', $body['needs'])));
  } else {
    $category = $body['category'] ?? $existing['category'];
  }

  $hasRepParts = array_key_exists('representativeLastName', $body) || array_key_exists('representativeFirstName', $body)
    || array_key_exists('representative_last_name', $body) || array_key_exists('lastName', $body)
    || array_key_exists('firstName', $body);
  if ($hasRepParts) {
    [$repLast, $repFirst, $repMi, $repName] = read_name_parts([
      'lastName' => $body['representativeLastName'] ?? $body['representative_last_name'] ?? $body['lastName'] ?? '',
      'firstName' => $body['representativeFirstName'] ?? $body['representative_first_name'] ?? $body['firstName'] ?? '',
      'middleInitial' => $body['representativeMiddleInitial'] ?? $body['representative_middle_initial'] ?? $body['middleInitial'] ?? '',
      'name' => $body['representativeName'] ?? $body['representative_name'] ?? '',
    ]);
  } else {
    $repLast = trim((string) ($existing['representative_last_name'] ?? ''));
    $repFirst = trim((string) ($existing['representative_first_name'] ?? ''));
    $repMi = trim((string) ($existing['representative_middle_initial'] ?? ''));
    $repName = trim((string) ($body['representativeName'] ?? $existing['representative_name'] ?? ''));
  }
  $repMiDb = $repMi !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $repMi) ?: '', 0, 1))
    : null;

  $update = $pdo->prepare('
    UPDATE beneficiaries SET full_name = ?, category = ?, barangay_type = ?, barangay = ?, municipality = ?, address = ?, affected_families = ?,
    representative_name = ?, representative_first_name = ?, representative_last_name = ?, representative_middle_initial = ?,
    representative_position = ?, representative_phone = ?, representative_email = ?, needs = ?, notes = ?, status = ?
    WHERE id = ?
  ');
  $update->execute([
    $barangay,
    $category,
    $body['barangayType'] ?? $existing['barangay_type'],
    $barangay,
    $body['municipality'] ?? $existing['municipality'],
    $body['address'] ?? $existing['address'],
    (int) ($body['affectedFamilies'] ?? $existing['affected_families']),
    $repName !== '' ? $repName : ($existing['representative_name'] ?? null),
    $repFirst !== '' ? $repFirst : null,
    $repLast !== '' ? $repLast : null,
    $repMiDb,
    $body['representativePosition'] ?? ($existing['representative_position'] ?? null),
    $body['representativePhone'] ?? $existing['representative_phone'],
    $body['representativeEmail'] ?? $existing['representative_email'],
    $needsValue,
    $body['notes'] ?? $existing['notes'],
    $newStatus,
    $id,
  ]);

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Barangay status updated', "{$barangay} status changed to {$newStatus}", '/admin/beneficiaries');
  }

  audit_log($pdo, 'update', 'beneficiary', $existing['code'], "Updated {$barangay}" . ($newStatus !== $existing['status'] ? " (status: {$newStatus})" : ''));

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $del = $pdo->prepare('SELECT code, full_name FROM beneficiaries WHERE id = ?');
  $del->execute([$id]);
  $delRow = $del->fetch();
  $pdo->prepare('DELETE FROM beneficiaries WHERE id = ?')->execute([$id]);
  if ($delRow) {
    audit_log($pdo, 'delete', 'beneficiary', $delRow['code'], "Deleted barangay {$delRow['full_name']}");
  }
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
