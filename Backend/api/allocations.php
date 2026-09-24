<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
ensure_allocation_inventory_schema($pdo);

// Normalize database state across workflow stages:
try {
  // 1. Sync allocations linked to distributions
  $pdo->exec("
    UPDATE allocations a
    JOIN distributions d ON d.id = a.distribution_id
    SET 
      a.status = CASE
        WHEN d.status IN ('Delivered', 'Completed') THEN 'Delivered'
        WHEN d.status = 'Cancelled' THEN 'Allocated'
        ELSE 'In Distribution'
      END,
      a.distribution_id = CASE
        WHEN d.status = 'Cancelled' THEN NULL
        ELSE a.distribution_id
      END
    WHERE a.distribution_id IS NOT NULL 
      AND a.distribution_id > 0
  ");

  // 2. Fix orphaned 'In Distribution' allocations that have no distribution
  $pdo->exec("
    UPDATE allocations
    SET status = 'Allocated'
    WHERE (distribution_id IS NULL OR distribution_id = 0)
      AND status = 'In Distribution'
  ");

  // 3. Keep linked relief request status synchronized
  $pdo->exec("
    UPDATE assistance_requests ar
    JOIN allocations a ON a.assistance_request_id = ar.id
    SET ar.status = 'In Distribution'
    WHERE a.status = 'In Distribution'
      AND ar.status NOT IN ('In Distribution', 'In Transit', 'Delivered', 'Completed', 'Rejected', 'Cancelled')
  ");
} catch (Throwable $e) {}

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

  // Linked inventory item info
  $invItemId = !empty($row['inventory_item_id']) ? (int) $row['inventory_item_id'] : null;
  $invItemCode = null;
  $invItemName = null;
  $invItemUnit = $row['unit'] ?? null;
  $invItemVariant = $row['variant'] ?? null;
  if ($invItemId) {
    try {
      $invStmt = $pdo->prepare('SELECT code, item_name, unit, variant FROM inventory_items WHERE id = ? LIMIT 1');
      $invStmt->execute([$invItemId]);
      $invRow = $invStmt->fetch();
      if ($invRow) {
        $invItemCode = $invRow['code'];
        $invItemName = $invRow['item_name'];
        $invItemUnit = $invRow['unit'] ?: $invItemUnit;
        $invItemVariant = $invRow['variant'] ?: $invItemVariant;
      }
    } catch (Throwable $e) {}
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'resource' => $row['resource_name'],
    'quantity' => (int) $row['quantity'],
    'inventoryItemId' => $invItemId,
    'inventoryItemCode' => $invItemCode,
    'inventoryItemName' => $invItemName,
    'inventoryDeducted' => !empty($row['inventory_deducted']),
    'deductedQuantity' => (int) ($row['deducted_quantity'] ?? 0),
    'unit' => $invItemUnit ?: 'packs',
    'variant' => $invItemVariant,
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
    $stmt = $pdo->prepare("
      UPDATE assistance_requests
      SET status = 'Allocated'
      WHERE id = ?
        AND status NOT IN ('Allocated', 'Completed', 'Rejected', 'Cancelled')
    ");
    $stmt->execute([$requestId]);
    if ($stmt->rowCount() > 0 && function_exists('notify_request_lifecycle')) {
      notify_request_lifecycle($pdo, (int) $requestId, 'Allocated');
    }
  } catch (Throwable $e) {
    // best-effort status sync
  }
}

/**
 * Find matching inventory item for a requested resource.
 */
function find_inventory_item(PDO $pdo, ?int $inventoryItemId, string $resourceName, ?string $variant = null): ?array
{
  if ($inventoryItemId && $inventoryItemId > 0) {
    $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
    $stmt->execute([$inventoryItemId]);
    $item = $stmt->fetch();
    if ($item) {
      return $item;
    }
  }

  $cleanName = trim($resourceName);
  if ($cleanName === '') {
    return null;
  }

  // Exact code match (e.g. INV-1002)
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE code = ? LIMIT 1');
  $stmt->execute([$cleanName]);
  $item = $stmt->fetch();
  if ($item) return $item;

  // Exact item_name + variant match
  if ($variant !== null && trim($variant) !== '') {
    $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE LOWER(item_name) = LOWER(?) AND LOWER(variant) = LOWER(?) LIMIT 1');
    $stmt->execute([$cleanName, trim($variant)]);
    $item = $stmt->fetch();
    if ($item) return $item;
  }

  // Exact item_name match (case-insensitive)
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE LOWER(item_name) = LOWER(?) LIMIT 1');
  $stmt->execute([$cleanName]);
  $item = $stmt->fetch();
  if ($item) return $item;

  // Fallback: substring match (e.g. "Rice" -> "Rice (50kg sacks)" or "5kg Family Rice Packs")
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE LOWER(item_name) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT("%", LOWER(item_name), "%") ORDER BY LENGTH(item_name) ASC LIMIT 1');
  $stmt->execute(['%' . $cleanName . '%', $cleanName]);
  return $stmt->fetch() ?: null;
}

/**
 * Record inventory ledger transaction for full auditability.
 */
function log_inventory_transaction(
  PDO $pdo,
  int $inventoryItemId,
  string $type,
  int $quantity,
  int $balanceAfter,
  ?string $referenceCode,
  ?string $destination,
  ?string $notes = null
): void {
  try {
    $stmt = $pdo->prepare('
      INSERT INTO inventory_transactions (
        inventory_item_id, transaction_type, quantity, balance_after,
        reference_code, destination, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
      $inventoryItemId,
      $type,
      $quantity,
      $balanceAfter,
      $referenceCode,
      $destination,
      $notes,
    ]);
  } catch (Throwable $e) {}
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

  $scope = $_GET['scope'] ?? '';
  $statusParam = $_GET['status'] ?? '';
  if ($statusParam !== '') {
    $stmt = $pdo->prepare('SELECT * FROM allocations WHERE status = ? ORDER BY created_at DESC, allocation_date DESC, id DESC');
    $stmt->execute([$statusParam]);
    $rows = $stmt->fetchAll();
  } elseif ($scope === 'active') {
    $rows = $pdo->query("
      SELECT * FROM allocations
      WHERE status NOT IN ('In Distribution', 'Delivered', 'Cancelled')
        AND (distribution_id IS NULL OR distribution_id = 0)
      ORDER BY created_at DESC, allocation_date DESC, id DESC
    ")->fetchAll();
  } else {
    $rows = $pdo->query('SELECT * FROM allocations ORDER BY created_at DESC, allocation_date DESC, id DESC')->fetchAll();
  }
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_allocation($pdo, $r), $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  $status = 'Allocated'; // Enforce Allocated status
  $priority = in_array($body['priority'] ?? 'Medium', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Medium';
  $assistanceRequestId = !empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : null;
  $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null;
  $beneficiary = trim((string) ($body['beneficiary'] ?? ''));
  $program = $body['program'] ?? null;
  $notes = $body['notes'] ?? null;
  $allocationDate = $body['allocationDate'] ?? date('Y-m-d');

  // Validate Relief Request if provided
  if ($assistanceRequestId) {
    $arStmt = $pdo->prepare('
      SELECT ar.*, b.full_name AS beneficiary_name, b.barangay, b.municipality
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.id = ? LIMIT 1
    ');
    $arStmt->execute([$assistanceRequestId]);
    $arRow = $arStmt->fetch();
    if (!$arRow) {
      json_response(['ok' => false, 'error' => 'Linked relief request not found.'], 404);
    }
    // Target Barangay MUST come from the Relief Request and cannot be changed
    $beneficiaryId = (int) $arRow['beneficiary_id'];
    $beneficiary = $arRow['beneficiary_name'] ?: ($arRow['barangay'] ?: 'Beneficiary');
  }

  // Parse lines: either $body['lines'] or single item
  $rawLines = [];
  if (!empty($body['lines']) && is_array($body['lines'])) {
    $rawLines = $body['lines'];
  } elseif (!empty($body['resource'])) {
    $rawLines = [[
      'resource' => $body['resource'],
      'quantity' => $body['quantity'] ?? 0,
      'inventoryItemId' => $body['inventoryItemId'] ?? null,
      'unit' => $body['unit'] ?? null,
      'variant' => $body['variant'] ?? null,
    ]];
  }

  // Filter valid lines
  $linesToProcess = [];
  foreach ($rawLines as $l) {
    $resName = trim((string) ($l['resource'] ?? ''));
    $q = (int) ($l['quantity'] ?? 0);
    $invId = !empty($l['inventoryItemId']) ? (int) $l['inventoryItemId'] : null;
    if ($resName === '' && !$invId) continue;
    $linesToProcess[] = [
      'resource' => $resName,
      'quantity' => $q,
      'inventoryItemId' => $invId,
      'unit' => $l['unit'] ?? null,
      'variant' => $l['variant'] ?? null,
    ];
  }

  if (count($linesToProcess) === 0) {
    json_response(['ok' => false, 'error' => 'At least one resource item with a valid name or inventory selection is required.'], 400);
  }

  foreach ($linesToProcess as $l) {
    if ($l['quantity'] <= 0) {
      json_response(['ok' => false, 'error' => "Quantity for '{$l['resource']}' must be greater than zero."], 400);
    }
  }

  $createdAllocations = [];
  $firstAllocRow = null;

  // Start transaction for atomic inventory deduction and allocation creation
  $pdo->beginTransaction();
  try {
    foreach ($linesToProcess as $line) {
      $qty = (int) $line['quantity'];
      $invId = $line['inventoryItemId'] ? (int) $line['inventoryItemId'] : null;
      $resourceName = $line['resource'];
      $variant = isset($line['variant']) ? trim((string) $line['variant']) : null;

      $invItem = find_inventory_item($pdo, $invId, $resourceName, $variant);
      if (!$invItem) {
        throw new RuntimeException("Inventory item '{$resourceName}' could not be found in warehouse stock.");
      }

      $matchedInvId = (int) $invItem['id'];
      $unit = $invItem['unit'] ?? ($line['unit'] ?? 'packs');
      $resourceClean = $invItem['item_name'];
      $variant = $variant ?: ($invItem['variant'] ?? null);

      // Lock inventory row with FOR UPDATE
      $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
      $lockStmt->execute([$matchedInvId]);
      $lockedInv = $lockStmt->fetch();

      if (!$lockedInv) {
        throw new RuntimeException("Inventory item '{$resourceClean}' not found.");
      }

      $availableStock = (int) ($lockedInv['quantity'] ?? 0);
      if ($qty > $availableStock) {
        throw new RuntimeException("Insufficient inventory stock for '{$lockedInv['item_name']}'. Available: {$availableStock} {$lockedInv['unit']}, Requested: {$qty} {$lockedInv['unit']}.");
      }

      $newStock = $availableStock - $qty;
      $newAllocated = (int) ($lockedInv['allocated'] ?? 0) + $qty;
      $lowThreshold = (int) ($lockedInv['low_stock_threshold'] ?? 10);
      $newStockState = ($newStock <= 0) ? 'Out of Stock' : (($newStock <= $lowThreshold) ? 'Low Stock' : 'Available');

      update_inventory_stock_state($pdo, $matchedInvId, $newStock, $newAllocated, $newStockState);

      $code = generate_code('ALC');

      log_inventory_transaction(
        $pdo,
        $matchedInvId,
        'Allocation',
        $qty,
        $newStock,
        $code,
        $beneficiary ?: 'Beneficiary',
        "Allocated {$qty} {$lockedInv['unit']} of {$lockedInv['item_name']} ({$status})"
      );

      $stmt = $pdo->prepare('
        INSERT INTO allocations (
          code, resource_name, quantity, program, beneficiary_target, beneficiary_id,
          assistance_request_id, status, priority, notes, allocation_date,
          inventory_item_id, inventory_deducted, deducted_quantity, unit, variant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $stmt->execute([
        $code,
        $resourceClean,
        $qty,
        $program,
        $beneficiary ?: null,
        $beneficiaryId,
        $assistanceRequestId,
        $status,
        $priority,
        $notes,
        $allocationDate,
        $matchedInvId,
        1,
        $qty,
        $unit,
        $variant,
      ]);
      $newId = (int) $pdo->lastInsertId();

      $fetchStmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
      $fetchStmt->execute([$newId]);
      $allocRow = $fetchStmt->fetch();
      if ($allocRow) {
        if (!$firstAllocRow) {
          $firstAllocRow = $allocRow;
        }
        $createdAllocations[] = map_allocation($pdo, $allocRow);
      }
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => $e->getMessage()], 400);
  }

  foreach ($createdAllocations as $ca) {
    notify_admins($pdo, 'allocation', 'New resource allocation', "Allocated {$ca['resource']} for {$beneficiary}", '/admin/allocation');
    audit_log($pdo, 'create', 'allocation', $ca['id'], "Allocated {$ca['resource']} for {$beneficiary}");
  }

  // Leave Relief Requests queue once this request has been allocated
  mark_request_allocated($pdo, $assistanceRequestId);

  $primaryResult = $createdAllocations[0] ?? [];
  $primaryResult['createdCount'] = count($createdAllocations);
  $primaryResult['allocations'] = $createdAllocations;

  json_response(['ok' => true, 'data' => $primaryResult], 201);
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

  assert_valid_status_transition(
    'Allocation',
    (string) $oldStatus,
    (string) $newStatus,
    WORKFLOW_ALLOCATION_STEPS,
    WORKFLOW_ALLOCATION_TERMINAL,
    WORKFLOW_ALLOCATION_BRANCHES
  );

  $newQty = array_key_exists('quantity', $body) ? (int) $body['quantity'] : (int) $existing['quantity'];
  if ($newQty <= 0) {
    json_response(['ok' => false, 'error' => 'Quantity must be greater than zero.'], 400);
  }

  $newResource = trim((string) ($body['resource'] ?? $existing['resource_name']));
  $newInvItemId = array_key_exists('inventoryItemId', $body) 
    ? ($body['inventoryItemId'] ? (int) $body['inventoryItemId'] : null)
    : ($existing['inventory_item_id'] ? (int) $existing['inventory_item_id'] : null);
  $beneficiaryTarget = $body['beneficiary'] ?? $existing['beneficiary_target'];

  $pdo->beginTransaction();
  try {
    $invDeducted = (int) ($existing['inventory_deducted'] ?? 0);
    $deductedQty = (int) ($existing['deducted_quantity'] ?? 0);
    $targetInvId = $existing['inventory_item_id'] ? (int) $existing['inventory_item_id'] : null;

    // CASE 1: Status changing TO Cancelled -> Restore deducted stock
    if ($newStatus === 'Cancelled' && $oldStatus !== 'Cancelled') {
      if ($invDeducted === 1 && $deductedQty > 0 && $targetInvId) {
        $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
        $lockStmt->execute([$targetInvId]);
        $inv = $lockStmt->fetch();
        if ($inv) {
          $restoredStock = (int) $inv['quantity'] + $deductedQty;
          $restoredAlloc = max(0, (int) $inv['allocated'] - $deductedQty);
          $lowThreshold = (int) ($inv['low_stock_threshold'] ?? 10);
          $stockState = ($restoredStock <= 0) ? 'Out of Stock' : (($restoredStock <= $lowThreshold) ? 'Low Stock' : 'Available');

          update_inventory_stock_state($pdo, $targetInvId, $restoredStock, $restoredAlloc, $stockState);

          log_inventory_transaction(
            $pdo,
            $targetInvId,
            'Restoration',
            $deductedQty,
            $restoredStock,
            $existing['code'],
            $beneficiaryTarget,
            "Restored {$deductedQty} {$inv['unit']} due to cancelled allocation {$existing['code']}"
          );
        }
        $invDeducted = 0;
        $deductedQty = 0;
      }
    }
    // CASE 2: Status changing FROM Pending to Confirmed (Reserved or Allocated) -> Deduct stock
    elseif (in_array($newStatus, ['Reserved', 'Allocated'], true) && $oldStatus === 'Pending' && $invDeducted === 0) {
      $invItem = find_inventory_item($pdo, $newInvItemId, $newResource, $existing['variant'] ?? null);
      if ($invItem) {
        $targetInvId = (int) $invItem['id'];
        $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
        $lockStmt->execute([$targetInvId]);
        $inv = $lockStmt->fetch();
        if ($inv) {
          $avail = (int) $inv['quantity'];
          if ($newQty > $avail) {
            throw new RuntimeException("Insufficient inventory stock for '{$inv['item_name']}'. Available: {$avail} {$inv['unit']}, Requested: {$newQty} {$inv['unit']}.");
          }
          $newStock = $avail - $newQty;
          $newAlloc = (int) $inv['allocated'] + $newQty;
          $lowThreshold = (int) ($inv['low_stock_threshold'] ?? 10);
          $stockState = ($newStock <= 0) ? 'Out of Stock' : (($newStock <= $lowThreshold) ? 'Low Stock' : 'Available');

          update_inventory_stock_state($pdo, $targetInvId, $newStock, $newAlloc, $stockState);

          log_inventory_transaction(
            $pdo,
            $targetInvId,
            'Allocation',
            $newQty,
            $newStock,
            $existing['code'],
            $beneficiaryTarget,
            "Deducted {$newQty} {$inv['unit']} on allocation confirmation {$existing['code']}"
          );
          $invDeducted = 1;
          $deductedQty = $newQty;
        }
      }
    }
    // CASE 3: Status changing TO Delivered -> Move counter from allocated to distributed
    elseif ($newStatus === 'Delivered' && $oldStatus !== 'Delivered') {
      if ($targetInvId && $invDeducted === 1) {
        $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
        $lockStmt->execute([$targetInvId]);
        $inv = $lockStmt->fetch();
        if ($inv) {
          $newAlloc = max(0, (int) $inv['allocated'] - $deductedQty);
          $newDist = (int) ($inv['distributed'] ?? 0) + $deductedQty;
          $pdo->prepare('UPDATE inventory_items SET allocated = ?, distributed = ? WHERE id = ?')
            ->execute([$newAlloc, $newDist, $targetInvId]);

          log_inventory_transaction(
            $pdo,
            $targetInvId,
            'Distribution',
            $deductedQty,
            (int) $inv['quantity'],
            $existing['code'],
            $beneficiaryTarget,
            "Delivered {$deductedQty} {$inv['unit']} of {$inv['item_name']} to {$beneficiaryTarget}"
          );
        }
      }
    }
    // CASE 4: Active allocation (already deducted) with revised quantity
    elseif ($invDeducted === 1 && $newStatus !== 'Cancelled' && $newQty !== $deductedQty && $targetInvId) {
      $diff = $newQty - $deductedQty;
      $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
      $lockStmt->execute([$targetInvId]);
      $inv = $lockStmt->fetch();
      if ($inv) {
        if ($diff > 0) {
          // Increase deduction
          $avail = (int) $inv['quantity'];
          if ($diff > $avail) {
            throw new RuntimeException("Insufficient stock to increase allocation. Additional required: {$diff} {$inv['unit']}, Available: {$avail} {$inv['unit']}.");
          }
          $newStock = $avail - $diff;
          $newAlloc = (int) $inv['allocated'] + $diff;
          $lowThreshold = (int) ($inv['low_stock_threshold'] ?? 10);
          $stockState = ($newStock <= 0) ? 'Out of Stock' : (($newStock <= $lowThreshold) ? 'Low Stock' : 'Available');

          update_inventory_stock_state($pdo, $targetInvId, $newStock, $newAlloc, $stockState);

          log_inventory_transaction(
            $pdo,
            $targetInvId,
            'Allocation',
            $diff,
            $newStock,
            $existing['code'],
            $beneficiaryTarget,
            "Increased allocation {$existing['code']} by {$diff} {$inv['unit']}"
          );
        } else {
          // Partial restore
          $restoreAmount = abs($diff);
          $newStock = (int) $inv['quantity'] + $restoreAmount;
          $newAlloc = max(0, (int) $inv['allocated'] - $restoreAmount);
          $lowThreshold = (int) ($inv['low_stock_threshold'] ?? 10);
          $stockState = ($newStock <= 0) ? 'Out of Stock' : (($newStock <= $lowThreshold) ? 'Low Stock' : 'Available');

          update_inventory_stock_state($pdo, $targetInvId, $newStock, $newAlloc, $stockState);

          log_inventory_transaction(
            $pdo,
            $targetInvId,
            'Restoration',
            $restoreAmount,
            $newStock,
            $existing['code'],
            $beneficiaryTarget,
            "Reduced allocation {$existing['code']} by {$restoreAmount} {$inv['unit']} (stock restored)"
          );
        }
        $deductedQty = $newQty;
      }
    }

    $update = $pdo->prepare('
      UPDATE allocations SET
        resource_name = ?, quantity = ?, program = ?, beneficiary_target = ?,
        beneficiary_id = ?, assistance_request_id = ?, status = ?, priority = ?,
        notes = ?, allocation_date = ?, inventory_item_id = ?, inventory_deducted = ?,
        deducted_quantity = ?
      WHERE id = ?
    ');
    $update->execute([
      $newResource,
      $newQty,
      $body['program'] ?? $existing['program'],
      $beneficiaryTarget,
      array_key_exists('beneficiaryId', $body) ? ($body['beneficiaryId'] ?: null) : $existing['beneficiary_id'],
      array_key_exists('assistanceRequestId', $body) ? ($body['assistanceRequestId'] ?: null) : ($existing['assistance_request_id'] ?? null),
      $newStatus,
      $priority,
      $body['notes'] ?? $existing['notes'],
      $body['allocationDate'] ?? $existing['allocation_date'],
      $targetInvId,
      $invDeducted,
      $deductedQty,
      $id,
    ]);

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => $e->getMessage()], 400);
  }

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
  $updatedRow = $stmt->fetch();
  if (!$updatedRow) {
    json_response(['ok' => false, 'error' => 'Failed to retrieve updated allocation'], 500);
  }
  $result = map_allocation($pdo, $updatedRow);
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
  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Allocation not found'], 404);
  }

  $pdo->beginTransaction();
  try {
    if ((int)($existing['inventory_deducted'] ?? 0) === 1 && (int)($existing['deducted_quantity'] ?? 0) > 0 && ($existing['status'] ?? '') !== 'Delivered') {
      $invId = !empty($existing['inventory_item_id']) ? (int) $existing['inventory_item_id'] : null;
      $restoreQty = (int) $existing['deducted_quantity'];
      if ($invId) {
        $lockStmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE');
        $lockStmt->execute([$invId]);
        $inv = $lockStmt->fetch();
        if ($inv) {
          $newStock = (int) $inv['quantity'] + $restoreQty;
          $newAlloc = max(0, (int) $inv['allocated'] - $restoreQty);
          $lowThreshold = (int) ($inv['low_stock_threshold'] ?? 10);
          $stockState = ($newStock <= 0) ? 'Out of Stock' : (($newStock <= $lowThreshold) ? 'Low Stock' : 'Available');

          update_inventory_stock_state($pdo, $invId, $newStock, $newAlloc, $stockState);

          log_inventory_transaction(
            $pdo,
            $invId,
            'Restoration',
            $restoreQty,
            $newStock,
            $existing['code'],
            $existing['beneficiary_target'],
            "Restored {$restoreQty} {$inv['unit']} due to deleted allocation {$existing['code']}"
          );
        }
      }
    }

    $pdo->prepare('DELETE FROM allocations WHERE id = ?')->execute([$id]);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => 'Failed to delete allocation: ' . $e->getMessage()], 500);
  }

  audit_log($pdo, 'delete', 'allocation', $existing['code'] ?: (string) $id, 'Deleted allocation');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
