<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function ensure_inventory_items_columns(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN item_type VARCHAR(100) NULL AFTER category");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN brand VARCHAR(100) NULL AFTER item_type");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN variant VARCHAR(100) NULL AFTER brand");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN date_received DATE NULL AFTER variant");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN cost_per_unit DECIMAL(10,2) NULL AFTER unit");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN supplier VARCHAR(120) NULL AFTER cost_per_unit");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN location VARCHAR(120) NULL AFTER supplier");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN reorder_amount INT UNSIGNED NULL AFTER location");
  } catch (Throwable $e) {}
  $ensured = true;
}
ensure_inventory_items_columns($pdo);
ensure_allocation_inventory_schema($pdo);

function map_inventory(array $row): array
{
  $low = (int) ($row['low_stock_threshold'] ?? 100);
  $moderate = (int) ($row['moderate_stock_threshold'] ?? ($low * 2));
  $qty = (int) ($row['quantity'] ?? 0);
  $totalQty = max($qty, (int) ($row['total_quantity'] ?? $qty));
  $deductedQty = max(0, $totalQty - $qty);
  $level = stock_level($qty, $low, $moderate);
  $cat = $row['category'] ?? '';

  $defaultCost = match(true) {
    stripos($row['item_name'] ?? '', 'rice') !== false => 520.0,
    stripos($row['item_name'] ?? '', 'sardines') !== false || stripos($row['item_name'] ?? '', 'canned') !== false => 35.0,
    stripos($row['item_name'] ?? '', 'water') !== false => 25.0,
    stripos($cat, 'food') !== false => 45.0,
    stripos($cat, 'hygiene') !== false => 85.0,
    stripos($cat, 'medical') !== false => 120.0,
    stripos($cat, 'clothing') !== false => 150.0,
    default => 50.0,
  };
  $cost = isset($row['cost_per_unit']) && $row['cost_per_unit'] !== null && (float)$row['cost_per_unit'] > 0
    ? (float)$row['cost_per_unit']
    : $defaultCost;
  $supplier = !empty($row['supplier']) ? (string)$row['supplier'] : 'Rise Above Logistics / Community Donors';
  $location = !empty($row['location']) ? (string)$row['location'] : ('Warehouse Shelf ' . strtoupper(substr($cat ?: 'G', 0, 1)) . '-1');
  $reorder = !empty($row['reorder_amount']) ? (int)$row['reorder_amount'] : max(10, ($moderate ?: ($low * 2)) - $qty);

  $donationCodes = trim((string) ($row['donation_tracking_codes'] ?? ''));
  $donorNames = trim((string) ($row['donor_names'] ?? ''));
  if ($donationCodes !== '') {
    $sourceRef = $donationCodes . ($donorNames !== '' ? " ({$donorNames})" : '');
  } elseif (!empty($row['supplier'])) {
    $sourceRef = (string) $row['supplier'];
  } else {
    $sourceRef = 'Direct Procurement / Warehouse Stock';
  }

  $dateReceivedRaw = $row['donation_received_date'] ?? $row['date_received'] ?? $row['created_at'] ?? null;
  $dateReceived = format_date($dateReceivedRaw);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'item' => $row['item_name'],
    'category' => $cat,
    'itemType' => $row['item_type'] ?? '',
    'brand' => $row['brand'] ?? '',
    'variant' => $row['variant'] ?? '',
    'quantity' => $qty,
    'currentStock' => $qty,
    'totalQuantity' => $totalQty,
    'deductedQuantity' => $deductedQty,
    'unit' => $row['unit'] ?? 'units',
    'status' => stock_level_label($level),
    'stockLevel' => $level,
    'stockPercent' => $moderate > 0 ? min(100, (int) round(($qty / $moderate) * 100)) : 100,
    'allocated' => (int) ($row['allocated'] ?? 0),
    'distributed' => (int) ($row['distributed'] ?? 0),
    'available' => $qty,
    'stockState' => $row['stock_state'] ?? 'Available',
    'lowStockThreshold' => $low,
    'moderateStockThreshold' => $moderate,
    'minStock' => $low,
    'maxStock' => max($moderate * 2, $low * 4, $totalQty),
    'costPerUnit' => $cost,
    'totalValue' => $qty * $cost,
    'supplier' => $supplier,
    'location' => $location,
    'reorderAmount' => $reorder,
    'dateReceived' => $dateReceived,
    'dateReceivedRaw' => $dateReceivedRaw,
    'source' => $sourceRef,
    'sourceReference' => $sourceRef,
    'donationReference' => $donationCodes ?: $sourceRef,
    'lastUpdated' => format_date($row['updated_at'] ?? null),
  ];
}

