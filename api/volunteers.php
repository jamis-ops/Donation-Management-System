<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_volunteer(PDO $pdo, array $row): array
{
  $taskCount = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE assignee = ? OR assignee_user_id = ?');
  $taskCount->execute([$row['full_name'], $row['user_id']]);
  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'email' => $row['email'],
    'userId' => $row['user_id'] ? (int) $row['user_id'] : null,
    'programs' => decode_programs($row['programs_json']),
    'status' => $row['status'],
    'hours' => (int) $row['hours'],
    'requiredHours' => (int) ($row['required_hours'] ?? 0),
    'remainingHours' => max(0, (int) ($row['required_hours'] ?? 0) - (int) $row['hours']),
    'assignedTasks' => (int) $taskCount->fetchColumn(),
  ];
}

$user = require_auth(['Admin', 'Staff', 'Volunteer']);

if ($method === 'GET') {
  if ($user['role'] === 'Volunteer') {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['ok' => true, 'data' => $row ? [map_volunteer($pdo, $row)] : []]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Volunteer not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_volunteer($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM volunteers ORDER BY full_name ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_volunteer($pdo, $r), $rows)]);
}

if ($user['role'] === 'Volunteer') {
  json_response(['ok' => false, 'error' => 'Access denied'], 403);
}

$body = read_json_body();

if ($method === 'POST') {
  $name = trim((string) ($body['name'] ?? ''));
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Name is required'], 400);
  }
  $programs = $body['programs'] ?? [];
  $code = generate_code('VOL');
  $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, email, programs_json, status, hours, required_hours) VALUES (?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $name,
    $body['email'] ?? null,
    json_encode($programs),
    $body['status'] ?? 'Pending Review',
    (int) ($body['hours'] ?? 0),
    (int) ($body['requiredHours'] ?? $body['required_hours'] ?? 0),
  ]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_volunteer($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Volunteer id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Volunteer not found'], 404);
  }
  $programs = isset($body['programs']) ? json_encode($body['programs']) : $existing['programs_json'];
  $update = $pdo->prepare('UPDATE volunteers SET full_name = ?, email = ?, programs_json = ?, status = ?, hours = ?, required_hours = ? WHERE id = ?');
  $update->execute([
    $body['name'] ?? $existing['full_name'],
    $body['email'] ?? $existing['email'],
    $programs,
    $body['status'] ?? $existing['status'],
    (int) ($body['hours'] ?? $existing['hours']),
    (int) ($body['requiredHours'] ?? $body['required_hours'] ?? ($existing['required_hours'] ?? 0)),
    $id,
  ]);
  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_volunteer($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Volunteer id is required'], 400);
  }
  $pdo->prepare('DELETE FROM volunteers WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
