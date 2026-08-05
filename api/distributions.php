<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_distribution(PDO $pdo, array $row): array
{
  $barangay = '';
  $barangayMunicipality = '';
  if (!empty($row['beneficiary_id'])) {
    $b = $pdo->prepare('SELECT full_name, affected_families, municipality FROM beneficiaries WHERE id = ?');
    $b->execute([$row['beneficiary_id']]);
    $ben = $b->fetch();
    if ($ben) {
      $barangay = $ben['full_name'] . ' (' . $ben['affected_families'] . ' families)';
      $barangayMunicipality = $ben['municipality'] ?? '';
    }
  }

  $proofCount = $pdo->prepare('SELECT COUNT(*) FROM distribution_proofs WHERE distribution_id = ?');
  $proofCount->execute([$row['id']]);

  $eventName = trim((string) ($row['event_name'] ?? ''));
  if ($eventName === '') {
    $eventName = trim(($row['code'] ?? '') . ' — ' . ($row['location'] ?? 'Distribution'));
  }

  $linkedAllocs = [];
  try {
    $aStmt = $pdo->prepare('SELECT id, code, resource_name, quantity, status FROM allocations WHERE distribution_id = ? ORDER BY id ASC');
    $aStmt->execute([(int) $row['id']]);
    foreach ($aStmt->fetchAll() as $a) {
      $linkedAllocs[] = [
        'dbId' => (int) $a['id'],
        'id' => $a['code'],
        'resource' => $a['resource_name'],
        'quantity' => (int) $a['quantity'],
        'status' => $a['status'],
      ];
    }
  } catch (Throwable $e) {
    $linkedAllocs = [];
  }

  // Linked request urgency + details
  $requestPriority = null;
  $requestInfo = null;
  $requestId = !empty($row['request_id']) ? (int) $row['request_id'] : null;

  // Fallback: resolve via linked allocation if distribution.request_id is empty
  if (!$requestId) {
    try {
      $ar = $pdo->prepare(
        'SELECT assistance_request_id FROM allocations
         WHERE distribution_id = ? AND assistance_request_id IS NOT NULL
         ORDER BY id ASC LIMIT 1'
      );
      $ar->execute([(int) $row['id']]);
      $fromAlloc = $ar->fetchColumn();
      if ($fromAlloc) {
        $requestId = (int) $fromAlloc;
      }
    } catch (Throwable $e) {
      // column may be missing on older DBs
    }
  }

  if ($requestId) {
    $rp = $pdo->prepare(
      'SELECT id, reference_code, assistance_type, status, priority, notes, request_date
       FROM assistance_requests WHERE id = ? LIMIT 1'
    );
    $rp->execute([$requestId]);
    $reqRow = $rp->fetch();
    if ($reqRow) {
      $requestPriority = $reqRow['priority'] ?: null;
      $requestInfo = [
        'dbId' => (int) $reqRow['id'],
        'id' => $reqRow['reference_code'],
        'type' => $reqRow['assistance_type'],
        'status' => $reqRow['status'],
        'priority' => $reqRow['priority'],
        'notes' => $reqRow['notes'] ?? '',
        'date' => format_date($reqRow['request_date'] ?? null),
        'requestDate' => $reqRow['request_date'] ?? null,
      ];
    }
  }

  // Source allocation IDs for grouped distributions
  $sourceAllocIds = [];
  if (!empty($row['source_allocation_ids'])) {
    $decoded = json_decode((string) $row['source_allocation_ids'], true);
    if (is_array($decoded)) {
      $sourceAllocIds = array_map('intval', $decoded);
    }
  }

  // Volunteer / staff status updates surface via admin notifications (audit trail for detail UI).
  $statusActivity = [];
  $code = (string) ($row['code'] ?? '');
  if ($code !== '') {
    try {
      $act = $pdo->prepare(
        "SELECT title, message, created_at FROM notifications
         WHERE type = 'distribution' AND message LIKE ?
         ORDER BY created_at DESC LIMIT 12"
      );
      $act->execute(['%' . $code . '%']);
      foreach ($act->fetchAll() as $n) {
        $statusActivity[] = [
          'title' => (string) ($n['title'] ?? ''),
          'message' => (string) ($n['message'] ?? ''),
          'at' => format_date($n['created_at'] ?? null),
          'atRaw' => $n['created_at'] ?? null,
        ];
      }
    } catch (Throwable $e) {
      $statusActivity = [];
    }
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'eventName' => $eventName,
    'location' => $row['location'],
    'barangay' => $barangay,
    'barangayMunicipality' => $barangayMunicipality,
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
    'status' => normalize_distribution_status((string) ($row['status'] ?? 'Planning')),
    'proofStatus' => $row['proof_status'] ?? 'Not Required',
    'receiptStatus' => $row['receipt_status'] ?? 'Awaiting Confirmation',
    'receivedQuantity' => isset($row['received_quantity']) && $row['received_quantity'] !== null ? (int) $row['received_quantity'] : null,
    'receivedAt' => format_date($row['received_at'] ?? null),
    'receiptNotes' => $row['receipt_notes'] ?? '',
    'type' => $row['distribution_type'],
    'itemsSummary' => $row['items_summary'] ?? '',
    'items' => $row['items_summary'] ?? '',
    'quantity' => isset($row['beneficiaries_count']) ? (int) $row['beneficiaries_count'] : null,
    'coordinator' => $row['coordinator'] ?? '',
    'notes' => $row['notes'] ?? '',
    'allocations' => $linkedAllocs,
    'allocationIds' => array_map(fn($a) => $a['dbId'], $linkedAllocs),
    'proofsCount' => (int) $proofCount->fetchColumn(),
    'workflowSteps' => distribution_workflow_steps(),
    'requestId' => $requestId ?: null,
    'requestPriority' => $requestPriority,
    'request' => $requestInfo,
    'sourceAllocationIds' => $sourceAllocIds,
    'statusActivity' => $statusActivity,
    'isAutoDraft' => str_contains($row['notes'] ?? '', 'Auto-created from Allocation'),
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
      $receipt = $row['receipt_status'] ?? 'Awaiting Confirmation';
      if ($proof === 'Proof Verified') {
        return false;
      }
      // After Confirm Received, barangay should submit proof
      if ($receipt === 'Received') {
        return true;
      }
      if ($proof === 'Proof Rejected' || $proof === 'Proof Submitted' || $proof === 'Awaiting Proof') {
        return true;
      }
      $eligible = ['Delivered', 'Awaiting Proof', 'In Transit', 'Preparing', 'Completed'];
      return in_array($status, $eligible, true);
    }));
  }

  return $rows;
}

