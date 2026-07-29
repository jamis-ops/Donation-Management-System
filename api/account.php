<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$user = require_auth(['SuperAdmin', 'Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary']);

function map_account_user(PDO $pdo, int $userId): array
{
  $stmt = $pdo->prepare("
    SELECT u.id, u.full_name, u.email, u.phone, u.recovery_phone, u.profile_photo,
           u.must_change_password, u.status, r.name AS role
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
    LIMIT 1
  ");
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  if (!$row) {
    return [];
  }
  return [
    'id' => (int) $row['id'],
    'name' => $row['full_name'],
    'email' => $row['email'],
    'phone' => $row['phone'] ?? '',
    'recoveryPhone' => $row['recovery_phone'] ?? '',
    'profilePhoto' => $row['profile_photo']
      ? ('/api/uploads/profiles/' . basename((string) $row['profile_photo']))
      : null,
    'mustChangePassword' => (bool) ($row['must_change_password'] ?? false),
    'role' => $row['role'],
    'status' => $row['status'],
  ];
}

if ($method === 'GET') {
  if (is_super_admin_user($user)) {
    json_response([
      'ok' => true,
      'data' => [
        'id' => 0,
        'name' => $user['name'] ?? SUPER_ADMIN_NAME,
        'email' => $user['email'] ?? super_admin_email(),
        'phone' => '',
        'recoveryPhone' => '',
        'profilePhoto' => null,
        'mustChangePassword' => false,
        'role' => 'SuperAdmin',
        'isSuperAdmin' => true,
        'status' => 'ACTIVE',
      ],
    ]);
  }
  json_response(['ok' => true, 'data' => map_account_user($pdo, (int) $user['id'])]);
}

if ($method === 'PUT') {
  $body = read_json_body();
  $uid = (int) $user['id'];

  if (is_super_admin_user($user)) {
    json_response([
      'ok' => false,
      'error' => 'Super Admin credentials are defined in server configuration (api/super_admin_config.php or environment variables), not in the database. Update the password hash there instead of using this form.',
    ], 400);
  }

  // Change password
  if (!empty($body['newPassword']) || !empty($body['changePassword'])) {
    $current = (string) ($body['currentPassword'] ?? '');
    $new = (string) ($body['newPassword'] ?? '');
    if (strlen($new) < 6) {
      json_response(['ok' => false, 'error' => 'New password must be at least 6 characters'], 400);
    }
    $stmt = $pdo->prepare('SELECT password_hash, must_change_password FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'User not found'], 404);
    }
    $must = (bool) ($row['must_change_password'] ?? false);
    if (!$must) {
      if ($current === '' || !password_verify($current, $row['password_hash'])) {
        json_response(['ok' => false, 'error' => 'Current password is incorrect'], 400);
      }
    } elseif ($current !== '' && !password_verify($current, $row['password_hash'])) {
      json_response(['ok' => false, 'error' => 'Current password is incorrect'], 400);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
      ->execute([$hash, $uid]);
    $_SESSION['user']['mustChangePassword'] = false;
  }

  $fields = [];
  $params = [];
  if (array_key_exists('name', $body) && trim((string) $body['name']) !== '') {
    $fields[] = 'full_name = ?';
    $params[] = trim((string) $body['name']);
    $_SESSION['user']['name'] = trim((string) $body['name']);
  }
  if (array_key_exists('phone', $body)) {
    $fields[] = 'phone = ?';
    $params[] = trim((string) $body['phone']) ?: null;
  }
  if (array_key_exists('recoveryPhone', $body)) {
    $fields[] = 'recovery_phone = ?';
    $params[] = trim((string) $body['recoveryPhone']) ?: null;
  }
  if ($fields) {
    $params[] = $uid;
    $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
  }

  if (!empty($body['acceptedPolicies']) || !empty($body['termsAccepted'])) {
    accept_privacy_terms($pdo, $uid);
  }

  json_response(['ok' => true, 'data' => map_account_user($pdo, $uid)]);
}

// Profile photo upload
if ($method === 'POST') {
  if (!isset($_FILES['photo']) || $_FILES['photo']['error'] === UPLOAD_ERR_NO_FILE) {
    json_response(['ok' => false, 'error' => 'Photo file is required'], 400);
  }
  if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Photo upload failed'], 400);
  }
  $file = $_FILES['photo'];
  $mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
  if (!str_starts_with($mime, 'image/')) {
    json_response(['ok' => false, 'error' => 'Photo must be an image'], 400);
  }
  if ($file['size'] > 3 * 1024 * 1024) {
    json_response(['ok' => false, 'error' => 'Photo must be under 3MB'], 400);
  }
  $dir = __DIR__ . '/uploads/profiles';
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }
  $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
  $safe = 'profile_' . (int) $user['id'] . '_' . time() . '.' . $ext;
  if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $safe)) {
    json_response(['ok' => false, 'error' => 'Failed to save photo'], 500);
  }
  $pdo->prepare('UPDATE users SET profile_photo = ? WHERE id = ?')->execute([$safe, (int) $user['id']]);
  json_response(['ok' => true, 'data' => map_account_user($pdo, (int) $user['id'])]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
