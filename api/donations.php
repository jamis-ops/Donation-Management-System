<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function donation_proof_is_image(?string $mime, ?string $fileName): bool
{
  $mime = (string) $mime;
  $fileName = (string) $fileName;
  return str_starts_with($mime, 'image/')
    || (bool) preg_match('/\.(jpe?g|png|gif|webp)$/i', $fileName);
}

function map_donation(array $row): array
{
  $proofPath = $row['proof_path'] ?? null;
  $proofName = $row['proof_file_name'] ?? null;
  $proofType = $row['proof_file_type'] ?? null;
  $hasProof = !empty($proofPath);

  return [
    'id' => $row['tracking_code'],
    'dbId' => (int) $row['id'],
    'trackingCode' => $row['tracking_code'],
    'donor' => $row['donor_name'],
    'donorEmail' => $row['donor_email'],
    'type' => $row['type'],
    'category' => $row['category'] ?? '',
    'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
    'amountRaw' => $row['amount'],
    'itemsDescription' => $row['items_description'],
    'status' => $row['status'],
    'date' => format_date($row['donation_date']),
    'donationDate' => $row['donation_date'],
    'notes' => $row['notes'],
    'paymentMethod' => $row['payment_method'] ?? '',
    'hasProof' => $hasProof,
    'proofFileName' => $proofName,
    'proofFileType' => $proofType,
    'proofIsImage' => $hasProof && donation_proof_is_image($proofType, $proofName),
    'proofUrl' => $hasProof ? ('/api/uploads/donation_proofs/' . basename((string) $proofPath)) : null,
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
  $isMultipart = isset($_SERVER['CONTENT_TYPE'])
    && stripos((string) $_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;

  if ($isMultipart) {
    $body = $_POST;
    $public = !empty($body['public']);
  } else {
    $body = read_json_body();
    $public = !empty($body['public']);
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
  $phone = trim((string) ($body['phone'] ?? ''));
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
  $category = trim((string) ($body['category'] ?? '')) ?: null;

  $proof = $isMultipart ? save_donation_proof_upload() : null;

  if ($public) {
    if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
      json_response(['ok' => false, 'error' => 'You must accept the Data Privacy Policy and Terms & Conditions'], 400);
    }
    if ($donorEmail === '' || !filter_var($donorEmail, FILTER_VALIDATE_EMAIL)) {
      json_response(['ok' => false, 'error' => 'A valid email is required'], 400);
    }
    if (!$proof) {
      json_response(['ok' => false, 'error' => 'Proof of donation is required (receipt, bank slip, GCash screenshot, or OR)'], 400);
    }
    $status = 'Pending Verification';
  }

  $donorId = null;
  if ($donorEmail !== '') {
    $find = $pdo->prepare('SELECT id FROM donors WHERE email = ? LIMIT 1');
    $find->execute([$donorEmail]);
    $existingDonorId = $find->fetchColumn();

    if ($existingDonorId) {
      $donorId = (int) $existingDonorId;
      // Public give-now: refresh profile fields from the form.
      if ($public) {
        $upd = $pdo->prepare('
          UPDATE donors
          SET full_name = ?, first_name = ?, last_name = ?, middle_initial = ?,
              donor_type = ?, organization = ?, contact_person = ?,
              phone = COALESCE(NULLIF(?, ""), phone),
              country = COALESCE(NULLIF(?, ""), country),
              address = COALESCE(NULLIF(?, ""), address)
          WHERE id = ?
        ');
        $upd->execute([
          $fullName,
          $firstName !== '' ? $firstName : null,
          $lastName !== '' ? $lastName : null,
          $miDb,
          $donorType,
          $organization !== '' ? $organization : null,
          $contactPerson !== '' ? $contactPerson : null,
          $phone,
          $country,
          $address,
          $donorId,
        ]);
      }
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
      (tracking_code, donor_id, donor_name, donor_email, type, category, amount, items_description, status, donation_date, notes, payment_method, proof_path, proof_file_name, proof_file_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    $proof['path'] ?? null,
    $proof['name'] ?? null,
    $proof['type'] ?? null,
  ]);

  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT * FROM donations WHERE id = ?');
  $stmt->execute([$newId]);
  $donation = map_donation($stmt->fetch());
  $actor = $public ? ['name' => 'Public Donor'] : ($user ?? current_user());
  record_donation_update($pdo, $newId, 'Donation Received', 'Donation submitted and tracking code issued.', is_array($actor) ? $actor : null);
  notify_admins($pdo, 'donation', 'New donation received', "{$donation['donor']} submitted {$donation['amount']} ({$donation['trackingCode']})", '/admin/donations');
  audit_log($pdo, 'create', 'donation', $tracking, "{$donorName} donated {$donation['amount']}", $public ? ['name' => $donorName, 'role' => 'Public'] : null);
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
    if (strcasecmp((string) $row['donor_email'], (string) $user['email']) !== 0) {
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

  $status = trim((string) ($body['status'] ?? $existing['status']));
  $donorName = trim((string) ($body['donorName'] ?? $existing['donor_name']));
  $type = ($body['type'] ?? $existing['type']) === 'In-Kind' ? 'In-Kind' : 'Monetary';
  $amount = $type === 'Monetary' ? (float) ($body['amountRaw'] ?? $body['amount'] ?? $existing['amount']) : null;
  $items = $type === 'In-Kind' ? trim((string) ($body['itemsDescription'] ?? $existing['items_description'])) : null;
  $donationDate = (string) ($body['donationDate'] ?? $existing['donation_date']);

  $becomingVerified = $status === 'Verified' && ($existing['status'] ?? '') !== 'Verified';
  if ($becomingVerified && empty($existing['proof_path'])) {
    json_response(['ok' => false, 'error' => 'Cannot approve: proof of donation is required. Ask the donor to resubmit with proof.'], 400);
  }

  $category = array_key_exists('category', $body) ? (trim((string) $body['category']) ?: null) : ($existing['category'] ?? null);
  $update = $pdo->prepare('UPDATE donations SET donor_name = ?, type = ?, category = ?, amount = ?, items_description = ?, status = ?, donation_date = ? WHERE id = ?');
  $update->execute([$donorName, $type, $category, $amount, $items, $status, $donationDate, $id]);

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
    if (!empty($existing['donor_email'])) {
      send_mail(
        $existing['donor_email'],
        $existing['donor_name'],
        "Donation {$existing['tracking_code']} status update",
        "<p>Hello {$existing['donor_name']},</p>"
          . "<p>Your donation <strong>{$existing['tracking_code']}</strong> has been updated to "
          . "<strong>{$status}</strong>.</p>"
          . ($becomingVerified && !empty($accountProvision['created'])
            ? '<p>A donor portal account was created. Check your email for temporary login credentials, then change your password on first sign-in.</p>'
            : '<p>You can track its full progress anytime from your donor portal.</p>')
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
