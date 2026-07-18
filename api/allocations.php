<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_allocation(PDO $pdo, array $row): array
{
  $benName = $row['beneficiary_target'];
  if (!empty($row['beneficiary_id'])) {
    $b = $pdo->prepare('SELECT full_name FROM beneficiaries WHERE id = ?');
    $b->execute([$row['beneficiary_id']]);
    $benName = $b->fetchColumn() ?: $benName;
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'resource' => $row['resource_name'],
    'quantity' => (int) $row['quantity'],
    'program' => $row['program'],
    'beneficiary' => $benName,
    'beneficiaryId' => $row['beneficiary_id'] ? (int) $row['beneficiary_id'] : null,
    'status' => $row['status'],
    'priority' => $row['priority'] ?? 'Medium',
    'notes' => $row['notes'] ?? '',
    'date' => format_date($row['allocation_date']),
    'allocationDate' => $row['allocation_date'],
  ];
}

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
  $rows = $pdo->query('SELECT * FROM allocations ORDER BY FIELD(priority,"Critical","High","Medium","Low"), allocation_date DESC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_allocation($pdo, $r), $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  $code = generate_code('ALC');
  $priority = in_array($body['priority'] ?? 'Medium', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Medium';
  $stmt = $pdo->prepare('INSERT INTO allocations (code, resource_name, quantity, program, beneficiary_target, beneficiary_id, status, priority, notes, allocation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $body['resource'] ?? '',
    (int) ($body['quantity'] ?? 0),
    $body['program'] ?? null,
    $body['beneficiary'] ?? null,
    $body['beneficiaryId'] ?? null,
    $body['status'] ?? 'Pending',
    $priority,
    $body['notes'] ?? null,
    $body['allocationDate'] ?? date('Y-m-d'),
  ]);
  notify_admins($pdo, 'allocation', 'New resource allocation', "Allocated {$body['resource']} for {$body['beneficiary']}", '/admin/allocation');
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_allocation($pdo, $stmt->fetch())], 201);
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

  $update = $pdo->prepare('UPDATE allocations SET resource_name = ?, quantity = ?, program = ?, beneficiary_target = ?, beneficiary_id = ?, status = ?, priority = ?, notes = ?, allocation_date = ? WHERE id = ?');
  $update->execute([
    $body['resource'] ?? $existing['resource_name'],
    (int) ($body['quantity'] ?? $existing['quantity']),
    $body['program'] ?? $existing['program'],
    $body['beneficiary'] ?? $existing['beneficiary_target'],
    $body['beneficiaryId'] ?? $existing['beneficiary_id'],
    $newStatus,
    $priority,
    $body['notes'] ?? $existing['notes'],
    $body['allocationDate'] ?? $existing['allocation_date'],
    $id,
  ]);

  if ($newStatus !== $existing['status'] || $priority !== ($existing['priority'] ?? 'Medium')) {
    notify_admins($pdo, 'status_update', 'Allocation updated', "Allocation {$existing['code']} → status: {$newStatus}, priority: {$priority}", '/admin/allocation');
  }

  $stmt = $pdo->prepare('SELECT * FROM allocations WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_allocation($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Allocation id is required'], 400);
  }
  $pdo->prepare('DELETE FROM allocations WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
