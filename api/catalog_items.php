<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

$CATALOGS = [
  'needs' => [
    'table' => 'need_types',
    'label' => 'Type of Needs',
    'defaults' => [
      'Food', 'Water', 'Clothing', 'Medicine', 'Hygiene Kits',
      'Shelter', 'Financial Assistance', 'Educational Support',
    ],
  ],
  'barangay_types' => [
    'table' => 'barangay_types',
    'label' => 'Type of Barangay',
    'defaults' => [
      'Urban', 'Rural', 'Coastal', 'Upland', 'Island', 'Lowland',
    ],
  ],
  'task_types' => [
    'table' => 'task_types',
    'label' => 'Task Type',
    'defaults' => [
      'Distribution', 'Repacking', 'Verification', 'Fieldwork',
      'Administrative', 'Logistics', 'Outreach', 'Operations',
      'Donations', 'Inventory', 'Distributions', 'Volunteer',
    ],
  ],
];

function resolve_catalog_key(array $catalogs): string
{
  $fromGet = strtolower(trim((string) ($_GET['catalog'] ?? '')));
  if ($fromGet !== '' && isset($catalogs[$fromGet])) {
    return $fromGet;
  }
  // Fallback: catalog in JSON body (helps proxies / nested forms)
  $body = read_json_body();
  $fromBody = strtolower(trim((string) ($body['catalog'] ?? '')));
  if ($fromBody !== '' && isset($catalogs[$fromBody])) {
    return $fromBody;
  }
  return $fromGet;
}

