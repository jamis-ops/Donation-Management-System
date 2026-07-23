<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_request(array $row, string $beneficiaryName): array
{
  return [
    'id' => $row['reference_code'],
    'dbId' => (int) $row['id'],
    'beneficiary' => $beneficiaryName,
    'beneficiaryId' => (int) $row['beneficiary_id'],
    'type' => $row['assistance_type'],
    'status' => $row['status'],
    'date' => format_date($row['request_date']),
    'requestDate' => $row['request_date'],
    'priority' => $row['priority'],
    'notes' => $row['notes'],
  ];
}

if ($method === 'GET') {
  $user = require_auth(['Admin', 'Staff', 'Beneficiary']);

  if ($user['role'] === 'Beneficiary') {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $benId = $ben->fetchColumn();
    if (!$benId) {
      json_response(['ok' => true, 'data' => []]);
    }
    $stmt = $pdo->prepare('
      SELECT ar.*, b.full_name AS beneficiary_name
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.beneficiary_id = ?
      ORDER BY ar.request_date DESC
    ');
    $stmt->execute([$benId]);
  } else {
    $stmt = $pdo->query('
      SELECT ar.*, b.full_name AS beneficiary_name
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      ORDER BY ar.request_date DESC
    ');
  }

  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_request($r, $r['beneficiary_name']), $rows)]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $public = !empty($body['public']);
  $user = $public ? null : require_auth(['Admin', 'Staff', 'Beneficiary']);

  $beneficiaryId = (int) ($body['beneficiaryId'] ?? $body['beneficiary_id'] ?? 0);
  if ($user && $user['role'] === 'Beneficiary') {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $beneficiaryId = (int) $ben->fetchColumn();
  }

  // Public form: find or create a beneficiary from email + barangay/address
  if ($beneficiaryId <= 0 && $public) {
    $fullName = trim((string) ($body['fullName'] ?? $body['name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $phone = trim((string) ($body['phone'] ?? ''));
    $barangay = trim((string) ($body['barangay'] ?? $body['address'] ?? ''));
    if ($fullName === '') {
      json_response(['ok' => false, 'error' => 'Full name is required'], 400);
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      json_response(['ok' => false, 'error' => 'A valid email is required'], 400);
    }
    if ($barangay === '') {
      json_response(['ok' => false, 'error' => 'Address / barangay is required'], 400);
    }

    $find = $pdo->prepare('
      SELECT id FROM beneficiaries
      WHERE LOWER(representative_email) = ?
        AND (
          LOWER(barangay) = LOWER(?)
          OR LOWER(full_name) = LOWER(?)
          OR LOWER(address) = LOWER(?)
        )
      ORDER BY id ASC
      LIMIT 1
    ');
    $find->execute([$email, $barangay, $barangay, $barangay]);
    $foundId = (int) $find->fetchColumn();

    if ($foundId > 0) {
      $beneficiaryId = $foundId;
    } else {
      $benCode = generate_code('BEN');
      $insertBen = $pdo->prepare('
        INSERT INTO beneficiaries (
          code, full_name, category, barangay, address,
          representative_name, representative_phone, representative_email,
          needs, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $insertBen->execute([
        $benCode,
        $fullName,
        'Individual',
        $barangay,
        $barangay,
        $fullName,
        $phone !== '' ? $phone : null,
        $email,
        trim((string) ($body['notes'] ?? $body['description'] ?? '')) ?: null,
        'Pending Approval',
      ]);
      $beneficiaryId = (int) $pdo->lastInsertId();
    }
  }

  if ($beneficiaryId <= 0) {
    json_response(['ok' => false, 'error' => 'Beneficiary is required'], 400);
  }

  $type = trim((string) ($body['type'] ?? $body['assistanceType'] ?? $body['assistance_type'] ?? ''));
  if ($type === '') {
    json_response(['ok' => false, 'error' => 'Assistance type is required'], 400);
  }

  $notes = $body['notes'] ?? $body['description'] ?? null;
  $ref = generate_code('AST');
  $priority = in_array($body['priority'] ?? 'Medium', ['Low', 'Medium', 'High'], true) ? $body['priority'] : 'Medium';
  $stmt = $pdo->prepare('INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, status, priority, request_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $ref,
    $beneficiaryId,
    $type,
    $public ? 'Pending Review' : ($body['status'] ?? 'Pending Review'),
    $priority,
    $body['requestDate'] ?? date('Y-m-d'),
    $notes,
  ]);

  $newId = (int) $pdo->lastInsertId();

  if ($public) {
    notify_admins(
      $pdo,
      'assistance',
      'New assistance request',
      "Assistance request {$ref} submitted",
      '/admin/beneficiaries'
    );
  }

  $stmt = $pdo->prepare('
    SELECT ar.*, b.full_name AS beneficiary_name
    FROM assistance_requests ar
    JOIN beneficiaries b ON b.id = ar.beneficiary_id
    WHERE ar.id = ?
  ');
  $stmt->execute([$newId]);
  $row = $stmt->fetch();
  json_response([
    'ok' => true,
    'data' => map_request($row, $row['beneficiary_name']),
    'trackingCode' => $ref,
  ], 201);
}

require_auth(['Admin', 'Staff']);

$body = read_json_body();

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Request id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Request not found'], 404);
  }
  $update = $pdo->prepare('UPDATE assistance_requests SET assistance_type = ?, status = ?, priority = ?, notes = ? WHERE id = ?');
  $update->execute([
    $body['type'] ?? $existing['assistance_type'],
    $body['status'] ?? $existing['status'],
    $body['priority'] ?? $existing['priority'],
    $body['notes'] ?? $existing['notes'],
    $id,
  ]);
  $stmt = $pdo->prepare('
    SELECT ar.*, b.full_name AS beneficiary_name
    FROM assistance_requests ar
    JOIN beneficiaries b ON b.id = ar.beneficiary_id
    WHERE ar.id = ?
  ');
  $stmt->execute([$id]);
  $row = $stmt->fetch();
  json_response(['ok' => true, 'data' => map_request($row, $row['beneficiary_name'])]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Request id is required'], 400);
  }
  $pdo->prepare('DELETE FROM assistance_requests WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
