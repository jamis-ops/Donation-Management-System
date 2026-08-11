<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_inventory(array $row): array
{
  $low = (int) $row['low_stock_threshold'];
  $moderate = (int) ($row['moderate_stock_threshold'] ?? ($low * 2));
  $qty = (int) $row['quantity'];
  $level = stock_level($qty, $low, $moderate);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'item' => $row['item_name'],
    'category' => $row['category'] ?? '',
    'quantity' => $qty,
    'unit' => $row['unit'],
    'status' => stock_level_label($level),
    'stockLevel' => $level,
    'stockPercent' => $moderate > 0 ? min(100, (int) round(($qty / $moderate) * 100)) : 100,
    'allocated' => (int) $row['allocated'],
    'distributed' => (int) $row['distributed'],
    'available' => max(0, $qty - (int) $row['allocated']),
    'stockState' => $row['stock_state'] ?? 'Available',
    'lowStockThreshold' => $low,
    'moderateStockThreshold' => $moderate,
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
          $pdo->prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?')
            ->execute([$qty, $itemId]);
        }
      }
      return;
    }
  }

  // Handle single-source format (legacy)
  if (!empty($job['source_item_id']) && (int) ($job['source_quantity'] ?? 0) > 0) {
    $pdo->prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?')
      ->execute([(int) $job['source_quantity'], (int) $job['source_item_id']]);
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
    $pdo->prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?')
      ->execute([$qty, (int) $itemId]);
  } else {
    $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)')
      ->execute([generate_code('INV'), $outputName, 'Repacked Goods', $qty, $job['output_unit'] ?: 'packs', 50]);
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
    $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Inventory item not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_inventory($row)]);
  }

  $rows = $pdo->query('SELECT * FROM inventory_items ORDER BY item_name ASC')->fetchAll();
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
        $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?')
          ->execute([$srcQty, $srcItemId]);

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
      
      $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?')
        ->execute([$sourceQty, $sourceItemId]);
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

    $code = generate_code('RPK');
    
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

  $itemName = trim((string) ($body['item'] ?? $body['item_name'] ?? ''));
  if ($itemName === '') {
    json_response(['ok' => false, 'error' => 'Item name is required'], 400);
  }
  $code = generate_code('INV');
  $stmt = $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, quantity, unit, low_stock_threshold, moderate_stock_threshold, allocated, distributed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $itemName,
    trim((string) ($body['category'] ?? '')) ?: null,
    (int) ($body['quantity'] ?? 0),
    $body['unit'] ?? 'units',
    (int) ($body['lowStockThreshold'] ?? 100),
    !empty($body['moderateStockThreshold']) ? (int) $body['moderateStockThreshold'] : null,
    (int) ($body['allocated'] ?? 0),
    (int) ($body['distributed'] ?? 0),
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
  $update = $pdo->prepare('UPDATE inventory_items SET item_name = ?, category = ?, quantity = ?, unit = ?, low_stock_threshold = ?, moderate_stock_threshold = ?, allocated = ?, distributed = ? WHERE id = ?');
  $update->execute([
    $body['item'] ?? $existing['item_name'],
    array_key_exists('category', $body) ? (trim((string) $body['category']) ?: null) : ($existing['category'] ?? null),
    (int) ($body['quantity'] ?? $existing['quantity']),
    $body['unit'] ?? $existing['unit'],
    (int) ($body['lowStockThreshold'] ?? $existing['low_stock_threshold']),
    !empty($body['moderateStockThreshold']) ? (int) $body['moderateStockThreshold'] : ($existing['moderate_stock_threshold'] ?? null),
    (int) ($body['allocated'] ?? $existing['allocated']),
    (int) ($body['distributed'] ?? $existing['distributed']),
    $id,
  ]);
  $stmt = $pdo->prepare('SELECT * FROM inventory_items WHERE id = ?');
  $stmt->execute([$id]);
  $mapped = map_inventory($stmt->fetch());
  if ($mapped['stockLevel'] === 'low') {
    notify_admins($pdo, 'low_stock', 'Low stock alert', "{$mapped['item']} is low ({$mapped['quantity']} {$mapped['unit']} remaining)", '/admin/inventory');
  }
  json_response(['ok' => true, 'data' => $mapped]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Id is required'], 400);
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
