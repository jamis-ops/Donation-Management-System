<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

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

function ensure_tasks_distribution_column(PDO $pdo): void
{
  static $ready = false;
  if ($ready) {
    return;
  }
  try {
    $cols = $pdo->query('SHOW COLUMNS FROM tasks LIKE \'distribution_id\'')->fetchAll();
    if (!$cols) {
      $pdo->exec('ALTER TABLE tasks ADD COLUMN distribution_id BIGINT UNSIGNED NULL AFTER assignee_user_id');
    }
  } catch (Throwable $e) {
    // ignore — column may already exist
  }
  $ready = true;
}

/** Admin workflow statuses volunteers may set on a linked distribution. */
const VOLUNTEER_DISTRIBUTION_STATUSES = ['In Transit', 'Delivered'];

function can_volunteer_set_distribution_status(?string $current, string $next): bool
{
  if (!in_array($next, VOLUNTEER_DISTRIBUTION_STATUSES, true)) {
    return false;
  }
  $current = (string) $current;
  $terminal = ['Delivered', 'Awaiting Proof', 'Completed'];
  if (in_array($current, $terminal, true) && $next === 'In Transit') {
    return false;
  }
  if ($current === 'Completed' || $current === 'Awaiting Proof') {
    return false;
  }
  if ($next === 'In Transit') {
    return !in_array($current, ['In Transit', 'Delivered', 'Awaiting Proof', 'Completed'], true);
  }
  // Delivered: from In Transit (preferred) or earlier active statuses
  return in_array($current, [
    'Planning', 'Preparing', 'Scheduled', 'Pending', 'In Progress', 'In Transit',
  ], true);
}

function is_intern_assignee(PDO $pdo, ?int $userId, ?string $assigneeName, ?int $volunteerId = null): bool
{
  if ($volunteerId) {
    $st = $pdo->prepare("SELECT applicant_type FROM volunteers WHERE id = ? LIMIT 1");
    $st->execute([$volunteerId]);
    $type = $st->fetchColumn();
    if ($type && strcasecmp((string) $type, 'Intern') === 0) return true;
  }
  if ($userId) {
    $st = $pdo->prepare("SELECT applicant_type FROM volunteers WHERE user_id = ? LIMIT 1");
    $st->execute([$userId]);
    $type = $st->fetchColumn();
    if ($type && strcasecmp((string) $type, 'Intern') === 0) return true;
  }
  if ($assigneeName) {
    $st = $pdo->prepare("SELECT applicant_type FROM volunteers WHERE full_name = ? LIMIT 1");
    $st->execute([$assigneeName]);
    $type = $st->fetchColumn();
    if ($type && strcasecmp((string) $type, 'Intern') === 0) return true;
  }
  return false;
}

