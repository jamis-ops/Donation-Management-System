<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function ensure_donation_classified_columns(PDO $pdo): void
{
  static $done = false;
  if ($done) {
    return;
  }
  try {
    ensure_column($pdo, 'donations', 'classified_items_json', 'TEXT NULL');
    ensure_column($pdo, 'donations', 'payment_reference', 'VARCHAR(100) NULL AFTER payment_method');
    ensure_column($pdo, 'donations', 'payment_method', 'VARCHAR(120) NULL');
    ensure_column($pdo, 'donations', 'ai_extracted_amount', 'DECIMAL(12,2) NULL');
    ensure_column($pdo, 'donations', 'ai_extracted_reference', 'VARCHAR(100) NULL');
    ensure_column($pdo, 'donations', 'ai_extracted_method', 'VARCHAR(100) NULL');
    ensure_column($pdo, 'donations', 'ai_verification_status', 'VARCHAR(50) NULL DEFAULT "Unverified"');
    ensure_column($pdo, 'donations', 'ai_confidence', 'VARCHAR(50) NULL');
    ensure_column($pdo, 'donations', 'ai_verification_notes', 'TEXT NULL');
    ensure_column($pdo, 'donations', 'is_amount_manually_adjusted', 'TINYINT(1) NOT NULL DEFAULT 0');
    ensure_column($pdo, 'donations', 'ai_verified_at', 'DATETIME NULL');
  } catch (Throwable $e) {}
  $done = true;
}
ensure_donation_classified_columns($pdo);

function donation_proof_is_image(?string $mime, ?string $fileName): bool
{
  $mime = (string) $mime;
  $fileName = (string) $fileName;
  return str_starts_with($mime, 'image/')
    || (bool) preg_match('/\.(jpe?g|png|gif|webp)$/i', $fileName);
}

function ensure_procurement_table(PDO $pdo): void
{
  static $done = false;
  if ($done) {
    return;
  }
  try {
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS donation_procurements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donation_id INT NOT NULL,
        mode VARCHAR(50) NOT NULL DEFAULT 'Pack Sponsorship',
        beneficiary_id INT NULL,
        assistance_request_id INT NULL,
        allocation_id INT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        items_json TEXT NOT NULL,
        receipt_number VARCHAR(100) NULL,
        supplier_name VARCHAR(150) NULL,
        families_supported INT UNSIGNED NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_by_user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_proc_donation (donation_id),
        INDEX idx_proc_ben (beneficiary_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
  } catch (Throwable $e) {
    // best-effort
  }
  $done = true;
}

function map_donation(array $row, ?PDO $pdo = null): array
{
  $proofPath = $row['proof_path'] ?? null;
  $proofName = $row['proof_file_name'] ?? null;
  $proofType = $row['proof_file_type'] ?? null;
  $hasProof = !empty($proofPath);

  $procurements = [];
  $totalUtilized = 0.0;
  $familiesSupported = 0;
  if ($pdo) {
    ensure_procurement_table($pdo);
    try {
      $stmt = $pdo->prepare("
        SELECT dp.*, b.full_name AS beneficiary_name, b.municipality AS beneficiary_municipality
        FROM donation_procurements dp
        LEFT JOIN beneficiaries b ON b.id = dp.beneficiary_id
        WHERE dp.donation_id = ?
        ORDER BY dp.created_at DESC, dp.id DESC
      ");
      $stmt->execute([(int) $row['id']]);
      $rows = $stmt->fetchAll();
      foreach ($rows as $p) {
        $items = json_decode((string) $p['items_json'], true) ?: [];
        $pAmount = (float) $p['total_amount'];
        $totalUtilized += $pAmount;
        $familiesSupported += (int) $p['families_supported'];
        $procurements[] = [
          'id' => (int) $p['id'],
          'mode' => $p['mode'],
          'totalAmount' => $pAmount,
          'items' => $items,
          'receiptNumber' => $p['receipt_number'],
          'supplierName' => $p['supplier_name'],
          'familiesSupported' => (int) $p['families_supported'],
          'beneficiaryId' => $p['beneficiary_id'] ? (int) $p['beneficiary_id'] : null,
          'beneficiaryName' => $p['beneficiary_name'] ?? null,
          'beneficiaryMunicipality' => $p['beneficiary_municipality'] ?? null,
          'assistanceRequestId' => $p['assistance_request_id'] ? (int) $p['assistance_request_id'] : null,
          'allocationId' => $p['allocation_id'] ? (int) $p['allocation_id'] : null,
          'notes' => $p['notes'],
          'createdAt' => $p['created_at'],
        ];
      }
    } catch (Throwable $e) {}
  }

  $amountRaw = (float) ($row['amount'] ?? 0);
  $remainingAmount = max(0.0, $amountRaw - $totalUtilized);

  return [
    'id' => $row['tracking_code'],
    'dbId' => (int) $row['id'],
    'trackingCode' => $row['tracking_code'],
    'donor' => $row['donor_name'],
    'donorEmail' => $row['donor_email'],
    'type' => $row['type'],
    'category' => $row['category'] ?? '',
    'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
    'amountRaw' => $amountRaw,
    'totalUtilized' => $totalUtilized,
    'remainingBalance' => $remainingAmount,
    'familiesSupported' => $familiesSupported,
    'procurements' => $procurements,
    'itemsDescription' => $row['items_description'],
    'status' => $row['status'],
    'date' => format_date($row['donation_date']),
    'donationDate' => $row['donation_date'],
    'notes' => $row['notes'],
    'paymentMethod' => $row['payment_method'] ?? '',
    'paymentReference' => $row['payment_reference'] ?? '',
    'donorPhone' => $row['donor_phone'] ?? null,
    'donorAddress' => $row['donor_address'] ?? null,
    'donorType' => $row['donor_type'] ?? null,
    'donorOrganization' => $row['donor_organization'] ?? null,
    'classifiedItems' => !empty($row['classified_items_json']) ? (json_decode((string) $row['classified_items_json'], true) ?: []) : [],
    'hasProof' => $hasProof,
    'proofFileName' => $proofName,
    'proofFileType' => $proofType,
    'proofIsImage' => $hasProof && donation_proof_is_image($proofType, $proofName),
    'proofUrl' => (function() use ($hasProof, $proofPath) {
      if (!$hasProof || empty($proofPath)) return null;
      if (preg_match('/^https?:\/\//i', (string) $proofPath) || str_starts_with((string) $proofPath, 'data:')) {
        return (string) $proofPath;
      }
      return '/api/file.php?kind=donation_proofs&name=' . rawurlencode(basename((string) $proofPath));
    })(),
    'aiExtractedAmount' => isset($row['ai_extracted_amount']) && $row['ai_extracted_amount'] !== null ? (float) $row['ai_extracted_amount'] : null,
    'aiExtractedReference' => $row['ai_extracted_reference'] ?? null,
    'aiExtractedMethod' => $row['ai_extracted_method'] ?? null,
    'aiVerificationStatus' => $row['ai_verification_status'] ?? 'Unverified',
    'aiConfidence' => $row['ai_confidence'] ?? null,
    'aiVerificationNotes' => $row['ai_verification_notes'] ?? null,
    'isAmountManuallyAdjusted' => !empty($row['is_amount_manually_adjusted']),
    'aiVerifiedAt' => $row['ai_verified_at'] ?? null,
  ];
}

function save_donation_proof_upload(): ?array
{
  if (!isset($_FILES['proof']) || $_FILES['proof']['error'] === UPLOAD_ERR_NO_FILE) {
    return null;
  }
  if ($_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Proof upload failed'], 400);
  }

  $file = $_FILES['proof'];
  $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  $mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
  if (!in_array($mime, $allowed, true)) {
    json_response(['ok' => false, 'error' => 'Proof must be JPG, PNG, WEBP, GIF, or PDF'], 400);
  }
  if ($file['size'] > 5 * 1024 * 1024) {
    json_response(['ok' => false, 'error' => 'Proof file must be under 5MB'], 400);
  }

  $dir = __DIR__ . '/uploads/donation_proofs';
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }

  $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'bin';
  $safeName = 'donation_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
  if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $safeName)) {
    json_response(['ok' => false, 'error' => 'Failed to save proof file'], 500);
  }

  return [
    'path' => $safeName,
    'name' => $file['name'],
    'type' => $mime,
  ];
}

