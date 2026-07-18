<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

function map_proof(PDO $pdo, array $row): array
{
  $dist = $pdo->prepare('SELECT code, location, program FROM distributions WHERE id = ?');
  $dist->execute([$row['distribution_id']]);
  $distribution = $dist->fetch() ?: [];

  $ben = $pdo->prepare('SELECT code, full_name, barangay FROM beneficiaries WHERE id = ?');
  $ben->execute([$row['beneficiary_id']]);
  $beneficiary = $ben->fetch() ?: [];

  return [
    'id' => (int) $row['id'],
    'distributionId' => (int) $row['distribution_id'],
    'distributionCode' => $distribution['code'] ?? '',
    'distributionLocation' => $distribution['location'] ?? '',
    'program' => $distribution['program'] ?? '',
    'beneficiaryId' => (int) $row['beneficiary_id'],
    'barangay' => $beneficiary['full_name'] ?? $beneficiary['barangay'] ?? '',
    'fileName' => $row['file_name'],
    'fileType' => $row['file_type'],
    'fileUrl' => '/api/uploads/proofs/' . basename($row['file_path']),
    'notes' => $row['notes'],
    'status' => $row['status'],
    'submittedAt' => $row['submitted_at'],
    'reviewedAt' => $row['reviewed_at'],
  ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = get_id_param();

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $benId = $ben->fetchColumn();
    if (!$benId) {
      json_response(['ok' => true, 'data' => []]);
    }
    $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE beneficiary_id = ? ORDER BY submitted_at DESC');
    $stmt->execute([$benId]);
  } else {
    $stmt = $pdo->query('SELECT * FROM distribution_proofs ORDER BY submitted_at DESC');
  }
  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_proof($pdo, $r), $rows)]);
}

if ($method === 'POST') {
  if ($user['role'] !== 'Beneficiary') {
    json_response(['ok' => false, 'error' => 'Only barangay representatives can upload proof'], 403);
  }

  $ben = $pdo->prepare('SELECT id, full_name FROM beneficiaries WHERE user_id = ? LIMIT 1');
  $ben->execute([$user['id']]);
  $beneficiary = $ben->fetch();
  if (!$beneficiary) {
    json_response(['ok' => false, 'error' => 'No barangay profile linked to your account'], 400);
  }

  $distributionId = (int) ($_POST['distributionId'] ?? 0);
  $notes = trim((string) ($_POST['notes'] ?? ''));

  if ($distributionId <= 0) {
    json_response(['ok' => false, 'error' => 'Distribution is required'], 400);
  }

  if (!isset($_FILES['proof']) || $_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Please upload a photo or document'], 400);
  }

  $file = $_FILES['proof'];
  $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  $mime = mime_content_type($file['tmp_name']) ?: $file['type'];
  if (!in_array($mime, $allowed, true)) {
    json_response(['ok' => false, 'error' => 'Allowed files: JPG, PNG, WEBP, GIF, PDF'], 400);
  }

  if ($file['size'] > 5 * 1024 * 1024) {
    json_response(['ok' => false, 'error' => 'File must be under 5MB'], 400);
  }

  $uploadDir = __DIR__ . '/uploads/proofs';
  if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
  }

  $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'bin';
  $safeName = 'proof_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
  $destPath = $uploadDir . '/' . $safeName;

  if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    json_response(['ok' => false, 'error' => 'Failed to save file'], 500);
  }

  $stmt = $pdo->prepare('
    INSERT INTO distribution_proofs (distribution_id, beneficiary_id, submitted_by_user_id, file_path, file_name, file_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $distributionId,
    $beneficiary['id'],
    $user['id'],
    $safeName,
    $file['name'],
    $mime,
    $notes ?: null,
  ]);

  $pdo->prepare("UPDATE distributions SET proof_status = 'Proof Submitted', status = 'Awaiting Proof' WHERE id = ?")
    ->execute([$distributionId]);

  $dist = $pdo->prepare('SELECT code, location FROM distributions WHERE id = ?');
  $dist->execute([$distributionId]);
  $d = $dist->fetch();

  notify_admins(
    $pdo,
    'proof_submitted',
    'Distribution proof submitted',
    ($beneficiary['full_name'] ?? 'Barangay') . ' uploaded proof for distribution ' . ($d['code'] ?? '') . ' at ' . ($d['location'] ?? ''),
    '/admin/distributions'
  );

  $proofId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE id = ?');
  $stmt->execute([$proofId]);
  json_response(['ok' => true, 'data' => map_proof($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  require_auth(['Admin', 'Staff']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Proof id required'], 400);
  }
  $body = read_json_body();
  $status = $body['status'] ?? 'Verified';
  if (!in_array($status, ['Verified', 'Rejected', 'Pending Review'], true)) {
    $status = 'Verified';
  }

  $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE id = ?');
  $stmt->execute([$id]);
  $proof = $stmt->fetch();
  if (!$proof) {
    json_response(['ok' => false, 'error' => 'Proof not found'], 404);
  }

  $pdo->prepare('UPDATE distribution_proofs SET status = ?, reviewed_at = NOW() WHERE id = ?')
    ->execute([$status, $id]);

  if ($status === 'Verified') {
    $pdo->prepare("UPDATE distributions SET proof_status = 'Proof Verified', status = 'Completed' WHERE id = ?")
      ->execute([$proof['distribution_id']]);
  }

  $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_proof($pdo, $stmt->fetch())]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