/**
 * Auto-close linked assistance request when all its distributions are completed.
 * Defined in bootstrap.php so proofs and distributions can both call it.
 */

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
  if (empty($dist['beneficiary_id'])) {
    $pdo->prepare('UPDATE distributions SET beneficiary_id = ? WHERE id = ?')->execute([$benRow['id'], $id]);
    $dist['beneficiary_id'] = $benRow['id'];
  }

  $action = $body['action'] ?? 'confirm-receipt';

  if ($action === 'confirm-receipt') {
    $status = normalize_distribution_status((string) ($dist['status'] ?? ''));
    if ($status !== 'Delivered') {
      json_response([
        'ok' => false,
        'error' => 'You can confirm receipt only after the distribution is marked Delivered.',
      ], 400);
    }
    $qty = isset($body['receivedQuantity']) ? (int) $body['receivedQuantity'] : null;
    $notes = trim((string) ($body['notes'] ?? ''));
    $proofStatus = (string) ($dist['proof_status'] ?? 'Not Required');
    $newProof = in_array($proofStatus, ['Proof Verified', 'Proof Submitted'], true)
      ? $proofStatus
      : 'Awaiting Proof';
    $newStatus = 'Awaiting Proof';
    $upd = $pdo->prepare('
      UPDATE distributions
      SET receipt_status = ?, received_quantity = ?, received_at = NOW(), receipt_notes = ?,
          proof_status = ?, status = ?
      WHERE id = ?
    ');
    $upd->execute(['Received', $qty, $notes !== '' ? $notes : null, $newProof, $newStatus, $id]);
    notify_admins(
      $pdo,
      'receipt',
      'Donation receipt confirmed',
      "{$benRow['full_name']} confirmed receipt for {$dist['code']}" . ($qty !== null ? " ({$qty} items)" : '') . '. Awaiting proof submission.',
      '/admin/distributions?id=' . $id . '#distributions-table'
    );
  } elseif ($action === 'report-missing') {
    $notes = trim((string) ($body['notes'] ?? ''));
    if ($notes === '') {
      json_response(['ok' => false, 'error' => 'Please describe the issue so Admin/Staff can follow up.'], 400);
    }
    $upd = $pdo->prepare('UPDATE distributions SET receipt_status = ?, receipt_notes = ? WHERE id = ?');
    $upd->execute(['Not Received', $notes, $id]);
    notify_admins(
      $pdo,
      'alert',
      'Barangay reported a distribution issue',
      "{$benRow['full_name']} reports distribution {$dist['code']} has not been received. Message: {$notes}",
      '/admin/distributions?id=' . $id . '#distributions-table'
    );
  } else {
    json_response(['ok' => false, 'error' => 'Unknown action'], 400);
  }

  audit_log($pdo, $action === 'report-missing' ? 'report-missing' : 'confirm-receipt', 'distribution', $dist['code'], "{$benRow['full_name']}: {$action}");

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response([
    'ok' => true,
    'data' => map_distribution($pdo, $stmt->fetch()),
    'nextStep' => $action === 'confirm-receipt' ? 'submit-proof' : null,
  ]);
}