function map_repacking(array $row): array
{
  $mapped = [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'sourceItemId' => isset($row['source_item_id']) && $row['source_item_id'] ? (int) $row['source_item_id'] : null,
    'source' => $row['source_items'],
    'sourceQuantity' => (int) ($row['source_quantity'] ?? 0),
    'output' => $row['output_item'],
    'outputUnit' => $row['output_unit'] ?? 'packs',
    'quantity' => (int) $row['quantity'],
    'status' => $row['status'],
    'assignedTo' => $row['assigned_to'],
    'dueDate' => format_date($row['due_date']),
    'dueDateRaw' => $row['due_date'],
    'notes' => $row['notes'] ?? '',
  ];

  // Add multi-source fields if available
  if (isset($row['source_items_json']) && $row['source_items_json']) {
    $sources = json_decode($row['source_items_json'], true);
    $mapped['sources'] = is_array($sources) ? $sources : [];
  }
  
  if (isset($row['target_barangay_id']) && $row['target_barangay_id']) {
    $mapped['targetBarangayId'] = (int) $row['target_barangay_id'];
    if (isset($row['target_barangay_name'])) {
      $mapped['targetBarangayName'] = $row['target_barangay_name'];
    }
    if (isset($row['target_barangay_location'])) {
      $mapped['targetBarangayLocation'] = $row['target_barangay_location'];
    }
  }
  
  if (isset($row['recommended_contents_json']) && $row['recommended_contents_json']) {
    $contents = json_decode($row['recommended_contents_json'], true);
    $mapped['recommendedContents'] = is_array($contents) ? $contents : [];
  }
  
  if (isset($row['families_targeted']) && $row['families_targeted']) {
    $mapped['familiesTargeted'] = (int) $row['families_targeted'];
  }
  
  if (isset($row['sufficiency_status']) && $row['sufficiency_status']) {
    $mapped['sufficiencyStatus'] = $row['sufficiency_status'];
  }

  return $mapped;
}

/** Return stock to the source inventory item(s) (used on cancel/delete). */
function restore_source_stock(PDO $pdo, array $job): void
{
  // Handle multi-source format (new)
  if (!empty($job['source_items_json'])) {
    $sources = json_decode($job['source_items_json'], true);
    if (is_array($sources)) {
      foreach ($sources as $src) {
        $itemId = (int) ($src['item_id'] ?? 0);
        $qty = (int) ($src['quantity'] ?? 0);
        if ($itemId > 0 && $qty > 0) {
          $pdo->prepare('UPDATE inventory_items SET quantity = LEAST(total_quantity, quantity + ?) WHERE id = ?')
            ->execute([$qty, $itemId]);
          $balanceStmt = $pdo->prepare('SELECT quantity FROM inventory_items WHERE id = ?');
          $balanceStmt->execute([$itemId]);
          record_inventory_transaction($pdo, $itemId, 'Restoration', $qty, (int) $balanceStmt->fetchColumn(), $job['code'] ?? null, 'Repacking', 'Source stock restored after repacking cancellation');
        }
      }
      return;
    }
  }

  // Handle single-source format (legacy)
  if (!empty($job['source_item_id']) && (int) ($job['source_quantity'] ?? 0) > 0) {
    $pdo->prepare('UPDATE inventory_items SET quantity = LEAST(total_quantity, quantity + ?) WHERE id = ?')
      ->execute([(int) $job['source_quantity'], (int) $job['source_item_id']]);
    $balanceStmt = $pdo->prepare('SELECT quantity FROM inventory_items WHERE id = ?');
    $balanceStmt->execute([(int) $job['source_item_id']]);
    record_inventory_transaction($pdo, (int) $job['source_item_id'], 'Restoration', (int) $job['source_quantity'], (int) $balanceStmt->fetchColumn(), $job['code'] ?? null, 'Repacking', 'Source stock restored after repacking cancellation');
  }
}