function ensure_catalog_table(PDO $pdo, string $table, array $defaults): void
{
  static $ready = [];
  if (!empty($ready[$table])) {
    return;
  }

  $allowed = ['need_types', 'barangay_types', 'task_types'];
  if (!in_array($table, $allowed, true)) {
    throw new InvalidArgumentException('Invalid catalog table.');
  }

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS `{$table}` (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_{$table}_label` (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $count = (int) $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
  if ($count === 0 && count($defaults) > 0) {
    $ins = $pdo->prepare("INSERT INTO `{$table}` (label, sort_order, is_active) VALUES (?, ?, 1)");
    foreach (array_values($defaults) as $i => $label) {
      $ins->execute([(string) $label, $i + 1]);
    }
  }
  $ready[$table] = true;
}

function map_catalog_item(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'dbId' => (int) $row['id'],
    'label' => (string) $row['label'],
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'isActive' => (bool) ((int) ($row['is_active'] ?? 1)),
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

function normalize_catalog_label(string $label): string
{
  return trim(preg_replace('/\s+/u', ' ', $label) ?? '');
}

function fetch_catalog_item(PDO $pdo, string $table, int $itemId): ?array
{
  $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE id = ? LIMIT 1");
  $stmt->execute([$itemId]);
  $row = $stmt->fetch();
  return $row ?: null;
}

try {
  $catalog = resolve_catalog_key($CATALOGS);
  if ($catalog === '' || !isset($CATALOGS[$catalog])) {
    json_response([
      'ok' => false,
      'error' => 'Unknown catalog. Use needs, barangay_types, or task_types.',
    ], 400);
  }

  $meta = $CATALOGS[$catalog];
  $table = $meta['table'];
  ensure_catalog_table($pdo, $table, $meta['defaults']);

  if ($method === 'GET') {
    $user = require_auth(['Admin', 'Staff', 'Beneficiary', 'Donor', 'Volunteer', 'SuperAdmin']);
    $wantAll = isset($_GET['all']) && $_GET['all'] === '1';
    $role = (string) ($user['role'] ?? '');
    $isOps = in_array($role, ['Admin', 'Staff', 'SuperAdmin'], true)
      || (function_exists('is_super_admin_user') && is_super_admin_user($user));

    if ($wantAll && !$isOps) {
      json_response(['ok' => false, 'error' => 'You do not have permission to manage this catalog.'], 403);
    }

    if ($id) {
      $row = fetch_catalog_item($pdo, $table, $id);
      if (!$row) {
        json_response(['ok' => false, 'error' => $meta['label'] . ' not found.'], 404);
      }
      if (!$isOps && empty($row['is_active'])) {
        json_response(['ok' => false, 'error' => $meta['label'] . ' not found.'], 404);
      }
      json_response(['ok' => true, 'data' => map_catalog_item($row), 'catalog' => $catalog]);
    }

    // Always return catalogs A–Z by label so dropdowns and Settings stay alphabetical.
    if ($wantAll && $isOps) {
      $rows = $pdo->query("SELECT * FROM `{$table}` ORDER BY label ASC")->fetchAll();
    } else {
      $rows = $pdo->query("SELECT * FROM `{$table}` WHERE is_active = 1 ORDER BY label ASC")->fetchAll();
    }

    json_response([
      'ok' => true,
      'catalog' => $catalog,
      'data' => array_map('map_catalog_item', $rows ?: []),
    ]);
  }

  // Mutations: Admin / Staff / SuperAdmin only
  require_auth(['Admin', 'Staff', 'SuperAdmin']);

  if ($method === 'POST') {
    $body = read_json_body();
    $label = normalize_catalog_label((string) ($body['label'] ?? ''));
    if ($label === '') {
      json_response(['ok' => false, 'error' => 'Label is required.'], 400);
    }
    if (mb_strlen($label) > 120) {
      json_response(['ok' => false, 'error' => 'Label must be 120 characters or fewer.'], 400);
    }

    $dup = $pdo->prepare("SELECT id FROM `{$table}` WHERE LOWER(label) = LOWER(?) LIMIT 1");
    $dup->execute([$label]);
    if ($dup->fetch()) {
      json_response(['ok' => false, 'error' => 'That item already exists.'], 409);
    }

    $maxSort = (int) $pdo->query("SELECT COALESCE(MAX(sort_order), 0) FROM `{$table}`")->fetchColumn();
    $sort = isset($body['sortOrder']) ? (int) $body['sortOrder'] : ($maxSort + 1);
    $active = array_key_exists('isActive', $body) ? (!empty($body['isActive']) ? 1 : 0) : 1;

    $stmt = $pdo->prepare("INSERT INTO `{$table}` (label, sort_order, is_active) VALUES (?, ?, ?)");
    $stmt->execute([$label, $sort, $active]);
    $newId = (int) $pdo->lastInsertId();
    if ($newId <= 0) {
      json_response(['ok' => false, 'error' => 'Failed to save item to the database.'], 500);
    }

    $row = fetch_catalog_item($pdo, $table, $newId);
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Item was saved but could not be reloaded.'], 500);
    }

    json_response(['ok' => true, 'data' => map_catalog_item($row), 'catalog' => $catalog], 201);
  }

  if ($method === 'PUT') {
    if (!$id) {
      json_response(['ok' => false, 'error' => 'Item id is required.'], 400);
    }
    $existing = fetch_catalog_item($pdo, $table, $id);
    if (!$existing) {
      json_response(['ok' => false, 'error' => $meta['label'] . ' not found.'], 404);
    }

    $body = read_json_body();
    $label = array_key_exists('label', $body)
      ? normalize_catalog_label((string) $body['label'])
      : (string) $existing['label'];
    if ($label === '') {
      json_response(['ok' => false, 'error' => 'Label is required.'], 400);
    }

    $dup = $pdo->prepare("SELECT id FROM `{$table}` WHERE LOWER(label) = LOWER(?) AND id <> ? LIMIT 1");
    $dup->execute([$label, $id]);
    if ($dup->fetch()) {
      json_response(['ok' => false, 'error' => 'That item already exists.'], 409);
    }

    $sort = array_key_exists('sortOrder', $body) ? (int) $body['sortOrder'] : (int) $existing['sort_order'];
    $active = array_key_exists('isActive', $body)
      ? (!empty($body['isActive']) ? 1 : 0)
      : (int) $existing['is_active'];

    $upd = $pdo->prepare("UPDATE `{$table}` SET label = ?, sort_order = ?, is_active = ? WHERE id = ?");
    $upd->execute([$label, $sort, $active, $id]);

    $row = fetch_catalog_item($pdo, $table, $id);
    json_response(['ok' => true, 'data' => map_catalog_item($row ?: $existing), 'catalog' => $catalog]);
  }

  if ($method === 'DELETE') {
    if (!$id) {
      json_response(['ok' => false, 'error' => 'Item id is required.'], 400);
    }
    $existing = fetch_catalog_item($pdo, $table, $id);
    if (!$existing) {
      json_response(['ok' => false, 'error' => $meta['label'] . ' not found.'], 404);
    }
    $pdo->prepare("DELETE FROM `{$table}` WHERE id = ?")->execute([$id]);
    json_response([
      'ok' => true,
      'data' => ['id' => (int) $id, 'label' => $existing['label']],
      'catalog' => $catalog,
    ]);
  }

  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Catalog operation failed: ' . $e->getMessage(),
  ], 500);
}