require_auth(['Admin', 'Staff']);

// ── Grouping action: merge multiple Planning distributions for same barangay ──
if ($method === 'POST' && !empty($body['action']) && $body['action'] === 'group') {
  $distIds = $body['distributionIds'] ?? $body['distribution_ids'] ?? [];
  if (!is_array($distIds) || count($distIds) < 2) {
    json_response(['ok' => false, 'error' => 'At least 2 distribution IDs are required for grouping'], 400);
  }
  $distIds = array_map('intval', $distIds);

  $placeholders = implode(',', array_fill(0, count($distIds), '?'));
  $stmt = $pdo->prepare("SELECT * FROM distributions WHERE id IN ({$placeholders})");
  $stmt->execute($distIds);
  $dists = $stmt->fetchAll();

  if (count($dists) !== count($distIds)) {
    json_response(['ok' => false, 'error' => 'One or more distributions not found'], 400);
  }

  // Validate: all must be same beneficiary and status Planning
  $benIds = [];
  foreach ($dists as $d) {
    if ($d['status'] !== 'Planning') {
      json_response(['ok' => false, 'error' => "Distribution {$d['code']} is not in Planning status"], 400);
    }
    $benIds[] = (int) ($d['beneficiary_id'] ?? 0);
  }
  $benIds = array_unique($benIds);
  if (count($benIds) !== 1 || $benIds[0] === 0) {
    json_response(['ok' => false, 'error' => 'All distributions must belong to the same barangay'], 400);
  }

  // Merge: combine items, notes, source allocation IDs
  $mergedItems = [];
  $mergedNotes = [];
  $allSourceAllocIds = [];
  $mergedPrograms = [];
  $mergedRequestIds = [];

  foreach ($dists as $d) {
    if (!empty($d['items_summary'])) {
      $mergedItems[] = $d['items_summary'];
    }
    if (!empty($d['notes'])) {
      $mergedNotes[] = $d['notes'];
    }
    if (!empty($d['source_allocation_ids'])) {
      $decoded = json_decode($d['source_allocation_ids'], true);
      if (is_array($decoded)) {
        $allSourceAllocIds = array_merge($allSourceAllocIds, $decoded);
      }
    }
    if (!empty($d['program'])) {
      $mergedPrograms[] = $d['program'];
    }
    if (!empty($d['request_id'])) {
      $mergedRequestIds[] = (int) $d['request_id'];
    }
  }

  $benInfo = $pdo->prepare('SELECT full_name, barangay, affected_families FROM beneficiaries WHERE id = ?');
  $benInfo->execute([$benIds[0]]);
  $ben = $benInfo->fetch();
  $barangayName = $ben ? $ben['full_name'] : 'Unknown';

  $code = generate_code('DST');
  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, beneficiaries_count, status, distribution_type, items_summary, notes, proof_status, request_id, source_allocation_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    "Grouped Distribution — {$barangayName}",
    $ben['barangay'] ?? $barangayName,
    $benIds[0],
    implode(', ', array_unique($mergedPrograms)) ?: null,
    (int) ($ben['affected_families'] ?? 0),
    'Planning',
    'Delivery',
    implode('; ', $mergedItems) ?: null,
    'Grouped from: ' . implode(', ', array_map(fn($d) => $d['code'], $dists)),
    'Awaiting Proof',
    $mergedRequestIds ? $mergedRequestIds[0] : null,
    json_encode(array_values(array_unique($allSourceAllocIds))),
  ]);
  $newId = (int) $pdo->lastInsertId();

  // Re-link allocations to the merged distribution
  foreach ($distIds as $oldDistId) {
    $pdo->prepare('UPDATE allocations SET distribution_id = ? WHERE distribution_id = ?')->execute([$newId, $oldDistId]);
  }

  // Delete the individual drafts
  $pdo->prepare("DELETE FROM distributions WHERE id IN ({$placeholders})")->execute($distIds);

  audit_log($pdo, 'group', 'distribution', $code, "Grouped " . count($distIds) . " distributions for {$barangayName}");
  notify_admins($pdo, 'distribution', 'Distributions grouped', "Merged " . count($distIds) . " drafts into {$code} for {$barangayName}", '/admin/distributions');

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())], 201);
}

