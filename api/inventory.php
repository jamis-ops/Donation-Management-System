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
    'lowStockThreshold' => $low,
    'moderateStockThreshold' => $moderate,
  ];
}

function map_repacking(array $row): array
{
  return [
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
}

/** Return stock to the source inventory item (used on cancel/delete). */
function restore_source_stock(PDO $pdo, array $job): void
{
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
    $rows = $pdo->query('SELECT * FROM repacking_jobs ORDER BY FIELD(status, "In Progress", "Scheduled", "Completed", "Cancelled"), due_date ASC')->fetchAll();
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
    $sourceItemId = !empty($body['sourceItemId']) ? (int) $body['sourceItemId'] : null;
    $sourceQty = (int) ($body['sourceQuantity'] ?? 0);
    $sourceLabel = trim((string) ($body['source'] ?? ''));

    // Deduct source stock right away so it can't be double-allocated.
    if ($sourceItemId) {
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
    }

    if ($sourceLabel === '') {
      json_response(['ok' => false, 'error' => 'Source items are required'], 400);
    }

    $code = generate_code('RPK');
    $stmt = $pdo->prepare('INSERT INTO repacking_jobs (code, source_item_id, source_items, source_quantity, output_item, output_unit, quantity, status, assigned_to, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
    $newId = (int) $pdo->lastInsertId();
    notify_admins($pdo, 'repacking', 'Repacking batch created', "Batch {$code}: {$sourceLabel} → {$body['quantity']} {$body['output']}", '/admin/inventory');
    $stmt = $pdo->prepare('SELECT * FROM repacking_jobs WHERE id = ?');
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
