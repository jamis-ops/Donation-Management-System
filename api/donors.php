<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function donor_display_name(array $row): string
{
  $org = trim((string) ($row['organization'] ?? ''));
  $name = trim((string) ($row['full_name'] ?? ''));
  return $org !== '' ? $org : $name;
}

function map_donor(PDO $pdo, array $row): array
{
  $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM donations WHERE donor_id = ? AND type = ?');
  $stmt->execute([$row['id'], 'Monetary']);
  $stats = $stmt->fetch();

  $last = $pdo->prepare('SELECT donation_date FROM donations WHERE donor_id = ? ORDER BY donation_date DESC LIMIT 1');
  $last->execute([$row['id']]);
  $lastDate = $last->fetchColumn();

  $hasAccount = !empty($row['user_id']);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => donor_display_name($row),
    'fullName' => $row['full_name'] ?? '',
    'firstName' => $row['first_name'] ?? '',
    'lastName' => $row['last_name'] ?? '',
    'middleInitial' => $row['middle_initial'] ?? '',
    'donorType' => $row['donor_type'] ?? 'Individual',
    'organization' => $row['organization'] ?? '',
    'contactPerson' => $row['contact_person'] ?? '',
    'email' => $row['email'] ?? '',
    'phone' => $row['phone'] ?? '',
    'country' => $row['country'] ?? '',
    'address' => $row['address'] ?? '',
    'notes' => $row['notes'] ?? '',
    'hasAccount' => $hasAccount,
    'userId' => $hasAccount ? (int) $row['user_id'] : null,
    'totalDonated' => '₱' . number_format((float) $stats['total']),
    'donations' => (int) $stats['cnt'],
    'lastDonation' => format_date($lastDate ?: null),
  ];
}

function donor_duplicate_exists(PDO $pdo, string $name, string $organization, ?int $excludeId = null): bool
{
  $name = trim($name);
  $organization = trim($organization);
  $checks = [];
  $params = [];

  if ($name !== '') {
    $checks[] = 'LOWER(full_name) = LOWER(?)';
    $params[] = $name;
    $checks[] = '(organization IS NOT NULL AND organization <> "" AND LOWER(organization) = LOWER(?))';
    $params[] = $name;
  }
  if ($organization !== '') {
    $checks[] = 'LOWER(full_name) = LOWER(?)';
    $params[] = $organization;
    $checks[] = '(organization IS NOT NULL AND organization <> "" AND LOWER(organization) = LOWER(?))';
    $params[] = $organization;
  }
  if (!$checks) {
    return false;
  }

  $sql = 'SELECT id FROM donors WHERE (' . implode(' OR ', $checks) . ')';
  if ($excludeId) {
    $sql .= ' AND id <> ?';
    $params[] = $excludeId;
  }
  $sql .= ' LIMIT 1';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  return (bool) $stmt->fetchColumn();
}

