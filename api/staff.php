<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();
// Portal access: SuperAdmin (hardcoded) or database Admin/Staff.
$user = require_auth(['SuperAdmin', 'Admin', 'Staff']);

function map_staff_user(array $row): array
{
  $statusRaw = (string) ($row['status'] ?? 'ACTIVE');
  $statusLabel = match ($statusRaw) {
    'ACTIVE' => 'Active',
    'DISABLED' => 'Inactive',
    'PENDING' => 'Pending',
    default => $statusRaw,
  };
  return [
    'id' => 'STF-' . str_pad((string) $row['id'], 3, '0', STR_PAD_LEFT),
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'firstName' => $row['first_name'] ?? '',
    'lastName' => $row['last_name'] ?? '',
    'middleInitial' => $row['middle_initial'] ?? '',
    'email' => $row['email'],
    'phone' => $row['phone'] ?? '',
    'role' => $row['role_name'],
    'department' => $row['role_name'] === 'Admin' ? 'Management' : 'Operations',
    'status' => $statusLabel,
    'statusRaw' => $statusRaw,
    'mustChangePassword' => (bool) ($row['must_change_password'] ?? false),
  ];
}

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare("
      SELECT u.*, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name IN ('Staff', 'Admin')
      LIMIT 1
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Staff account not found'], 404);
    }
    // Regular Admin may view Staff; only Super Admin may view Admin accounts.
    if (($row['role_name'] ?? '') === 'Admin' && !is_super_admin_user($user)) {
      json_response(['ok' => false, 'error' => 'Only the Super Admin can manage Admin accounts'], 403);
    }
    json_response(['ok' => true, 'data' => map_staff_user($row)]);
  }

  if (is_super_admin_user($user)) {
    $rows = $pdo->query("
      SELECT u.*, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('Staff', 'Admin')
      ORDER BY r.name ASC, u.full_name ASC
    ")->fetchAll();
  } else {
    // Database Admin / Staff: Staff directory only (no Admin accounts).
    $rows = $pdo->query("
      SELECT u.*, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'Staff'
      ORDER BY u.full_name ASC
    ")->fetchAll();
  }

  json_response(['ok' => true, 'data' => array_map('map_staff_user', $rows)]);
}

if ($method === 'POST') {
  // Creating accounts requires at least Admin portal privileges (SuperAdmin inherits).
  require_auth(['SuperAdmin', 'Admin']);
  $body = read_json_body();

  [$last, $first, $mi, $name] = read_name_parts($body);
  $email = require_valid_email((string) ($body['email'] ?? ''), 'Email');
  $role = ucfirst(strtolower(trim((string) ($body['role'] ?? 'Staff'))));
  $phone = require_valid_ph_mobile($body['phone'] ?? '', false, 'Phone');

  if (!in_array($role, ['Admin', 'Staff'], true)) {
    json_response(['ok' => false, 'error' => 'Role must be Admin or Staff'], 400);
  }

  // Only hardcoded Super Admin may create database Admin accounts + email credentials.
  if ($role === 'Admin' && !is_super_admin_user($user)) {
    json_response([
      'ok' => false,
      'error' => 'Only the Super Admin can create Admin accounts and send their credentials.',
    ], 403);
  }

  // Database Admin may create Staff only.
  if ($role === 'Staff' && !is_super_admin_user($user) && strcasecmp((string) ($user['role'] ?? ''), 'Admin') !== 0) {
    json_response(['ok' => false, 'error' => 'You do not have permission to create staff accounts'], 403);
  }

  if ($last === '' || $first === '') {
    json_response(['ok' => false, 'error' => 'Last Name and First Name are required'], 400);
  }
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Name is required'], 400);
  }
  if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
    json_response(['ok' => false, 'error' => 'User must accept the Data Privacy Policy and Terms & Conditions'], 400);
  }
  if (email_taken($pdo, $email)) {
    json_response(['ok' => false, 'error' => 'An account with this email already exists'], 409);
  }
  if (is_super_admin_email($email)) {
    json_response(['ok' => false, 'error' => 'This email is reserved for the system Super Admin account'], 409);
  }

  $password = generate_temp_password();
  $userId = create_user_account(
    $pdo,
    $role,
    $name,
    $email,
    $password,
    'ACTIVE',
    true,
    ['lastName' => $last, 'firstName' => $first, 'middleInitial' => $mi]
  );
  if ($phone !== '') {
    $pdo->prepare('UPDATE users SET phone = ? WHERE id = ?')->execute([$phone, $userId]);
  }
  $pdo->prepare('UPDATE users SET email_verified_at = NOW(), must_change_password = 1 WHERE id = ?')->execute([$userId]);
  accept_privacy_terms($pdo, $userId);

  $mail = send_account_credentials($email, $name, $email, $password, $role);
  $sent = (bool) ($mail['sent'] ?? false);
  $transport = (string) ($mail['transport'] ?? '');
  $credentialsSent = $sent && in_array($transport, ['nodemailer', 'smtp', 'outbox', 'mail'], true);

  $payload = [
    'ok' => true,
    'data' => [
      'id' => 'STF-' . str_pad((string) $userId, 3, '0', STR_PAD_LEFT),
      'dbId' => $userId,
      'name' => $name,
      'firstName' => $first,
      'lastName' => $last,
      'middleInitial' => $mi,
      'email' => $email,
      'phone' => $phone,
      'role' => $role,
      'department' => $role === 'Admin' ? 'Management' : 'Operations',
      'status' => 'Active',
    ],
    'credentialsSent' => $credentialsSent,
    'mailTransport' => $transport,
    'mailError' => $credentialsSent ? '' : (string) ($mail['error'] ?? 'Email not delivered'),
    'message' => $credentialsSent
      ? "{$role} account created and temporary login credentials were emailed successfully."
      : "{$role} account created. Credential email could not be sent — share the temporary password securely.",
  ];

  if (!$credentialsSent) {
    $payload['temporaryPassword'] = $password;
  }

  json_response($payload, 201);
}