/** Credit the repacked output into inventory (create the item if missing). */
function credit_output_stock(PDO $pdo, array $job): void
{
  $outputName = trim((string) $job['output_item']);
  $qty = (int) $job['quantity'];
  if ($outputName === '' || $qty <= 0) {
    return;
  }

  $find = $pdo->prepare('SELECT id FROM inventory_items WHERE LOWER(item_name) = LOWER(?) LIMIT 1');
  $find->execute([$outputName]);
  $itemId = $find->fetchColumn();

  if ($itemId) {
    $pdo->prepare('UPDATE inventory_items SET quantity = quantity + ?, total_quantity = total_quantity + ? WHERE id = ?')
      ->execute([$qty, $qty, (int) $itemId]);
    $balanceStmt = $pdo->prepare('SELECT quantity FROM inventory_items WHERE id = ?');
    $balanceStmt->execute([(int) $itemId]);
    record_inventory_transaction($pdo, (int) $itemId, 'Intake', $qty, (int) $balanceStmt->fetchColumn(), $job['code'] ?? null, 'Repacking Output', 'Completed repacking output added to inventory');
  } else {
    $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, quantity, total_quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)')
      ->execute([generate_code('INV'), $outputName, 'Repacked Goods', $qty, $qty, $job['output_unit'] ?: 'packs', 50]);
  }
}

$tab = $_GET['tab'] ?? 'inventory';
require_auth(['Admin', 'Staff']);