function read_donor_fields(array $body, ?array $existing = null): array
{
  $donorTypeRaw = trim((string) ($body['donorType'] ?? $body['donor_type'] ?? ($existing['donor_type'] ?? 'Individual')));
  $donorType = strcasecmp($donorTypeRaw, 'Company') === 0 || strcasecmp($donorTypeRaw, 'Organization') === 0 || strcasecmp($donorTypeRaw, 'Company/Organization') === 0
    ? 'Company'
    : 'Individual';

  $organization = trim((string) ($body['organization'] ?? $body['company'] ?? ($existing['organization'] ?? '')));
  [$lastName, $firstName, $middleInitial, $composed] = read_name_parts($body);
  if ($lastName === '' && $firstName === '' && $existing) {
    $lastName = trim((string) ($existing['last_name'] ?? ''));
    $firstName = trim((string) ($existing['first_name'] ?? ''));
    $middleInitial = trim((string) ($existing['middle_initial'] ?? ''));
    if ($lastName !== '' || $firstName !== '') {
      $composed = format_full_name($lastName, $firstName, $middleInitial);
    }
  }
  $contactPerson = $composed !== ''
    ? $composed
    : trim((string) ($body['contactPerson'] ?? $body['contact_person'] ?? ($existing['contact_person'] ?? '')));
  $fullName = trim((string) ($body['fullName'] ?? $body['name'] ?? $body['full_name'] ?? ($existing['full_name'] ?? '')));
  $email = strtolower(trim((string) ($body['email'] ?? ($existing['email'] ?? ''))));
  $phone = trim((string) ($body['phone'] ?? $body['contactNumber'] ?? ($existing['phone'] ?? '')));
  $country = trim((string) ($body['country'] ?? ($existing['country'] ?? '')));
  $address = trim((string) ($body['address'] ?? ($existing['address'] ?? '')));
  $notes = trim((string) ($body['notes'] ?? ($existing['notes'] ?? '')));

  if ($donorType === 'Individual') {
    $organization = '';
    if ($fullName === '' && $contactPerson !== '') {
      $fullName = $contactPerson;
    }
    if ($contactPerson === '' && $fullName !== '') {
      $contactPerson = $fullName;
    }
  } else {
    if ($organization === '') {
      // keep empty — caller validates required
    }
    if ($fullName === '' && $organization !== '') {
      $fullName = $organization;
    }
    if ($contactPerson === '' && $fullName !== '' && $organization !== '' && strcasecmp($fullName, $organization) !== 0) {
      $contactPerson = $fullName;
    }
  }

  $miDb = $middleInitial !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
    : null;

  return compact('donorType', 'fullName', 'organization', 'contactPerson', 'email', 'phone', 'country', 'address', 'notes', 'firstName', 'lastName', 'middleInitial', 'miDb');
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
  $rows = $pdo->query('SELECT * FROM donors ORDER BY COALESCE(NULLIF(organization, ""), full_name) ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_donor($pdo, $r), $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  $fields = read_donor_fields($body);
  if ($fields['donorType'] === 'Company' && $fields['organization'] === '') {
    json_response(['ok' => false, 'error' => 'Company / Organization Name is required for company donors'], 400);
  }
  if ($fields['contactPerson'] === '' && $fields['fullName'] === '') {
    json_response(['ok' => false, 'error' => 'Contact Person is required'], 400);
  }
  if ($fields['email'] === '' || !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'A valid email is required'], 400);
  }
  if (donor_duplicate_exists($pdo, $fields['fullName'], $fields['organization'])) {
    json_response(['ok' => false, 'error' => 'A donor with the same name or company already exists'], 409);
  }

  $createAccount = !empty($body['createAccount']);
  $acceptedPolicies = !empty($body['acceptedPolicies']) || !empty($body['termsAccepted']);
  if ($createAccount && !$acceptedPolicies) {
    json_response(['ok' => false, 'error' => 'Donor must accept the Data Privacy Policy and Terms & Conditions'], 400);
  }
  if ($createAccount && email_taken($pdo, $fields['email'])) {
    json_response(['ok' => false, 'error' => 'An account with this email already exists'], 409);
  }

  $userId = null;
  $tempPassword = null;
  $credentialsSent = false;

  try {
    $pdo->beginTransaction();

    if ($createAccount) {
      $tempPassword = generate_temp_password();
      $displayName = $fields['contactPerson'] !== '' ? $fields['contactPerson'] : $fields['fullName'];
      $userId = create_user_account($pdo, 'Donor', $displayName, $fields['email'], $tempPassword, 'ACTIVE', false, [
        'lastName' => $fields['lastName'],
        'firstName' => $fields['firstName'],
        'middleInitial' => $fields['middleInitial'],
      ]);
      $pdo->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = ?')->execute([$userId]);
      accept_privacy_terms($pdo, $userId);
    }

    $code = generate_code('DNR');
    $stmt = $pdo->prepare('
      INSERT INTO donors (code, full_name, first_name, last_name, middle_initial, donor_type, organization, contact_person, email, phone, country, address, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
      $code,
      $fields['fullName'],
      $fields['firstName'] !== '' ? $fields['firstName'] : null,
      $fields['lastName'] !== '' ? $fields['lastName'] : null,
      $fields['miDb'],
      $fields['donorType'],
      $fields['organization'] !== '' ? $fields['organization'] : null,
      $fields['contactPerson'] !== '' ? $fields['contactPerson'] : null,
      $fields['email'] !== '' ? $fields['email'] : null,
      $fields['phone'] !== '' ? $fields['phone'] : null,
      $fields['country'] !== '' ? $fields['country'] : null,
      $fields['address'] !== '' ? $fields['address'] : null,
      $fields['notes'] !== '' ? $fields['notes'] : null,
      $userId,
    ]);
    $newId = (int) $pdo->lastInsertId();
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => 'Could not save donor'], 500);
  }

  $credentialsSent = false;
  $mailTransport = '';
  $mailError = '';
  $tempPasswordForAdmin = null;

  if ($createAccount && $tempPassword) {
    $displayName = $fields['contactPerson'] !== '' ? $fields['contactPerson'] : $fields['fullName'];
    $mail = send_account_credentials($fields['email'], $displayName, $fields['email'], $tempPassword, 'Donor');
    $credentialsSent = (bool) ($mail['sent'] ?? false);
    $mailTransport = (string) ($mail['transport'] ?? '');
    $mailError = (string) ($mail['error'] ?? '');
    // If real SMTP delivery failed, return the temp password so the admin can share it securely.
    if (!$credentialsSent || $mailTransport === 'outbox') {
      $tempPasswordForAdmin = $tempPassword;
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ?');
  $stmt->execute([$newId]);
  json_response([
    'ok' => true,
    'data' => map_donor($pdo, $stmt->fetch()),
    'accountCreated' => (bool) $createAccount,
    'credentialsSent' => $credentialsSent && in_array($mailTransport, ['nodemailer', 'smtp'], true),
    'mailTransport' => $mailTransport,
    'mailError' => $mailError,
    'temporaryPassword' => $tempPasswordForAdmin,
  ], 201);
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

  // Create portal account for an existing donor profile.
  if (!empty($body['createAccount']) && empty($existing['user_id'])) {
    $email = strtolower(trim((string) ($body['email'] ?? $existing['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      json_response(['ok' => false, 'error' => 'A valid email is required to create an account'], 400);
    }
    if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
      json_response(['ok' => false, 'error' => 'Donor must accept the Data Privacy Policy and Terms & Conditions'], 400);
    }
    if (email_taken($pdo, $email)) {
      json_response(['ok' => false, 'error' => 'An account with this email already exists'], 409);
    }
    $tempPassword = generate_temp_password();
    $displayName = trim((string) ($existing['contact_person'] ?: $existing['full_name']));
    $userId = create_user_account($pdo, 'Donor', $displayName, $email, $tempPassword, 'ACTIVE');
    $pdo->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = ?')->execute([$userId]);
    accept_privacy_terms($pdo, $userId);
    $pdo->prepare('UPDATE donors SET user_id = ?, email = ? WHERE id = ?')->execute([$userId, $email, $id]);
    $mail = send_account_credentials($email, $displayName, $email, $tempPassword, 'Donor');
    $sent = (bool) ($mail['sent'] ?? false);
    $transport = (string) ($mail['transport'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ?');
    $stmt->execute([$id]);
    json_response([
      'ok' => true,
      'data' => map_donor($pdo, $stmt->fetch()),
      'accountCreated' => true,
      'credentialsSent' => $sent && in_array($transport, ['nodemailer', 'smtp'], true),
      'mailTransport' => $transport,
      'mailError' => (string) ($mail['error'] ?? ''),
      'temporaryPassword' => (!$sent || $transport === 'outbox') ? $tempPassword : null,
    ]);
  }

  $fields = read_donor_fields($body, $existing);
  if ($fields['donorType'] === 'Company' && $fields['organization'] === '') {
    json_response(['ok' => false, 'error' => 'Company / Organization Name is required for company donors'], 400);
  }
  if ($fields['contactPerson'] === '' && $fields['fullName'] === '') {
    json_response(['ok' => false, 'error' => 'Contact Person is required'], 400);
  }
  if (donor_duplicate_exists($pdo, $fields['fullName'], $fields['organization'], (int) $id)) {
    json_response(['ok' => false, 'error' => 'A donor with the same name or company already exists'], 409);
  }

  $update = $pdo->prepare('
    UPDATE donors
    SET full_name = ?, first_name = ?, last_name = ?, middle_initial = ?, donor_type = ?, organization = ?, contact_person = ?, email = ?, phone = ?, country = ?, address = ?, notes = ?
    WHERE id = ?
  ');
  $update->execute([
    $fields['fullName'],
    $fields['firstName'] !== '' ? $fields['firstName'] : null,
    $fields['lastName'] !== '' ? $fields['lastName'] : null,
    $fields['miDb'],
    $fields['donorType'],
    $fields['organization'] !== '' ? $fields['organization'] : null,
    $fields['contactPerson'] !== '' ? $fields['contactPerson'] : null,
    $fields['email'] !== '' ? $fields['email'] : null,
    $fields['phone'] !== '' ? $fields['phone'] : null,
    $fields['country'] !== '' ? $fields['country'] : null,
    $fields['address'] !== '' ? $fields['address'] : null,
    $fields['notes'] !== '' ? $fields['notes'] : null,
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

  $stmt = $pdo->prepare('SELECT * FROM donors WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $donor = $stmt->fetch();
  if (!$donor) {
    json_response(['ok' => false, 'error' => 'Donor not found'], 404);
  }

  try {
    $pdo->beginTransaction();

    // Keep donation history text, but detach the FK so the donor row can be removed.
    $pdo->prepare('UPDATE donations SET donor_id = NULL WHERE donor_id = ?')->execute([$id]);

    $userId = !empty($donor['user_id']) ? (int) $donor['user_id'] : null;
    $pdo->prepare('DELETE FROM donors WHERE id = ?')->execute([$id]);

    // Permanently remove the linked portal login when it is a Donor role account.
    if ($userId) {
      $roleStmt = $pdo->prepare("
        SELECT u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND r.name = 'Donor'
        LIMIT 1
      ");
      $roleStmt->execute([$userId]);
      if ($roleStmt->fetchColumn()) {
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
      }
    }

    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => 'Could not delete donor: ' . $e->getMessage()], 500);
  }

  json_response(['ok' => true, 'deleted' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