if ($method === 'POST') {
  $code = generate_code('DST');
  $proofStatus = $body['proofStatus'] ?? 'Awaiting Proof';
  $isDelivery = ($body['type'] ?? 'Delivery') === 'Delivery';

  // Optional handoff: build distribution from confirmed allocations
  $allocationIds = [];
  if (!empty($body['allocationIds']) && is_array($body['allocationIds'])) {
    $allocationIds = array_values(array_unique(array_map('intval', $body['allocationIds'])));
  } elseif (!empty($body['allocationId'])) {
    $allocationIds = [(int) $body['allocationId']];
  }

  $fromAllocations = [];
  if ($allocationIds) {
    $placeholders = implode(',', array_fill(0, count($allocationIds), '?'));
    $stmtA = $pdo->prepare("SELECT * FROM allocations WHERE id IN ({$placeholders})");
    $stmtA->execute($allocationIds);
    $fromAllocations = $stmtA->fetchAll();
    if (count($fromAllocations) !== count($allocationIds)) {
      json_response(['ok' => false, 'error' => 'One or more allocations were not found'], 400);
    }
    foreach ($fromAllocations as $a) {
      if (!in_array($a['status'], ['Reserved', 'Allocated'], true)) {
        json_response(['ok' => false, 'error' => "Allocation {$a['code']} must be Reserved or Allocated before planning distribution"], 400);
      }
      if (!empty($a['distribution_id'])) {
        json_response(['ok' => false, 'error' => "Allocation {$a['code']} is already linked to a distribution"], 400);
      }
    }
    $benIds = array_unique(array_filter(array_map(fn($a) => (int) ($a['beneficiary_id'] ?? 0), $fromAllocations)));
    if (count($benIds) !== 1) {
      json_response(['ok' => false, 'error' => 'All selected allocations must belong to the same barangay'], 400);
    }
  }

  $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null;
  if (!$beneficiaryId && $fromAllocations) {
    $beneficiaryId = (int) ($fromAllocations[0]['beneficiary_id'] ?? 0) ?: null;
  }
  if (!$beneficiaryId) {
    json_response(['ok' => false, 'error' => 'Target barangay (beneficiary) is required for a distribution event'], 400);
  }

  $benRow = $pdo->prepare('SELECT full_name, barangay, affected_families FROM beneficiaries WHERE id = ?');
  $benRow->execute([$beneficiaryId]);
  $benInfo = $benRow->fetch() ?: [];

  $location = trim((string) ($body['location'] ?? ''));
  if ($location === '') {
    $location = trim((string) ($benInfo['barangay'] ?? $benInfo['full_name'] ?? ''));
  }

  $itemsSummary = trim((string) ($body['itemsSummary'] ?? ''));
  if ($itemsSummary === '' && $fromAllocations) {
    $parts = [];
    foreach ($fromAllocations as $a) {
      $parts[] = trim($a['resource_name']) . ' × ' . (int) $a['quantity'];
    }
    $itemsSummary = implode('; ', $parts);
  }

  $program = $body['program'] ?? null;
  if (($program === null || $program === '') && $fromAllocations) {
    foreach ($fromAllocations as $a) {
      if (!empty($a['program'])) {
        $program = $a['program'];
        break;
      }
    }
  }

  $beneficiariesCount = (int) ($body['beneficiaries'] ?? 0);
  if ($beneficiariesCount <= 0) {
    $beneficiariesCount = (int) ($benInfo['affected_families'] ?? 0);
  }

  $eventName = trim((string) ($body['eventName'] ?? ''));
  if ($eventName === '') {
    $place = $location !== '' ? $location : 'Distribution';
    $eventName = 'Distribution — ' . $place;
  }

  $notes = $body['notes'] ?? null;
  if (($notes === null || $notes === '') && $fromAllocations) {
    $codes = array_map(fn($a) => $a['code'], $fromAllocations);
    $notes = 'Created from allocation(s): ' . implode(', ', $codes);
  }

  // Determine request_id
  $requestId = $body['requestId'] ?? null;
  if (!$requestId && $fromAllocations) {
    foreach ($fromAllocations as $a) {
      if (!empty($a['assistance_request_id'])) {
        $requestId = (int) $a['assistance_request_id'];
        break;
      }
    }
  }

  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, distribution_date, schedule_time, beneficiaries_count, volunteers_count, vehicles_count, distance_km, fuel_liters, fuel_cost, status, distribution_type, items_summary, coordinator, notes, proof_status, request_id, source_allocation_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $eventName,
    $location,
    $beneficiaryId,
    $program,
    $body['distributionDate'] ?? null,
    $body['scheduleTime'] ?? null,
    $beneficiariesCount,
    (int) ($body['volunteers'] ?? 0),
    (int) ($body['vehicles'] ?? 0),
    $isDelivery && isset($body['distanceKm']) && $body['distanceKm'] !== '' ? (float) $body['distanceKm'] : null,
    $isDelivery && isset($body['fuelLiters']) && $body['fuelLiters'] !== '' ? (float) $body['fuelLiters'] : null,
    $isDelivery && isset($body['fuelCost']) && $body['fuelCost'] !== '' ? (float) $body['fuelCost'] : null,
    $body['status'] ?? 'Planning',
    $body['type'] ?? 'Delivery',
    $itemsSummary !== '' ? $itemsSummary : null,
    $body['coordinator'] ?? null,
    $notes,
    $proofStatus,
    $requestId ? (int) $requestId : null,
    $allocationIds ? json_encode($allocationIds) : null,
  ]);
  $newId = (int) $pdo->lastInsertId();

  if ($fromAllocations) {
    $link = $pdo->prepare('UPDATE allocations SET distribution_id = ?, status = CASE WHEN status = \'Reserved\' THEN \'Allocated\' ELSE status END WHERE id = ?');
    foreach ($fromAllocations as $a) {
      $link->execute([$newId, (int) $a['id']]);
    }
  }

  notify_admins($pdo, 'distribution', 'New distribution planned', "Distribution {$code} scheduled for {$location}", '/admin/distributions?focus=drafts#distributions-drafts');
  audit_log($pdo, 'create', 'distribution', $code, "Planned distribution for {$location}" . ($allocationIds ? ' from allocations' : ''));
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

  $newStatus = normalize_distribution_status((string) ($body['status'] ?? $existing['status']));
  if (!is_valid_distribution_status($newStatus)) {
    json_response([
      'ok' => false,
      'error' => 'Invalid distribution status. Use: ' . implode(', ', distribution_workflow_steps()),
    ], 400);
  }
  $proofStatus = $body['proofStatus'] ?? $existing['proof_status'];
  $allowedProof = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected'];
  if (!in_array((string) $proofStatus, $allowedProof, true)) {
    $proofStatus = $existing['proof_status'] ?? 'Not Required';
  }

  if ($newStatus === 'Delivered' && in_array((string) $proofStatus, ['Not Required', ''], true)) {
    $proofStatus = 'Awaiting Proof';
  }
  // Completed requires verified proof — Staff/Admin cannot skip barangay receipt/proof.
  if ($newStatus === 'Completed') {
    $existingProof = (string) ($existing['proof_status'] ?? '');
    $hasVerified = ($proofStatus === 'Proof Verified') || ($existingProof === 'Proof Verified');
    if (!$hasVerified && empty($body['forceComplete'])) {
      json_response([
        'ok' => false,
        'error' => 'Cannot mark Completed until proof is verified. Advance to Delivered, then wait for barangay receipt and proof approval.',
      ], 400);
    }
    $proofStatus = 'Proof Verified';
  }
  // Staff may only set early/mid workflow statuses (not Completed without proof).
  if (($user['role'] ?? '') === 'Staff' && $newStatus === 'Completed' && ($existing['proof_status'] ?? '') !== 'Proof Verified') {
    json_response([
      'ok' => false,
      'error' => 'Staff cannot complete a distribution before proof verification.',
    ], 403);
  }

  $type = $body['type'] ?? $existing['distribution_type'];
  $isDelivery = $type === 'Delivery';
  $beneficiaryId = array_key_exists('beneficiaryId', $body)
    ? (!empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null)
    : ($existing['beneficiary_id'] ? (int) $existing['beneficiary_id'] : null);
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
    notify_admins($pdo, 'status_update', 'Distribution status updated', "Distribution {$existing['code']} is now {$newStatus}", '/admin/distributions?id=' . (int) $id . '#distributions-table');
    if (in_array($newStatus, ['Delivered', 'Completed'], true)) {
      try {
        $pdo->prepare("UPDATE allocations SET status = 'Delivered' WHERE distribution_id = ? AND status IN ('Reserved','Allocated')")
          ->execute([$id]);
      } catch (Throwable $e) {
        // column may not exist yet pre-migrate
      }
    }
    // Auto-close linked request when distribution is Completed
    if ($newStatus === 'Completed') {
      try {
        try_close_linked_request($pdo, (int) $id);
      } catch (Throwable $e) {
        // best-effort
      }
    }
    // Email + in-app for barangay on In Transit / Delivered / Completed
    $freshForMail = array_merge($existing, [
      'status' => $newStatus,
      'beneficiary_id' => $beneficiaryId ?? ($existing['beneficiary_id'] ?? null),
    ]);
    notify_distribution_lifecycle($pdo, $freshForMail, (string) $newStatus, (string) ($existing['status'] ?? ''));
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
  try {
    $pdo->prepare('UPDATE allocations SET distribution_id = NULL WHERE distribution_id = ?')->execute([$id]);
  } catch (Throwable $e) {
    // ignore if column missing
  }
  $pdo->prepare('DELETE FROM distributions WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'distribution', $delCode ?: (string) $id, 'Deleted distribution');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
