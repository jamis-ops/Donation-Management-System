<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_distribution(PDO $pdo, array $row): array
{
  $barangay = '';
  if (!empty($row['beneficiary_id'])) {
    $b = $pdo->prepare('SELECT full_name, affected_families FROM beneficiaries WHERE id = ?');
    $b->execute([$row['beneficiary_id']]);
    $ben = $b->fetch();
    if ($ben) {
      $barangay = $ben['full_name'] . ' (' . $ben['affected_families'] . ' families)';
    }
  }

  $proofCount = $pdo->prepare('SELECT COUNT(*) FROM distribution_proofs WHERE distribution_id = ?');
  $proofCount->execute([$row['id']]);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'location' => $row['location'],
    'barangay' => $barangay,
    'beneficiaryId' => $row['beneficiary_id'] ? (int) $row['beneficiary_id'] : null,
    'program' => $row['program'],
    'date' => format_date($row['distribution_date']),
    'distributionDate' => $row['distribution_date'],
    'beneficiaries' => (int) $row['beneficiaries_count'],
    'volunteers' => (int) $row['volunteers_count'],
    'vehicles' => (int) $row['vehicles_count'],
    'status' => $row['status'],
    'proofStatus' => $row['proof_status'] ?? 'Not Required',
    'type' => $row['distribution_type'],
    'itemsSummary' => $row['items_summary'] ?? '',
    'coordinator' => $row['coordinator'] ?? '',
    'notes' => $row['notes'] ?? '',
    'proofsCount' => (int) $proofCount->fetchColumn(),
    'workflowSteps' => distribution_workflow_steps(),
  ];
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $benId = $ben->fetchColumn();
    $activeStatuses = "'Planning','Preparing','In Transit','Scheduled','Delivered','Awaiting Proof'";
    if ($benId) {
      $stmt = $pdo->prepare("SELECT * FROM distributions WHERE beneficiary_id = ? OR status IN ({$activeStatuses}) ORDER BY distribution_date ASC");
      $stmt->execute([$benId]);
    } else {
      $stmt = $pdo->query("SELECT * FROM distributions WHERE status IN ({$activeStatuses}) ORDER BY distribution_date ASC");
    }
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_distribution($pdo, $r), $rows)]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Distribution not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_distribution($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM distributions ORDER BY distribution_date DESC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_distribution($pdo, $r), $rows)]);
}

$body = read_json_body();
require_auth(['Admin', 'Staff']);

if ($method === 'POST') {
  $code = generate_code('DST');
  $proofStatus = $body['proofStatus'] ?? 'Awaiting Proof';
  $stmt = $pdo->prepare('INSERT INTO distributions (code, location, beneficiary_id, program, distribution_date, beneficiaries_count, volunteers_count, vehicles_count, status, distribution_type, items_summary, coordinator, notes, proof_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $body['location'] ?? '',
    $body['beneficiaryId'] ?? null,
    $body['program'] ?? null,
    $body['distributionDate'] ?? null,
    (int) ($body['beneficiaries'] ?? 0),
    (int) ($body['volunteers'] ?? 0),
    (int) ($body['vehicles'] ?? 0),
    $body['status'] ?? 'Planning',
    $body['type'] ?? 'Delivery',
    $body['itemsSummary'] ?? null,
    $body['coordinator'] ?? null,
    $body['notes'] ?? null,
    $proofStatus,
  ]);
  notify_admins($pdo, 'distribution', 'New distribution planned', "Distribution {$code} scheduled for {$body['location']}", '/admin/distributions');
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Distribution id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Distribution not found'], 404);
  }

  $newStatus = $body['status'] ?? $existing['status'];
  $proofStatus = $body['proofStatus'] ?? $existing['proof_status'];

  if ($newStatus === 'Delivered' && ($proofStatus === 'Not Required' || $proofStatus === '')) {
    $proofStatus = 'Awaiting Proof';
  }
  if ($newStatus === 'Completed') {
    $proofStatus = 'Proof Verified';
  }

  $update = $pdo->prepare('UPDATE distributions SET location = ?, beneficiary_id = ?, program = ?, distribution_date = ?, beneficiaries_count = ?, volunteers_count = ?, vehicles_count = ?, status = ?, distribution_type = ?, items_summary = ?, coordinator = ?, notes = ?, proof_status = ? WHERE id = ?');
  $update->execute([
    $body['location'] ?? $existing['location'],
    $body['beneficiaryId'] ?? $existing['beneficiary_id'],
    $body['program'] ?? $existing['program'],
    $body['distributionDate'] ?? $existing['distribution_date'],
    (int) ($body['beneficiaries'] ?? $existing['beneficiaries_count']),
    (int) ($body['volunteers'] ?? $existing['volunteers_count']),
    (int) ($body['vehicles'] ?? $existing['vehicles_count']),
    $newStatus,
    $body['type'] ?? $existing['distribution_type'],
    $body['itemsSummary'] ?? $existing['items_summary'],
    $body['coordinator'] ?? $existing['coordinator'],
    $body['notes'] ?? $existing['notes'],
    $proofStatus,
    $id,
  ]);

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Distribution status updated', "Distribution {$existing['code']} is now {$newStatus}", '/admin/distributions');
  }

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Distribution id is required'], 400);
  }
  $pdo->prepare('DELETE FROM distributions WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
