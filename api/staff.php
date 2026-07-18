<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
require_auth(['Admin', 'Staff']);

$rows = $pdo->query("
  SELECT u.id, u.full_name, u.email, u.status, r.name AS role_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE r.name IN ('Staff', 'Admin')
  ORDER BY u.full_name ASC
")->fetchAll();

$data = array_map(static function (array $row): array {
  return [
    'id' => 'STF-' . str_pad((string) $row['id'], 3, '0', STR_PAD_LEFT),
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'email' => $row['email'],
    'role' => $row['role_name'],
    'department' => $row['role_name'] === 'Admin' ? 'Management' : 'Operations',
    'status' => $row['status'] === 'ACTIVE' ? 'Active' : $row['status'],
  ];
}, $rows);

json_response(['ok' => true, 'data' => $data]);
