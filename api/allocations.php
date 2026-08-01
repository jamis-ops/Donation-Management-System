<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_allocation(PDO $pdo, array $row): array
{
  $benName = $row['beneficiary_target'];
  $affectedFamilies = 0;
  $beneficiaryNeeds = [];
  if (!empty($row['beneficiary_id'])) {
    $b = $pdo->prepare('SELECT full_name, affected_families, needs, category FROM beneficiaries WHERE id = ?');
    $b->execute([$row['beneficiary_id']]);
    $ben = $b->fetch();
    if ($ben) {
      $benName = $ben['full_name'] ?: $benName;
      $affectedFamilies = (int) ($ben['affected_families'] ?? 0);
      if (!empty($ben['needs'])) {
        $decoded = json_decode((string) $ben['needs'], true);
        if (is_array($decoded)) {
          $beneficiaryNeeds = array_values(array_filter(array_map('strval', $decoded)));
        }
      }
      if (!$beneficiaryNeeds && !empty($ben['category'])) {
        $beneficiaryNeeds = array_values(array_filter(array_map('trim', explode(',', (string) $ben['category']))));
      }
    }
  }

  // Check for linked draft distribution
  $draftDistId = null;
  $draftDistCode = null;
  if (!empty($row['distribution_id'])) {
    $dd = $pdo->prepare('SELECT id, code, status FROM distributions WHERE id = ? LIMIT 1');
    $dd->execute([$row['distribution_id']]);
    $ddRow = $dd->fetch();
    if ($ddRow) {
      $draftDistId = (int) $ddRow['id'];
      $draftDistCode = $ddRow['code'];
    }
  }

  // Linked relief request reference (for admin tables + tracking)
  $assistanceRequestId = !empty($row['assistance_request_id']) ? (int) $row['assistance_request_id'] : null;
  $assistanceRequestCode = null;
  $assistanceRequestType = null;
  $assistanceRequestStatus = null;
  if ($assistanceRequestId) {
    try {
      $ar = $pdo->prepare('SELECT reference_code, assistance_type, status FROM assistance_requests WHERE id = ? LIMIT 1');
      $ar->execute([$assistanceRequestId]);
      $arRow = $ar->fetch();
      if ($arRow) {
        $assistanceRequestCode = $arRow['reference_code'] ?? null;
        $assistanceRequestType = $arRow['assistance_type'] ?? null;
        $assistanceRequestStatus = $arRow['status'] ?? null;
      }
    } catch (Throwable $e) {
      // older schemas may differ
    }
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'resource' => $row['resource_name'],
    'quantity' => (int) $row['quantity'],
    'program' => $row['program'],
    'beneficiary' => $benName,
    'beneficiaryId' => $row['beneficiary_id'] ? (int) $row['beneficiary_id'] : null,
    'assistanceRequestId' => $assistanceRequestId,
    'assistanceRequestCode' => $assistanceRequestCode,
    'assistanceRequestType' => $assistanceRequestType,
    'assistanceRequestStatus' => $assistanceRequestStatus,
    'distributionId' => !empty($row['distribution_id']) ? (int) $row['distribution_id'] : null,
    'draftDistributionId' => $draftDistId,
    'draftDistributionCode' => $draftDistCode,
    'affectedFamilies' => $affectedFamilies,
    'beneficiaryNeeds' => $beneficiaryNeeds,
    'status' => $row['status'],
    'priority' => $row['priority'] ?? 'Medium',
    'notes' => $row['notes'] ?? '',
    'date' => format_date($row['allocation_date']),
    'allocationDate' => $row['allocation_date'],
  ];
}

/**
 * Auto-create a distribution draft when allocation is approved (status → Allocated).
 */
