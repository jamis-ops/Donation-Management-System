<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$user = current_user();
if (!$user) {
  json_response(['ok' => false, 'user' => null], 200);
}

$token = generate_auth_token($user, 86400 * 30);

// Super Admin is not a database user — return session as-is.
if (is_super_admin_user($user)) {
  $user = array_merge(make_super_admin_session_user(), [
    'name' => $user['name'] ?? SUPER_ADMIN_NAME,
  ]);
  $user['isSuperAdmin'] = true;
  $_SESSION['user'] = $user;
  json_response(['ok' => true, 'user' => $user, 'token' => $token], 200);
}

// Refresh must_change_password / photo from DB when possible
try {
  $pdo = db();
  $stmt = $pdo->prepare('SELECT must_change_password, profile_photo, full_name, phone, recovery_phone FROM users WHERE id = ? LIMIT 1');
  $stmt->execute([(int) $user['id']]);
  $row = $stmt->fetch();
  if ($row) {
    $user['mustChangePassword'] = (bool) ($row['must_change_password'] ?? false);
    $user['name'] = $row['full_name'] ?? $user['name'];
    $user['phone'] = $row['phone'] ?? ($user['phone'] ?? '');
    $user['recoveryPhone'] = $row['recovery_phone'] ?? ($user['recoveryPhone'] ?? '');
    $user['profilePhoto'] = !empty($row['profile_photo'])
      ? ('/api/uploads/profiles/' . basename((string) $row['profile_photo']))
      : null;
    $user['isSuperAdmin'] = false;
    $_SESSION['user'] = $user;
  }
} catch (Throwable $e) {
  // ignore — session user still returned
}

json_response(['ok' => true, 'user' => $user, 'token' => $token], 200);
