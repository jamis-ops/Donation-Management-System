<?php
declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

function current_user(): ?array
{
  return $_SESSION['user'] ?? null;
}

function require_auth(?array $roles = null): array
{
  $user = current_user();
  if (!$user) {
    json_response(['ok' => false, 'error' => 'Authentication required. Please log in.'], 401);
  }
  if ($roles !== null && !in_array($user['role'], $roles, true)) {
    json_response(['ok' => false, 'error' => 'You do not have permission for this action.'], 403);
  }
  return $user;
}

function request_method(): string
{
  $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
  if ($method === 'POST') {
    $body = read_json_body();
    $override = $_POST['_method'] ?? ($body['_method'] ?? null);
    if (is_string($override) && $override !== '') {
      return strtoupper($override);
    }
  }
  return $method;
}

function get_id_param(): ?int
{
  if (!isset($_GET['id']) || $_GET['id'] === '') {
    return null;
  }
  return (int) $_GET['id'];
}

function generate_code(string $prefix): string
{
  return $prefix . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
}

function format_date(?string $date): string
{
  if (!$date) {
    return '—';
  }
  $ts = strtotime($date);
  return $ts ? date('Y-m-d', $ts) : '—';
}

function decode_programs(?string $json): array
{
  if (!$json) {
    return [];
  }
  $data = json_decode($json, true);
  return is_array($data) ? $data : [];
}

function inventory_status(int $quantity, int $threshold): string
{
  return $quantity <= $threshold ? 'Low Stock' : 'Available';
}

function stock_level(int $quantity, int $lowThreshold, ?int $moderateThreshold = null): string
{
  $moderate = $moderateThreshold ?? max($lowThreshold * 2, $lowThreshold + 1);
  if ($quantity <= $lowThreshold) {
    return 'low';
  }
  if ($quantity <= $moderate) {
    return 'moderate';
  }
  return 'sufficient';
}

function stock_level_label(string $level): string
{
  return match ($level) {
    'low' => 'Low Stock',
    'moderate' => 'Moderate',
    default => 'Sufficient',
  };
}

function create_notification(PDO $pdo, string $type, string $title, string $message, ?string $link = null, ?int $userId = null, ?string $roleTarget = null): void
{
  $stmt = $pdo->prepare('INSERT INTO notifications (user_id, role_target, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)');
  $stmt->execute([$userId, $roleTarget, $type, $title, $message, $link]);
}

function notify_admins(PDO $pdo, string $type, string $title, string $message, ?string $link = null): void
{
  create_notification($pdo, $type, $title, $message, $link, null, 'Admin');
  create_notification($pdo, $type, $title, $message, $link, null, 'Staff');
}

function distribution_workflow_steps(): array
{
  return ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed'];
}

function money_display(string $type, $amount, ?string $items = null): string
{
  if ($type === 'In-Kind') {
    return $items ?: ((string) ($amount ?? 'In-kind donation'));
  }
  if ($amount === null || $amount === '') {
    return '₱0';
  }
  $value = (float) $amount;
  return '₱' . number_format($value, $value == floor($value) ? 0 : 2);
}