function auto_create_distribution_draft(PDO $pdo, array $allocation): ?int
{
  $beneficiaryId = $allocation['beneficiary_id'] ?? null;
  if (!$beneficiaryId) {
    return null;
  }

  // Get barangay info
  $ben = $pdo->prepare('SELECT full_name, barangay, affected_families FROM beneficiaries WHERE id = ?');
  $ben->execute([$beneficiaryId]);
  $benInfo = $ben->fetch();
  $barangayName = $benInfo ? ($benInfo['full_name'] ?? 'Unknown') : 'Unknown';
  $location = $benInfo ? ($benInfo['barangay'] ?? $benInfo['full_name'] ?? '') : '';

  $code = generate_code('DST');
  $eventName = "Distribution — {$barangayName}";
  $program = $allocation['program'] ?? null;
  $itemsSummary = trim(($allocation['resource_name'] ?? '') . ' × ' . (int) ($allocation['quantity'] ?? 0));
  $notes = "Auto-created from Allocation {$allocation['code']}";
  $beneficiariesCount = (int) ($benInfo['affected_families'] ?? 0);

  // Determine request_id from linked assistance request
  $requestId = !empty($allocation['assistance_request_id']) ? (int) $allocation['assistance_request_id'] : null;

  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, beneficiaries_count, status, distribution_type, items_summary, notes, proof_status, request_id, source_allocation_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $eventName,
    $location,
    (int) $beneficiaryId,
    $program,
    $beneficiariesCount,
    'Planning',
    'Delivery',
    $itemsSummary !== '' ? $itemsSummary : null,
    $notes,
    'Awaiting Proof',
    $requestId,
    json_encode([(int) $allocation['id']]),
  ]);

  $distId = (int) $pdo->lastInsertId();

  // Link allocation to distribution
  $pdo->prepare('UPDATE allocations SET distribution_id = ? WHERE id = ?')->execute([$distId, (int) $allocation['id']]);

  // Notify
  notify_admins($pdo, 'distribution', 'Distribution draft created', "Auto-draft {$code} created for {$barangayName} from Allocation {$allocation['code']}", '/admin/distributions?focus=drafts#distributions-drafts');
  audit_log($pdo, 'auto-create', 'distribution', $code, "Auto-created from allocation {$allocation['code']} for {$barangayName}");

  return $distId;
}

/**
 * Once resources are allocated against a relief request, mark that request Allocated
 * so it leaves the active Relief Requests queue.
 */
