<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_certificate(array $row): array
{
  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'type' => $row['cert_type'],
    'recipientType' => $row['recipient_type'] ?? 'Donor',
    'recipient' => $row['recipient_name'],
    'reference' => $row['reference_code'],
    'details' => $row['details'] ?? '',
    'signatoryName' => $row['signatory_name'] ?? '',
    'signatoryTitle' => $row['signatory_title'] ?? '',
    'date' => format_date($row['cert_date']),
    'certDate' => $row['cert_date'],
    'status' => $row['status'],
  ];
}

$user = require_auth(['Admin', 'Staff', 'Donor', 'Volunteer']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Certificate not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_certificate($row)]);
  }

  if ($user['role'] === 'Donor') {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE recipient_name = ? OR reference_code IN (SELECT tracking_code FROM donations WHERE donor_email = ?) ORDER BY id DESC');
    $stmt->execute([$user['name'], $user['email']]);
  } elseif ($user['role'] === 'Volunteer') {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE recipient_name = ? ORDER BY id DESC');
    $stmt->execute([$user['name']]);
  } else {
    $stmt = $pdo->query('SELECT * FROM certificates ORDER BY id DESC');
  }

  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map('map_certificate', $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  // Donors may request a certificate for one of their own donations.
  if ($user['role'] === 'Donor') {
    $reference = trim((string) ($body['reference'] ?? ''));
    if ($reference !== '') {
      $own = $pdo->prepare('SELECT COUNT(*) FROM donations WHERE tracking_code = ? AND donor_email = ?');
      $own->execute([$reference, $user['email']]);
      if (!$own->fetchColumn()) {
        json_response(['ok' => false, 'error' => 'That donation reference does not belong to your account'], 403);
      }
    }
    $code = generate_code('CERT');
    $stmt = $pdo->prepare('INSERT INTO certificates (code, cert_type, recipient_type, recipient_name, reference_code, details, cert_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
      $code,
      in_array($body['type'] ?? '', ['Certificate of Donation', 'Official Receipt'], true) ? $body['type'] : 'Certificate of Donation',
      'Donor',
      $user['name'],
      $reference ?: null,
      trim((string) ($body['details'] ?? '')) ?: null,
      date('Y-m-d'),
      'Requested',
    ]);
    notify_admins($pdo, 'certificate', 'Certificate requested', "{$user['name']} requested a certificate" . ($reference ? " for {$reference}" : ''), '/admin/certificates');
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
    $stmt->execute([(int) $pdo->lastInsertId()]);
    json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())], 201);
  }

  if (!in_array($user['role'], ['Admin', 'Staff'], true)) {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }

  $recipient = trim((string) ($body['recipient'] ?? ''));
  if ($recipient === '') {
    json_response(['ok' => false, 'error' => 'Recipient is required'], 400);
  }

  $code = generate_code('CERT');
  $stmt = $pdo->prepare('INSERT INTO certificates (code, cert_type, recipient_type, recipient_name, reference_code, details, signatory_name, signatory_title, cert_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $body['type'] ?? 'Certificate of Donation',
    $body['recipientType'] ?? 'Donor',
    $recipient,
    $body['reference'] ?? null,
    trim((string) ($body['details'] ?? '')) ?: null,
    trim((string) ($body['signatoryName'] ?? '')) ?: null,
    trim((string) ($body['signatoryTitle'] ?? '')) ?: null,
    $body['certDate'] ?? date('Y-m-d'),
    $body['status'] ?? 'Generated',
  ]);
  $newId = (int) $pdo->lastInsertId();

  // Notify the recipient if they have a portal account.
  $findUser = $pdo->prepare('SELECT id FROM users WHERE name = ? LIMIT 1');
  $findUser->execute([$recipient]);
  $recipientUserId = $findUser->fetchColumn();
  if ($recipientUserId) {
    $link = ($body['recipientType'] ?? 'Donor') === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates';
    create_notification($pdo, 'certificate', 'Certificate ready', "Your {$body['type']} ({$code}) is ready to view and download.", $link, (int) $recipientUserId);
  }

  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())], 201);
}

require_auth(['Admin', 'Staff']);

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Certificate id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Certificate not found'], 404);
  }
  $update = $pdo->prepare('UPDATE certificates SET cert_type = ?, recipient_type = ?, recipient_name = ?, reference_code = ?, details = ?, signatory_name = ?, signatory_title = ?, cert_date = ?, status = ? WHERE id = ?');
  $update->execute([
    $body['type'] ?? $existing['cert_type'],
    $body['recipientType'] ?? ($existing['recipient_type'] ?? 'Donor'),
    $body['recipient'] ?? $existing['recipient_name'],
    $body['reference'] ?? $existing['reference_code'],
    array_key_exists('details', $body) ? (trim((string) $body['details']) ?: null) : ($existing['details'] ?? null),
    array_key_exists('signatoryName', $body) ? (trim((string) $body['signatoryName']) ?: null) : ($existing['signatory_name'] ?? null),
    array_key_exists('signatoryTitle', $body) ? (trim((string) $body['signatoryTitle']) ?: null) : ($existing['signatory_title'] ?? null),
    $body['certDate'] ?? $existing['cert_date'],
    $body['status'] ?? $existing['status'],
    $id,
  ]);

  $newStatus = $body['status'] ?? $existing['status'];
  if ($newStatus === 'Generated' && $existing['status'] !== 'Generated') {
    $findUser = $pdo->prepare('SELECT id FROM users WHERE name = ? LIMIT 1');
    $findUser->execute([$existing['recipient_name']]);
    $recipientUserId = $findUser->fetchColumn();
    if ($recipientUserId) {
      $link = ($existing['recipient_type'] ?? 'Donor') === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates';
      create_notification($pdo, 'certificate', 'Certificate ready', "Your {$existing['cert_type']} ({$existing['code']}) is ready to view and download.", $link, (int) $recipientUserId);
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Certificate id is required'], 400);
  }
  $pdo->prepare('DELETE FROM certificates WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
