<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/super_admin.php';

// Strict Super Admin Access Only
$user = require_super_admin();
$pdo = db();
$method = request_method();
$action = $_GET['action'] ?? ($_POST['action'] ?? null);

if ($method === 'POST' && empty($action)) {
  $body = read_json_body();
  $action = $body['action'] ?? null;
}

/**
 * Returns all valid table names in the current active database schema.
 * @return array<string, array{name: string, rows: int, sizeBytes: int, engine: string, updateTime: ?string}>
 */
function get_db_tables(PDO $pdo): array
{
  $stmt = $pdo->query("
    SELECT TABLE_NAME, ENGINE, DATA_LENGTH, INDEX_LENGTH, UPDATE_TIME, CREATE_TIME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME ASC
  ");
  $rawTables = $stmt->fetchAll();
  
  $tables = [];
  foreach ($rawTables as $t) {
    $tName = (string) $t['TABLE_NAME'];
    // Count exact live rows
    $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$tName}`");
    $exactRows = (int) $countStmt->fetchColumn();

    $sizeBytes = ((int) ($t['DATA_LENGTH'] ?? 0)) + ((int) ($t['INDEX_LENGTH'] ?? 0));

    $tables[$tName] = [
      'name' => $tName,
      'rows' => $exactRows,
      'sizeBytes' => $sizeBytes,
      'engine' => (string) ($t['ENGINE'] ?? 'InnoDB'),
      'updateTime' => $t['UPDATE_TIME'] ?? $t['CREATE_TIME'] ?? null,
    ];
  }
  return $tables;
}

/**
 * Returns column definitions for a given valid table.
 */
function get_table_columns(PDO $pdo, string $tableName): array
{
  $stmt = $pdo->prepare("
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION ASC
  ");
  $stmt->execute([$tableName]);
  $cols = $stmt->fetchAll();

  $result = [];
  foreach ($cols as $c) {
    $result[] = [
      'name' => (string) $c['COLUMN_NAME'],
      'dataType' => (string) $c['DATA_TYPE'],
      'columnType' => (string) $c['COLUMN_TYPE'],
      'nullable' => ($c['IS_NULLABLE'] === 'YES'),
      'isPrimary' => ($c['COLUMN_KEY'] === 'PRI'),
      'defaultValue' => $c['COLUMN_DEFAULT'],
      'extra' => (string) ($c['EXTRA'] ?? ''),
    ];
  }
  return $result;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
  $tables = get_db_tables($pdo);

  // 1. List all tables metadata
  if ($action === 'tables' || empty($action)) {
    $tableList = [];
    foreach ($tables as $name => $meta) {
      $cols = get_table_columns($pdo, $name);
      $primaryKey = null;
      foreach ($cols as $c) {
        if ($c['isPrimary']) {
          $primaryKey = $c['name'];
          break;
        }
      }
      $tableList[] = [
        'name' => $name,
        'rows' => $meta['rows'],
        'sizeBytes' => $meta['sizeBytes'],
        'engine' => $meta['engine'],
        'updateTime' => $meta['updateTime'],
        'columnCount' => count($cols),
        'primaryKey' => $primaryKey,
        'isSystem' => in_array($name, ['roles', 'schema_migrations', 'admin_section_views'], true),
      ];
    }
    json_response(['ok' => true, 'data' => $tableList]);
  }

  // 2. Query table contents dynamically
  if ($action === 'table_data') {
    $tableName = trim((string) ($_GET['table'] ?? ''));
    if (!isset($tables[$tableName])) {
      json_response(['ok' => false, 'error' => "Table '{$tableName}' does not exist."], 404);
    }

    $columns = get_table_columns($pdo, $tableName);
    $columnNames = array_column($columns, 'name');
    $primaryKey = null;
    $searchableCols = [];
    foreach ($columns as $col) {
      if ($col['isPrimary']) {
        $primaryKey = $col['name'];
      }
      if (in_array(strtolower($col['dataType']), ['varchar', 'text', 'mediumtext', 'longtext', 'char', 'enum'], true)) {
        $searchableCols[] = $col['name'];
      }
    }

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(200, max(5, (int) ($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;
    $search = trim((string) ($_GET['search'] ?? ''));
    $sortCol = trim((string) ($_GET['sort'] ?? ''));
    $sortOrder = strtoupper(trim((string) ($_GET['order'] ?? 'DESC'))) === 'ASC' ? 'ASC' : 'DESC';

    // Validate sort column
    if (!in_array($sortCol, $columnNames, true)) {
      $sortCol = $primaryKey ?? $columnNames[0] ?? null;
    }

    $whereClauses = [];
    $params = [];

    if ($search !== '' && count($searchableCols) > 0) {
      $searchParts = [];
      foreach ($searchableCols as $sCol) {
        $searchParts[] = "`{$sCol}` LIKE ?";
        $params[] = "%{$search}%";
      }
      $whereClauses[] = '(' . implode(' OR ', $searchParts) . ')';
    }

    $whereSql = count($whereClauses) > 0 ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    // Count total filtered rows
    $countSql = "SELECT COUNT(*) FROM `{$tableName}` {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalFiltered = (int) $countStmt->fetchColumn();

    // Fetch paginated rows
    $orderSql = $sortCol ? "ORDER BY `{$sortCol}` {$sortOrder}" : '';
    $dataSql = "SELECT * FROM `{$tableName}` {$whereSql} {$orderSql} LIMIT {$limit} OFFSET {$offset}";
    $dataStmt = $pdo->prepare($dataSql);
    $dataStmt->execute($params);
    $rows = $dataStmt->fetchAll();

    json_response([
      'ok' => true,
      'data' => [
        'table' => $tableName,
        'columns' => $columns,
        'primaryKey' => $primaryKey,
        'rows' => $rows,
        'totalRows' => $tables[$tableName]['rows'],
        'filteredRows' => $totalFiltered,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => max(1, (int) ceil($totalFiltered / $limit)),
      ],
    ]);
  }

  json_response(['ok' => false, 'error' => 'Invalid action.'], 400);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST REQUESTS (MUTATIONS & DELETIONS)
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
  $body = read_json_body();
  $tables = get_db_tables($pdo);
  $reqAction = $body['action'] ?? $action;

  // 1. Delete selected rows
  if ($reqAction === 'delete_rows') {
    $tableName = trim((string) ($body['table'] ?? ''));
    if (!isset($tables[$tableName])) {
      json_response(['ok' => false, 'error' => "Table '{$tableName}' not found."], 404);
    }

    $ids = $body['ids'] ?? [];
    if (!is_array($ids) || count($ids) === 0) {
      json_response(['ok' => false, 'error' => 'No records selected for deletion.'], 400);
    }

    $idColumn = trim((string) ($body['idColumn'] ?? ''));
    $columns = get_table_columns($pdo, $tableName);
    $columnNames = array_column($columns, 'name');

    if (!in_array($idColumn, $columnNames, true)) {
      json_response(['ok' => false, 'error' => "Invalid ID column '{$idColumn}'."], 400);
    }

    try {
      $pdo->beginTransaction();
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

      $placeholders = implode(',', array_fill(0, count($ids), '?'));
      $delStmt = $pdo->prepare("DELETE FROM `{$tableName}` WHERE `{$idColumn}` IN ({$placeholders})");
      $delStmt->execute(array_values($ids));
      $deletedCount = $delStmt->rowCount();

      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      $pdo->commit();

      json_response([
        'ok' => true,
        'message' => "Successfully deleted {$deletedCount} record(s) from '{$tableName}'.",
        'deletedCount' => $deletedCount,
      ]);
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      json_response(['ok' => false, 'error' => 'Deletion failed: ' . $e->getMessage()], 500);
    }
  }

  // 2. Truncate / Clear a single table
  if ($reqAction === 'truncate_table') {
    $tableName = trim((string) ($body['table'] ?? ''));
    if (!isset($tables[$tableName])) {
      json_response(['ok' => false, 'error' => "Table '{$tableName}' not found."], 404);
    }

    try {
      $pdo->beginTransaction();
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
      $pdo->exec("DELETE FROM `{$tableName}`");
      try {
        $pdo->exec("ALTER TABLE `{$tableName}` AUTO_INCREMENT = 1");
      } catch (Throwable $t) {}
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      $pdo->commit();

      json_response([
        'ok' => true,
        'message' => "Successfully cleared all data from table '{$tableName}'.",
      ]);
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      json_response(['ok' => false, 'error' => 'Failed to clear table: ' . $e->getMessage()], 500);
    }
  }

  // 3. "Delete Everything Except..." (Preserve selected tables)
  if ($reqAction === 'wipe_except') {
    $preserveTables = $body['preserveTables'] ?? [];
    if (!is_array($preserveTables)) {
      $preserveTables = [];
    }

    $confirmation = trim((string) ($body['confirmation'] ?? ''));
    if (strtoupper($confirmation) !== 'CONFIRM' && strtoupper($confirmation) !== 'DELETE') {
      json_response(['ok' => false, 'error' => 'Please type CONFIRM or DELETE to verify this destructive action.'], 400);
    }

    $tablesToWipe = [];
    foreach (array_keys($tables) as $tName) {
      if (!in_array($tName, $preserveTables, true)) {
        $tablesToWipe[] = $tName;
      }
    }

    if (count($tablesToWipe) === 0) {
      json_response(['ok' => true, 'message' => 'No tables to wipe; all selected tables were preserved.', 'wipedTables' => []]);
    }

    try {
      $pdo->beginTransaction();
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

      $wipedSummary = [];
      foreach ($tablesToWipe as $tName) {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM `{$tName}`")->fetchColumn();
        $pdo->exec("DELETE FROM `{$tName}`");
        try {
          $pdo->exec("ALTER TABLE `{$tName}` AUTO_INCREMENT = 1");
        } catch (Throwable $t) {}
        $wipedSummary[] = ['table' => $tName, 'deletedRows' => $count];
      }

      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      $pdo->commit();

      json_response([
        'ok' => true,
        'message' => 'Successfully wiped ' . count($tablesToWipe) . ' table(s). Preserved: ' . implode(', ', $preserveTables),
        'wipedTables' => $wipedSummary,
        'preservedTables' => $preserveTables,
      ]);
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
      json_response(['ok' => false, 'error' => 'Database wipe failed: ' . $e->getMessage()], 500);
    }
  }

  json_response(['ok' => false, 'error' => 'Invalid action.'], 400);
}
