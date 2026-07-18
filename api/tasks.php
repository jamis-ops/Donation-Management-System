<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_task(array $row): array
{
  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'title' => $row['title'],
    'assignee' => $row['assignee'],
    'priority' => $row['priority'],
    'due' => format_date($row['due_date']),
    'dueDate' => $row['due_date'],
    'module' => $row['module'],
    'boardColumn' => $row['board_column'],
  ];
}

$user = require_auth(['Admin', 'Staff', 'Volunteer']);

if ($method === 'GET') {
  if ($user['role'] === 'Volunteer') {
    $vol = $pdo->prepare('SELECT full_name FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$user['id']]);
    $name = $vol->fetchColumn() ?: $user['name'];
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY due_date ASC');
    $stmt->execute([$name, $user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map('map_task', $rows), 'list' => array_map('map_task', $rows)]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Task not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_task($row)]);
  }

  $rows = $pdo->query('SELECT * FROM tasks ORDER BY due_date ASC')->fetchAll();
  $grouped = ['todo' => [], 'inProgress' => [], 'review' => [], 'done' => []];
  foreach ($rows as $row) {
    $col = $row['board_column'];
    if (!isset($grouped[$col])) {
      $col = 'todo';
    }
    $grouped[$col][] = map_task($row);
  }
  json_response(['ok' => true, 'data' => $grouped, 'list' => array_map('map_task', $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  if ($user['role'] === 'Volunteer') {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }
  $title = trim((string) ($body['title'] ?? ''));
  if ($title === '') {
    json_response(['ok' => false, 'error' => 'Title is required'], 400);
  }
  $code = generate_code('TSK');
  $column = $body['boardColumn'] ?? 'todo';
  if (!in_array($column, ['todo', 'inProgress', 'review', 'done'], true)) {
    $column = 'todo';
  }

  $assigneeUserId = !empty($body['assigneeUserId']) ? (int) $body['assigneeUserId'] : null;
  $assignee = trim((string) ($body['assignee'] ?? ''));

  if ($assigneeUserId) {
    $vol = $pdo->prepare('SELECT full_name FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$assigneeUserId]);
    $volName = $vol->fetchColumn();
    if ($volName) {
      $assignee = $volName;
    }
  } elseif (!empty($body['volunteerId'])) {
    $vol = $pdo->prepare('SELECT full_name, user_id FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([(int) $body['volunteerId']]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $assignee = $volRow['full_name'];
      if ($volRow['user_id']) {
        $assigneeUserId = (int) $volRow['user_id'];
      }
    }
  }

  $stmt = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, priority, due_date, module, board_column) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $title,
    $assignee ?: null,
    $assigneeUserId,
    $body['priority'] ?? 'Medium',
    $body['dueDate'] ?? null,
    $body['module'] ?? null,
    $column,
  ]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
  $stmt->execute([$newId]);
  $task = map_task($stmt->fetch());

  if ($assigneeUserId) {
    create_notification(
      $pdo,
      'task_assigned',
      'New task assigned',
      "You have been assigned: {$title}",
      '/volunteer-portal/tasks',
      $assigneeUserId
    );
  }

  json_response(['ok' => true, 'data' => $task], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Task id is required'], 400);
  }
  if ($user['role'] === 'Volunteer') {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }
  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Task not found'], 404);
  }
  $column = $body['boardColumn'] ?? $existing['board_column'];

  $assigneeUserId = array_key_exists('assigneeUserId', $body)
    ? ($body['assigneeUserId'] ? (int) $body['assigneeUserId'] : null)
    : ($existing['assignee_user_id'] ? (int) $existing['assignee_user_id'] : null);
  $assignee = trim((string) ($body['assignee'] ?? $existing['assignee'] ?? ''));

  if (!empty($body['volunteerId'])) {
    $vol = $pdo->prepare('SELECT full_name, user_id FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([(int) $body['volunteerId']]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $assignee = $volRow['full_name'];
      $assigneeUserId = $volRow['user_id'] ? (int) $volRow['user_id'] : null;
    }
  } elseif ($assigneeUserId && !array_key_exists('assignee', $body)) {
    $vol = $pdo->prepare('SELECT full_name FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$assigneeUserId]);
    $volName = $vol->fetchColumn();
    if ($volName) {
      $assignee = $volName;
    }
  }

  $update = $pdo->prepare('UPDATE tasks SET title = ?, assignee = ?, assignee_user_id = ?, priority = ?, due_date = ?, module = ?, board_column = ? WHERE id = ?');
  $update->execute([
    $body['title'] ?? $existing['title'],
    $assignee ?: null,
    $assigneeUserId,
    $body['priority'] ?? $existing['priority'],
    $body['dueDate'] ?? $existing['due_date'],
    $body['module'] ?? $existing['module'],
    $column,
    $id,
  ]);

  if ($assigneeUserId && (int) $assigneeUserId !== (int) ($existing['assignee_user_id'] ?? 0)) {
    create_notification(
      $pdo,
      'task_assigned',
      'New task assigned',
      'You have been assigned: ' . ($body['title'] ?? $existing['title']),
      '/volunteer-portal/tasks',
      $assigneeUserId
    );
  }

  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_task($stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Task id is required'], 400);
  }
  if ($user['role'] === 'Volunteer') {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }
  $pdo->prepare('DELETE FROM tasks WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
