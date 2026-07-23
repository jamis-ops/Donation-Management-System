<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function format_duty_time(?string $time): string
{
  if (!$time) {
    return '';
  }
  $ts = strtotime($time);
  return $ts ? date('g:i A', $ts) : $time;
}

function duty_label(?string $start, ?string $end, $hours): string
{
  $parts = [];
  if ($start && $end) {
    $parts[] = format_duty_time($start) . ' – ' . format_duty_time($end);
  } elseif ($start) {
    $parts[] = 'From ' . format_duty_time($start);
  }
  if ($hours !== null && (float) $hours > 0) {
    $h = rtrim(rtrim(number_format((float) $hours, 2), '0'), '.');
    $parts[] = "{$h} hr" . ((float) $hours == 1.0 ? '' : 's');
  }
  return implode(' · ', $parts);
}

/**
 * Derive total duty hours from a start/end time pair (handles overnight shifts).
 */
function hours_between(?string $start, ?string $end): ?float
{
  if (!$start || !$end) {
    return null;
  }
  $s = strtotime("1970-01-01 {$start}");
  $e = strtotime("1970-01-01 {$end}");
  if ($s === false || $e === false) {
    return null;
  }
  $diff = ($e - $s) / 3600;
  if ($diff <= 0) {
    $diff += 24;
  }
  return round($diff, 2);
}

function encode_required_skills($skills): ?string
{
  if ($skills === null || $skills === '') {
    return null;
  }
  if (is_string($skills)) {
    $parts = array_values(array_filter(array_map('trim', explode(',', $skills))));
    return $parts ? json_encode($parts) : null;
  }
  if (is_array($skills)) {
    $parts = array_values(array_filter(array_map(static fn($s) => trim((string) $s), $skills)));
    return $parts ? json_encode($parts) : null;
  }
  return null;
}

function decode_required_skills(?string $json): array
{
  if (!$json) {
    return [];
  }
  $decoded = json_decode($json, true);
  if (!is_array($decoded)) {
    return [];
  }
  return array_values(array_filter(array_map(static fn($s) => trim((string) $s), $decoded)));
}

function map_task(array $row): array
{
  $dutyStart = $row['duty_start'] ?? null;
  $dutyEnd = $row['duty_end'] ?? null;
  $dutyHours = isset($row['duty_hours']) && $row['duty_hours'] !== null ? (float) $row['duty_hours'] : null;
  $completedAt = $row['completed_at'] ?? null;
  $completedTs = $completedAt ? strtotime((string) $completedAt) : false;
  $column = $row['board_column'] ?? 'todo';
  $statusLabels = [
    'todo' => 'To Do',
    'inProgress' => 'In Progress',
    'review' => 'In Review',
    'done' => 'Done',
  ];
  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'title' => $row['title'],
    'assignee' => $row['assignee'],
    'assigneeUserId' => !empty($row['assignee_user_id']) ? (int) $row['assignee_user_id'] : null,
    'priority' => $row['priority'],
    'due' => format_date($row['due_date']),
    'dueDate' => $row['due_date'],
    'dutyStart' => $dutyStart ?: '',
    'dutyEnd' => $dutyEnd ?: '',
    'dutyHours' => $dutyHours,
    'dutyLabel' => duty_label($dutyStart, $dutyEnd, $dutyHours),
    'module' => $row['module'],
    'requiredSkills' => decode_required_skills($row['required_skills_json'] ?? null),
    'boardColumn' => $column,
    'status' => $statusLabels[$column] ?? $column,
    'completedAt' => $completedAt,
    'completedAtLabel' => $completedTs ? date('M j, Y · g:i A', $completedTs) : '',
    'isDone' => $column === 'done',
  ];
}

/**
 * Normalize the duty-hours fields from a request body.
 * Returns [start, end, hours] — hours is auto-computed from start/end when omitted.
 */
