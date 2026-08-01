<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

$DEFAULT_NEEDS = [
  'Food',
  'Water',
  'Clothing',
  'Medicine',
  'Hygiene Kits',
  'Shelter',
  'Financial Assistance',
  'Educational Support',
];

function ensure_need_types_table(PDO $pdo, array $defaults): void
{
  static $ready = false;
  if ($ready) {
    return;
  }
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS need_types (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_need_types_label (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $count = (int) $pdo->query('SELECT COUNT(*) FROM need_types')->fetchColumn();
  if ($count === 0) {
    $ins = $pdo->prepare('INSERT INTO need_types (label, sort_order, is_active) VALUES (?, ?, 1)');
    foreach (array_values($defaults) as $i => $label) {
      $ins->execute([(string) $label, $i + 1]);
    }
  }
  $ready = true;
}

function map_need_type(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'dbId' => (int) $row['id'],
    'label' => (string) $row['label'],
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'isActive' => (bool) ($row['is_active'] ?? 1),
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

function normalize_need_label(string $label): string
{
  $label = trim(preg_replace('/\s+/', ' ', $label) ?? '');
  return $label;
}

ensure_need_types_table($pdo, $DEFAULT_NEEDS);

if ($method === 'GET') {
  // Active catalog is readable by authenticated portal users.
  // Full list (incl. inactive) is Admin/Staff only when ?all=1.
  $user = require_auth(['Admin', 'Staff', 'Beneficiary', 'Donor', 'Volunteer', 'SuperAdmin']);
  $wantAll = isset($_GET['all']) && $_GET['all'] === '1';
  $role = (string) ($user['role'] ?? '');
  $isOps = in_array($role, ['Admin', 'Staff', 'SuperAdmin'], true)
    || (function_exists('is_super_admin_user') && is_super_admin_user($user));

  if ($wantAll && !$isOps) {
    json_response(['ok' => false, 'error' => 'You do not have permission to manage need types.'], 403);
  }

  if ($wantAll && $isOps) {
    $rows = $pdo->query('SELECT * FROM need_types ORDER BY sort_order ASC, label ASC')->fetchAll();
  } else {
    $rows = $pdo->query('SELECT * FROM need_types WHERE is_active = 1 ORDER BY sort_order ASC, label ASC')->fetchAll();
  }

  json_response([
    'ok' => true,
    'data' => array_map('map_need_type', $rows ?: []),
  ]);
}

// Mutations: Admin / Staff only
$user = require_auth(['Admin', 'Staff', 'SuperAdmin']);

if ($method === 'POST') {
  $body = read_json_body();
  $label = normalize_need_label((string) ($body['label'] ?? ''));
  if ($label === '') {
    json_response(['ok' => false, 'error' => 'Type of Need label is required.'], 400);
  }
  if (mb_strlen($label) > 120) {
    json_response(['ok' => false, 'error' => 'Label must be 120 characters or fewer.'], 400);
  }

  $dup = $pdo->prepare('SELECT id FROM need_types WHERE LOWER(label) = LOWER(?) LIMIT 1');
  $dup->execute([$label]);
  if ($dup->fetch()) {
    json_response(['ok' => false, 'error' => 'That Type of Need already exists.'], 409);
  }

  $maxSort = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) FROM need_types')->fetchColumn();
  $sort = isset($body['sortOrder']) ? (int) $body['sortOrder'] : ($maxSort + 1);
  $active = array_key_exists('isActive', $body) ? (!empty($body['isActive']) ? 1 : 0) : 1;

  $stmt = $pdo->prepare('INSERT INTO need_types (label, sort_order, is_active) VALUES (?, ?, ?)');
  $stmt->execute([$label, $sort, $active]);
  $newId = (int) $pdo->lastInsertId();
  $row = $pdo->prepare('SELECT * FROM need_types WHERE id = ?');
  $row->execute([$newId]);
  json_response(['ok' => true, 'data' => map_need_type($row->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Need type id is required.'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM need_types WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Type of Need not found.'], 404);
  }

  $body = read_json_body();
  $label = array_key_exists('label', $body)
    ? normalize_need_label((string) $body['label'])
    : (string) $existing['label'];
  if ($label === '') {
    json_response(['ok' => false, 'error' => 'Type of Need label is required.'], 400);
  }

  $dup = $pdo->prepare('SELECT id FROM need_types WHERE LOWER(label) = LOWER(?) AND id <> ? LIMIT 1');
  $dup->execute([$label, $id]);
  if ($dup->fetch()) {
    json_response(['ok' => false, 'error' => 'That Type of Need already exists.'], 409);
  }

  $sort = array_key_exists('sortOrder', $body) ? (int) $body['sortOrder'] : (int) $existing['sort_order'];
  $active = array_key_exists('isActive', $body)
    ? (!empty($body['isActive']) ? 1 : 0)
    : (int) $existing['is_active'];

  $upd = $pdo->prepare('UPDATE need_types SET label = ?, sort_order = ?, is_active = ? WHERE id = ?');
  $upd->execute([$label, $sort, $active, $id]);

  $row = $pdo->prepare('SELECT * FROM need_types WHERE id = ?');
  $row->execute([$id]);
  json_response(['ok' => true, 'data' => map_need_type($row->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Need type id is required.'], 400);
  }
  $stmt = $pdo->prepare('SELECT id, label FROM need_types WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Type of Need not found.'], 404);
  }
  $pdo->prepare('DELETE FROM need_types WHERE id = ?')->execute([$id]);
  json_response(['ok' => true, 'data' => ['id' => (int) $id, 'label' => $existing['label']]]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
