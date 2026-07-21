<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$user = require_auth(['Admin', 'Staff']);

if ($method === 'GET') {
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
}

if ($method === 'POST') {
  require_auth(['Admin']);
  $body = read_json_body();

  $name = trim((string) ($body['name'] ?? ''));
  $email = strtolower(trim((string) ($body['email'] ?? '')));
  $role = ucfirst(strtolower(trim((string) ($body['role'] ?? 'Staff'))));
  if (!in_array($role, ['Admin', 'Staff'], true)) {
    json_response(['ok' => false, 'error' => 'Role must be Admin or Staff'], 400);
  }
  if ($name === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Name and a valid email are required'], 400);
  }
  if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
    json_response(['ok' => false, 'error' => 'User must accept the Data Privacy Policy and Terms & Conditions'], 400);
  }
  if (email_taken($pdo, $email)) {
    json_response(['ok' => false, 'error' => 'An account with this email already exists'], 409);
  }

  $password = generate_temp_password();
  $userId = create_user_account($pdo, $role, $name, $email, $password, 'ACTIVE');
  $pdo->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = ?')->execute([$userId]);
  accept_privacy_terms($pdo, $userId);
  $mail = send_account_credentials($email, $name, $email, $password, $role);
  $sent = (bool) ($mail['sent'] ?? false);
  $transport = (string) ($mail['transport'] ?? '');

  json_response([
    'ok' => true,
    'data' => [
      'id' => 'STF-' . str_pad((string) $userId, 3, '0', STR_PAD_LEFT),
      'dbId' => $userId,
      'name' => $name,
      'email' => $email,
      'role' => $role,
      'department' => $role === 'Admin' ? 'Management' : 'Operations',
      'status' => 'Active',
    ],
    'credentialsSent' => $sent && in_array($transport, ['nodemailer', 'smtp'], true),
    'mailTransport' => $transport,
    'mailError' => (string) ($mail['error'] ?? ''),
    'temporaryPassword' => (!$sent || $transport === 'outbox') ? $password : null,
  ], 201);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
