<?php
declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

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

/**
 * The Audit Logs feature was removed. This no-op is kept so existing call sites
 * continue to work without change. It intentionally does nothing.
 */
function audit_log(PDO $pdo, string $action, ?string $entity = null, $entityId = null, ?string $details = null, ?array $actor = null): void
{
  // Audit logging removed by request — intentionally left blank.
}

/* ---------------- Account provisioning ---------------- */

function role_id(PDO $pdo, string $role): int
{
  $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = ? LIMIT 1');
  $stmt->execute([$role]);
  $id = $stmt->fetchColumn();
  if (!$id) {
    $pdo->prepare('INSERT INTO roles (name) VALUES (?)')->execute([$role]);
    $id = (int) $pdo->lastInsertId();
  }
  return (int) $id;
}

function email_taken(PDO $pdo, string $email): bool
{
  $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
  $stmt->execute([strtolower(trim($email))]);
  return (bool) $stmt->fetchColumn();
}

function create_user_account(PDO $pdo, string $role, string $name, string $email, string $password, string $status = 'ACTIVE'): int
{
  $rid = role_id($pdo, $role);
  $hash = password_hash($password, PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)');
  $stmt->execute([$rid, $name, strtolower(trim($email)), $hash, $status]);
  return (int) $pdo->lastInsertId();
}

/* ---------------- Email verification ---------------- */

function generate_verification_token(): string
{
  return bin2hex(random_bytes(32));
}

/**
 * Absolute URL for the React frontend (used in verification emails / redirects).
 */
function frontend_url(string $path = ''): string
{
  $base = defined('FRONTEND_URL') ? rtrim((string) FRONTEND_URL, '/') : 'http://localhost:5173';
  if ($path === '') {
    return $base;
  }
  return $base . '/' . ltrim($path, '/');
}

/**
 * Absolute URL to the API verify endpoint (fallback when the frontend is offline).
 */
function api_verify_url(string $token): string
{
  if (defined('API_PUBLIC_URL') && API_PUBLIC_URL !== '') {
    return rtrim((string) API_PUBLIC_URL, '/') . '/verify.php?token=' . urlencode($token);
  }
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
  $dir = rtrim($dir, '/');
  return "{$scheme}://{$host}{$dir}/verify.php?token=" . urlencode($token);
}

/**
 * Build the absolute URL a user clicks to verify their email.
 * Prefers the frontend /verify route so the user lands back in the app.
 */
function build_verify_url(string $token): string
{
  return frontend_url('/verify?token=' . urlencode($token));
}

/**
 * Send a "Verify it's you" activation email.
 * Returns ['url' => string, 'sent' => bool].
 */
function send_verification_email(string $toEmail, string $name, string $token): array
{
  $url = build_verify_url($token);
  $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
  $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');

  $subject = "Verify it's you";
  $html = "<p style=\"margin:0 0 12px;font-size:1.15rem;font-weight:700;color:#0f172a\">Verify it's you</p>"
    . "<p style=\"margin:0 0 14px\">Hi {$safeName},</p>"
    . '<p style="margin:0 0 14px">We received a request to create a <strong>Rise Above Foundation</strong> account with this email address. '
    . 'Click the button below to verify it\'s you and activate your account.</p>'
    . '<p style="margin:24px 0;text-align:center">'
    . '<a href="' . $safeUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">Verify it\'s you</a>'
    . '</p>'
    . '<p style="margin:0 0 10px;color:#64748b;font-size:0.88rem">Or copy and paste this link into your browser:</p>'
    . '<p style="margin:0 0 18px;word-break:break-all;font-size:0.85rem"><a href="' . $safeUrl . '" style="color:#2563eb">' . $safeUrl . '</a></p>'
    . '<p style="margin:0;color:#64748b;font-size:0.88rem">If you did not create this account, you can safely ignore this email.</p>';

  $sent = false;
  if (function_exists('send_mail')) {
    $sent = send_mail($toEmail, $name, $subject, $html);
  }
  return ['url' => $url, 'sent' => $sent];
}

