<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_donation(array $row): array
{
  return [
    'id' => $row['tracking_code'],
    'dbId' => (int) $row['id'],
    'trackingCode' => $row['tracking_code'],
    'donor' => $row['donor_name'],
    'donorEmail' => $row['donor_email'],
    'type' => $row['type'],
    'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
    'amountRaw' => $row['amount'],
    'itemsDescription' => $row['items_description'],
    'status' => $row['status'],
    'date' => format_date($row['donation_date']),
    'donationDate' => $row['donation_date'],
    'notes' => $row['notes'],
  ];
}

if ($method === 'GET') {
  $user = require_auth(['Admin', 'Staff', 'Donor']);

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Donation not found'], 404);
    }
    if ($user['role'] === 'Donor' && strcasecmp((string) $row['donor_email'], (string) $user['email']) !== 0) {
      json_response(['ok' => false, 'error' => 'Access denied'], 403);
    }
    json_response(['ok' => true, 'data' => map_donation($row)]);
  }

  if ($user['role'] === 'Donor') {
    $stmt = $pdo->prepare('SELECT * FROM donations WHERE donor_email = ? ORDER BY donation_date DESC, id DESC');
    $stmt->execute([$user['email']]);
  } else {
    $stmt = $pdo->query('SELECT * FROM donations ORDER BY donation_date DESC, id DESC');
  }
  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map('map_donation', $rows)]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $public = !empty($body['public']);
  $user = $public ? null : require_auth(['Admin', 'Staff']);

  $type = ($body['type'] ?? 'Monetary') === 'In-Kind' ? 'In-Kind' : 'Monetary';
  $donorName = trim((string) ($body['donorName'] ?? $body['donor_name'] ?? ''));
  $donorEmail = strtolower(trim((string) ($body['email'] ?? $body['donor_email'] ?? '')));
  $donationDate = (string) ($body['donationDate'] ?? $body['donation_date'] ?? date('Y-m-d'));

  if ($donorName === '') {
    json_response(['ok' => false, 'error' => 'Donor name is required'], 400);
  }

  $tracking = generate_code('DON');
  $amount = $type === 'Monetary' ? (float) ($body['amount'] ?? 0) : null;
  $items = $type === 'In-Kind' ? trim((string) ($body['items'] ?? $body['itemsDescription'] ?? '')) : null;
  $status = trim((string) ($body['status'] ?? 'Pending Verification'));
  $notes = trim((string) ($body['notes'] ?? $body['message'] ?? ''));

  $donorId = null;
  if ($donorEmail !== '') {
    $find = $pdo->prepare('SELECT id FROM donors WHERE email = ? LIMIT 1');
    $find->execute([$donorEmail]);
    $donorId = $find->fetchColumn() ?: null;
  }

  $stmt = $pdo->prepare('INSERT INTO donations (tracking_code, donor_id, donor_name, donor_email, type, amount, items_description, status, donation_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([$tracking, $donorId, $donorName, $donorEmail ?: null, $type, $amount, $items, $status, $donationDate, $notes ?: null]);

  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
  $stmt->execute([$newId]);
  $donation = map_donation($stmt->fetch());
  notify_admins($pdo, 'donation', 'New donation received', "{$donation['donor']} submitted {$donation['amount']} ({$donation['trackingCode']})", '/admin/donations');
  json_response(['ok' => true, 'data' => $donation], 201);
}

if ($method === 'DELETE') {
  $user = require_auth(['Admin', 'Staff', 'Donor']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Donation id is required'], 400);
  }

  if ($user['role'] === 'Donor') {
    // Donors may only cancel their own donations while still pending.
    $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Donation not found'], 404);
    }
    if (strcasecmp((string) $row['donor_email'], (string) $user['email']) !== 0) {
      json_response(['ok' => false, 'error' => 'Access denied'], 403);
    }
    if ($row['status'] !== 'Pending Verification') {
      json_response(['ok' => false, 'error' => 'Only donations pending verification can be cancelled'], 400);
    }
    $pdo->prepare('DELETE FROM donations WHERE id = ?')->execute([$id]);
    notify_admins($pdo, 'donation', 'Donation cancelled', "{$user['name']} cancelled donation {$row['tracking_code']}", '/admin/donations');
    json_response(['ok' => true]);
  }

  $pdo->prepare('DELETE FROM donations WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

require_auth(['Admin', 'Staff']);

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Donation id is required'], 400);
  }
  $body = read_json_body();
  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Donation not found'], 404);
  }

  $status = trim((string) ($body['status'] ?? $existing['status']));
  $donorName = trim((string) ($body['donorName'] ?? $existing['donor_name']));
  $type = ($body['type'] ?? $existing['type']) === 'In-Kind' ? 'In-Kind' : 'Monetary';
  $amount = $type === 'Monetary' ? (float) ($body['amountRaw'] ?? $body['amount'] ?? $existing['amount']) : null;
  $items = $type === 'In-Kind' ? trim((string) ($body['itemsDescription'] ?? $existing['items_description'])) : null;
  $donationDate = (string) ($body['donationDate'] ?? $existing['donation_date']);

  $update = $pdo->prepare('UPDATE donations SET donor_name = ?, type = ?, amount = ?, items_description = ?, status = ?, donation_date = ? WHERE id = ?');
  $update->execute([$donorName, $type, $amount, $items, $status, $donationDate, $id]);

  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
  $stmt->execute([$id]);
  $donation = map_donation($stmt->fetch());
  if ($status !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Donation status updated', "{$donation['trackingCode']} is now {$status}", '/admin/donations');
  }
  json_response(['ok' => true, 'data' => $donation]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