if ($method === 'GET') {
  $user = require_auth(['Admin', 'Staff', 'Donor']);

  $baseSelect = "
    SELECT d.*,
           dn.phone AS donor_phone,
           dn.address AS donor_address,
           dn.donor_type,
           dn.organization AS donor_organization
    FROM donations d
    LEFT JOIN donors dn ON dn.id = d.donor_id
  ";

  if ($id) {
    $stmt = $pdo->prepare("{$baseSelect} WHERE d.id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Donation not found'], 404);
    }
    if ($user['role'] === 'Donor' && !donation_belongs_to_donor_user($pdo, $row, $user)) {
      json_response(['ok' => false, 'error' => 'Access denied'], 403);
    }
    json_response(['ok' => true, 'data' => map_donation($row, $pdo)]);
  }

  if ($user['role'] === 'Donor') {
    $rows = donations_for_donor_user($pdo, $user);
  } else {
    $rows = $pdo->query("{$baseSelect} ORDER BY d.created_at DESC, d.donation_date DESC, d.id DESC")->fetchAll();
  }
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_donation($r, $pdo), $rows)]);
}

if ($method === 'POST') {
  $isMultipart = isset($_SERVER['CONTENT_TYPE'])
    && stripos((string) $_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;

  if ($isMultipart) {
    $body = $_POST;
    $public = !empty($body['public']);
  } else {
    $body = read_json_body();
    $public = !empty($body['public']);
  }

  $action = trim((string) ($_GET['action'] ?? $body['action'] ?? ''));

  // ── Procurement & Fund Allocation Action ──
  if ($action === 'procure' || $action === 'procure_or_allocate') {
    $user = require_auth(['Admin', 'Staff']);
    ensure_procurement_table($pdo);

    $donationId = (int) ($body['donationId'] ?? $body['donation_id'] ?? 0);
    if ($donationId <= 0) {
      json_response(['ok' => false, 'error' => 'Valid donationId is required'], 400);
    }

    $dStmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
    $dStmt->execute([$donationId]);
    $donation = $dStmt->fetch();
    if (!$donation) {
      json_response(['ok' => false, 'error' => 'Donation record not found'], 404);
    }

    $mode = trim((string) ($body['mode'] ?? 'Pack Sponsorship'));
    $totalAmount = (float) ($body['totalAmount'] ?? $body['total_amount'] ?? 0);
    if ($totalAmount <= 0) {
      json_response(['ok' => false, 'error' => 'Total amount utilized must be greater than 0'], 400);
    }

    $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : (!empty($body['beneficiary_id']) ? (int) $body['beneficiary_id'] : null);
    $assistanceRequestId = !empty($body['assistanceRequestId']) ? (int) $body['assistanceRequestId'] : (!empty($body['assistance_request_id']) ? (int) $body['assistance_request_id'] : null);
    $items = is_array($body['items'] ?? null) ? $body['items'] : [];
    $receiptNumber = trim((string) ($body['receiptNumber'] ?? $body['receipt_number'] ?? ''));
    $supplierName = trim((string) ($body['supplierName'] ?? $body['supplier_name'] ?? ''));
    $familiesSupported = (int) ($body['familiesSupported'] ?? $body['families_supported'] ?? 0);
    $notes = trim((string) ($body['notes'] ?? ''));
    $addToInventory = !empty($body['addToInventory']);

    // Fetch beneficiary details if provided
    $beneficiary = null;
    $benName = 'General Community Aid';
    if ($beneficiaryId && $beneficiaryId > 0) {
      $bStmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
      $bStmt->execute([$beneficiaryId]);
      $beneficiary = $bStmt->fetch() ?: null;
      if ($beneficiary) {
        $benName = $beneficiary['full_name'] ?: ($beneficiary['barangay'] ?? 'Partner Community');
        if ($familiesSupported <= 0) {
          $familiesSupported = (int) ($beneficiary['affected_families'] ?? 1);
        }
      }
    }

    // Build items summary text
    $summaryParts = [];
    $totalQty = 0;
    foreach ($items as $it) {
      $itName = trim((string) ($it['item'] ?? $it['name'] ?? 'Relief Pack'));
      $itQty = (int) ($it['quantity'] ?? 1);
      $itUnit = trim((string) ($it['unit'] ?? 'packs'));
      $totalQty += $itQty;
      $summaryParts[] = "{$itName} ({$itQty} {$itUnit})";
    }
    $itemsSummary = !empty($summaryParts) ? implode(', ', $summaryParts) : "{$mode} (₱" . number_format($totalAmount, 2) . ")";

    // Create Allocation in allocations table
    $allocationId = null;
    if ($beneficiaryId && $beneficiaryId > 0) {
      try {
        $alcCode = generate_code('ALC');
        $alcStmt = $pdo->prepare('
          INSERT INTO allocations (code, resource_name, quantity, program, beneficiary_target, beneficiary_id, assistance_request_id, status, priority, allocation_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $donorLabel = !empty($donation['donor_name']) ? $donation['donor_name'] : 'Donor';
        $alcStmt->execute([
          $alcCode,
          $itemsSummary,
          max(1, $totalQty),
          $donation['category'] ?: 'Disaster Relief',
          $benName,
          $beneficiaryId,
          $assistanceRequestId,
          'Allocated',
          'High',
          date('Y-m-d'),
          "Funded from Monetary Donation {$donation['tracking_code']} ({$donorLabel})",
        ]);
        $allocationId = (int) $pdo->lastInsertId();

        // Automatically sync Assistance Request status to 'Allocated'
        if ($assistanceRequestId && $assistanceRequestId > 0) {
          $pdo->prepare("UPDATE assistance_requests SET status = 'Allocated' WHERE id = ?")->execute([$assistanceRequestId]);
        }
      } catch (Throwable $e) {
        // best-effort
      }
    }

    // Optionally add purchased goods into Inventory warehouse
    if ($addToInventory && !empty($items)) {
      foreach ($items as $it) {
        $itemName = trim((string) ($it['item'] ?? $it['name'] ?? ''));
        $itemQty = (int) ($it['quantity'] ?? 0);
        $itemUnit = trim((string) ($it['unit'] ?? 'pcs'));
        if ($itemName !== '' && $itemQty > 0) {
          try {
            $invCheck = $pdo->prepare('SELECT id FROM inventory_items WHERE LOWER(item_name) = LOWER(?) LIMIT 1');
            $invCheck->execute([$itemName]);
            $existingInvId = (int) $invCheck->fetchColumn();
            if ($existingInvId > 0) {
              $pdo->prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?')->execute([$itemQty, $existingInvId]);
            } else {
              $itemCode = generate_code('INV');
              $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, quantity, unit, low_stock_threshold, stock_state) VALUES (?, ?, ?, ?, ?, ?, ?)')
                ->execute([$itemCode, $itemName, $donation['category'] ?: 'Relief Goods', $itemQty, $itemUnit, 10, 'Available']);
            }
          } catch (Throwable $e) {}
        }
      }
    }

    // Insert Procurement Record
    $procStmt = $pdo->prepare('
      INSERT INTO donation_procurements (donation_id, mode, beneficiary_id, assistance_request_id, allocation_id, total_amount, items_json, receipt_number, supplier_name, families_supported, notes, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $procStmt->execute([
      $donationId,
      $mode,
      $beneficiaryId,
      $assistanceRequestId,
      $allocationId,
      $totalAmount,
      json_encode($items),
      $receiptNumber !== '' ? $receiptNumber : null,
      $supplierName !== '' ? $supplierName : null,
      $familiesSupported,
      $notes !== '' ? $notes : null,
      (int) $user['id'],
    ]);
    $procurementId = (int) $pdo->lastInsertId();

    // Update donation status to Allocated
    $pdo->prepare("UPDATE donations SET status = 'Allocated' WHERE id = ?")->execute([$donationId]);

    // Record timeline step
    $timelineNote = "₱" . number_format($totalAmount, 2) . " converted into {$itemsSummary} for {$benName}." . ($receiptNumber !== '' ? " Ref: {$receiptNumber}" : '');
    $updStmt = $pdo->prepare('
      INSERT INTO donation_updates (donation_id, stage, note, created_by_user_id, created_by_name)
      VALUES (?, ?, ?, ?, ?)
    ');
    $updStmt->execute([
      $donationId,
      'Scheduled for Distribution',
      $timelineNote,
      (int) $user['id'],
      (string) ($user['name'] ?? 'Staff'),
    ]);

    // Trigger Email Notification to Donor (non-blocking / safe)
    $donorEmail = trim((string) ($donation['donor_email'] ?? ''));
    $donorName = trim((string) ($donation['donor_name'] ?? 'Donor'));
    $emailSent = false;
    if ($donorEmail !== '' && filter_var($donorEmail, FILTER_VALIDATE_EMAIL)) {
      try {
        $procurementRecord = [
          'mode' => $mode,
          'total_amount' => $totalAmount,
          'items' => $items,
          'receipt_number' => $receiptNumber,
          'supplier_name' => $supplierName,
          'families_supported' => $familiesSupported,
        ];
        $emailSent = (bool) send_donation_allocated_email($donorEmail, $donorName, $donation, $procurementRecord, $beneficiary);
      } catch (Throwable $e) {
        $emailSent = false;
      }
    }

    notify_admins(
      $pdo,
      'donation',
      'Donation Allocated & Procured',
      "{$donation['tracking_code']} allocated: ₱" . number_format($totalAmount, 2) . " for {$benName}",
      '/admin/donations?tab=monetary'
    );

    // Return updated donation details
    $refreshed = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
    $refreshed->execute([$donationId]);
    $updatedRow = $refreshed->fetch();

    json_response([
      'ok' => true,
      'message' => "Donation successfully allocated for {$benName}!",
      'emailSent' => $emailSent,
      'procurementId' => $procurementId,
      'allocationId' => $allocationId,
      'data' => map_donation($updatedRow, $pdo),
    ]);
  }

  $user = $public ? null : require_auth(['Admin', 'Staff']);

  $type = (($body['type'] ?? 'Monetary') === 'In-Kind') ? 'In-Kind' : 'Monetary';
  [$lastName, $firstName, $middleInitial, $composedName] = read_name_parts($body);
  $contactPerson = $composedName !== ''
    ? $composedName
    : trim((string) ($body['contactPerson'] ?? $body['contact_person'] ?? $body['donorName'] ?? $body['donor_name'] ?? ''));
  $donorEmail = strtolower(trim((string) ($body['email'] ?? $body['donor_email'] ?? '')));
  $donationDate = (string) ($body['donationDate'] ?? $body['donation_date'] ?? date('Y-m-d'));

  $donorTypeRaw = trim((string) ($body['donorType'] ?? $body['donor_type'] ?? 'Individual'));
  $donorType = (strcasecmp($donorTypeRaw, 'Company') === 0 || strcasecmp($donorTypeRaw, 'Organization') === 0)
    ? 'Company'
    : 'Individual';
  $organization = $donorType === 'Company'
    ? trim((string) ($body['organization'] ?? $body['company'] ?? ''))
    : '';
  $phone = require_valid_phone($body['phone'] ?? '', $public, 'Phone', true);
  $country = trim((string) ($body['country'] ?? ''));
  $address = trim((string) ($body['address'] ?? ''));

  // donors.full_name: organization for Company, contact person for Individual.
  $fullName = $donorType === 'Company' && $organization !== ''
    ? $organization
    : $contactPerson;
  // donations.donor_name prefers contact person; fall back to organization.
  $donorName = $contactPerson !== '' ? $contactPerson : $fullName;
  $miDb = $middleInitial !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
    : null;

  if ($donorName === '') {
    json_response(['ok' => false, 'error' => 'Donor name is required'], 400);
  }
  if ($public && $donorType === 'Company' && $organization === '') {
    json_response(['ok' => false, 'error' => 'Company / Organization Name is required'], 400);
  }

  $tracking = generate_code('DON');
  $amount = $type === 'Monetary' ? (float) ($body['amount'] ?? 0) : null;
  $items = $type === 'In-Kind' ? trim((string) ($body['items'] ?? $body['itemsDescription'] ?? '')) : null;
  $status = trim((string) ($body['status'] ?? 'Pending Verification'));
  $notes = trim((string) ($body['notes'] ?? $body['message'] ?? ''));
  $paymentMethod = trim((string) ($body['paymentMethod'] ?? $body['payment_method'] ?? '')) ?: null;
  $paymentReference = trim((string) ($body['paymentReference'] ?? $body['payment_reference'] ?? '')) ?: null;
  $category = trim((string) ($body['category'] ?? '')) ?: null;

  $proof = $isMultipart ? save_donation_proof_upload() : null;
  if (!$proof && !empty($body['tempProofToken'])) {
    $safeToken = basename((string) $body['tempProofToken']);
    $tokenFullPath = __DIR__ . '/uploads/donation_proofs/' . $safeToken;
    if (file_exists($tokenFullPath)) {
      $proof = [
        'path' => $safeToken,
        'name' => (string) ($body['proofFileName'] ?? $safeToken),
        'type' => mime_content_type($tokenFullPath) ?: 'image/jpeg',
      ];
    }
  }

  $aiExtractedAmount = (isset($body['aiExtractedAmount']) && is_numeric($body['aiExtractedAmount']))
    ? (float) $body['aiExtractedAmount']
    : (isset($body['ai_extracted_amount']) && is_numeric($body['ai_extracted_amount']) ? (float) $body['ai_extracted_amount'] : null);
  $aiExtractedReference = trim((string) ($body['aiExtractedReference'] ?? $body['ai_extracted_reference'] ?? '')) ?: null;
  $aiExtractedMethod = trim((string) ($body['aiExtractedMethod'] ?? $body['ai_extracted_method'] ?? '')) ?: null;
  $aiVerificationStatus = trim((string) ($body['aiVerificationStatus'] ?? $body['ai_verification_status'] ?? 'Unverified'));
  $aiConfidence = trim((string) ($body['aiConfidence'] ?? $body['ai_confidence'] ?? '')) ?: null;
  $aiVerificationNotes = trim((string) ($body['aiVerificationNotes'] ?? $body['ai_verification_notes'] ?? '')) ?: null;
  $isAmountAdjusted = !empty($body['isAmountManuallyAdjusted']) || !empty($body['is_amount_manually_adjusted']);
  if ($aiExtractedAmount !== null && $amount !== null && abs($amount - $aiExtractedAmount) > 0.009) {
    $isAmountAdjusted = true;
  }
  $aiVerifiedAt = ($aiVerificationStatus !== 'Unverified' && $aiVerificationStatus !== '') ? date('Y-m-d H:i:s') : null;

  if ($donorEmail !== '') {
    $donorEmail = require_valid_email($donorEmail, 'Donor email');
  }

  if ($type === 'Monetary' && ($amount === null || $amount <= 0)) {
    json_response(['ok' => false, 'error' => 'Monetary donation amount must be greater than 0.'], 400);
  }
  if ($type === 'In-Kind' && ($items === null || $items === '')) {
    json_response(['ok' => false, 'error' => 'In-kind item description is required.'], 400);
  }

  if ($public) {
    if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
      json_response(['ok' => false, 'error' => 'You must accept the Data Privacy Policy and Terms & Conditions'], 400);
    }
    if ($donorEmail === '') {
      json_response(['ok' => false, 'error' => 'A valid email is required'], 400);
    }
    if (!$proof) {
      json_response(['ok' => false, 'error' => 'Proof of donation is required (receipt, bank slip, GCash screenshot, or OR)'], 400);
    }
    $status = 'Pending Verification';
  }

  $donorId = null;
  $authenticatedUser = current_user();
  $isLoggedInDonor = $authenticatedUser && (($authenticatedUser['role'] ?? '') === 'Donor');

  if ($isLoggedInDonor) {
    $uid = (int) ($authenticatedUser['id'] ?? 0);
    $uEmail = strtolower(trim((string) ($authenticatedUser['email'] ?? $donorEmail)));
    $find = $pdo->prepare('
      SELECT * FROM donors 
      WHERE (user_id IS NOT NULL AND user_id = ?) 
         OR (email IS NOT NULL AND email <> "" AND LOWER(email) = ?)
      ORDER BY (user_id = ?) DESC, id DESC 
      LIMIT 1
    ');
    $find->execute([$uid, $uEmail, $uid]);
    $donorRow = $find->fetch();

    if ($donorRow) {
      $donorId = (int) $donorRow['id'];
      if (empty($donorRow['user_id']) && $uid > 0) {
        $pdo->prepare('UPDATE donors SET user_id = ? WHERE id = ?')->execute([$uid, $donorId]);
      }
    } else {
      // Auto-create persistent donor record for this registered donor user
      $code = generate_code('DNR');
      [$lName, $fName, $mInitial] = split_full_name($donorName);
      $ins = $pdo->prepare('
        INSERT INTO donors (code, full_name, first_name, last_name, middle_initial, donor_type, organization, contact_person, email, phone, country, address, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $ins->execute([
        $code,
        $fullName,
        $firstName !== '' ? $firstName : ($fName ?: null),
        $lastName !== '' ? $lastName : ($lName ?: null),
        $miDb ?: ($mInitial ?: null),
        $donorType,
        $organization !== '' ? $organization : null,
        $contactPerson !== '' ? $contactPerson : null,
        $uEmail ?: null,
        $phone !== '' ? $phone : null,
        $country !== '' ? $country : null,
        $address !== '' ? $address : null,
        $uid,
      ]);
      $donorId = (int) $pdo->lastInsertId();
    }
  } elseif ($donorEmail !== '') {
    $find = $pdo->prepare('SELECT id FROM donors WHERE email = ? LIMIT 1');
    $find->execute([$donorEmail]);
    $existingDonorId = $find->fetchColumn();

    if ($existingDonorId) {
      $donorId = (int) $existingDonorId;
    } elseif ($public) {
      // Create a donor row for public donations so they appear in Admin → Donors.
      $ins = $pdo->prepare('
        INSERT INTO donors (code, full_name, first_name, last_name, middle_initial, donor_type, organization, contact_person, email, phone, country, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ');
      $ins->execute([
        generate_code('DNR'),
        $fullName,
        $firstName !== '' ? $firstName : null,
        $lastName !== '' ? $lastName : null,
        $miDb,
        $donorType,
        $organization !== '' ? $organization : null,
        $contactPerson !== '' ? $contactPerson : null,
        $donorEmail,
        $phone !== '' ? $phone : null,
        $country !== '' ? $country : null,
        $address !== '' ? $address : null,
      ]);
      $donorId = (int) $pdo->lastInsertId();
    }
  }

  $stmt = $pdo->prepare('
    INSERT INTO donations
      (tracking_code, donor_id, donor_name, donor_email, type, category, amount, items_description, status, donation_date, notes, payment_method, payment_reference, proof_path, proof_file_name, proof_file_type, ai_extracted_amount, ai_extracted_reference, ai_extracted_method, ai_verification_status, ai_confidence, ai_verification_notes, is_amount_manually_adjusted, ai_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $tracking,
    $donorId,
    $donorName,
    $donorEmail ?: null,
    $type,
    $category,
    $amount,
    $items,
    $status,
    $donationDate,
    $notes ?: null,
    $paymentMethod,
    $paymentReference,
    $proof['path'] ?? null,
    $proof['name'] ?? null,
    $proof['type'] ?? null,
    $aiExtractedAmount,
    $aiExtractedReference,
    $aiExtractedMethod,
    $aiVerificationStatus,
    $aiConfidence,
    $aiVerificationNotes,
    $isAmountAdjusted ? 1 : 0,
    $aiVerifiedAt,
  ]);

  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
  $stmt->execute([$newId]);
  $donation = map_donation($stmt->fetch());
  $actor = $isLoggedInDonor ? $authenticatedUser : ($public ? ['name' => 'Public Donor'] : ($user ?? current_user()));

  $timelineNote = 'Donation submitted and tracking code issued.';
  if ($aiVerificationStatus === 'verified') {
    $timelineNote .= " AI Proof Verification: Verified ({$aiExtractedMethod}, Extracted ₱" . number_format($aiExtractedAmount ?: 0, 2) . ($aiExtractedReference ? ", Ref: {$aiExtractedReference}" : '') . ').';
  } elseif ($aiVerificationStatus === 'needs_review') {
    $timelineNote .= " AI Proof Verification: Flagged for Staff Review (" . ($aiVerificationNotes ?: 'Awaiting manual verification') . ').';
  }
  if ($isAmountAdjusted && $aiExtractedAmount !== null) {
    $timelineNote .= " Amount manually adjusted by donor from ₱" . number_format($aiExtractedAmount, 2) . " to ₱" . number_format($amount ?: 0, 2) . ".";
  }
  record_donation_update($pdo, $newId, 'Donation Received', $timelineNote, is_array($actor) ? $actor : null);
  notify_admins($pdo, 'donation', 'New donation received', "{$donation['donor']} submitted {$donation['amount']} ({$donation['trackingCode']})", '/admin/donations');
  audit_log($pdo, 'create', 'donation', $tracking, "{$donorName} donated {$donation['amount']}", $isLoggedInDonor ? ['name' => $donorName, 'role' => 'Donor'] : ($public ? ['name' => $donorName, 'role' => 'Public'] : null));
  json_response(['ok' => true, 'data' => $donation], 201);
}

if ($method === 'DELETE') {
  $user = require_auth(['Admin', 'Staff', 'Donor']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Donation id is required'], 400);
  }

  if ($user['role'] === 'Donor') {
    $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Donation not found'], 404);
    }
    if (!donation_belongs_to_donor_user($pdo, $row, $user)) {
      json_response(['ok' => false, 'error' => 'Access denied'], 403);
    }
    if ($row['status'] !== 'Pending Verification') {
      json_response(['ok' => false, 'error' => 'Only donations pending verification can be cancelled'], 400);
    }
    $pdo->prepare('DELETE FROM donations WHERE id = ?')->execute([$id]);
    notify_admins($pdo, 'donation', 'Donation cancelled', "{$user['name']} cancelled donation {$row['tracking_code']}", '/admin/donations');
    audit_log($pdo, 'cancel', 'donation', $row['tracking_code'], 'Donor cancelled pending donation');
    json_response(['ok' => true]);
  }

  $delRow = $pdo->prepare('SELECT tracking_code FROM donations WHERE id = ?');
  $delRow->execute([$id]);
  $delCode = $delRow->fetchColumn();
  $pdo->prepare('DELETE FROM donations WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'donation', $delCode ?: (string) $id, 'Deleted donation');
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

  $action = trim((string) ($body['action'] ?? ''));
  if ($action === 'classify_in_kind') {
    $classifiedItems = is_array($body['classifiedItems'] ?? null) ? $body['classifiedItems'] : [];
    if (empty($classifiedItems)) {
      json_response(['ok' => false, 'error' => 'Please provide at least one item to classify into inventory.'], 400);
    }

    $newStatus = trim((string) ($body['status'] ?? 'Verified'));
    $becomingVerified = $newStatus === 'Verified' && ($existing['status'] ?? '') !== 'Verified';

    try {
      $pdo->exec("ALTER TABLE inventory_items ADD COLUMN item_type VARCHAR(100) NULL AFTER category");
      $pdo->exec("ALTER TABLE inventory_items ADD COLUMN brand VARCHAR(100) NULL AFTER item_type");
      $pdo->exec("ALTER TABLE inventory_items ADD COLUMN variant VARCHAR(100) NULL AFTER brand");
    } catch (Throwable $e) {}

    $inventoryAddedCount = 0;
    $itemSummaryList = [];

    foreach ($classifiedItems as $item) {
      $cat = trim((string) ($item['category'] ?? 'Food')) ?: 'Food';
      $itemType = trim((string) ($item['itemType'] ?? $item['item_type'] ?? '')) ?: null;
      $brand = trim((string) ($item['brand'] ?? '')) ?: null;
      $variant = trim((string) ($item['variant'] ?? '')) ?: null;
      $qty = max(1, (int) ($item['quantity'] ?? 1));
      $unit = trim((string) ($item['unit'] ?? 'pcs')) ?: 'pcs';
      $lowStock = isset($item['lowStockThreshold']) ? (int) $item['lowStockThreshold'] : 50;

      $explicitName = trim((string) ($item['item'] ?? $item['item_name'] ?? ''));
      if ($explicitName !== '') {
        $itemName = $explicitName;
      } elseif ($itemType) {
        $parts = [];
        if ($brand) $parts[] = $brand;
        $parts[] = $itemType;
        $assembled = implode(' ', $parts);
        if ($variant) $assembled .= " ({$variant})";
        $itemName = $assembled;
      } else {
        $itemName = $cat . ' Items';
      }

      $itemSummaryList[] = "{$qty} {$unit} {$itemName}";

      $findStmt = $pdo->prepare('
        SELECT id, quantity FROM inventory_items
        WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
        LIMIT 1
      ');
      $findStmt->execute([$itemName]);
      $invRow = $findStmt->fetch();

      if ($invRow) {
        update_inventory_stock_state($pdo, (int) $invRow['id'], (int) $invRow['quantity'] + $qty, (int) ($invRow['allocated'] ?? 0), 'Available');
      } else {
        try {
          $insertInv = $pdo->prepare('
            INSERT INTO inventory_items (
              code, item_name, category, item_type, brand, variant, 
              quantity, unit, stock_state, low_stock_threshold
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'Available\', ?)
          ');
          $insertInv->execute([
            generate_code('INV'),
            $itemName,
            $cat,
            $itemType,
            $brand,
            $variant,
            $qty,
            $unit,
            $lowStock
          ]);
        } catch (PDOException $e) {
          if (str_contains($e->getMessage(), 'stock_state') || $e->getCode() === '42S22' || str_contains((string) $e->getCode(), '1054')) {
            $insertInv = $pdo->prepare('
              INSERT INTO inventory_items (
                code, item_name, category, item_type, brand, variant, 
                quantity, unit, low_stock_threshold
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $insertInv->execute([
              generate_code('INV'),
              $itemName,
              $cat,
              $itemType,
              $brand,
              $variant,
              $qty,
              $unit,
              $lowStock
            ]);
          } else {
            throw $e;
          }
        }
      }
      $inventoryAddedCount += $qty;
    }

    ensure_donation_classified_columns($pdo);
    $encodedJson = json_encode($classifiedItems);
    $pdo->prepare('
      UPDATE donations 
      SET status = ?, 
          classified_items_json = ?, 
          inventory_posted_at = NOW() 
      WHERE id = ?
    ')->execute([$newStatus, $encodedJson, $id]);

    $accountProvision = null;
    if ($becomingVerified) {
      $accountProvision = provision_donor_from_donation($pdo, $existing);
    }

    $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
    $stmt->execute([$id]);
    $donation = map_donation($stmt->fetch(), $pdo);

    $summaryText = implode(', ', $itemSummaryList);
    $stageNote = "Donation verified and intaked into inventory: {$summaryText}.";
    if (!empty($accountProvision['created'])) {
      $stageNote .= ' Donor portal account created and credentials emailed.';
    } elseif (empty($accountProvision['created']) && empty($accountProvision['error'])) {
      $stageNote .= ' Existing donor account linked.';
    }

    record_donation_update(
      $pdo,
      (int) $id,
      'Sorted',
      $stageNote,
      $user ?? current_user()
    );

    notify_admins(
      $pdo, 
      'donation', 
      'In-Kind Donation Classified & Verified', 
      "{$donation['donor']} donation {$donation['trackingCode']} was classified and added to warehouse inventory.",
      '/admin/inventory'
    );

    audit_log(
      $pdo, 
      'update', 
      'donation', 
      $existing['tracking_code'], 
      "Verified & classified in-kind donation into inventory ({$summaryText})"
    );

    json_response([
      'ok' => true,
      'data' => $donation,
      'accountCreated' => !empty($accountProvision['created']),
      'credentialsSent' => !empty($accountProvision['mail']['sent']),
      'itemsClassified' => count($classifiedItems),
      'totalQuantityAdded' => $inventoryAddedCount
    ]);
  }

  $status = trim((string) ($body['status'] ?? $existing['status']));
  assert_valid_status_transition(
    'Donation',
    (string) ($existing['status'] ?? ''),
    $status,
    WORKFLOW_DONATION_STEPS,
    WORKFLOW_DONATION_TERMINAL,
    WORKFLOW_DONATION_BRANCHES
  );

  $donorName = trim((string) ($body['donorName'] ?? $existing['donor_name']));
  $type = ($body['type'] ?? $existing['type']) === 'In-Kind' ? 'In-Kind' : 'Monetary';
  $amount = $type === 'Monetary' ? (float) ($body['amountRaw'] ?? $body['amount'] ?? $existing['amount']) : null;
  $items = $type === 'In-Kind' ? trim((string) ($body['itemsDescription'] ?? $existing['items_description'])) : null;
  $donationDate = (string) ($body['donationDate'] ?? $existing['donation_date']);

  $becomingVerified = $status === 'Verified' && ($existing['status'] ?? '') !== 'Verified';

  $category = array_key_exists('category', $body) ? (trim((string) $body['category']) ?: null) : ($existing['category'] ?? null);
  $paymentMethod = array_key_exists('paymentMethod', $body)
    ? (trim((string) $body['paymentMethod']) ?: null)
    : (array_key_exists('payment_method', $body) ? (trim((string) $body['payment_method']) ?: null) : ($existing['payment_method'] ?? null));
  $paymentReference = array_key_exists('paymentReference', $body)
    ? (trim((string) $body['paymentReference']) ?: null)
    : (array_key_exists('payment_reference', $body) ? (trim((string) $body['payment_reference']) ?: null) : ($existing['payment_reference'] ?? null));

  $update = $pdo->prepare('UPDATE donations SET donor_name = ?, type = ?, category = ?, amount = ?, items_description = ?, payment_method = ?, payment_reference = ?, status = ?, donation_date = ? WHERE id = ?');
  $update->execute([$donorName, $type, $category, $amount, $items, $paymentMethod, $paymentReference, $status, $donationDate, $id]);

  $accountProvision = null;
  $inventoryPosted = false;
  if ($becomingVerified) {
    $accountProvision = provision_donor_from_donation($pdo, $existing);
    try {
      post_donation_to_inventory_packs($pdo, array_merge($existing, [
        'type' => $type,
        'category' => $category,
        'items_description' => $items,
      ]));
      $inventoryPosted = ($type === 'In-Kind');
    } catch (Throwable $e) {
      error_log('[inventory post] ' . $e->getMessage());
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
  $stmt->execute([$id]);
  $donation = map_donation($stmt->fetch());
  if ($status !== $existing['status']) {
    $stageFromStatus = match ($status) {
      'Pending Verification' => 'Donation Received',
      'Verified' => 'Sorted',
      'Allocated' => 'Scheduled for Distribution',
      'Distributed' => 'In Transit',
      'Completed' => 'Delivered',
      default => $status,
    };
    $note = "Status changed to {$status}.";
    if ($becomingVerified && !empty($accountProvision['created'])) {
      $note .= ' Donor portal account created and credentials emailed.';
    } elseif ($becomingVerified && empty($accountProvision['created']) && empty($accountProvision['error'])) {
      $note .= ' Existing donor account linked.';
    }
    if ($inventoryPosted) {
      $note .= ' In-kind items posted to inventory as packs.';
    }
    record_donation_update(
      $pdo,
      (int) $id,
      $stageFromStatus,
      $note,
      $user ?? current_user()
    );
    notify_admins($pdo, 'status_update', 'Donation status updated', "{$donation['trackingCode']} is now {$status}", '/admin/donations');
    // Email donors only on high-value milestones (avoids mid-hop spam + doubles with stage posts).
    if (lifecycle_mail_allowed('donation', (string) $status) && !empty($existing['donor_email'])) {
      $tracking = htmlspecialchars((string) $existing['tracking_code'], ENT_QUOTES, 'UTF-8');
      $statusSafe = htmlspecialchars((string) $status, ENT_QUOTES, 'UTF-8');
      $extra = ($becomingVerified && !empty($accountProvision['created']))
        ? '<p style="margin:0 0 12px;line-height:1.6;color:#475569">A donor portal account was created. Check your inbox for sign-in details, then choose a new password after you sign in.</p>'
        : '<p style="margin:0 0 12px;line-height:1.6;color:#475569">You can track full progress anytime from your donor portal.</p>';
      send_lifecycle_email(
        (string) $existing['donor_email'],
        (string) $existing['donor_name'],
        "Update on your donation {$existing['tracking_code']}",
        "Donation status: {$status}",
        "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Your donation <strong>{$tracking}</strong> is now <strong>{$statusSafe}</strong>.</p>" . $extra,
        '/donor/donations',
        'Open donor portal'
      );
    }
  }
  audit_log($pdo, 'update', 'donation', $existing['tracking_code'], "Updated donation" . ($status !== $existing['status'] ? " (status: {$status})" : ''));
  json_response([
    'ok' => true,
    'data' => $donation,
    'accountCreated' => !empty($accountProvision['created']),
    'credentialsSent' => !empty($accountProvision['mail']['sent']),
  ]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
