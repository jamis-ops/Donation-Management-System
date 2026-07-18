<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$user = require_auth(['Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary']);
$id = get_id_param();

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

if ($method === 'GET') {
  $unreadOnly = isset($_GET['unread']) && $_GET['unread'] === '1';

  $sql = '
    SELECT * FROM notifications
    WHERE (user_id = ? OR role_target = ? OR role_target IS NULL)
  ';
  if ($unreadOnly) {
    $sql .= ' AND is_read = 0';
  }
  $sql .= ' ORDER BY created_at DESC LIMIT 50';

  $stmt = $pdo->prepare($sql);
  $stmt->execute([$user['id'], $user['role']]);
  $rows = $stmt->fetchAll();

  $countStmt = $pdo->prepare('
    SELECT COUNT(*) FROM notifications
    WHERE (user_id = ? OR role_target = ?) AND is_read = 0
  ');
  $countStmt->execute([$user['id'], $user['role']]);
  $unreadCount = (int) $countStmt->fetchColumn();

  json_response([
    'ok' => true,
    'data' => array_map('map_notification', $rows),
    'unreadCount' => $unreadCount,
  ]);
}

$body = read_json_body();

if ($method === 'PUT' && $id) {
  $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

if ($method === 'PUT' && isset($body['markAllRead'])) {
  $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR role_target = ?');
  $stmt->execute([$user['id'], $user['role']]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