if ($method === 'PUT') {
  require_auth(['SuperAdmin', 'Admin']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Staff id is required'], 400);
  }
  $body = read_json_body();
  $stmt = $pdo->prepare("
    SELECT u.*, r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ? AND r.name IN ('Staff', 'Admin')
    LIMIT 1
  ");
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Staff account not found'], 404);
  }

  $existingRole = (string) ($existing['role_name'] ?? 'Staff');

  // Only Super Admin may manage database Admin accounts.
  if ($existingRole === 'Admin' && !is_super_admin_user($user)) {
    json_response(['ok' => false, 'error' => 'Only the Super Admin can manage Admin accounts'], 403);
  }

  [$last, $first, $mi, $name] = read_name_parts(array_merge($existing, $body));
  if (array_key_exists('lastName', $body) || array_key_exists('firstName', $body) || array_key_exists('last_name', $body)) {
    [$last, $first, $mi, $name] = read_name_parts($body);
    if ($last === '' || $first === '') {
      json_response(['ok' => false, 'error' => 'Last Name and First Name are required'], 400);
    }
  } else {
    $last = $existing['last_name'] ?? '';
    $first = $existing['first_name'] ?? '';
    $mi = $existing['middle_initial'] ?? '';
    $name = $body['name'] ?? $existing['full_name'];
  }

  $email = require_valid_email((string) ($body['email'] ?? $existing['email'] ?? ''), 'Email');
  if (strcasecmp($email, (string) $existing['email']) !== 0 && email_taken($pdo, $email)) {
    json_response(['ok' => false, 'error' => 'An account with this email already exists'], 409);
  }
  if (is_super_admin_email($email)) {
    json_response(['ok' => false, 'error' => 'This email is reserved for the system Super Admin account'], 409);
  }

  $statusIn = $body['status'] ?? $existing['status'];
  $statusMap = [
    'Active' => 'ACTIVE',
    'ACTIVE' => 'ACTIVE',
    'Inactive' => 'DISABLED',
    'DISABLED' => 'DISABLED',
    'Pending' => 'PENDING',
    'PENDING' => 'PENDING',
  ];
  $status = $statusMap[$statusIn] ?? $existing['status'];

  $phone = array_key_exists('phone', $body)
    ? (require_valid_ph_mobile($body['phone'] ?? '', false, 'Phone') ?: null)
    : ($existing['phone'] ?? null);

  $pdo->prepare('UPDATE users SET full_name = ?, first_name = ?, last_name = ?, middle_initial = ?, email = ?, phone = ?, status = ? WHERE id = ?')
    ->execute([
      $name,
      $first !== '' ? $first : null,
      $last !== '' ? $last : null,
      $mi !== '' ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $mi) ?: '', 0, 1)) : null,
      $email,
      $phone,
      $status,
      $id,
    ]);

  $stmt = $pdo->prepare("
    SELECT u.*, r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  ");
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_staff_user($stmt->fetch())]);
}

if ($method === 'DELETE') {
  require_super_admin();
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Account id is required'], 400);
  }
  $stmt = $pdo->prepare("
    SELECT u.id, r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ? AND r.name IN ('Staff', 'Admin')
    LIMIT 1
  ");
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Account not found'], 404);
  }
  $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
  json_response(['ok' => true, 'message' => 'Account deleted']);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
