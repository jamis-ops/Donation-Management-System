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
        WHEN d.status IN ('Delivered', 'Completed', 'Awaiting Proof') THEN 'Delivered'
        WHEN d.status = 'In Transit' THEN 'In Transit'
        WHEN d.status IN ('Planning', 'Preparing', 'Scheduled') THEN 'Scheduled'
        WHEN d.status = 'Cancelled' THEN 'Allocated'
        ELSE 'Scheduled'
      END,
      a.distribution_id = CASE
        WHEN d.status = 'Cancelled' THEN NULL
        ELSE a.distribution_id
      END
    WHERE a.distribution_id IS NOT NULL 
      AND a.distribution_id > 0
  ");

  // 2. Fix orphaned allocations that have no distribution
  $pdo->exec("
    UPDATE allocations
    SET status = 'Allocated'
    WHERE (distribution_id IS NULL OR distribution_id = 0)
      AND status IN ('In Distribution', 'Scheduled', 'In Transit')
  ");

  // 3. Keep linked relief request status synchronized
  $pdo->exec("
    UPDATE assistance_requests ar
    JOIN allocations a ON a.assistance_request_id = ar.id
    JOIN distributions d ON d.id = a.distribution_id
    SET ar.status = CASE
      WHEN d.status = 'In Transit' THEN 'In Transit'
      WHEN d.status IN ('Delivered', 'Awaiting Proof') THEN 'Delivered'
      WHEN d.status IN ('Planning', 'Preparing', 'Scheduled') THEN 'Allocated'
      ELSE ar.status
    END
    WHERE a.distribution_id IS NOT NULL 
      AND a.distribution_id > 0
      AND ar.status NOT IN ('Completed', 'Rejected', 'Cancelled')
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
      $ar = $pdo->prepare('SELECT reference_code, assistance_type, status, affected_families FROM assistance_requests WHERE id = ? LIMIT 1');
      $ar->execute([$assistanceRequestId]);
      $arRow = $ar->fetch();
      if ($arRow) {
        $assistanceRequestCode = $arRow['reference_code'] ?? null;
        $assistanceRequestType = $arRow['assistance_type'] ?? null;
        $assistanceRequestStatus = $arRow['status'] ?? null;
        if ($affectedFamilies <= 0 && !empty($arRow['affected_families'])) {
          $affectedFamilies = (int) $arRow['affected_families'];
        }
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
  if ($beneficiariesCount <= 0 && $requestId) {
    try {
      $arStmt = $pdo->prepare('SELECT affected_families FROM assistance_requests WHERE id = ?');
      $arStmt->execute([$requestId]);
      $arFam = (int) $arStmt->fetchColumn();
      if ($arFam > 0) {
        $beneficiariesCount = $arFam;
      }
    } catch (Throwable $e) {}
  }

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
    $requestStmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? LIMIT 1');
    $requestStmt->execute([$requestId]);
    $request = $requestStmt->fetch(PDO::FETCH_ASSOC);
    if (!$request || in_array($request['status'], ['In Distribution', 'Completed', 'Rejected', 'Cancelled'], true)) {
      return;
    }

    ensure_procurement_table($pdo);
    $fundingStmt = $pdo->prepare('SELECT COUNT(*) FROM donation_procurements WHERE assistance_request_id = ?');
    $fundingStmt->execute([$requestId]);
    $hasMonetaryFunding = (int) $fundingStmt->fetchColumn() > 0;

    // Inventory-only requests stay eligible when an itemized quantity is only
    // partially fulfilled. Legacy requests without numeric quantities retain
    // the established one-allocation completion behavior.
    if (!$hasMonetaryFunding) {
      $unmatchedNumericNeeds = 0;
      $limits = request_inventory_limits($pdo, $request, $unmatchedNumericNeeds);
      $hasNumericLimits = false;
      $allNumericLimitsMet = $unmatchedNumericNeeds === 0;
      $allocatedByItem = [];
      $allocationRows = $pdo->prepare("SELECT inventory_item_id, resource_name, quantity FROM allocations WHERE assistance_request_id = ? AND status <> 'Cancelled'");
      $allocationRows->execute([$requestId]);
      foreach ($allocationRows->fetchAll() as $allocationRow) {
        $inventoryId = !empty($allocationRow['inventory_item_id']) ? (int) $allocationRow['inventory_item_id'] : null;
        if (!$inventoryId) {
          $inventory = find_inventory_item($pdo, null, (string) ($allocationRow['resource_name'] ?? ''));
          $inventoryId = $inventory ? (int) $inventory['id'] : null;
        }
        if (!$inventoryId) continue;
        $allocatedByItem[$inventoryId] = ($allocatedByItem[$inventoryId] ?? 0) + (int) ($allocationRow['quantity'] ?? 0);
      }
      foreach ($limits as $inventoryId => $limit) {
        if ($limit['requestedQuantity'] === null) continue;
        $hasNumericLimits = true;
        if ((int) ($allocatedByItem[$inventoryId] ?? 0) < (int) $limit['requestedQuantity']) {
          $allNumericLimitsMet = false;
        }
      }
      $newStatus = $hasNumericLimits && !$allNumericLimitsMet ? 'Partially Allocated' : 'Allocated';
    } else {
      $finances = calculate_relief_request_finances($pdo, $request);
      if ($finances['remainingFamilies'] <= 0 || $finances['remainingCost'] <= 0.01) {
        $newStatus = 'Allocated';
      } elseif ($finances['alreadySupportedFamilies'] > 0) {
        $newStatus = 'Partially Allocated';
      } elseif ($finances['alreadyFundedAmount'] > 0) {
        $newStatus = 'Partially Funded';
      } else {
        return;
      }
    }

    if ($request['status'] !== $newStatus) {
      $pdo->prepare('UPDATE assistance_requests SET status = ? WHERE id = ?')->execute([$newStatus, $requestId]);
      if (function_exists('notify_request_lifecycle')) {
        notify_request_lifecycle($pdo, (int) $requestId, $newStatus, (string) $request['status']);
      }
    }
  } catch (Throwable $e) {
    // best-effort status sync
  }
}

/**
 * Resolve a relief request's itemized needs to warehouse inventory IDs.
 * A null requestedQuantity means the legacy request named the item but did
 * not record a numeric cap; the item is still eligible, but stock remains the
 * authoritative quantity limit.
 */
function request_inventory_limits(PDO $pdo, array $request, ?int &$unmatchedNumericNeeds = null): array
{
  $unmatchedNumericNeeds = 0;
  $requestedItems = [];
  if (!empty($request['needs_json'])) {
    $decoded = json_decode((string) $request['needs_json'], true);
    if (is_array($decoded)) {
      foreach ($decoded as $item) {
        if (is_string($item)) {
          $name = trim($item);
          if ($name !== '') {
            $requestedItems[] = ['item' => $name, 'quantity' => null, 'unit' => null];
          }
          continue;
        }
        if (!is_array($item)) continue;
        $name = trim((string) ($item['item'] ?? $item['name'] ?? ''));
        if ($name === '') continue;
        $requestedItems[] = [
          'item' => $name,
          'quantity' => isset($item['quantity']) && is_numeric($item['quantity'])
            ? max(0, (int) $item['quantity'])
            : null,
          'unit' => !empty($item['unit']) ? trim((string) $item['unit']) : null,
        ];
      }
    }
  }

  if (!$requestedItems && !empty($request['notes'])
      && preg_match('/(?:Goods Required|Type of Needs):\s*([^\n\r]+)/i', (string) $request['notes'], $match)) {
    foreach (array_filter(array_map('trim', explode(',', $match[1]))) as $name) {
      $requestedItems[] = ['item' => $name, 'quantity' => null, 'unit' => null];
    }
  }

  if (!$requestedItems && !empty($request['assistance_type'])) {
    foreach (array_filter(array_map('trim', preg_split('/[,;\n]/', (string) $request['assistance_type']))) as $name) {
      $requestedItems[] = ['item' => $name, 'quantity' => null, 'unit' => null];
    }
  }

  $limits = [];
  foreach ($requestedItems as $requested) {
    $inventory = find_inventory_item($pdo, null, (string) $requested['item']);
    if (!$inventory) {
      if ($requested['quantity'] !== null && (int) $requested['quantity'] > 0) {
        $unmatchedNumericNeeds += 1;
      }
      continue;
    }
    $inventoryId = (int) $inventory['id'];
    $quantity = $requested['quantity'];

    if (!isset($limits[$inventoryId])) {
      $limits[$inventoryId] = [
        'inventoryItemId' => $inventoryId,
        'item' => (string) $requested['item'],
        'requestedQuantity' => $quantity,
        'unit' => $requested['unit'] ?: ($inventory['unit'] ?? 'units'),
      ];
      continue;
    }

    // If any legacy entry lacks an explicit quantity, retain an open request
    // cap while still restricting allocation to requested item IDs.
    if ($limits[$inventoryId]['requestedQuantity'] === null || $quantity === null) {
      $limits[$inventoryId]['requestedQuantity'] = null;
    } else {
      $limits[$inventoryId]['requestedQuantity'] += $quantity;
    }
  }

  return $limits;
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
  $priority = in_array($body['priority'] ?? 'Low', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Low';
  $assistanceRequestId = !empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : null;
  $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null;
  $beneficiary = trim((string) ($body['beneficiary'] ?? ''));
  $program = $body['program'] ?? null;
  $notes = $body['notes'] ?? null;
  $allocationDate = $body['allocationDate'] ?? date('Y-m-d');

  if (!$assistanceRequestId) {
    json_response(['ok' => false, 'error' => 'Select an approved relief request before allocating inventory.'], 400);
  }

  // Validate the required Relief Request.
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
    $allocatableRequestStatuses = ['Approved', 'Ready for Allocation', 'Partially Funded', 'Partially Allocated'];
    if (!in_array((string) ($arRow['status'] ?? ''), $allocatableRequestStatuses, true)) {
      json_response(['ok' => false, 'error' => "Relief request is {$arRow['status']} and is not open for inventory allocation."], 409);
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
    $invId = !empty($l['inventoryItemId']) ? (int) $l['inventoryItemId'] : null;
    if ($resName === '' && !$invId) continue;
    if ($assistanceRequestId && !$invId) {
      json_response(['ok' => false, 'error' => 'Every requested item must be linked to a valid warehouse inventory item.'], 400);
    }
    $rawQuantity = $l['quantity'] ?? 0;
    if (!is_numeric($rawQuantity) || (float) $rawQuantity <= 0 || floor((float) $rawQuantity) !== (float) $rawQuantity) {
      $lineLabel = $resName !== '' ? $resName : 'selected item';
      json_response(['ok' => false, 'error' => "Quantity for '{$lineLabel}' must be a whole number greater than zero."], 400);
    }
    $q = (int) $rawQuantity;
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

  // Lock inventory in a stable order so concurrent batches cannot deadlock by
  // requesting the same items in a different UI order.
  usort($linesToProcess, fn(array $left, array $right) => ((int) $left['inventoryItemId']) <=> ((int) $right['inventoryItemId']));

  $createdAllocations = [];
  $firstAllocRow = null;
  $requestItemLimits = [];
  $requestAllocatedTotals = [];
  $batchRequestTotals = [];

  // Start transaction for atomic inventory deduction and allocation creation
  $pdo->beginTransaction();
  try {
    if ($assistanceRequestId) {
      $requestLock = $pdo->prepare('SELECT status FROM assistance_requests WHERE id = ? FOR UPDATE');
      $requestLock->execute([$assistanceRequestId]);
      $lockedRequestStatus = $requestLock->fetchColumn();
      if ($lockedRequestStatus === false) {
        throw new RuntimeException('Linked relief request no longer exists.');
      }
      if (!in_array((string) $lockedRequestStatus, $allocatableRequestStatuses, true)) {
        throw new RuntimeException("Relief request is {$lockedRequestStatus} and is no longer open for inventory allocation.");
      }

      $requestItemLimits = request_inventory_limits($pdo, $arRow);
      if (!$requestItemLimits) {
        // If request had free-text needs, build open limits directly from valid inventory items being allocated:
        foreach ($linesToProcess as $l) {
          $invId = (int) ($l['inventoryItemId'] ?? 0);
          if ($invId > 0) {
            $requestItemLimits[$invId] = [
              'inventoryItemId' => $invId,
              'item' => $l['resource'],
              'requestedQuantity' => null,
              'unit' => $l['unit'] ?? 'units',
            ];
          }
        }
        if (!$requestItemLimits) {
          throw new RuntimeException('This relief request has no requested goods that match warehouse inventory.');
        }
      }

      // The request row lock serializes concurrent allocation attempts for the
      // same request. Lock existing lines too so requested quantities cannot be
      // over-allocated by a stale or duplicate submission.
      $existingRequestAllocations = $pdo->prepare("SELECT inventory_item_id, resource_name, quantity FROM allocations WHERE assistance_request_id = ? AND status <> 'Cancelled' FOR UPDATE");
      $existingRequestAllocations->execute([$assistanceRequestId]);
      foreach ($existingRequestAllocations->fetchAll() as $existingAllocation) {
        $existingInventoryId = !empty($existingAllocation['inventory_item_id'])
          ? (int) $existingAllocation['inventory_item_id']
          : null;
        if (!$existingInventoryId) {
          $existingInventory = find_inventory_item($pdo, null, (string) ($existingAllocation['resource_name'] ?? ''));
          $existingInventoryId = $existingInventory ? (int) $existingInventory['id'] : null;
        }
        if (!$existingInventoryId) continue;
        $requestAllocatedTotals[$existingInventoryId] = ($requestAllocatedTotals[$existingInventoryId] ?? 0)
          + (int) ($existingAllocation['quantity'] ?? 0);
      }
    }

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

      if ($assistanceRequestId) {
        if (!isset($requestItemLimits[$matchedInvId])) {
          throw new RuntimeException("'{$resourceClean}' is not one of the goods requested on this relief request.");
        }

        $requestLimit = $requestItemLimits[$matchedInvId]['requestedQuantity'];
        $alreadyAllocated = (int) ($requestAllocatedTotals[$matchedInvId] ?? 0);
        $inThisBatch = (int) ($batchRequestTotals[$matchedInvId] ?? 0);
        if ($requestLimit !== null && ($alreadyAllocated + $inThisBatch + $qty) > (int) $requestLimit) {
          $remainingRequested = max(0, (int) $requestLimit - $alreadyAllocated - $inThisBatch);
          throw new RuntimeException("Allocation for '{$resourceClean}' exceeds the request. Remaining requested quantity: {$remainingRequested} {$unit}.");
        }
        $batchRequestTotals[$matchedInvId] = $inThisBatch + $qty;
      }

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

      consume_donation_inventory_sources($pdo, $newId, $matchedInvId, $qty);

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
    WORKFLOW_ALLOCATION_BRANCHES,
    WORKFLOW_ALLOCATION_ALIASES ?? []
  );

  if (in_array($newStatus, ['Delivered', 'Completed'], true) && $oldStatus !== $newStatus) {
    json_response(['ok' => false, 'error' => 'Allocation status cannot be manually set to Delivered. It updates automatically when the delivery is executed in Logistics.'], 400);
  }

  $rawNewQty = array_key_exists('quantity', $body) ? $body['quantity'] : $existing['quantity'];
  if (!is_numeric($rawNewQty) || (float) $rawNewQty <= 0 || floor((float) $rawNewQty) !== (float) $rawNewQty) {
    json_response(['ok' => false, 'error' => 'Quantity must be a whole number greater than zero.'], 400);
  }
  $newQty = (int) $rawNewQty;

  $newResource = trim((string) ($body['resource'] ?? $existing['resource_name']));
  $newInvItemId = array_key_exists('inventoryItemId', $body) 
    ? ($body['inventoryItemId'] ? (int) $body['inventoryItemId'] : null)
    : ($existing['inventory_item_id'] ? (int) $existing['inventory_item_id'] : null);
  $beneficiaryTarget = $body['beneficiary'] ?? $existing['beneficiary_target'];

  $existingInventoryId = !empty($existing['inventory_item_id']) ? (int) $existing['inventory_item_id'] : null;
  if ((int) ($existing['inventory_deducted'] ?? 0) === 1 && $existingInventoryId && $newInvItemId !== $existingInventoryId) {
    json_response(['ok' => false, 'error' => 'The warehouse item cannot be changed after stock has been allocated. Cancel this allocation and create a new one instead.'], 409);
  }
  if ($existingInventoryId) {
    $canonicalInventory = find_inventory_item($pdo, $existingInventoryId, $newResource, $existing['variant'] ?? null);
    if ($canonicalInventory) {
      $newInvItemId = $existingInventoryId;
      $newResource = (string) $canonicalInventory['item_name'];
    }
  }
  $existingRequestId = !empty($existing['assistance_request_id']) ? (int) $existing['assistance_request_id'] : null;
  $newRequestId = array_key_exists('assistanceRequestId', $body)
    ? (!empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : null)
    : $existingRequestId;
  if ((int) ($existing['inventory_deducted'] ?? 0) === 1 && $existingRequestId !== $newRequestId) {
    json_response(['ok' => false, 'error' => 'The linked relief request cannot be changed after stock has been allocated.'], 409);
  }

  $pdo->beginTransaction();
  try {
    $invDeducted = (int) ($existing['inventory_deducted'] ?? 0);
    $deductedQty = (int) ($existing['deducted_quantity'] ?? 0);
    $targetInvId = $existing['inventory_item_id'] ? (int) $existing['inventory_item_id'] : $newInvItemId;

    if ($newRequestId && $newStatus !== 'Cancelled') {
      $requestStmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? FOR UPDATE');
      $requestStmt->execute([$newRequestId]);
      $requestRow = $requestStmt->fetch();
      if (!$requestRow) {
        throw new RuntimeException('Linked relief request no longer exists.');
      }
      $requestLimits = request_inventory_limits($pdo, $requestRow);
      if (!$targetInvId || !isset($requestLimits[$targetInvId])) {
        throw new RuntimeException("'{$newResource}' is not one of the goods requested on the linked relief request.");
      }
      $requestLimit = $requestLimits[$targetInvId]['requestedQuantity'];
      if ($requestLimit !== null) {
        $otherRowsStmt = $pdo->prepare("SELECT inventory_item_id, resource_name, quantity FROM allocations WHERE assistance_request_id = ? AND id <> ? AND status <> 'Cancelled' FOR UPDATE");
        $otherRowsStmt->execute([$newRequestId, $id]);
        $allocatedElsewhere = 0;
        foreach ($otherRowsStmt->fetchAll() as $otherRow) {
          $otherInventoryId = !empty($otherRow['inventory_item_id']) ? (int) $otherRow['inventory_item_id'] : null;
          if (!$otherInventoryId) {
            $otherInventory = find_inventory_item($pdo, null, (string) ($otherRow['resource_name'] ?? ''));
            $otherInventoryId = $otherInventory ? (int) $otherInventory['id'] : null;
          }
          if ($otherInventoryId === $targetInvId) {
            $allocatedElsewhere += (int) ($otherRow['quantity'] ?? 0);
          }
        }
        if (($allocatedElsewhere + $newQty) > (int) $requestLimit) {
          $remainingForThisAllocation = max(0, (int) $requestLimit - $allocatedElsewhere);
          throw new RuntimeException("Allocation exceeds the linked request. Maximum allowed for this record: {$remainingForThisAllocation} {$requestLimits[$targetInvId]['unit']}.");
        }
      }
    }

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
        release_donation_inventory_sources($pdo, (int) $id);
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
          consume_donation_inventory_sources($pdo, (int) $id, $targetInvId, $newQty);
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
          consume_donation_inventory_sources($pdo, (int) $id, $targetInvId, $diff);
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
          release_donation_inventory_sources($pdo, (int) $id, $restoreAmount);
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

    release_donation_inventory_sources($pdo, (int) $id);
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
