<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$user = require_auth(['Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary', 'SuperAdmin']);
$id = get_id_param();

/**
 * Roles this user may receive role-targeted notifications for.
 * SuperAdmin inherits the Admin inbox only (never Staff/Donor/etc.).
 */
function notification_roles_for_user(array $user): array
{
  $role = (string) ($user['role'] ?? '');
  $roles = [];
  if ($role !== '') {
    $roles[] = $role;
  }
  if (function_exists('is_super_admin_user') && is_super_admin_user($user)) {
    $roles[] = 'Admin';
  } elseif (strcasecmp($role, 'SuperAdmin') === 0) {
    $roles[] = 'Admin';
  }
  // Unique, preserve order
  $out = [];
  foreach ($roles as $r) {
    if ($r !== '' && !in_array($r, $out, true)) {
      $out[] = $r;
    }
  }
  return $out;
}

/**
 * Visibility:
 * - user_id = me  → personal notification for this account only
 * - user_id IS NULL AND role_target IN my roles → role inbox (Admin/Staff/…)
 * Never expose another user's personal notifications, and never treat
 * role_target IS NULL as a broadcast to every portal.
 */
function notification_visibility_sql(array $roles): array
{
  if (count($roles) === 0) {
    return ['(user_id = ?)', []];
  }
  $placeholders = implode(', ', array_fill(0, count($roles), '?'));
  $sql = "(user_id = ? OR (user_id IS NULL AND role_target IN ({$placeholders})))";
  return [$sql, $roles];
}

function map_notification(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'type' => $row['type'],
    'title' => $row['title'],
    'message' => $row['message'],
    'link' => $row['link'],
    'isRead' => (bool) $row['is_read'],
    'createdAt' => $row['created_at'],
    'timeAgo' => format_time_ago($row['created_at']),
  ];
}

function format_time_ago(string $datetime): string
{
  $ts = strtotime($datetime);
  $diff = time() - $ts;
  if ($diff < 60) return 'Just now';
  if ($diff < 3600) return floor($diff / 60) . ' min ago';
  if ($diff < 86400) return floor($diff / 3600) . ' hr ago';
  return date('M j, Y g:i A', $ts);
}

$roles = notification_roles_for_user($user);
[$visibilitySql, $roleParams] = notification_visibility_sql($roles);
$userId = (int) $user['id'];

if ($method === 'GET') {
  $unreadOnly = isset($_GET['unread']) && $_GET['unread'] === '1';

  $sql = "SELECT * FROM notifications WHERE {$visibilitySql}";
  if ($unreadOnly) {
    $sql .= ' AND is_read = 0';
  }
  $sql .= ' ORDER BY created_at DESC LIMIT 50';

  $stmt = $pdo->prepare($sql);
  $stmt->execute(array_merge([$userId], $roleParams));
  $rows = $stmt->fetchAll();

  $countStmt = $pdo->prepare("
    SELECT COUNT(*) FROM notifications
    WHERE {$visibilitySql} AND is_read = 0
  ");
  $countStmt->execute(array_merge([$userId], $roleParams));
  $unreadCount = (int) $countStmt->fetchColumn();

  json_response([
    'ok' => true,
    'data' => array_map('map_notification', $rows),
    'unreadCount' => $unreadCount,
  ]);
}

$body = read_json_body();

if ($method === 'PUT' && $id) {
  $stmt = $pdo->prepare("
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND {$visibilitySql}
  ");
  $stmt->execute(array_merge([(int) $id, $userId], $roleParams));
  json_response(['ok' => true]);
}

if ($method === 'PUT' && isset($body['markAllRead'])) {
  $stmt = $pdo->prepare("
    UPDATE notifications SET is_read = 1
    WHERE {$visibilitySql}
  ");
  $stmt->execute(array_merge([$userId], $roleParams));
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