function map_task(PDO $pdo, ?array $row): ?array
{
  if (!$row) {
    return null;
  }
  $column = $row['board_column'] ?? 'todo';
  $statusLabels = [
    'todo' => 'To Do',
    'inProgress' => 'In Progress',
    'review' => 'In Review',
    'done' => 'Done',
  ];
  $completedAt = !empty($row['completed_at']) ? $row['completed_at'] : null;
  $completedTs = $completedAt ? strtotime((string) $completedAt) : false;
  $dutyStart = $row['duty_start'] ?? null;
  $dutyEnd = $row['duty_end'] ?? null;
  $rawDutyHours = isset($row['duty_hours']) && $row['duty_hours'] !== null ? (float) $row['duty_hours'] : null;

  $assigneeUserId = !empty($row['assignee_user_id']) ? (int) $row['assignee_user_id'] : null;
  $assigneeName = $row['assignee'] ?? null;
  $isIntern = is_intern_assignee($pdo, $assigneeUserId, $assigneeName);

  $dutyHours = $isIntern ? $rawDutyHours : null;
  $dutyStartClean = $isIntern ? ($dutyStart ?: '') : '';
  $dutyEndClean = $isIntern ? ($dutyEnd ?: '') : '';
  $dutyLabelClean = $isIntern ? duty_label($dutyStart, $dutyEnd, $dutyHours) : '';

  $distId = !empty($row['distribution_id']) ? (int) $row['distribution_id'] : null;
  $distCode = '';
  $distStatus = '';
  $distLabel = '';
  $distLocation = '';
  if ($distId) {
    $dStmt = $pdo->prepare('SELECT code, event_name, location, status FROM distributions WHERE id = ? LIMIT 1');
    $dStmt->execute([$distId]);
    $distRow = $dStmt->fetch();
    if ($distRow) {
      $distCode = (string) ($distRow['code'] ?? "DST-{$distId}");
      $distStatus = (string) ($distRow['status'] ?? '');
      $distLabel = (string) ($distRow['event_name'] ?: ($distRow['location'] ?: 'Distribution'));
      $distLocation = (string) ($distRow['location'] ?? '');
    }
  }
  $moduleStr = strtolower((string) ($row['module'] ?? ''));
  $titleStr = strtolower((string) ($row['title'] ?? ''));
  $isDistType = str_contains($moduleStr, 'distribution') ||
                str_contains($moduleStr, 'logistics') ||
                str_contains($moduleStr, 'delivery') ||
                str_contains($moduleStr, 'relief') ||
                str_contains($titleStr, 'distribution') ||
                str_contains($titleStr, 'delivery') ||
                str_contains($titleStr, 'logistics');
  $isDistTask = (bool) ($distId && $isDistType);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'title' => $row['title'],
    'assignee' => $row['assignee'],
    'assigneeUserId' => $assigneeUserId,
    'program' => $row['module'] ?: 'General Operations',
    'location' => $distLocation ?: ($row['location'] ?? 'Cebu Operations Depot'),
    'instructions' => !empty($row['instructions']) ? $row['instructions'] : (!empty($row['description']) ? $row['description'] : 'Execute assigned operational task according to standard Foundation protocols, safety rules, and verification procedures.'),
    'description' => $row['description'] ?? $row['title'],
    'schedule' => !empty($dutyStartClean) ? format_date($row['due_date']) . " ({$dutyStartClean} - {$dutyEndClean})" : format_date($row['due_date']),
    'distributionId' => $distId ?: null,
    'distributionCode' => $distCode,
    'distributionStatus' => $distStatus,
    'distributionLabel' => $distLabel,
    'distributionLocation' => $distLocation,
    'isDistributionTask' => (bool) $distId,
    'canMarkInTransit' => $isDistTask ? can_volunteer_set_distribution_status($distStatus, 'In Transit') : false,
    'canMarkDelivered' => $isDistTask ? can_volunteer_set_distribution_status($distStatus, 'Delivered') : false,
    'priority' => $row['priority'],
    'due' => format_date($row['due_date']),
    'dueDate' => $row['due_date'],
    'dutyStart' => $dutyStartClean,
    'dutyEnd' => $dutyEndClean,
    'dutyHours' => $dutyHours,
    'dutyLabel' => $dutyLabelClean,
    'module' => $row['module'] ?: 'General Operations',
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
ensure_tasks_distribution_column($pdo);

if ($method === 'GET') {
  if ($user['role'] === 'Volunteer') {
    $vol = $pdo->prepare('SELECT full_name FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$user['id']]);
    $name = $vol->fetchColumn() ?: $user['name'];
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY created_at DESC, id DESC');
    $stmt->execute([$name, $user['id']]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_task($pdo, $r), $rows), 'list' => array_map(fn($r) => map_task($pdo, $r), $rows)]);
  }

  // Staff: default to "my tasks" unless mine=0 (admin-style full list not needed in portal).
  if ($user['role'] === 'Staff' && (!isset($_GET['mine']) || $_GET['mine'] !== '0')) {
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee_user_id = ? OR assignee = ? ORDER BY created_at DESC, id DESC');
    $stmt->execute([(int) $user['id'], (string) $user['name']]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_task($pdo, $r), $rows), 'list' => array_map(fn($r) => map_task($pdo, $r), $rows)]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Task not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_task($pdo, $row)]);
  }

  // Optional filter by volunteer for Volunteers page.
  if (!empty($_GET['volunteerId'])) {
    $vol = $pdo->prepare('SELECT full_name, user_id FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([(int) $_GET['volunteerId']]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY created_at DESC, id DESC');
      $stmt->execute([$volRow['full_name'], $volRow['user_id'] ?: 0]);
      $rows = $stmt->fetchAll();
      json_response(['ok' => true, 'data' => array_map(fn($r) => map_task($pdo, $r), $rows), 'list' => array_map(fn($r) => map_task($pdo, $r), $rows)]);
    }
  }

  // Optional filter by staff/user assignee for Staff Management page.
  if (!empty($_GET['assigneeUserId'])) {
    $uid = (int) $_GET['assigneeUserId'];
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE assignee_user_id = ? ORDER BY created_at DESC, id DESC');
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_task($pdo, $r), $rows), 'list' => array_map(fn($r) => map_task($pdo, $r), $rows)]);
  }

  $rows = $pdo->query('SELECT * FROM tasks ORDER BY created_at DESC, id DESC')->fetchAll();
  $grouped = ['todo' => [], 'inProgress' => [], 'review' => [], 'done' => []];
  foreach ($rows as $row) {
    $col = $row['board_column'];
    if (!isset($grouped[$col])) {
      $col = 'todo';
    }
    $grouped[$col][] = map_task($pdo, $row);
  }
  json_response(['ok' => true, 'data' => $grouped, 'list' => array_map(fn($r) => map_task($pdo, $r), $rows)]);
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

  // Validate due date: cannot be in the past
  $dueDate = !empty($body['dueDate']) ? trim((string) $body['dueDate']) : null;
  if ($dueDate !== null && $dueDate !== '') {
    $today = date('Y-m-d');
    if ($dueDate < $today) {
      json_response(['ok' => false, 'error' => 'Due date cannot be in the past. Please select today or a future date.'], 400);
    }
  }

  $code = generate_code('TSK');
  $column = $body['boardColumn'] ?? 'todo';
  if (!in_array($column, ['todo', 'inProgress', 'review', 'done'], true)) {
    $column = 'todo';
  }

  $volunteerIds = [];
  if (!empty($body['volunteerIds']) && is_array($body['volunteerIds'])) {
    $volunteerIds = array_values(array_unique(array_filter(array_map('intval', $body['volunteerIds']))));
  } elseif (!empty($body['volunteerId'])) {
    $volunteerIds = [(int) $body['volunteerId']];
  }

  // Check that assignees are Approved volunteers
  if (!empty($volunteerIds)) {
    $inClause = implode(',', array_fill(0, count($volunteerIds), '?'));
    $vCheck = $pdo->prepare("SELECT full_name, status FROM volunteers WHERE id IN ($inClause)");
    $vCheck->execute($volunteerIds);
    $vRows = $vCheck->fetchAll();
    foreach ($vRows as $vRow) {
      $st = $vRow['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$vRow['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
    }
  }

  $assigneeUserId = !empty($body['assigneeUserId']) ? (int) $body['assigneeUserId'] : null;
  $assignee = trim((string) ($body['assignee'] ?? ''));

  if ($assigneeUserId && empty($volunteerIds)) {
    $vol = $pdo->prepare('SELECT full_name, status FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$assigneeUserId]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $st = $volRow['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$volRow['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
      $assignee = $volRow['full_name'];
    } elseif ($assignee === '') {
      $uName = $pdo->prepare('SELECT full_name FROM users WHERE id = ? LIMIT 1');
      $uName->execute([$assigneeUserId]);
      $assignee = (string) ($uName->fetchColumn() ?: '');
    }
  } elseif ($assignee !== '' && empty($volunteerIds) && !$assigneeUserId) {
    $volByName = $pdo->prepare('SELECT full_name, status FROM volunteers WHERE full_name = ? LIMIT 1');
    $volByName->execute([$assignee]);
    $vbn = $volByName->fetch();
    if ($vbn) {
      $st = $vbn['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$vbn['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
    }
  } elseif (count($volunteerIds) === 1) {
    $vol = $pdo->prepare('SELECT full_name, user_id FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([$volunteerIds[0]]);
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
  $distributionId = !empty($body['distributionId']) ? (int) $body['distributionId'] : null;
  if ($distributionId) {
    $dCheck = $pdo->prepare('SELECT id, code, status FROM distributions WHERE id = ? LIMIT 1');
    $dCheck->execute([$distributionId]);
    $distRow = $dCheck->fetch();
    if (!$distRow) {
      json_response(['ok' => false, 'error' => 'Linked distribution not found'], 400);
    }
    if ($module === null || $module === '') {
      $module = 'Distribution';
    }
  }

  $singleVolId = !empty($body['volunteerId']) ? (int) $body['volunteerId'] : (count($volunteerIds) === 1 ? $volunteerIds[0] : null);

  // If assigning to a single volunteer and module is empty or generic, resolve to their enrolled program
  if (($module === null || $module === '' || $module === 'Volunteer' || $module === 'Internship') && $singleVolId) {
    $vCheck = $pdo->prepare('SELECT programs_json FROM volunteers WHERE id = ? LIMIT 1');
    $vCheck->execute([$singleVolId]);
    $vRow = $vCheck->fetch();
    if ($vRow && !empty($vRow['programs_json'])) {
      $progs = json_decode((string) $vRow['programs_json'], true);
      if (is_array($progs) && !empty($progs[0])) {
        $module = trim((string) $progs[0]);
      }
    }
  }

  if (count($volunteerIds) > 1) {
    $created = [];
    foreach ($volunteerIds as $vId) {
      $tCode = generate_code('TSK');
      $vol = $pdo->prepare('SELECT full_name, user_id, applicant_type, programs_json FROM volunteers WHERE id = ? LIMIT 1');
      $vol->execute([$vId]);
      $volRow = $vol->fetch();
      $vAssignee = $volRow ? $volRow['full_name'] : null;
      $vAssigneeUserId = ($volRow && $volRow['user_id']) ? (int) $volRow['user_id'] : null;
      $isVIntern = ($volRow && strcasecmp((string)($volRow['applicant_type'] ?? ''), 'Intern') === 0);

      $tModule = $module;
      if (($tModule === null || $tModule === '' || $tModule === 'Volunteer' || $tModule === 'Internship') && !empty($volRow['programs_json'])) {
        $vProgs = json_decode((string) $volRow['programs_json'], true);
        if (is_array($vProgs) && !empty($vProgs[0])) {
          $tModule = trim((string) $vProgs[0]);
        }
      }

      $tDutyStart = $isVIntern ? $dutyStart : null;
      $tDutyEnd = $isVIntern ? $dutyEnd : null;
      $tDutyHours = $isVIntern ? $dutyHours : null;

      $stmt = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, distribution_id, priority, due_date, duty_start, duty_end, duty_hours, module, required_skills_json, board_column) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $stmt->execute([
        $tCode,
        $title,
        $vAssignee,
        $vAssigneeUserId,
        $distributionId,
        $body['priority'] ?? 'Low',
        $body['dueDate'] ?? null,
        $tDutyStart,
        $tDutyEnd,
        $tDutyHours,
        $tModule,
        encode_required_skills($body['requiredSkills'] ?? $body['skills'] ?? null),
        $column,
      ]);
      $newId = (int) $pdo->lastInsertId();
      $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
      $stmt->execute([$newId]);
      $task = map_task($pdo, $stmt->fetch());
      $created[] = $task;

      if ($vAssigneeUserId) {
        $duty = $isVIntern ? duty_label($tDutyStart, $tDutyEnd, $tDutyHours) : '';
        create_notification(
          $pdo,
          'task_assigned',
          'New task assigned',
          "You have been assigned: {$title}" . ($duty ? " (Duty: {$duty})" : ''),
          '/volunteer-portal/tasks',
          $vAssigneeUserId
        );
      }
    }
    json_response(['ok' => true, 'data' => $created[0], 'created' => $created, 'count' => count($created)], 201);
  }

  $singleVolId = !empty($body['volunteerId']) ? (int) $body['volunteerId'] : (count($volunteerIds) === 1 ? $volunteerIds[0] : null);
  $isSingleIntern = is_intern_assignee($pdo, $assigneeUserId, $assignee, $singleVolId);
  $finalDutyStart = $isSingleIntern ? $dutyStart : null;
  $finalDutyEnd = $isSingleIntern ? $dutyEnd : null;
  $finalDutyHours = $isSingleIntern ? $dutyHours : null;

  $stmt = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, distribution_id, priority, due_date, duty_start, duty_end, duty_hours, module, required_skills_json, board_column) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $title,
    $assignee ?: null,
    $assigneeUserId,
    $distributionId,
    $body['priority'] ?? 'Low',
    $body['dueDate'] ?? null,
    $finalDutyStart,
    $finalDutyEnd,
    $finalDutyHours,
    $module,
    encode_required_skills($body['requiredSkills'] ?? $body['skills'] ?? null),
    $column,
  ]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
  $stmt->execute([$newId]);
  $task = map_task($pdo, $stmt->fetch());

  if ($assigneeUserId) {
    $duty = $isSingleIntern ? duty_label($finalDutyStart, $finalDutyEnd, $finalDutyHours) : '';
    $roleStmt = $pdo->prepare('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?');
    $roleStmt->execute([$assigneeUserId]);
    $assigneeRole = (string) ($roleStmt->fetchColumn() ?: '');
    $link = $assigneeRole === 'Staff' || $assigneeRole === 'Admin' ? '/staff/tasks' : '/volunteer-portal/tasks';
    $distNote = $distributionId && !empty($task['distributionCode'])
      ? " · Distribution {$task['distributionCode']}"
      : '';
    create_notification(
      $pdo,
      'task_assigned',
      'New task assigned',
      "You have been assigned: {$title}" . ($duty ? " (Duty: {$duty})" : '') . $distNote,
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
  $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Task not found'], 404);
  }

  $isAssignee = ((int) ($existing['assignee_user_id'] ?? 0) === (int) $user['id'])
    || (strcasecmp((string) ($existing['assignee'] ?? ''), (string) $user['name']) === 0);

  // Volunteers and staff may only update tasks assigned to them (e.g. mark Done).
  if (in_array($user['role'], ['Volunteer', 'Staff'], true) && !$isAssignee) {
    // Also allow match by volunteer profile name when assignee_user_id is unset.
    if ($user['role'] === 'Volunteer') {
      $vol = $pdo->prepare('SELECT full_name FROM volunteers WHERE user_id = ? LIMIT 1');
      $vol->execute([$user['id']]);
      $volName = (string) ($vol->fetchColumn() ?: '');
      if ($volName !== '' && strcasecmp((string) ($existing['assignee'] ?? ''), $volName) === 0) {
        $isAssignee = true;
      }
    }
    if (!$isAssignee) {
      json_response(['ok' => false, 'error' => 'You can only update tasks assigned to you'], 403);
    }
  }

  $column = $body['boardColumn'] ?? $body['status'] ?? $existing['board_column'];
  if (isset(WORKFLOW_TASK_ALIASES[$column])) {
    $column = WORKFLOW_TASK_ALIASES[$column];
  }
  if (!in_array($column, ['todo', 'inProgress', 'review', 'done'], true)) {
    $column = $existing['board_column'];
  }

  assert_valid_status_transition(
    'Task',
    (string) ($existing['board_column'] ?? 'todo'),
    $column,
    WORKFLOW_TASK_STEPS,
    WORKFLOW_TASK_TERMINAL,
    [],
    WORKFLOW_TASK_ALIASES
  );

  // If task is already completed / done, lock from edits
  if (($existing['board_column'] ?? '') === 'done') {
    if ($column !== 'done') {
      json_response([
        'ok' => false,
        'error' => 'Task is already Completed/Done (final status) and cannot be changed or reverted.',
      ], 400);
    }
    $titleDiff = array_key_exists('title', $body) && trim((string) $body['title']) !== (string) $existing['title'];
    $dueDiff = array_key_exists('dueDate', $body) && $body['dueDate'] !== $existing['due_date'];
    $assigneeDiff = array_key_exists('assigneeUserId', $body) && (int) $body['assigneeUserId'] !== (int) $existing['assignee_user_id'];
    if ($titleDiff || $dueDiff || $assigneeDiff) {
      json_response([
        'ok' => false,
        'error' => 'This task is already Completed and locked from modifications.',
      ], 400);
    }
  }

  // Validate due date change
  if (array_key_exists('dueDate', $body) && $body['dueDate'] !== $existing['due_date']) {
    $newDue = trim((string) $body['dueDate']);
    if ($newDue !== '' && $newDue < date('Y-m-d')) {
      json_response([
        'ok' => false,
        'error' => 'Due date cannot be in the past. Please select today or a future date.',
      ], 400);
    }
  }

  // Volunteer / Staff limited to status changes on their own tasks.
  if (in_array($user['role'], ['Volunteer', 'Staff'], true)) {
    $distributionStatus = trim((string) ($body['distributionStatus'] ?? ''));
    $linkedDistId = !empty($existing['distribution_id']) ? (int) $existing['distribution_id'] : null;

    // Volunteers cannot directly mark tasks completed; only administrators can verify and complete tasks.
    if ($user['role'] === 'Volunteer' && $distributionStatus === '' && ($column === 'done' || $column === 'review')) {
      json_response(['ok' => false, 'error' => 'Only administrators can mark tasks as completed for volunteers.'], 403);
    }

    // Volunteers (and staff assignees) can advance a linked distribution: In Transit / Delivered.
    if ($distributionStatus !== '' && $linkedDistId) {
      if (!in_array($distributionStatus, VOLUNTEER_DISTRIBUTION_STATUSES, true)) {
        json_response([
          'ok' => false,
          'error' => 'Volunteers may only set distribution status to In Transit or Delivered.',
        ], 400);
      }
      $dStmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
      $dStmt->execute([$linkedDistId]);
      $dist = $dStmt->fetch();
      if (!$dist) {
        json_response(['ok' => false, 'error' => 'Linked distribution not found'], 404);
      }
      if (!can_volunteer_set_distribution_status((string) ($dist['status'] ?? ''), $distributionStatus)) {
        json_response([
          'ok' => false,
          'error' => "Cannot set status to {$distributionStatus} from current status \"{$dist['status']}\".",
        ], 400);
      }

      $pdo->prepare('UPDATE distributions SET status = ? WHERE id = ?')
        ->execute([$distributionStatus, $linkedDistId]);

      // Keep task board aligned with delivery progress.
      if ($distributionStatus === 'In Transit') {
        $column = 'inProgress';
      } elseif ($distributionStatus === 'Delivered') {
        $column = 'done';
      }

      $code = (string) ($dist['code'] ?? '');
      $actor = (string) ($user['name'] ?? 'Volunteer');
      notify_admins(
        $pdo,
        'distribution',
        "Distribution {$distributionStatus}",
        "{$actor} updated {$code} to {$distributionStatus} via task {$existing['code']}.",
        '/admin/distributions'
      );
      notify_distribution_lifecycle(
        $pdo,
        $dist,
        $distributionStatus,
        (string) ($dist['status'] ?? '')
      );
      if (function_exists('audit_log')) {
        audit_log($pdo, 'status-update', 'distribution', $code, "{$actor} set status to {$distributionStatus} from task {$existing['code']}");
      }
    }

    $update = $pdo->prepare('UPDATE tasks SET board_column = ?, completed_at = CASE WHEN ? = \'done\' THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = ?');
    $update->execute([$column, $column, $id]);

    // When completing, credit duty hours to intern record if assignee is an intern.
    if ($column === 'done' && ($existing['board_column'] ?? '') !== 'done') {
      $hours = isset($existing['duty_hours']) ? (float) $existing['duty_hours'] : 0;
      if ($hours > 0 && !empty($existing['assignee_user_id'])) {
        $pdo->prepare('UPDATE volunteers SET hours = hours + ? WHERE user_id = ? AND applicant_type = "Intern"')
          ->execute([$hours, (int) $existing['assignee_user_id']]);
      }
    }

    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['ok' => true, 'data' => map_task($pdo, $stmt->fetch())]);
  }

  $assigneeUserId = array_key_exists('assigneeUserId', $body)
    ? ($body['assigneeUserId'] ? (int) $body['assigneeUserId'] : null)
    : ($existing['assignee_user_id'] ? (int) $existing['assignee_user_id'] : null);
  $assignee = trim((string) ($body['assignee'] ?? $existing['assignee'] ?? ''));

  $singleVolId = null;
  if (!empty($body['volunteerId'])) {
    $singleVolId = (int) $body['volunteerId'];
    $vol = $pdo->prepare('SELECT full_name, user_id, status FROM volunteers WHERE id = ? LIMIT 1');
    $vol->execute([$singleVolId]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $st = $volRow['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$volRow['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
      $assignee = $volRow['full_name'];
      $assigneeUserId = $volRow['user_id'] ? (int) $volRow['user_id'] : null;
    }
  } elseif ($assigneeUserId && !array_key_exists('assignee', $body)) {
    $vol = $pdo->prepare('SELECT full_name, status FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$assigneeUserId]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $st = $volRow['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$volRow['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
      $assignee = $volRow['full_name'];
    }
  } elseif (!empty($body['assignee'])) {
    $vol = $pdo->prepare('SELECT full_name, status FROM volunteers WHERE full_name = ? LIMIT 1');
    $vol->execute([trim((string) $body['assignee'])]);
    $volRow = $vol->fetch();
    if ($volRow) {
      $st = $volRow['status'] ?? '';
      if (!in_array($st, ['Approved', 'Active', 'Assigned'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot assign task to \"{$volRow['full_name']}\" because their status is {$st}. Only Approved volunteers can be assigned tasks.",
        ], 400);
      }
    }
  }

  $isAssigneeIntern = is_intern_assignee($pdo, $assigneeUserId, $assignee, $singleVolId);

  // Preserve existing duty hours only for Interns. For volunteers, duty hours are always null.
  $dutyTouched = array_key_exists('dutyStart', $body) || array_key_exists('dutyEnd', $body) || array_key_exists('dutyHours', $body);
  if ($isAssigneeIntern) {
    if ($dutyTouched) {
      [$dutyStart, $dutyEnd, $dutyHours] = read_duty_fields($body);
    } else {
      $dutyStart = $existing['duty_start'] ?? null;
      $dutyEnd = $existing['duty_end'] ?? null;
      $dutyHours = isset($existing['duty_hours']) && $existing['duty_hours'] !== null ? (float) $existing['duty_hours'] : null;
    }
  } else {
    $dutyStart = null;
    $dutyEnd = null;
    $dutyHours = null;
  }

  $completedAtSql = $column === 'done'
    ? 'COALESCE(completed_at, NOW())'
    : 'NULL';

  $distributionId = array_key_exists('distributionId', $body)
    ? (!empty($body['distributionId']) ? (int) $body['distributionId'] : null)
    : (!empty($existing['distribution_id']) ? (int) $existing['distribution_id'] : null);
  if ($distributionId) {
    $dCheck = $pdo->prepare('SELECT id FROM distributions WHERE id = ? LIMIT 1');
    $dCheck->execute([$distributionId]);
    if (!$dCheck->fetch()) {
      json_response(['ok' => false, 'error' => 'Linked distribution not found'], 400);
    }
  }

  $update = $pdo->prepare("UPDATE tasks SET title = ?, assignee = ?, assignee_user_id = ?, distribution_id = ?, priority = ?, due_date = ?, duty_start = ?, duty_end = ?, duty_hours = ?, module = ?, required_skills_json = ?, board_column = ?, completed_at = {$completedAtSql} WHERE id = ?");
  $update->execute([
    $body['title'] ?? $existing['title'],
    $assignee ?: null,
    $assigneeUserId,
    $distributionId,
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

  if ($column === 'done' && ($existing['board_column'] ?? '') !== 'done' && $dutyHours && $assigneeUserId && $isAssigneeIntern) {
    $pdo->prepare('UPDATE volunteers SET hours = hours + ? WHERE user_id = ? AND applicant_type = "Intern"')
      ->execute([(float) $dutyHours, (int) $assigneeUserId]);
  }

  if ($assigneeUserId && (int) $assigneeUserId !== (int) ($existing['assignee_user_id'] ?? 0)) {
    $duty = $isAssigneeIntern ? duty_label($dutyStart, $dutyEnd, $dutyHours) : '';
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
  json_response(['ok' => true, 'data' => map_task($pdo, $stmt->fetch())]);
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