/**
 * Legacy stub retained for compatibility — credential emails are no longer sent.
 */
function send_account_credentials(string $toEmail, string $name, string $loginEmail, string $password, string $role): bool
{
  error_log("[credentials] deprecated — accounts now self-register with email verification ({$toEmail})");
  return false;
}

function distribution_workflow_steps(): array
{
  return ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed'];
}

/**
 * Build searchable name fragments for matching a distribution location to a barangay.
 */
function beneficiary_location_keys(array $ben): array
{
  $keys = [];
  foreach (['full_name', 'barangay', 'municipality'] as $field) {
    $value = trim((string) ($ben[$field] ?? ''));
    if ($value === '') {
      continue;
    }
    $keys[] = $value;
    $stripped = preg_replace('/^(brgy\.?|barangay)\s+/i', '', $value);
    if (is_string($stripped) && $stripped !== '' && strcasecmp($stripped, $value) !== 0) {
      $keys[] = $stripped;
    }
  }
  return array_values(array_unique(array_filter($keys)));
}

/**
 * Whether a distribution event belongs to (or can be claimed by) this barangay.
 */
function distribution_belongs_to_beneficiary(array $dist, array $ben): bool
{
  $benId = (int) ($ben['id'] ?? 0);
  if ($benId <= 0) {
    return false;
  }
  if (!empty($dist['beneficiary_id'])) {
    return (int) $dist['beneficiary_id'] === $benId;
  }
  $location = strtolower((string) ($dist['location'] ?? ''));
  if ($location === '') {
    return false;
  }
  foreach (beneficiary_location_keys($ben) as $key) {
    if ($key !== '' && str_contains($location, strtolower($key))) {
      return true;
    }
  }
  return false;
}

/**
 * Build an ordered list of time buckets for a trend chart.
 * Returns [['key' => matchKey, 'label' => displayLabel], ...].
 *  - week:  last 8 ISO weeks (key matches YEARWEEK(col, 3))
 *  - month: last 6 months    (key matches DATE_FORMAT(col, '%Y-%m'))
 *  - year:  last 4 years      (key matches YEAR(col))
 */
function build_periods(string $gran): array
{
  $out = [];
  if ($gran === 'week') {
    $monday = strtotime('monday this week');
    for ($i = 7; $i >= 0; $i--) {
      $ts = strtotime("-{$i} week", $monday);
      $out[] = ['key' => date('oW', $ts), 'label' => date('M j', $ts)];
    }
  } elseif ($gran === 'year') {
    $year = (int) date('Y');
    for ($i = 3; $i >= 0; $i--) {
      $yr = $year - $i;
      $out[] = ['key' => (string) $yr, 'label' => (string) $yr];
    }
  } else {
    for ($i = 5; $i >= 0; $i--) {
      $ts = strtotime(date('Y-m-01') . " -{$i} months");
      $out[] = ['key' => date('Y-m', $ts), 'label' => date("M 'y", $ts)];
    }
  }
  return $out;
}

/** SQL grouping expression for a date column at the given granularity. */
function period_group_expr(string $col, string $gran): string
{
  return match ($gran) {
    'week' => "YEARWEEK($col, 3)",
    'year' => "YEAR($col)",
    default => "DATE_FORMAT($col, '%Y-%m')",
  };
}

/**
 * Run a grouped query (must SELECT the bucket as `k`) and map it onto the
 * ordered periods, filling gaps via $valueFn($label, $rowOrNull).
 */
function trend_series(PDO $pdo, string $sql, array $periods, callable $valueFn): array
{
  $map = [];
  foreach ($pdo->query($sql) as $row) {
    $map[(string) $row['k']] = $row;
  }
  $out = [];
  foreach ($periods as $p) {
    $out[] = $valueFn($p['label'], $map[$p['key']] ?? null);
  }
  return $out;
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
