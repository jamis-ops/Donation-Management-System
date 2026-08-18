<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

function normalize_proof_status(?string $status): string
{
  $status = trim((string) $status);
  return match ($status) {
    'Verified', 'Proof Verified', 'Approved' => 'Approved',
    'Rejected', 'Proof Rejected' => 'Rejected',
    'Pending Review', 'Under Review', 'Pending', '' => 'Pending',
    default => $status !== '' ? $status : 'Pending',
  };
}

function map_proof(PDO $pdo, array $row): array
{
  $distStmt = $pdo->prepare('SELECT id, code, event_name, location, program, status, distribution_date, request_id FROM distributions WHERE id = ?');
  $distStmt->execute([$row['distribution_id']]);
  $distribution = $distStmt->fetch() ?: [];

  $ben = $pdo->prepare('SELECT code, full_name, barangay FROM beneficiaries WHERE id = ?');
  $ben->execute([$row['beneficiary_id']]);
  $beneficiary = $ben->fetch() ?: [];

  $eventName = trim((string) ($distribution['event_name'] ?? ''));
  if ($eventName === '') {
    $eventName = trim(($distribution['code'] ?? '') . ' — ' . ($distribution['location'] ?? ''));
  }

  $requestInfo = null;
  $requestId = !empty($distribution['request_id']) ? (int) $distribution['request_id'] : null;
  if (!$requestId && !empty($distribution['id'])) {
    try {
      $ar = $pdo->prepare(
        'SELECT assistance_request_id FROM allocations
         WHERE distribution_id = ? AND assistance_request_id IS NOT NULL
         ORDER BY id ASC LIMIT 1'
      );
      $ar->execute([(int) $distribution['id']]);
      $fromAlloc = $ar->fetchColumn();
      if ($fromAlloc) {
        $requestId = (int) $fromAlloc;
      }
    } catch (Throwable $e) {
    }
  }
  if ($requestId) {
    $rp = $pdo->prepare(
      'SELECT id, reference_code, assistance_type, status, notes, request_date
       FROM assistance_requests WHERE id = ? LIMIT 1'
    );
    $rp->execute([$requestId]);
    $reqRow = $rp->fetch();
    if ($reqRow) {
      $requestInfo = [
        'dbId' => (int) $reqRow['id'],
        'id' => $reqRow['reference_code'],
        'type' => $reqRow['assistance_type'],
        'status' => $reqRow['status'],
        'notes' => $reqRow['notes'] ?? '',
        'date' => format_date($reqRow['request_date'] ?? null),
      ];
    }
  }

  $fileType = (string) ($row['file_type'] ?? '');
  $fileName = (string) ($row['file_name'] ?? '');
  $isImage = str_starts_with($fileType, 'image/')
    || (bool) preg_match('/\.(jpe?g|png|gif|webp)$/i', $fileName);

  $status = normalize_proof_status($row['status'] ?? 'Pending');

  $category = (string) ($row['proof_category'] ?? 'other');
  $categoryLabel = match ($category) {
    'received_goods' => 'Received donations',
    'distribution' => 'Distribution photos',
    'acknowledgment' => 'Signed acknowledgment',
    default => 'Supporting file',
  };

  return [
    'id' => (int) $row['id'],
    'distributionId' => (int) $row['distribution_id'],
    'distributionCode' => $distribution['code'] ?? '',
    'eventName' => $eventName,
    'distributionLocation' => $distribution['location'] ?? '',
    'distributionDate' => format_date($distribution['distribution_date'] ?? null),
    'distributionStatus' => $distribution['status'] ?? '',
    'program' => $distribution['program'] ?? '',
    'requestId' => $requestId ?: null,
    'request' => $requestInfo,
    'beneficiaryId' => (int) $row['beneficiary_id'],
    'barangay' => $beneficiary['full_name'] ?? $beneficiary['barangay'] ?? '',
    'fileName' => $fileName,
    'fileType' => $fileType,
    'isImage' => $isImage,
    'fileUrl' => '/api/file.php?kind=proofs&name=' . rawurlencode(basename((string) $row['file_path'])),
    'notes' => $row['notes'],
    'category' => $category,
    'categoryLabel' => $categoryLabel,
    'status' => $status,
    'reviewRemarks' => $row['review_remarks'] ?? '',
    'reviewedByUserId' => isset($row['reviewed_by_user_id']) && $row['reviewed_by_user_id'] !== null
      ? (int) $row['reviewed_by_user_id']
      : null,
    'submittedAt' => $row['submitted_at'],
    'reviewedAt' => $row['reviewed_at'],
  ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = get_id_param();

if ($method === 'GET') {
  $beneficiaryFilter = isset($_GET['beneficiaryId']) ? (int) $_GET['beneficiaryId'] : 0;

  if ($user['role'] === 'Beneficiary') {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $benId = $ben->fetchColumn();
    if (!$benId) {
      json_response(['ok' => true, 'data' => []]);
    }
    $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE beneficiary_id = ? ORDER BY submitted_at DESC');
    $stmt->execute([$benId]);
  } elseif ($beneficiaryFilter > 0) {
    $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE beneficiary_id = ? ORDER BY submitted_at DESC');
    $stmt->execute([$beneficiaryFilter]);
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

  $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
  $ben->execute([$user['id']]);
  $beneficiary = $ben->fetch();
  if (!$beneficiary) {
    json_response(['ok' => false, 'error' => 'No barangay profile linked to your account'], 400);
  }

  $distributionId = (int) ($_POST['distributionId'] ?? 0);
  $notes = trim((string) ($_POST['notes'] ?? ''));

  if ($distributionId <= 0) {
    json_response(['ok' => false, 'error' => 'Please select a distribution event'], 400);
  }

  $distCheck = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $distCheck->execute([$distributionId]);
  $distribution = $distCheck->fetch();
  if (!$distribution) {
    json_response(['ok' => false, 'error' => 'Distribution event not found'], 404);
  }
  if (!distribution_belongs_to_beneficiary($distribution, $beneficiary)) {
    json_response(['ok' => false, 'error' => 'This distribution event is not assigned to your barangay'], 403);
  }
  if (($distribution['proof_status'] ?? '') === 'Proof Verified') {
    json_response(['ok' => false, 'error' => 'Proof for this distribution event has already been approved'], 400);
  }

  if (empty($distribution['beneficiary_id'])) {
    $pdo->prepare('UPDATE distributions SET beneficiary_id = ? WHERE id = ?')
      ->execute([$beneficiary['id'], $distributionId]);
    $distribution['beneficiary_id'] = $beneficiary['id'];
  }

  $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  $uploadDir = __DIR__ . '/uploads/proofs';
  if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
  }

  // Collect categorized files: received_goods, distribution, acknowledgment (+ legacy "proof")
  $slots = [
    'received_goods' => 'received_goods',
    'distribution' => 'distribution',
    'acknowledgment' => 'acknowledgment',
  ];
  $legacyCategory = trim((string) ($_POST['category'] ?? $_POST['proofCategory'] ?? 'other'));
  if (!in_array($legacyCategory, ['received_goods', 'distribution', 'acknowledgment', 'other'], true)) {
    $legacyCategory = 'other';
  }
  $slots['proof'] = $legacyCategory;

  $uploads = [];
  foreach ($slots as $field => $category) {
    if (!isset($_FILES[$field])) {
      continue;
    }
    $entry = $_FILES[$field];
    // Support multi-file arrays under the same field name
    if (is_array($entry['name'] ?? null)) {
      $count = count($entry['name']);
      for ($i = 0; $i < $count; $i++) {
        if (($entry['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
          continue;
        }
        $uploads[] = [
          'category' => $category,
          'name' => (string) $entry['name'][$i],
          'type' => (string) ($entry['type'][$i] ?? ''),
          'tmp' => (string) $entry['tmp_name'][$i],
          'size' => (int) ($entry['size'][$i] ?? 0),
          'error' => (int) $entry['error'][$i],
        ];
      }
    } elseif (($entry['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
      $uploads[] = [
        'category' => $category,
        'name' => (string) $entry['name'],
        'type' => (string) ($entry['type'] ?? ''),
        'tmp' => (string) $entry['tmp_name'],
        'size' => (int) ($entry['size'] ?? 0),
        'error' => (int) $entry['error'],
      ];
    }
  }

  if (count($uploads) === 0) {
    json_response(['ok' => false, 'error' => 'Please upload at least one photo or document as proof.'], 400);
  }
  if (count($uploads) > 8) {
    json_response(['ok' => false, 'error' => 'You can upload up to 8 files at a time.'], 400);
  }

  $hasCategoryCol = false;
  try {
    $col = $pdo->query("SHOW COLUMNS FROM distribution_proofs LIKE 'proof_category'");
    $hasCategoryCol = (bool) $col->fetch();
  } catch (Throwable $e) {
    $hasCategoryCol = false;
  }

  $saved = [];
  foreach ($uploads as $file) {
    $mime = mime_content_type($file['tmp']) ?: $file['type'];
    if (!in_array($mime, $allowed, true)) {
      json_response(['ok' => false, 'error' => 'Allowed files: JPG, PNG, WEBP, GIF, PDF'], 400);
    }
    if ($file['size'] > 5 * 1024 * 1024) {
      json_response(['ok' => false, 'error' => 'Each file must be under 5MB'], 400);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'bin';
    $safeName = 'proof_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destPath = $uploadDir . '/' . $safeName;
    if (!move_uploaded_file($file['tmp'], $destPath)) {
      json_response(['ok' => false, 'error' => 'Failed to save file'], 500);
    }

    if ($hasCategoryCol) {
      $stmt = $pdo->prepare('
        INSERT INTO distribution_proofs
          (distribution_id, beneficiary_id, submitted_by_user_id, file_path, file_name, file_type, notes, proof_category, status, review_remarks, reviewed_at, reviewed_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'Pending\', NULL, NULL, NULL)
      ');
      $stmt->execute([
        $distributionId,
        $beneficiary['id'],
        $user['id'],
        $safeName,
        $file['name'],
        $mime,
        $notes !== '' ? $notes : null,
        $file['category'],
      ]);
    } else {
      $stmt = $pdo->prepare('
        INSERT INTO distribution_proofs
          (distribution_id, beneficiary_id, submitted_by_user_id, file_path, file_name, file_type, notes, status, review_remarks, reviewed_at, reviewed_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, \'Pending\', NULL, NULL, NULL)
      ');
      $stmt->execute([
        $distributionId,
        $beneficiary['id'],
        $user['id'],
        $safeName,
        $file['name'],
        $mime,
        $notes !== '' ? $notes : null,
      ]);
    }
    $saved[] = (int) $pdo->lastInsertId();
  }

  $pdo->prepare("UPDATE distributions SET proof_status = 'Proof Submitted', status = 'Awaiting Proof', receipt_status = CASE WHEN receipt_status = 'Awaiting Confirmation' THEN 'Received' ELSE receipt_status END WHERE id = ?")
    ->execute([$distributionId]);

  notify_admins(
    $pdo,
    'proof_submitted',
    'Distribution proof submitted',
    ($beneficiary['full_name'] ?? 'Barangay') . ' uploaded ' . count($saved) . ' proof file(s) for ' . ($distribution['code'] ?? '') . '. Open the delivery to review proof.',
    '/admin/distributions?id=' . $distributionId . '#distributions-table'
  );

  $placeholders = implode(',', array_fill(0, count($saved), '?'));
  $stmt = $pdo->prepare("SELECT * FROM distribution_proofs WHERE id IN ({$placeholders}) ORDER BY id ASC");
  $stmt->execute($saved);
  $rows = $stmt->fetchAll();
  json_response([
    'ok' => true,
    'count' => count($rows),
    'data' => array_map(fn($r) => map_proof($pdo, $r), $rows),
  ], 201);
}

if ($method === 'PUT') {
  require_auth(['Admin', 'Staff']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Proof id required'], 400);
  }
  $body = read_json_body();
  $rawStatus = (string) ($body['status'] ?? 'Approved');
  // Accept legacy + new labels from the UI
  $status = normalize_proof_status(
    in_array($rawStatus, ['Verified', 'Approve', 'approve'], true) ? 'Approved'
      : (in_array($rawStatus, ['Reject', 'reject'], true) ? 'Rejected' : $rawStatus)
  );
  if (!in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid proof status'], 400);
  }

  $remarks = trim((string) ($body['remarks'] ?? $body['reviewRemarks'] ?? ''));
  if ($status === 'Rejected' && $remarks === '') {
    json_response(['ok' => false, 'error' => 'Please provide a reason when rejecting a proof'], 400);
  }
  if ($status !== 'Rejected') {
    $remarks = $remarks !== '' ? $remarks : null;
  }

  $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE id = ?');
  $stmt->execute([$id]);
  $proof = $stmt->fetch();
  if (!$proof) {
    json_response(['ok' => false, 'error' => 'Proof not found'], 404);
  }

  $pdo->prepare('UPDATE distribution_proofs SET status = ?, review_remarks = ?, reviewed_at = NOW(), reviewed_by_user_id = ? WHERE id = ?')
    ->execute([$status, $remarks, $user['id'], $id]);

  if ($status === 'Approved') {
    $pdo->prepare("UPDATE distributions SET proof_status = 'Proof Verified', status = 'Completed' WHERE id = ?")
      ->execute([$proof['distribution_id']]);
  } elseif ($status === 'Rejected') {
    $pdo->prepare("UPDATE distributions SET proof_status = 'Proof Rejected', status = 'Awaiting Proof' WHERE id = ?")
      ->execute([$proof['distribution_id']]);
  }

  // Notify the barangay portal user if linked (in-app + email on high-value proof outcomes).
  $benUser = $pdo->prepare('SELECT user_id, full_name, representative_email, representative_name FROM beneficiaries WHERE id = ?');
  $benUser->execute([$proof['beneficiary_id']]);
  $benRow = $benUser->fetch();
  $distCodeStmt = $pdo->prepare('SELECT code, beneficiary_id FROM distributions WHERE id = ? LIMIT 1');
  $distCodeStmt->execute([(int) $proof['distribution_id']]);
  $distRow = $distCodeStmt->fetch() ?: [];
  $distCode = (string) ($distRow['code'] ?? 'distribution');
  $safeCode = htmlspecialchars($distCode, ENT_QUOTES, 'UTF-8');

  if ($benRow && !empty($benRow['user_id'])) {
    if ($status === 'Approved') {
      create_notification(
        $pdo,
        'proof_approved',
        'Proof approved',
        'Your distribution proof was approved. Thank you for submitting documentation.',
        '/beneficiary/proofs?focus=history#proof-history',
        (int) $benRow['user_id']
      );
    } elseif ($status === 'Rejected') {
      create_notification(
        $pdo,
        'proof_rejected',
        'Proof needs revision',
        'Your proof was rejected. Reason: ' . $remarks . ' Please resubmit a corrected file.',
        '/beneficiary/proofs?distributionId=' . (int) $proof['distribution_id'] . '#proof-submit-form',
        (int) $benRow['user_id']
      );
    }
  }

  if ($benRow && lifecycle_mail_allowed('proof', $status)) {
    $toEmail = strtolower(trim((string) ($benRow['representative_email'] ?? '')));
    if ($toEmail === '' && !empty($benRow['user_id'])) {
      $u = $pdo->prepare('SELECT email FROM users WHERE id = ? LIMIT 1');
      $u->execute([(int) $benRow['user_id']]);
      $toEmail = strtolower(trim((string) ($u->fetchColumn() ?: '')));
    }
    $toName = trim((string) ($benRow['representative_name'] ?? $benRow['full_name'] ?? 'Barangay Representative'));
    if ($status === 'Approved') {
      send_lifecycle_email(
        $toEmail,
        $toName,
        "Proof approved — {$distCode}",
        'Your delivery proof was approved',
        "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Proof for distribution <strong>{$safeCode}</strong> was approved. The delivery is now marked complete.</p>",
        '/beneficiary/proofs?focus=history#proof-history',
        'View proof history'
      );
      // Mirror distribution Completed email without a second in-app row (already notified above).
      if (function_exists('try_close_linked_request')) {
        try {
          try_close_linked_request($pdo, (int) $proof['distribution_id']);
        } catch (Throwable $e) {
          // best-effort
        }
      }
    } elseif ($status === 'Rejected') {
      $safeRemarks = htmlspecialchars($remarks, ENT_QUOTES, 'UTF-8');
      send_lifecycle_email(
        $toEmail,
        $toName,
        "Proof needs revision — {$distCode}",
        'Please resubmit your delivery proof',
        "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Proof for distribution <strong>{$safeCode}</strong> needs revision.</p>"
          . "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\"><strong>Reason:</strong> {$safeRemarks}</p>",
        '/beneficiary/proofs?distributionId=' . (int) $proof['distribution_id'] . '#proof-submit-form',
        'Resubmit proof'
      );
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM distribution_proofs WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_proof($pdo, $stmt->fetch())]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
