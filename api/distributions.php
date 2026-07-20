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

  $eventName = trim((string) ($row['event_name'] ?? ''));
  if ($eventName === '') {
    $eventName = trim(($row['code'] ?? '') . ' — ' . ($row['location'] ?? 'Distribution'));
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'eventName' => $eventName,
    'location' => $row['location'],
    'barangay' => $barangay,
    'beneficiaryId' => $row['beneficiary_id'] ? (int) $row['beneficiary_id'] : null,
    'program' => $row['program'],
    'date' => format_date($row['distribution_date']),
    'distributionDate' => $row['distribution_date'],
    'scheduleTime' => $row['schedule_time'] ?? '',
    'beneficiaries' => (int) $row['beneficiaries_count'],
    'volunteers' => (int) $row['volunteers_count'],
    'vehicles' => (int) $row['vehicles_count'],
    'distanceKm' => isset($row['distance_km']) && $row['distance_km'] !== null ? (float) $row['distance_km'] : null,
    'fuelLiters' => isset($row['fuel_liters']) && $row['fuel_liters'] !== null ? (float) $row['fuel_liters'] : null,
    'fuelCost' => isset($row['fuel_cost']) && $row['fuel_cost'] !== null ? (float) $row['fuel_cost'] : null,
    'status' => $row['status'],
    'proofStatus' => $row['proof_status'] ?? 'Not Required',
    'receiptStatus' => $row['receipt_status'] ?? 'Awaiting Confirmation',
    'receivedQuantity' => isset($row['received_quantity']) && $row['received_quantity'] !== null ? (int) $row['received_quantity'] : null,
    'receivedAt' => format_date($row['received_at'] ?? null),
    'receiptNotes' => $row['receipt_notes'] ?? '',
    'type' => $row['distribution_type'],
    'itemsSummary' => $row['items_summary'] ?? '',
    'coordinator' => $row['coordinator'] ?? '',
    'notes' => $row['notes'] ?? '',
    'proofsCount' => (int) $proofCount->fetchColumn(),
    'workflowSteps' => distribution_workflow_steps(),
  ];
}

/**
 * Distributions visible to a barangay portal user.
 */
function distributions_for_beneficiary(PDO $pdo, array $ben, bool $forProof = false): array
{
  $benId = (int) $ben['id'];
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE beneficiary_id = ? OR beneficiary_id IS NULL ORDER BY distribution_date DESC, id DESC');
  $stmt->execute([$benId]);
  $rows = array_values(array_filter(
    $stmt->fetchAll(),
    static fn(array $row) => distribution_belongs_to_beneficiary($row, $ben)
  ));

  if ($forProof) {
    $rows = array_values(array_filter($rows, static function (array $row) {
      $proof = $row['proof_status'] ?? 'Not Required';
      $status = $row['status'] ?? '';
      if ($proof === 'Proof Verified') {
        return false;
      }
      if ($status === 'Completed' && $proof === 'Proof Verified') {
        return false;
      }
      // Allow resubmission when previously rejected, and normal pending/submitted events.
      return true;
    }));
  }

  return $rows;
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $benStmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $benStmt->execute([$user['id']]);
    $ben = $benStmt->fetch();
    if (!$ben) {
      json_response(['ok' => true, 'data' => []]);
    }
    $forProof = isset($_GET['forProof']) && $_GET['forProof'] !== '' && $_GET['forProof'] !== '0';
    $rows = distributions_for_beneficiary($pdo, $ben, $forProof);
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

// ---- Beneficiary receipt confirmation / dispute ----
if ($user['role'] === 'Beneficiary') {
  if (!in_array($method, ['PUT', 'POST'], true) || !$id) {
    json_response(['ok' => false, 'error' => 'Invalid request'], 400);
  }

  $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
  $ben->execute([$user['id']]);
  $benRow = $ben->fetch();
  if (!$benRow) {
    json_response(['ok' => false, 'error' => 'No barangay linked to this account'], 403);
  }

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $dist = $stmt->fetch();
  if (!$dist || !distribution_belongs_to_beneficiary($dist, $benRow)) {
    json_response(['ok' => false, 'error' => 'Distribution not found for your barangay'], 404);
  }
  // Claim orphan events when the barangay confirms receipt.
  if (empty($dist['beneficiary_id'])) {
    $pdo->prepare('UPDATE distributions SET beneficiary_id = ? WHERE id = ?')->execute([$benRow['id'], $id]);
    $dist['beneficiary_id'] = $benRow['id'];
  }

  $action = $body['action'] ?? 'confirm-receipt';

  if ($action === 'confirm-receipt') {
    $qty = isset($body['receivedQuantity']) ? (int) $body['receivedQuantity'] : null;
    $upd = $pdo->prepare('UPDATE distributions SET receipt_status = ?, received_quantity = ?, received_at = NOW(), receipt_notes = ? WHERE id = ?');
    $upd->execute(['Received', $qty, $body['notes'] ?? null, $id]);
    notify_admins(
      $pdo,
      'receipt',
      'Donation receipt confirmed',
      "{$benRow['full_name']} confirmed receipt for {$dist['code']}" . ($qty !== null ? " ({$qty} items)" : ''),
      '/admin/distributions'
    );
  } elseif ($action === 'report-missing') {
    $upd = $pdo->prepare('UPDATE distributions SET receipt_status = ?, receipt_notes = ? WHERE id = ?');
    $upd->execute(['Not Received', $body['notes'] ?? null, $id]);
    notify_admins(
      $pdo,
      'alert',
      'Donation not yet received',
      "{$benRow['full_name']} reports distribution {$dist['code']} has not been received. " . (($body['notes'] ?? '') !== '' ? "Note: {$body['notes']}" : ''),
      '/admin/distributions'
    );
  } else {
    json_response(['ok' => false, 'error' => 'Unknown action'], 400);
  }

  audit_log($pdo, $action === 'report-missing' ? 'report-missing' : 'confirm-receipt', 'distribution', $dist['code'], "{$benRow['full_name']}: {$action}");

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())]);
}