if ($method === 'GET') {
  if ($tab === 'repacking') {
    try {
      $rows = $pdo->query('
        SELECT rj.*, b.full_name AS target_barangay_name, b.barangay AS target_barangay_location
        FROM repacking_jobs rj
        LEFT JOIN beneficiaries b ON b.id = rj.target_barangay_id
        ORDER BY FIELD(rj.status, "In Progress", "Scheduled", "Completed", "Cancelled"), rj.due_date ASC
      ')->fetchAll();
    } catch (Throwable $e) {
      $rows = $pdo->query('SELECT * FROM repacking_jobs ORDER BY FIELD(status, "In Progress", "Scheduled", "Completed", "Cancelled"), due_date ASC')->fetchAll();
    }
    $mapped = array_map('map_repacking', $rows);
    $summary = [
      'total' => count($mapped),
      'scheduled' => count(array_filter($mapped, fn($j) => $j['status'] === 'Scheduled')),
      'inProgress' => count(array_filter($mapped, fn($j) => $j['status'] === 'In Progress')),
      'completed' => count(array_filter($mapped, fn($j) => $j['status'] === 'Completed')),
    ];
    json_response(['ok' => true, 'data' => $mapped, 'summary' => $summary]);
  }

  if ($id) {
    try {
      $stmt = $pdo->prepare('
        SELECT ii.*,
               GROUP_CONCAT(DISTINCT d.tracking_code ORDER BY d.id SEPARATOR ", ") AS donation_tracking_codes,
               GROUP_CONCAT(DISTINCT d.donor_name ORDER BY d.id SEPARATOR ", ") AS donor_names,
               MIN(d.donation_date) AS donation_received_date
        FROM inventory_items ii
        LEFT JOIN donation_inventory_sources dis ON dis.inventory_item_id = ii.id
        LEFT JOIN donations d ON d.id = dis.donation_id
        WHERE ii.id = ?
        GROUP BY ii.id
        LIMIT 1
      ');
      $stmt->execute([$id]);
      $row = $stmt->fetch();
    } catch (Throwable $e) {
      $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
      $stmt->execute([$id]);
      $row = $stmt->fetch();
    }
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Inventory item not found'], 404);
    }
    $mapped = map_inventory($row);
    try {
      $historyStmt = $pdo->prepare('SELECT transaction_type, quantity, balance_after, reference_code, destination, notes, created_at FROM inventory_transactions WHERE inventory_item_id = ? ORDER BY created_at DESC, id DESC LIMIT 100');
      $historyStmt->execute([$id]);
      $mapped['stockHistory'] = array_map(static fn(array $entry): array => [
        'type' => $entry['transaction_type'],
        'quantity' => (int) $entry['quantity'],
        'balanceAfter' => (int) $entry['balance_after'],
        'referenceCode' => $entry['reference_code'],
        'destination' => $entry['destination'],
        'notes' => $entry['notes'],
        'createdAt' => $entry['created_at'],
      ], $historyStmt->fetchAll());
    } catch (Throwable $e) {
      $mapped['stockHistory'] = [];
    }
    json_response(['ok' => true, 'data' => $mapped]);
  }

  try {
    $rows = $pdo->query('
      SELECT ii.*,
             GROUP_CONCAT(DISTINCT d.tracking_code ORDER BY d.id SEPARATOR ", ") AS donation_tracking_codes,
             GROUP_CONCAT(DISTINCT d.donor_name ORDER BY d.id SEPARATOR ", ") AS donor_names,
             MIN(d.donation_date) AS donation_received_date
      FROM inventory_items ii
      LEFT JOIN donation_inventory_sources dis ON dis.inventory_item_id = ii.id
      LEFT JOIN donations d ON d.id = dis.donation_id
      GROUP BY ii.id
      ORDER BY ii.created_at DESC, ii.id DESC
    ')->fetchAll();
  } catch (Throwable $e) {
    $rows = $pdo->query('SELECT * FROM inventory_items ORDER BY created_at DESC, id DESC')->fetchAll();
  }
  $mapped = array_map('map_inventory', $rows);
  $summary = [
    'totalItems' => count($mapped),
    'totalUnits' => array_sum(array_map(fn($i) => $i['quantity'], $mapped)),
    'lowCount' => count(array_filter($mapped, fn($i) => $i['stockLevel'] === 'low')),
    'moderateCount' => count(array_filter($mapped, fn($i) => $i['stockLevel'] === 'moderate')),
    'sufficientCount' => count(array_filter($mapped, fn($i) => $i['stockLevel'] === 'sufficient')),
  ];
  json_response(['ok' => true, 'data' => $mapped, 'summary' => $summary]);
}

$body = read_json_body();

if ($method === 'POST') {
  if ($tab === 'repacking') {
    // Multi-source support: accept either single source (legacy) or sources array (new)
    $sources = $body['sources'] ?? [];
    $sourceItemId = !empty($body['sourceItemId']) ? (int) $body['sourceItemId'] : null;
    $sourceQty = (int) ($body['sourceQuantity'] ?? 0);
    $sourceLabel = trim((string) ($body['source'] ?? ''));
    
    $sourceItemsJson = null;
    $totalSourceQty = 0;
    $sourceLabels = [];
    $code = generate_code('RPK');

    // Handle multi-source repacking (new format)
    if (!empty($sources) && is_array($sources)) {
      $sourceItemsArray = [];
      
      foreach ($sources as $src) {
        $srcItemId = (int) ($src['itemId'] ?? 0);
        $srcQty = (int) ($src['quantity'] ?? 0);
        
        if ($srcItemId <= 0 || $srcQty <= 0) {
          continue;
        }

        // Validate and deduct stock
        $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
        $stmt->execute([$srcItemId]);
        $srcItem = $stmt->fetch();
        
        if (!$srcItem) {
          json_response(['ok' => false, 'error' => "Source item #{$srcItemId} not found"], 404);
        }
        
        $availableQty = (int) $srcItem['quantity'];
        if ($srcQty > $availableQty) {
          json_response(['ok' => false, 'error' => "Only {$availableQty} {$srcItem['unit']} of {$srcItem['item_name']} available"], 400);
        }

        // Deduct stock immediately
        $deductStmt = $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ? AND quantity >= ?');
        $deductStmt->execute([$srcQty, $srcItemId, $srcQty]);
        if ($deductStmt->rowCount() !== 1) {
          json_response(['ok' => false, 'error' => "Stock for {$srcItem['item_name']} changed while this batch was being prepared. Refresh and try again."], 409);
        }
        $balanceStmt = $pdo->prepare('SELECT quantity FROM inventory_items WHERE id = ?');
        $balanceStmt->execute([$srcItemId]);
        record_inventory_transaction($pdo, $srcItemId, 'Repacking', $srcQty, (int) $balanceStmt->fetchColumn(), $code, 'Repacking', "Deducted for repacking batch {$code}");

        $sourceItemsArray[] = [
          'item_id' => $srcItemId,
          'item_name' => $srcItem['item_name'],
          'quantity' => $srcQty,
          'unit' => $srcItem['unit'],
        ];
        
        $totalSourceQty += $srcQty;
        $sourceLabels[] = "{$srcItem['item_name']} ({$srcQty} {$srcItem['unit']})";
      }

      if (empty($sourceItemsArray)) {
        json_response(['ok' => false, 'error' => 'At least one source item is required'], 400);
      }

      $sourceItemsJson = json_encode($sourceItemsArray);
      $sourceLabel = implode(', ', $sourceLabels);
      $sourceItemId = null; // Multi-source doesn't use single ID
      $sourceQty = $totalSourceQty;

    } 
    // Handle single-source repacking (legacy format)
    elseif ($sourceItemId) {
      $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
      $stmt->execute([$sourceItemId]);
      $sourceItem = $stmt->fetch();
      
      if (!$sourceItem) {
        json_response(['ok' => false, 'error' => 'Source inventory item not found'], 404);
      }
      if ($sourceQty <= 0) {
        json_response(['ok' => false, 'error' => 'Source quantity must be greater than zero'], 400);
      }
      
      $availableQty = (int) $sourceItem['quantity'];
      if ($sourceQty > $availableQty) {
        json_response(['ok' => false, 'error' => "Only {$availableQty} {$sourceItem['unit']} of {$sourceItem['item_name']} in stock"], 400);
      }
      
      $deductStmt = $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ? AND quantity >= ?');
      $deductStmt->execute([$sourceQty, $sourceItemId, $sourceQty]);
      if ($deductStmt->rowCount() !== 1) {
        json_response(['ok' => false, 'error' => "Stock for {$sourceItem['item_name']} changed while this batch was being prepared. Refresh and try again."], 409);
      }
      $balanceStmt = $pdo->prepare('SELECT quantity FROM inventory_items WHERE id = ?');
      $balanceStmt->execute([$sourceItemId]);
      record_inventory_transaction($pdo, $sourceItemId, 'Repacking', $sourceQty, (int) $balanceStmt->fetchColumn(), $code, 'Repacking', "Deducted for repacking batch {$code}");
      $sourceLabel = $sourceItem['item_name'] . " ({$sourceQty} {$sourceItem['unit']})";

      // Create JSON structure for backward compatibility
      $sourceItemsJson = json_encode([[
        'item_id' => $sourceItemId,
        'item_name' => $sourceItem['item_name'],
        'quantity' => $sourceQty,
        'unit' => $sourceItem['unit'],
      ]]);
    }

    if ($sourceLabel === '') {
      json_response(['ok' => false, 'error' => 'Source items are required'], 400);
    }

    // Extract target barangay and recommendations if provided
    $targetBarangayId = !empty($body['targetBarangayId']) ? (int) $body['targetBarangayId'] : null;
    $recommendedContents = null;
    $familiesTargeted = null;
    $sufficiencyStatus = null;

    if (!empty($body['recommendedContents']) && is_array($body['recommendedContents'])) {
      $recommendedContents = json_encode($body['recommendedContents']);
    }
    if (!empty($body['familiesTargeted'])) {
      $familiesTargeted = (int) $body['familiesTargeted'];
    }
    if (!empty($body['sufficiencyStatus'])) {
      $sufficiencyStatus = in_array($body['sufficiencyStatus'], ['Insufficient', 'Partial', 'Sufficient', 'Excess'], true) 
        ? $body['sufficiencyStatus'] 
        : null;
    }

    // Check if new columns exist before using them
    try {
      $stmt = $pdo->prepare('
        INSERT INTO repacking_jobs (
          code, source_item_id, source_items, source_quantity, source_items_json,
          output_item, output_unit, quantity, 
          target_barangay_id, recommended_contents_json, families_targeted, sufficiency_status,
          status, assigned_to, due_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $stmt->execute([
        $code,
        $sourceItemId,
        $sourceLabel,
        $sourceQty,
        $sourceItemsJson,
        trim((string) ($body['output'] ?? '')),
        trim((string) ($body['outputUnit'] ?? 'packs')),
        (int) ($body['quantity'] ?? 0),
        $targetBarangayId,
        $recommendedContents,
        $familiesTargeted,
        $sufficiencyStatus,
        in_array($body['status'] ?? '', ['Scheduled', 'In Progress'], true) ? $body['status'] : 'Scheduled',
        $body['assignedTo'] ?? null,
        $body['dueDate'] ?? null,
        trim((string) ($body['notes'] ?? '')) ?: null,
      ]);
    } catch (Throwable $e) {
      // Fallback to old schema if new columns don't exist yet
      $stmt = $pdo->prepare('
        INSERT INTO repacking_jobs (
          code, source_item_id, source_items, source_quantity,
          output_item, output_unit, quantity, status, assigned_to, due_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $stmt->execute([
        $code,
        $sourceItemId,
        $sourceLabel,
        $sourceQty,
        trim((string) ($body['output'] ?? '')),
        trim((string) ($body['outputUnit'] ?? 'packs')),
        (int) ($body['quantity'] ?? 0),
        in_array($body['status'] ?? '', ['Scheduled', 'In Progress'], true) ? $body['status'] : 'Scheduled',
        $body['assignedTo'] ?? null,
        $body['dueDate'] ?? null,
        trim((string) ($body['notes'] ?? '')) ?: null,
      ]);
    }

    $newId = (int) $pdo->lastInsertId();
    
    $notifMsg = "Batch {$code}: {$sourceLabel} → {$body['quantity']} {$body['output']}";
    if ($targetBarangayId) {
      try {
        $benStmt = $pdo->prepare('SELECT full_name FROM beneficiaries WHERE id = ? LIMIT 1');
        $benStmt->execute([$targetBarangayId]);
        $benName = $benStmt->fetchColumn();
        if ($benName) {
          $notifMsg .= " for {$benName}";
        }
      } catch (Throwable $e) {
        // Ignore if can't fetch barangay name
      }
    }
    
    notify_admins($pdo, 'repacking', 'Repacking batch created', $notifMsg, '/admin/inventory');
    
    $stmt = $pdo->prepare('
      SELECT rj.*, b.full_name AS target_barangay_name, b.barangay AS target_barangay_location
      FROM repacking_jobs rj
      LEFT JOIN beneficiaries b ON b.id = rj.target_barangay_id
      WHERE rj.id = ?
    ');
    $stmt->execute([$newId]);
    json_response(['ok' => true, 'data' => map_repacking($stmt->fetch())], 201);
  }

  $category = trim((string) ($body['category'] ?? '')) ?: null;
  $itemType = trim((string) ($body['itemType'] ?? $body['item_type'] ?? '')) ?: null;
  $brand = trim((string) ($body['brand'] ?? '')) ?: null;
  $variant = trim((string) ($body['variant'] ?? '')) ?: null;

  $itemName = trim((string) ($body['item'] ?? $body['item_name'] ?? ''));
  if ($itemName === '') {
    if ($itemType) {
      $parts = [];
      if ($brand) $parts[] = $brand;
      $parts[] = $itemType;
      $name = implode(' ', $parts);
      if ($variant) $name .= " ({$variant})";
      $itemName = $name;
    } else {
      json_response(['ok' => false, 'error' => 'Item name or Item type is required'], 400);
    }
  }

  $code = generate_code('INV');
  $initialQuantity = max(0, (int) ($body['quantity'] ?? 0));
  $stmt = $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, item_type, brand, variant, quantity, total_quantity, unit, low_stock_threshold, moderate_stock_threshold, allocated, distributed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $itemName,
    $category,
    $itemType,
    $brand,
    $variant,
    $initialQuantity,
    $initialQuantity,
    trim((string) ($body['unit'] ?? 'units')) ?: 'units',
    (int) ($body['lowStockThreshold'] ?? 100),
    !empty($body['moderateStockThreshold']) ? (int) $body['moderateStockThreshold'] : null,
    0,
    0,
  ]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ?');
  $stmt->execute([$newId]);
  $mapped = map_inventory($stmt->fetch());
  if ($mapped['stockLevel'] === 'low') {
    notify_admins($pdo, 'low_stock', 'Low stock alert', "{$mapped['item']} is low ({$mapped['quantity']} {$mapped['unit']} remaining)", '/admin/inventory');
  }
  json_response(['ok' => true, 'data' => $mapped], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Id is required'], 400);
  }

  if ($tab === 'repacking') {
    $stmt = $pdo->prepare('SELECT * FROM repacking_jobs WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
      json_response(['ok' => false, 'error' => 'Repacking job not found'], 404);
    }

    $newStatus = $body['status'] ?? $existing['status'];
    $oldStatus = $existing['status'];

    if ($oldStatus === 'Completed' && $newStatus !== 'Completed') {
      json_response(['ok' => false, 'error' => 'Completed batches cannot be reopened'], 400);
    }

    $update = $pdo->prepare('UPDATE repacking_jobs SET output_item = ?, output_unit = ?, quantity = ?, status = ?, assigned_to = ?, due_date = ?, notes = ? WHERE id = ?');
    $update->execute([
      $body['output'] ?? $existing['output_item'],
      $body['outputUnit'] ?? ($existing['output_unit'] ?? 'packs'),
      (int) ($body['quantity'] ?? $existing['quantity']),
      $newStatus,
      $body['assignedTo'] ?? $existing['assigned_to'],
      $body['dueDate'] ?? $existing['due_date'],
      array_key_exists('notes', $body) ? (trim((string) $body['notes']) ?: null) : ($existing['notes'] ?? null),
      $id,
    ]);

    $stmt = $pdo->prepare('SELECT * FROM repacking_jobs WHERE id = ?');
    $stmt->execute([$id]);
    $job = $stmt->fetch();

    // Automations fire only on status transitions.
    if ($newStatus === 'Completed' && $oldStatus !== 'Completed') {
      credit_output_stock($pdo, $job);
      notify_admins($pdo, 'repacking', 'Repacking completed', "Batch {$job['code']} finished — {$job['quantity']} {$job['output_unit']} of {$job['output_item']} added to inventory", '/admin/inventory');
    } elseif ($newStatus === 'Cancelled' && in_array($oldStatus, ['Scheduled', 'In Progress'], true)) {
      restore_source_stock($pdo, $job);
      notify_admins($pdo, 'repacking', 'Repacking cancelled', "Batch {$job['code']} was cancelled — source stock returned to inventory", '/admin/inventory');
    }

    json_response(['ok' => true, 'data' => map_repacking($job)]);
  }

  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Inventory item not found'], 404);
  }
  $category = array_key_exists('category', $body) ? (trim((string) $body['category']) ?: null) : ($existing['category'] ?? null);
  $itemType = array_key_exists('itemType', $body) || array_key_exists('item_type', $body)
    ? (trim((string) ($body['itemType'] ?? $body['item_type'])) ?: null)
    : ($existing['item_type'] ?? null);
  $brand = array_key_exists('brand', $body) ? (trim((string) $body['brand']) ?: null) : ($existing['brand'] ?? null);
  $variant = array_key_exists('variant', $body) ? (trim((string) $body['variant']) ?: null) : ($existing['variant'] ?? null);

  $itemName = trim((string) ($body['item'] ?? $body['item_name'] ?? ''));
  if ($itemName === '') {
    if ($itemType) {
      $parts = [];
      if ($brand) $parts[] = $brand;
      $parts[] = $itemType;
      $name = implode(' ', $parts);
      if ($variant) $name .= " ({$variant})";
      $itemName = $name;
    } else {
      $itemName = $existing['item_name'];
    }
  }

  $oldAvailable = (int) ($existing['quantity'] ?? 0);
  if (array_key_exists('quantity', $body) && (!is_numeric($body['quantity']) || (float) $body['quantity'] < 0 || floor((float) $body['quantity']) !== (float) $body['quantity'])) {
    json_response(['ok' => false, 'error' => 'Available quantity must be a whole number of zero or greater.'], 400);
  }
  $newAvailable = array_key_exists('quantity', $body) ? (int) $body['quantity'] : $oldAvailable;
  $oldTotal = max($oldAvailable, (int) ($existing['total_quantity'] ?? $oldAvailable));
  $newTotal = $newAvailable > $oldAvailable ? $oldTotal + ($newAvailable - $oldAvailable) : $oldTotal;
  $lowThreshold = (int) ($body['lowStockThreshold'] ?? $existing['low_stock_threshold']);
  $stockState = $newAvailable <= 0 ? 'Out of Stock' : ($newAvailable <= $lowThreshold ? 'Low Stock' : 'Available');

  $update = $pdo->prepare('UPDATE inventory_items SET item_name = ?, category = ?, item_type = ?, brand = ?, variant = ?, quantity = ?, total_quantity = ?, unit = ?, stock_state = ?, low_stock_threshold = ?, moderate_stock_threshold = ?, allocated = ?, distributed = ? WHERE id = ? AND quantity = ?');
  $update->execute([
    $itemName,
    $category,
    $itemType,
    $brand,
    $variant,
    $newAvailable,
    $newTotal,
    $body['unit'] ?? $existing['unit'],
    $stockState,
    $lowThreshold,
    !empty($body['moderateStockThreshold']) ? (int) $body['moderateStockThreshold'] : ($existing['moderate_stock_threshold'] ?? null),
    (int) $existing['allocated'],
    (int) $existing['distributed'],
    $id,
    $oldAvailable,
  ]);
  $difference = $newAvailable - $oldAvailable;
  if ($difference !== 0 && $update->rowCount() !== 1) {
    json_response(['ok' => false, 'error' => 'Inventory stock changed while you were editing it. Refresh and try again.'], 409);
  }
  if ($difference !== 0) {
    $isAddition = $difference > 0;
    record_inventory_transaction(
      $pdo,
      (int) $id,
      $isAddition ? 'Intake' : 'Adjustment',
      abs($difference),
      $newAvailable,
      null,
      $isAddition ? 'Warehouse Intake' : 'Manual Deduction',
      trim((string) ($body['notes'] ?? '')) ?: ($isAddition ? 'Stock received/added manually' : 'Stock deducted manually')
    );
  }
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ?');
  $stmt->execute([$id]);
  $mapped = map_inventory($stmt->fetch());
  if ($mapped['stockLevel'] === 'low') {
    notify_admins($pdo, 'low_stock', 'Low stock alert', "{$mapped['item']} is low ({$mapped['quantity']} {$mapped['unit']} remaining)", '/admin/inventory');
  }
  json_response(['ok' => true, 'data' => $mapped]);
}

if ($method === 'DELETE') {
  $category = isset($_GET['category']) ? trim((string) $_GET['category']) : null;
  $itemType = isset($_GET['item_type']) ? trim((string) $_GET['item_type']) : (isset($_GET['itemType']) ? trim((string) $_GET['itemType']) : null);

  // 1. Delete by Category and Item Type (Classification)
  if ($category !== null && $category !== '' && $itemType !== null && $itemType !== '') {
    if ($itemType === 'General Goods') {
      $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE category = ? AND (item_type IS NULL OR item_type = "" OR item_type = "General Goods")');
      $delStmt->execute([$category]);
    } else {
      $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE category = ? AND item_type = ?');
      $delStmt->execute([$category, $itemType]);
    }
    $deletedCount = $delStmt->rowCount();

    try {
      $pdo->prepare('DELETE FROM inventory_item_types WHERE category_name = ? AND name = ?')->execute([$category, $itemType]);
    } catch (Throwable $e) {}

    json_response(['ok' => true, 'deleted' => $deletedCount, 'category' => $category, 'itemType' => $itemType]);
  }

  // 2. Delete entire Category
  if ($category !== null && $category !== '') {
    $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE category = ?');
    $delStmt->execute([$category]);
    $deletedCount = $delStmt->rowCount();

    try {
      $pdo->prepare('DELETE FROM inventory_categories WHERE name = ?')->execute([$category]);
    } catch (Throwable $e) {}
    try {
      $pdo->prepare('DELETE FROM inventory_item_types WHERE category_name = ?')->execute([$category]);
    } catch (Throwable $e) {}

    json_response(['ok' => true, 'deleted' => $deletedCount, 'category' => $category]);
  }

  // 3. Delete by ID
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Id or Category is required'], 400);
  }
  if ($tab === 'repacking') {
    $stmt = $pdo->prepare('SELECT * FROM repacking_jobs WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $job = $stmt->fetch();
    if ($job && in_array($job['status'], ['Scheduled', 'In Progress'], true)) {
      restore_source_stock($pdo, $job);
    }
    $pdo->prepare('DELETE FROM repacking_jobs WHERE id = ?')->execute([$id]);
  } else {
    $pdo->prepare('DELETE FROM inventory_items WHERE id = ?')->execute([$id]);
  }
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