function mark_request_allocated(PDO $pdo, ?int $requestId): void
{
  if (!$requestId || $requestId <= 0) {
    return;
  }
  try {
    $pdo->prepare("
      UPDATE assistance_requests
      SET status = 'Allocated'
      WHERE id = ?
        AND status NOT IN ('Allocated', 'Completed', 'Rejected', 'Cancelled')
    ")->execute([$requestId]);
  } catch (Throwable $e) {
    // best-effort status sync
  }
}

// Resource allocation is an admin/staff operation
require_auth(['Admin', 'Staff']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Allocation not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_allocation($pdo, $row)]);
  }

  // Allocations ready to plan into a distribution event
  if (!empty($_GET['readyForDistribution']) && $_GET['readyForDistribution'] === '1') {
    $rows = $pdo->query("
      SELECT * FROM allocations
      WHERE status IN ('Reserved','Allocated')
        AND (distribution_id IS NULL OR distribution_id = 0)
        AND beneficiary_id IS NOT NULL
      ORDER BY FIELD(priority,'Critical','High','Medium','Low'), allocation_date DESC
    ")->fetchAll();
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_allocation($pdo, $r), $rows)]);
  }

  $rows = $pdo->query('SELECT * FROM allocations ORDER BY FIELD(priority,"Critical","High","Medium","Low"), allocation_date DESC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_allocation($pdo, $r), $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  $code = generate_code('ALC');
  $priority = in_array($body['priority'] ?? 'Medium', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Medium';
  $assistanceRequestId = !empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : null;
  $qty = (int) ($body['quantity'] ?? 0);
  $resource = trim((string) ($body['resource'] ?? ''));
  $status = $body['status'] ?? 'Pending';

  $stmt = $pdo->prepare('INSERT INTO allocations (code, resource_name, quantity, program, beneficiary_target, beneficiary_id, assistance_request_id, status, priority, notes, allocation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $resource,
    $qty,
    $body['program'] ?? null,
    $body['beneficiary'] ?? null,
    $body['beneficiaryId'] ?? null,
    $assistanceRequestId,
    $status,
    $priority,
    $body['notes'] ?? null,
    $body['allocationDate'] ?? date('Y-m-d'),
  ]);

  // Sync inventory allocated counter + stock state when reserved/allocated
  if ($resource !== '' && $qty > 0 && in_array($status, ['Reserved', 'Allocated'], true)) {
    $inv = $pdo->prepare('SELECT id FROM inventory_items WHERE LOWER(item_name) = LOWER(?) LIMIT 1');
    $inv->execute([$resource]);
    $invId = $inv->fetchColumn();
    if ($invId) {
      $pdo->prepare("UPDATE inventory_items SET allocated = allocated + ?, stock_state = ? WHERE id = ?")
        ->execute([$qty, $status === 'Reserved' ? 'Reserved' : 'Allocated', (int) $invId]);
    }
  }

  notify_admins($pdo, 'allocation', 'New resource allocation', "Allocated {$resource} for {$body['beneficiary']}", '/admin/allocation');
  audit_log($pdo, 'create', 'allocation', $code, "Allocated {$resource} for {$body['beneficiary']}");
  $newId = (int) $pdo->lastInsertId();

  // Leave Relief Requests queue once this request has been allocated
  mark_request_allocated($pdo, $assistanceRequestId);

  // ── Auto-create distribution draft if status is Allocated ──
  $draftDistId = null;
  if ($status === 'Allocated' && !empty($body['beneficiaryId'])) {
    $stmt2 = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
    $stmt2->execute([$newId]);
    $newAlloc = $stmt2->fetch();
    if ($newAlloc) {
      $draftDistId = auto_create_distribution_draft($pdo, $newAlloc);
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
  $stmt->execute([$newId]);
  $result = map_allocation($pdo, $stmt->fetch());
  if ($draftDistId) {
    $result['draftDistributionCreated'] = true;
    $result['draftDistributionId'] = $draftDistId;
  }
  json_response(['ok' => true, 'data' => $result], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Allocation id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Allocation not found'], 404);
  }
  $priority = in_array($body['priority'] ?? ($existing['priority'] ?? 'Medium'), ['Low', 'Medium', 'High', 'Critical'], true)
    ? ($body['priority'] ?? $existing['priority'])
    : 'Medium';
  $newStatus = $body['status'] ?? $existing['status'];
  $oldStatus = $existing['status'];

  $update = $pdo->prepare('UPDATE allocations SET resource_name = ?, quantity = ?, program = ?, beneficiary_target = ?, beneficiary_id = ?, assistance_request_id = ?, status = ?, priority = ?, notes = ?, allocation_date = ? WHERE id = ?');
  $update->execute([
    $body['resource'] ?? $existing['resource_name'],
    (int) ($body['quantity'] ?? $existing['quantity']),
    $body['program'] ?? $existing['program'],
    $body['beneficiary'] ?? $existing['beneficiary_target'],
    array_key_exists('beneficiaryId', $body) ? ($body['beneficiaryId'] ?: null) : $existing['beneficiary_id'],
    array_key_exists('assistanceRequestId', $body) ? ($body['assistanceRequestId'] ?: null) : ($existing['assistance_request_id'] ?? null),
    $newStatus,
    $priority,
    $body['notes'] ?? $existing['notes'],
    $body['allocationDate'] ?? $existing['allocation_date'],
    $id,
  ]);

  $linkedRequestId = array_key_exists('assistanceRequestId', $body)
    ? (!empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : null)
    : (!empty($existing['assistance_request_id']) ? (int) $existing['assistance_request_id'] : null);
  mark_request_allocated($pdo, $linkedRequestId);

  // ── Auto-create distribution draft when status changes TO Allocated ──
  $draftDistId = null;
  if ($newStatus === 'Allocated' && $oldStatus !== 'Allocated' && empty($existing['distribution_id'])) {
    $stmt2 = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
    $stmt2->execute([$id]);
    $updatedAlloc = $stmt2->fetch();
    if ($updatedAlloc && !empty($updatedAlloc['beneficiary_id'])) {
      $draftDistId = auto_create_distribution_draft($pdo, $updatedAlloc);
    }
  }

  if ($newStatus !== $existing['status'] || $priority !== ($existing['priority'] ?? 'Medium')) {
    notify_admins($pdo, 'status_update', 'Allocation updated', "Allocation {$existing['code']} → status: {$newStatus}, priority: {$priority}", '/admin/allocation');
  }

  audit_log($pdo, 'update', 'allocation', $existing['code'], "Updated allocation (status: {$newStatus}, priority: {$priority})");

  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
  $stmt->execute([$id]);
  $result = map_allocation($pdo, $stmt->fetch());
  if ($draftDistId) {
    $result['draftDistributionCreated'] = true;
    $result['draftDistributionId'] = $draftDistId;
  }
  json_response(['ok' => true, 'data' => $result]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Allocation id is required'], 400);
  }
  $del = $pdo->prepare('SELECT code FROM allocations WHERE id = ?');
  $del->execute([$id]);
  $delCode = $del->fetchColumn();
  $pdo->prepare('DELETE FROM allocations WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'allocation', $delCode ?: (string) $id, 'Deleted allocation');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