function read_duty_fields(array $body): array
{
  $start = trim((string) ($body['dutyStart'] ?? '')) ?: null;
  $end = trim((string) ($body['dutyEnd'] ?? '')) ?: null;
  $hours = isset($body['dutyHours']) && $body['dutyHours'] !== '' && $body['dutyHours'] !== null
    ? (float) $body['dutyHours']
    : null;
  if ($hours === null) {
    $hours = hours_between($start, $end);
  }
  return [$start, $end, $hours];
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

  // Staff: default to "my tasks" unless mine=0 (admin-style full list not needed in portal).
  if ($user['role'] === 'Staff' && (!isset($_GET['mine']) || $_GET['mine'] !== '0')) {
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee_user_id = ? OR assignee = ? ORDER BY due_date ASC');
    $stmt->execute([(int) $user['id'], (string) $user['name']]);
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

  // Optional filter by volunteer for Volunteers page.
  if (!empty($_GET['volunteerId'])) {
    $vol = $pdo->prepare('SELECT full_name, user_id FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([(int) $_GET['volunteerId']]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY due_date ASC');
      $stmt->execute([$volRow['full_name'], $volRow['user_id'] ?: 0]);
      $rows = $stmt->fetchAll();
      json_response(['ok' => true, 'data' => array_map('map_task', $rows), 'list' => array_map('map_task', $rows)]);
    }
  }

  // Optional filter by staff/user assignee for Staff Management page.
  if (!empty($_GET['assigneeUserId'])) {
    $uid = (int) $_GET['assigneeUserId'];
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee_user_id = ? ORDER BY due_date ASC');
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map('map_task', $rows), 'list' => array_map('map_task', $rows)]);
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
    } elseif ($assignee === '') {
      $uName = $pdo->prepare('SELECT full_name FROM users WHERE id = ? LIMIT 1');
      $uName->execute([$assigneeUserId]);
      $assignee = (string) ($uName->fetchColumn() ?: '');
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

  [$dutyStart, $dutyEnd, $dutyHours] = read_duty_fields($body);
  $module = trim((string) ($body['module'] ?? '')) ?: null;
  $isVolunteerTask = !empty($body['volunteerId']) || strcasecmp((string) $module, 'Volunteer') === 0;
  // Duty hours are required for volunteer assignments (hours tracking).
  if ($isVolunteerTask && ($assignee || $assigneeUserId) && !$dutyStart && ($dutyHours === null || $dutyHours <= 0)) {
    json_response(['ok' => false, 'error' => 'Duty hours are required: set a start/end time or total hours.'], 400);
  }

  $stmt = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, priority, due_date, duty_start, duty_end, duty_hours, module, required_skills_json, board_column) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $title,
    $assignee ?: null,
    $assigneeUserId,
    $body['priority'] ?? 'Medium',
    $body['dueDate'] ?? null,
    $dutyStart,
    $dutyEnd,
    $dutyHours,
    $module,
    encode_required_skills($body['requiredSkills'] ?? $body['skills'] ?? null),
    $column,
  ]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
  $stmt->execute([$newId]);
  $task = map_task($stmt->fetch());

  if ($assigneeUserId) {
    $duty = duty_label($dutyStart, $dutyEnd, $dutyHours);
    $roleStmt = $pdo->prepare('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?');
    $roleStmt->execute([$assigneeUserId]);
    $assigneeRole = (string) ($roleStmt->fetchColumn() ?: '');
    $link = $assigneeRole === 'Staff' || $assigneeRole === 'Admin' ? '/staff/tasks' : '/volunteer-portal/tasks';
    create_notification(
      $pdo,
      'task_assigned',
      'New task assigned',
      "You have been assigned: {$title}" . ($duty ? " (Duty: {$duty})" : ''),
      $link,
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

  $isAssignee = ((int) ($existing['assignee_user_id'] ?? 0) === (int) $user['id'])
    || (strcasecmp((string) ($existing['assignee'] ?? ''), (string) $user['name']) === 0);

  // Staff may only update tasks assigned to them (e.g. mark Done).
  if ($user['role'] === 'Staff' && !$isAssignee) {
    json_response(['ok' => false, 'error' => 'You can only update tasks assigned to you'], 403);
  }

  $column = $body['boardColumn'] ?? $existing['board_column'];
  if (!in_array($column, ['todo', 'inProgress', 'review', 'done'], true)) {
    $column = $existing['board_column'];
  }

  // Staff limited to status changes on their own tasks.
  if ($user['role'] === 'Staff') {
    $update = $pdo->prepare('UPDATE tasks SET board_column = ?, completed_at = CASE WHEN ? = \'done\' THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = ?');
    $update->execute([$column, $column, $id]);

    // When completing, credit duty hours to volunteer record if assignee is a volunteer.
    if ($column === 'done' && ($existing['board_column'] ?? '') !== 'done') {
      $hours = isset($existing['duty_hours']) ? (float) $existing['duty_hours'] : 0;
      if ($hours > 0 && !empty($existing['assignee_user_id'])) {
        $pdo->prepare('UPDATE volunteers SET hours = hours + ? WHERE user_id = ?')
          ->execute([$hours, (int) $existing['assignee_user_id']]);
      }
    }

    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['ok' => true, 'data' => map_task($stmt->fetch())]);
  }

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

  // Preserve existing duty hours unless the request explicitly touches them.
  $dutyTouched = array_key_exists('dutyStart', $body) || array_key_exists('dutyEnd', $body) || array_key_exists('dutyHours', $body);
  if ($dutyTouched) {
    [$dutyStart, $dutyEnd, $dutyHours] = read_duty_fields($body);
    if (($assignee || $assigneeUserId) && !$dutyStart && ($dutyHours === null || $dutyHours <= 0)) {
      json_response(['ok' => false, 'error' => 'Duty hours are required: set a start/end time or total hours.'], 400);
    }
  } else {
    $dutyStart = $existing['duty_start'] ?? null;
    $dutyEnd = $existing['duty_end'] ?? null;
    $dutyHours = isset($existing['duty_hours']) && $existing['duty_hours'] !== null ? (float) $existing['duty_hours'] : null;
  }

  $completedAtSql = $column === 'done'
    ? 'COALESCE(completed_at, NOW())'
    : 'NULL';

  $update = $pdo->prepare("UPDATE tasks SET title = ?, assignee = ?, assignee_user_id = ?, priority = ?, due_date = ?, duty_start = ?, duty_end = ?, duty_hours = ?, module = ?, required_skills_json = ?, board_column = ?, completed_at = {$completedAtSql} WHERE id = ?");
  $update->execute([
    $body['title'] ?? $existing['title'],
    $assignee ?: null,
    $assigneeUserId,
    $body['priority'] ?? $existing['priority'],
    $body['dueDate'] ?? $existing['due_date'],
    $dutyStart,
    $dutyEnd,
    $dutyHours,
    $body['module'] ?? $existing['module'],
    array_key_exists('requiredSkills', $body) || array_key_exists('skills', $body)
      ? encode_required_skills($body['requiredSkills'] ?? $body['skills'] ?? null)
      : ($existing['required_skills_json'] ?? null),
    $column,
    $id,
  ]);

  if ($column === 'done' && ($existing['board_column'] ?? '') !== 'done' && $dutyHours && $assigneeUserId) {
    $pdo->prepare('UPDATE volunteers SET hours = hours + ? WHERE user_id = ?')
      ->execute([(float) $dutyHours, (int) $assigneeUserId]);
  }

  if ($assigneeUserId && (int) $assigneeUserId !== (int) ($existing['assignee_user_id'] ?? 0)) {
    $duty = duty_label($dutyStart, $dutyEnd, $dutyHours);
    // Route notification based on whether assignee is Staff or Volunteer.
    $roleStmt = $pdo->prepare('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?');
    $roleStmt->execute([$assigneeUserId]);
    $assigneeRole = $roleStmt->fetchColumn() ?: 'Volunteer';
    $link = $assigneeRole === 'Staff' ? '/staff/tasks' : '/volunteer-portal/tasks';
    create_notification(
      $pdo,
      'task_assigned',
      'New task assigned',
      'You have been assigned: ' . ($body['title'] ?? $existing['title']) . ($duty ? " (Duty: {$duty})" : ''),
      $link,
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