require_auth(['Admin', 'Staff']);

if ($method === 'POST') {
  $code = generate_code('DST');
  $proofStatus = $body['proofStatus'] ?? 'Awaiting Proof';
  $isDelivery = ($body['type'] ?? 'Delivery') === 'Delivery';
  $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null;
  if (!$beneficiaryId) {
    json_response(['ok' => false, 'error' => 'Target barangay (beneficiary) is required for a distribution event'], 400);
  }
  $location = trim((string) ($body['location'] ?? ''));
  $eventName = trim((string) ($body['eventName'] ?? ''));
  if ($eventName === '') {
    $eventName = $code . ' — ' . ($location !== '' ? $location : 'Distribution');
  }
  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, distribution_date, schedule_time, beneficiaries_count, volunteers_count, vehicles_count, distance_km, fuel_liters, fuel_cost, status, distribution_type, items_summary, coordinator, notes, proof_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $eventName,
    $location,
    $beneficiaryId,
    $body['program'] ?? null,
    $body['distributionDate'] ?? null,
    $body['scheduleTime'] ?? null,
    (int) ($body['beneficiaries'] ?? 0),
    (int) ($body['volunteers'] ?? 0),
    (int) ($body['vehicles'] ?? 0),
    $isDelivery && isset($body['distanceKm']) ? (float) $body['distanceKm'] : null,
    $isDelivery && isset($body['fuelLiters']) ? (float) $body['fuelLiters'] : null,
    $isDelivery && isset($body['fuelCost']) ? (float) $body['fuelCost'] : null,
    $body['status'] ?? 'Planning',
    $body['type'] ?? 'Delivery',
    $body['itemsSummary'] ?? null,
    $body['coordinator'] ?? null,
    $body['notes'] ?? null,
    $proofStatus,
  ]);
  notify_admins($pdo, 'distribution', 'New distribution planned', "Distribution {$code} scheduled for {$location}", '/admin/distributions');
  audit_log($pdo, 'create', 'distribution', $code, "Planned distribution for {$location}");
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

  $type = $body['type'] ?? $existing['distribution_type'];
  $isDelivery = $type === 'Delivery';
  $beneficiaryId = array_key_exists('beneficiaryId', $body)
    ? (!empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null)
    : ($existing['beneficiary_id'] ? (int) $existing['beneficiary_id'] : null);
  // Only enforce barangay when the admin is editing the assignment itself.
  if (array_key_exists('beneficiaryId', $body) && !$beneficiaryId) {
    json_response(['ok' => false, 'error' => 'Target barangay (beneficiary) is required for a distribution event'], 400);
  }
  $location = $body['location'] ?? $existing['location'];
  $eventName = array_key_exists('eventName', $body)
    ? (trim((string) $body['eventName']) ?: null)
    : ($existing['event_name'] ?? null);
  if ($eventName === null || $eventName === '') {
    $eventName = ($existing['code'] ?? 'DST') . ' — ' . $location;
  }
  $update = $pdo->prepare('UPDATE distributions SET event_name = ?, location = ?, beneficiary_id = ?, program = ?, distribution_date = ?, schedule_time = ?, beneficiaries_count = ?, volunteers_count = ?, vehicles_count = ?, distance_km = ?, fuel_liters = ?, fuel_cost = ?, status = ?, distribution_type = ?, items_summary = ?, coordinator = ?, notes = ?, proof_status = ? WHERE id = ?');
  $update->execute([
    $eventName,
    $location,
    $beneficiaryId,
    $body['program'] ?? $existing['program'],
    $body['distributionDate'] ?? $existing['distribution_date'],
    array_key_exists('scheduleTime', $body) ? ($body['scheduleTime'] ?: null) : $existing['schedule_time'],
    (int) ($body['beneficiaries'] ?? $existing['beneficiaries_count']),
    (int) ($body['volunteers'] ?? $existing['volunteers_count']),
    (int) ($body['vehicles'] ?? $existing['vehicles_count']),
    $isDelivery ? (array_key_exists('distanceKm', $body) ? ($body['distanceKm'] !== '' ? (float) $body['distanceKm'] : null) : $existing['distance_km']) : null,
    $isDelivery ? (array_key_exists('fuelLiters', $body) ? ($body['fuelLiters'] !== '' ? (float) $body['fuelLiters'] : null) : $existing['fuel_liters']) : null,
    $isDelivery ? (array_key_exists('fuelCost', $body) ? ($body['fuelCost'] !== '' ? (float) $body['fuelCost'] : null) : $existing['fuel_cost']) : null,
    $newStatus,
    $type,
    $body['itemsSummary'] ?? $existing['items_summary'],
    $body['coordinator'] ?? $existing['coordinator'],
    $body['notes'] ?? $existing['notes'],
    $proofStatus,
    $id,
  ]);

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Distribution status updated', "Distribution {$existing['code']} is now {$newStatus}", '/admin/distributions');
  }

  audit_log($pdo, 'update', 'distribution', $existing['code'], "Updated distribution" . ($newStatus !== $existing['status'] ? " (status: {$newStatus})" : ''));

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Distribution id is required'], 400);
  }
  $del = $pdo->prepare('SELECT code FROM distributions WHERE id = ?');
  $del->execute([$id]);
  $delCode = $del->fetchColumn();
  $pdo->prepare('DELETE FROM distributions WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'distribution', $delCode ?: (string) $id, 'Deleted distribution');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
