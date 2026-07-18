<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_donor(PDO $pdo, array $row): array
{
  $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM donations WHERE donor_id = ? AND type = ?');
  $stmt->execute([$row['id'], 'Monetary']);
  $stats = $stmt->fetch();

  $last = $pdo->prepare('SELECT donation_date FROM donations WHERE donor_id = ? ORDER BY donation_date DESC LIMIT 1');
  $last->execute([$row['id']]);
  $lastDate = $last->fetchColumn();

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'email' => $row['email'],
    'phone' => $row['phone'],
    'totalDonated' => '₱' . number_format((float) $stats['total']),
    'donations' => (int) $stats['cnt'],
    'lastDonation' => format_date($lastDate ?: null),
  ];
}

require_auth(['Admin', 'Staff']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Donor not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_donor($pdo, $row)]);
  }
  $rows = $pdo->query('SELECT * FROM donors ORDER BY full_name ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_donor($pdo, $r), $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  $name = trim((string) ($body['name'] ?? $body['full_name'] ?? ''));
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Name is required'], 400);
  }
  $code = generate_code('DNR');
  $stmt = $pdo->prepare('INSERT INTO donors (code, full_name, email, phone) VALUES (?, ?, ?, ?)');
  $stmt->execute([$code, $name, $body['email'] ?? null, $body['phone'] ?? null]);
  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_donor($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Donor id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Donor not found'], 404);
  }
  $update = $pdo->prepare('UPDATE donors SET full_name = ?, email = ?, phone = ? WHERE id = ?');
  $update->execute([
    trim((string) ($body['name'] ?? $existing['full_name'])),
    $body['email'] ?? $existing['email'],
    $body['phone'] ?? $existing['phone'],
    $id,
  ]);
  $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_donor($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Donor id is required'], 400);
  }
  $pdo->prepare('DELETE FROM donors WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
