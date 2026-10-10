<?php
declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/super_admin.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/auth_token.php';

function is_https_request(): bool
{
  if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    return true;
  }
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && stripos((string) $_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false) {
    return true;
  }
  if (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_SSL']) === 'on') {
    return true;
  }
  if (!empty($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) {
    return true;
  }
  if (isset($_SERVER['HTTP_HOST']) && str_contains((string) $_SERVER['HTTP_HOST'], 'onrender.com')) {
    return true;
  }
  return false;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
  $isHttps = is_https_request();
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => $isHttps ? 'None' : 'Lax',
  ]);
  @session_start();
}

function format_profile_photo_url(?string $raw): ?string
{
  if ($raw === null || trim($raw) === '') {
    return null;
  }
  $raw = trim($raw);
  if (str_starts_with($raw, 'data:image/')) {
    // If it's a corrupted/truncated data URI (e.g. from an old 255-char column), ignore it
    if (strlen($raw) < 200) {
      return null;
    }
    return $raw;
  }
  if (preg_match('/^https?:\/\//i', $raw) || str_starts_with($raw, '/api/file.php')) {
    return $raw;
  }
  $safe = basename($raw);
  return '/api/file.php?kind=profiles&name=' . rawurlencode($safe);
}

function current_user(): ?array
{
  if (!empty($_SESSION['user']) && is_array($_SESSION['user'])) {
    return $_SESSION['user'];
  }

  // Fallback: Verify Authorization: Bearer <token> for cross-site requests
  $token = get_bearer_token();
  if ($token) {
    $tokenUser = verify_auth_token($token);
    if ($tokenUser) {
      if (!empty($tokenUser['isSuperAdmin'])) {
        $superUser = make_super_admin_session_user();
        $user = array_merge($superUser, [
          'name' => $tokenUser['name'] ?? $superUser['name'],
          'profilePhoto' => get_super_admin_profile_photo(),
        ]);
        $user['isSuperAdmin'] = true;
        $_SESSION['user'] = $user;
        return $user;
      }

      try {
        $pdo = db();
        $stmt = $pdo->prepare("
          SELECT u.id, u.full_name, u.email, u.status, u.must_change_password, u.profile_photo, r.name AS role
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = ? AND u.status = 'ACTIVE'
          LIMIT 1
        ");
        $stmt->execute([(int) $tokenUser['id']]);
        $row = $stmt->fetch();
        if ($row) {
          $user = [
            'id' => (int) $row['id'],
            'name' => $row['full_name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'isSuperAdmin' => false,
            'mustChangePassword' => (bool) ($row['must_change_password'] ?? false),
            'profilePhoto' => format_profile_photo_url($row['profile_photo'] ?? null),
          ];
          $_SESSION['user'] = $user;
          return $user;
        }
      } catch (Throwable) {
        $user = [
          'id' => (int) $tokenUser['id'],
          'name' => $tokenUser['name'] ?? '',
          'email' => $tokenUser['email'] ?? '',
          'role' => $tokenUser['role'] ?? '',
          'isSuperAdmin' => false,
          'mustChangePassword' => false,
          'profilePhoto' => null,
        ];
        $_SESSION['user'] = $user;
        return $user;
      }
    }
  }

  return null;
}

function require_auth(?array $roles = null): array
{
  $user = current_user();
  if (!$user) {
    json_response(['ok' => false, 'error' => 'Authentication required. Please log in.'], 401);
  }
  if ($roles !== null) {
    $role = (string) ($user['role'] ?? '');
    $allowed = false;
    foreach ($roles as $allowedRole) {
      if (strcasecmp($role, (string) $allowedRole) === 0) {
        $allowed = true;
        break;
      }
    }
    // Hardcoded SuperAdmin inherits operational Admin privileges,
    // but remains a separate role (never a database Admin row).
    if (!$allowed && is_super_admin_user($user)) {
      foreach ($roles as $allowedRole) {
        $name = (string) $allowedRole;
        if (strcasecmp($name, 'Admin') === 0 || strcasecmp($name, 'SuperAdmin') === 0) {
          $allowed = true;
          break;
        }
      }
    }
    if (!$allowed) {
      json_response(['ok' => false, 'error' => 'You do not have permission for this action.'], 403);
    }
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
  if (!$date || $date === '0000-00-00' || $date === '0000-00-00 00:00:00') {
    return '—';
  }
  $ts = strtotime($date);
  return ($ts && $ts > 0) ? date('Y-m-d', $ts) : '—';
}

function format_duty_time(?string $time): string
{
  if (!$time) {
    return '';
  }
  $ts = strtotime($time);
  return $ts ? date('g:i A', $ts) : $time;
}

function duty_label(?string $start, ?string $end, $hours): string
{
  $parts = [];
  if ($start && $end) {
    $parts[] = format_duty_time($start) . ' – ' . format_duty_time($end);
  } elseif ($start) {
    $parts[] = 'From ' . format_duty_time($start);
  }
  if ($hours !== null && (float) $hours > 0) {
    $h = rtrim(rtrim(number_format((float) $hours, 2), '0'), '.');
    $parts[] = "{$h} hr" . ((float) $hours == 1.0 ? '' : 's');
  }
  return implode(' · ', $parts);
}

function hours_between(?string $start, ?string $end): ?float
{
  if (!$start || !$end) {
    return null;
  }
  $ts1 = strtotime("2000-01-01 {$start}");
  $ts2 = strtotime("2000-01-01 {$end}");
  if ($ts1 === false || $ts2 === false) {
    return null;
  }
  if ($ts2 < $ts1) {
    $ts2 = strtotime("2000-01-02 {$end}");
  }
  $diffSeconds = $ts2 - $ts1;
  if ($diffSeconds <= 0) {
    return null;
  }
  return round($diffSeconds / 3600, 2);
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
  if ($quantity <= 0) {
    return 'out';
  }
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
    'out' => 'Out of Stock',
    'low' => 'Low Stock',
    'moderate' => 'Moderate',
    default => 'Sufficient',
  };
}

function inventory_level_from_state(?string $state): ?string
{
  $normalized = strtolower(trim((string) $state));
  if ($normalized === '') return null;
  if (str_contains($normalized, 'out')) return 'out';
  if (str_contains($normalized, 'low')) return 'low';
  if (str_contains($normalized, 'moderate') || str_contains($normalized, 'medium')) return 'moderate';
  if (str_contains($normalized, 'sufficient') || str_contains($normalized, 'available')) return 'sufficient';
  return null;
}

/**
 * Synchronize the persisted inventory state and emit one alert only when an
 * item transitions into Low Stock or Out of Stock.
 */
function sync_inventory_stock_alert(PDO $pdo, int $itemId, ?string $previousLevel = null): ?string
{
  $stmt = $pdo->prepare('SELECT id, item_name, quantity, unit, low_stock_threshold, moderate_stock_threshold, stock_state FROM inventory_items WHERE id = ? LIMIT 1');
  $stmt->execute([$itemId]);
  $item = $stmt->fetch();
  if (!$item) return null;

  $quantity = max(0, (int) ($item['quantity'] ?? 0));
  $low = max(0, (int) ($item['low_stock_threshold'] ?? 100));
  $moderate = isset($item['moderate_stock_threshold']) && $item['moderate_stock_threshold'] !== null
    ? (int) $item['moderate_stock_threshold']
    : null;
  $newLevel = stock_level($quantity, $low, $moderate);
  $usesPersistedState = $previousLevel === null;
  $oldLevel = $previousLevel ?? inventory_level_from_state($item['stock_state'] ?? null);
  $newLabel = stock_level_label($newLevel);
  $stateUpdated = false;

  if (($item['stock_state'] ?? null) !== $newLabel) {
    try {
      $stateStmt = $pdo->prepare('UPDATE inventory_items SET stock_state = ? WHERE id = ? AND stock_state = ?');
      $stateStmt->execute([$newLabel, $itemId, (string) ($item['stock_state'] ?? '')]);
      $stateUpdated = $stateStmt->rowCount() === 1;
    } catch (PDOException $e) {
      if (!(str_contains($e->getMessage(), 'stock_state') || $e->getCode() === '42S22' || str_contains((string) $e->getCode(), '1054'))) {
        throw $e;
      }
    }
  }

  $ownsTransition = !$usesPersistedState || $stateUpdated;
  if ($ownsTransition && $oldLevel !== $newLevel && in_array($newLevel, ['low', 'out'], true)) {
    $unit = trim((string) ($item['unit'] ?? 'units')) ?: 'units';
    $title = $newLevel === 'out'
      ? 'Out of Stock: ' . $item['item_name']
      : 'Low Stock: ' . $item['item_name'];
    $message = "Available: {$quantity} {$unit}. Low Stock Threshold: {$low} {$unit}.";
    notify_admins($pdo, 'low_stock', $title, $message, '/admin/inventory');
  }

  return $newLevel;
}

function create_notification(PDO $pdo, string $type, string $title, string $message, ?string $link = null, ?int $userId = null, ?string $roleTarget = null): void
{
  // Store path-only links so in-app notifications work in every environment.
  $normalized = $link !== null && $link !== '' ? notification_path($link) : null;
  $stmt = $pdo->prepare('INSERT INTO notifications (user_id, role_target, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)');
  $stmt->execute([$userId, $roleTarget, $type, $title, $message, $normalized]);
}

/**
 * Map an admin deep-link to the Staff portal equivalent when one exists.
 * Staff must never receive raw /admin/... View links.
 */
function staff_notification_link(?string $link): ?string
{
  if ($link === null || $link === '') {
    return null;
  }
  $path = function_exists('notification_path') ? notification_path($link) : $link;
  if (!str_starts_with($path, '/admin')) {
    return $path;
  }
  $rest = substr($path, strlen('/admin')); // includes leading / or empty
  if ($rest === '' || $rest === '/') {
    return '/staff';
  }
  $base = parse_url($rest, PHP_URL_PATH) ?: $rest;
  $allowed = [
    '/donations',
    '/inventory',
    '/distributions',
    '/tasks',
    '/verification',
    '/settings',
  ];
  foreach ($allowed as $prefix) {
    if ($base === $prefix || str_starts_with($base, $prefix . '/')) {
      return '/staff' . $rest;
    }
  }
  // No staff page for this admin module — land on staff dashboard.
  return '/staff';
}

/**
 * Notify Admin + Staff inboxes only. Never Donor / Volunteer / Beneficiary.
 * Each role gets a portal-appropriate link.
 */
function notify_admins(PDO $pdo, string $type, string $title, string $message, ?string $link = null): void
{
  create_notification($pdo, $type, $title, $message, $link, null, 'Admin');
  create_notification($pdo, $type, $title, $message, staff_notification_link($link), null, 'Staff');
}

/**
 * Allowlist of high-value lifecycle transitions that may email external users.
 * Mid-hop operational statuses stay in-app only (Admin/Staff bell).
 */
function lifecycle_mail_allowed(string $domain, string $statusOrStage): bool
{
  $s = trim($statusOrStage);
  return match ($domain) {
    'donation' => in_array($s, ['Verified', 'Rejected', 'Cancelled', 'Distributed', 'Completed'], true),
    'donation_stage' => in_array($s, ['Sorted', 'Repacked', 'In Transit', 'Delivered'], true),
    'request' => in_array($s, ['Approved', 'Rejected', 'Allocated', 'Completed'], true),
    'distribution' => in_array($s, ['In Transit', 'Delivered', 'Completed'], true),
    'proof' => in_array($s, ['Approved', 'Rejected'], true),
    'application' => in_array($s, ['Rejected'], true),
    default => false,
  };
}

/**
 * Send a branded transactional status email to an external user (donor, barangay, volunteer).
 * Returns false when the address is missing/invalid or mail is unavailable — never throws.
 */
function send_lifecycle_email(
  string $toEmail,
  string $toName,
  string $subject,
  string $headline,
  string $messageHtml,
  string $portalPath,
  string $ctaLabel = 'Open portal'
): bool {
  $toEmail = trim($toEmail);
  if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
    return false;
  }
  if (!function_exists('send_mail')) {
    return false;
  }
  $safeName = htmlspecialchars($toName !== '' ? $toName : 'there', ENT_QUOTES, 'UTF-8');
  $safeHeadline = htmlspecialchars($headline, ENT_QUOTES, 'UTF-8');
  $html = "<p style=\"margin:0 0 12px\">Hello {$safeName},</p>"
    . "<p style=\"margin:0 0 14px;font-size:1.1rem;font-weight:700;color:#0f172a\">{$safeHeadline}</p>"
    . $messageHtml
    . (function_exists('email_link_html') ? email_link_html($portalPath, $ctaLabel) : '');
  try {
    return (bool) send_mail($toEmail, $toName !== '' ? $toName : $toEmail, $subject, $html);
  } catch (Throwable $e) {
    error_log('[lifecycle_email] ' . $e->getMessage());
    return false;
  }
}

/**
 * Resolve barangay contact for in-app + email notifications.
 * @return array{email:string,name:string,user_id:?int,label:string}|null
 */
function beneficiary_mail_contact(PDO $pdo, int $beneficiaryId): ?array
{
  if ($beneficiaryId <= 0) {
    return null;
  }
  try {
    $stmt = $pdo->prepare('
      SELECT b.id, b.full_name, b.barangay, b.representative_name, b.representative_email, b.user_id, u.email AS user_email
      FROM beneficiaries b
      LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = ?
      LIMIT 1
    ');
    $stmt->execute([$beneficiaryId]);
    $row = $stmt->fetch();
  } catch (Throwable $e) {
    return null;
  }
  if (!$row) {
    return null;
  }
  $email = strtolower(trim((string) ($row['representative_email'] ?? '')));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = strtolower(trim((string) ($row['user_email'] ?? '')));
  }
  if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
  }
  $name = trim((string) ($row['representative_name'] ?? ''));
  if ($name === '') {
    $name = trim((string) ($row['full_name'] ?? $row['barangay'] ?? 'Barangay Representative'));
  }
  $label = trim((string) ($row['full_name'] ?: $row['barangay'] ?: 'your barangay'));
  return [
    'email' => $email,
    'name' => $name,
    'user_id' => !empty($row['user_id']) ? (int) $row['user_id'] : null,
    'label' => $label,
  ];
}

/**
 * In-app (if linked) + optional email to the barangay for a lifecycle event.
 */
function notify_beneficiary_lifecycle(
  PDO $pdo,
  int $beneficiaryId,
  string $type,
  string $title,
  string $message,
  string $portalPath,
  string $emailSubject,
  string $emailHeadline,
  string $emailBodyHtml = '',
  bool $sendEmail = true,
  string $ctaLabel = 'Open barangay portal'
): void {
  $contact = beneficiary_mail_contact($pdo, $beneficiaryId);
  if ($contact === null) {
    return;
  }
  if (!empty($contact['user_id'])) {
    create_notification($pdo, $type, $title, $message, $portalPath, (int) $contact['user_id']);
  }
  if ($sendEmail && $contact['email'] !== '') {
    $body = $emailBodyHtml !== ''
      ? $emailBodyHtml
      : '<p style="margin:0 0 12px;line-height:1.6;color:#475569">' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p>';
    send_lifecycle_email(
      $contact['email'],
      $contact['name'],
      $emailSubject,
      $emailHeadline,
      $body,
      $portalPath,
      $ctaLabel
    );
  }
}

/**
 * Notify the barangay when an assistance request reaches a high-value status.
 */
function notify_request_lifecycle(PDO $pdo, int $requestId, string $newStatus, ?string $oldStatus = null): void
{
  if ($oldStatus !== null && $oldStatus === $newStatus) {
    return;
  }
  if (!lifecycle_mail_allowed('request', $newStatus)) {
    return;
  }
  try {
    $stmt = $pdo->prepare('
      SELECT ar.id, ar.reference_code, ar.status, ar.beneficiary_id, b.full_name AS barangay_name
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.id = ?
      LIMIT 1
    ');
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();
  } catch (Throwable $e) {
    return;
  }
  if (!$row || empty($row['beneficiary_id'])) {
    return;
  }
  $code = (string) ($row['reference_code'] ?? ('#' . $requestId));
  $barangay = (string) ($row['barangay_name'] ?? 'your barangay');
  $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
  $copy = match ($newStatus) {
    'Approved' => [
      'title' => 'Assistance request approved',
      'message' => "Request {$code} for {$barangay} was approved.",
      'headline' => 'Your assistance request was approved',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Your request <strong>{$safeCode}</strong> has been approved. Our team will allocate resources and schedule delivery next.</p>",
      'cta' => 'View requests',
    ],
    'Rejected' => [
      'title' => 'Assistance request not approved',
      'message' => "Request {$code} was not approved.",
      'headline' => 'Update on your assistance request',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Your request <strong>{$safeCode}</strong> was not approved. Sign in to review details or submit a new request if needed.</p>",
      'cta' => 'View requests',
    ],
    'Allocated' => [
      'title' => 'Resources allocated',
      'message' => "Resources were allocated for request {$code}.",
      'headline' => 'Resources have been allocated',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Resources for request <strong>{$safeCode}</strong> have been allocated. A distribution will be scheduled soon.</p>",
      'cta' => 'View requests',
    ],
    'Completed' => [
      'title' => 'Assistance request completed',
      'message' => "Request {$code} is complete.",
      'headline' => 'Your assistance request is complete',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Request <strong>{$safeCode}</strong> has been marked complete. Thank you for coordinating with Rise Above Foundation Cebu.</p>",
      'cta' => 'View requests',
    ],
    default => null,
  };
  if ($copy === null) {
    return;
  }
  notify_beneficiary_lifecycle(
    $pdo,
    (int) $row['beneficiary_id'],
    'assistance',
    $copy['title'],
    $copy['message'],
    '/beneficiary/requests',
    "Request {$code}: {$newStatus}",
    $copy['headline'],
    $copy['body'],
    true,
    $copy['cta']
  );
}

/**
 * Notify the barangay when a distribution reaches In Transit / Delivered / Completed.
 */
function notify_distribution_lifecycle(PDO $pdo, array $dist, string $newStatus, ?string $oldStatus = null): void
{
  if ($oldStatus !== null && $oldStatus === $newStatus) {
    return;
  }
  if (!lifecycle_mail_allowed('distribution', $newStatus)) {
    return;
  }
  $beneficiaryId = (int) ($dist['beneficiary_id'] ?? 0);
  if ($beneficiaryId <= 0) {
    return;
  }
  $code = (string) ($dist['code'] ?? 'distribution');
  $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
  $copy = match ($newStatus) {
    'In Transit' => [
      'title' => 'Delivery in transit',
      'message' => "Distribution {$code} is now In Transit.",
      'headline' => 'Your delivery is on the way',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Distribution <strong>{$safeCode}</strong> is in transit. You will be asked to confirm receipt once it is marked Delivered.</p>",
      'cta' => 'Track delivery',
    ],
    'Delivered' => [
      'title' => 'Delivery marked Delivered',
      'message' => "Distribution {$code} was marked Delivered. Please confirm receipt.",
      'headline' => 'Please confirm you received the delivery',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Distribution <strong>{$safeCode}</strong> was marked <strong>Delivered</strong>. Sign in to confirm receipt and submit proof of delivery.</p>",
      'cta' => 'Confirm receipt',
    ],
    'Completed' => [
      'title' => 'Distribution completed',
      'message' => "Distribution {$code} is complete.",
      'headline' => 'Distribution complete',
      'body' => "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">Distribution <strong>{$safeCode}</strong> is complete. Thank you for submitting documentation.</p>",
      'cta' => 'View distributions',
    ],
    default => null,
  };
  if ($copy === null) {
    return;
  }
  notify_beneficiary_lifecycle(
    $pdo,
    $beneficiaryId,
    'distribution',
    $copy['title'],
    $copy['message'],
    '/beneficiary/requests',
    "Delivery {$code}: {$newStatus}",
    $copy['headline'],
    $copy['body'],
    true,
    $copy['cta']
  );
}

/**
 * Auto-close linked assistance request when all its distributions are completed.
 */
function try_close_linked_request(PDO $pdo, int $distributionId): void
{
  $requestId = null;

  try {
    $dr = $pdo->prepare('SELECT request_id FROM distributions WHERE id = ? AND request_id IS NOT NULL LIMIT 1');
    $dr->execute([$distributionId]);
    $requestId = $dr->fetchColumn();
  } catch (Throwable $e) {
  }

  if (!$requestId) {
    try {
      $ar = $pdo->prepare('SELECT DISTINCT a.assistance_request_id FROM allocations a WHERE a.distribution_id = ? AND a.assistance_request_id IS NOT NULL');
      $ar->execute([$distributionId]);
      $requestId = $ar->fetchColumn();
    } catch (Throwable $e) {
    }
  }

  if (!$requestId) {
    return;
  }

  $allDone = true;

  $allocs = $pdo->prepare('SELECT id, distribution_id FROM allocations WHERE assistance_request_id = ?');
  $allocs->execute([$requestId]);
  foreach ($allocs->fetchAll() as $alloc) {
    if (empty($alloc['distribution_id'])) {
      $allDone = false;
      break;
    }
    $ds = $pdo->prepare('SELECT status FROM distributions WHERE id = ? LIMIT 1');
    $ds->execute([$alloc['distribution_id']]);
    $distStatus = $ds->fetchColumn();
    if ($distStatus !== 'Completed') {
      $allDone = false;
      break;
    }
  }

  try {
    $directDists = $pdo->prepare('SELECT status FROM distributions WHERE request_id = ? AND status != ?');
    $directDists->execute([$requestId, 'Completed']);
    if ($directDists->fetchColumn()) {
      $allDone = false;
    }
  } catch (Throwable $e) {
  }

  if ($allDone) {
    $upd = $pdo->prepare("UPDATE assistance_requests SET status = 'Completed' WHERE id = ? AND status NOT IN ('Rejected','Completed')");
    $upd->execute([$requestId]);
    if ($upd->rowCount() > 0) {
      audit_log($pdo, 'auto-complete', 'assistance_request', (string) $requestId, 'Auto-completed: all linked distributions finished');
      notify_request_lifecycle($pdo, (int) $requestId, 'Completed');
    }
  }
}

/**
 * Finalize distribution completion: approves pending proofs, marks allocations Delivered,
 * updates inventory, and closes linked requests.
 */
function complete_distribution(PDO $pdo, int $distId, ?int $reviewedByUserId = null): void
{
  $pdo->prepare("UPDATE distributions SET status = 'Completed', proof_status = 'Proof Verified' WHERE id = ?")
    ->execute([$distId]);

  try {
    $pdo->prepare("UPDATE distribution_proofs SET status = 'Approved', reviewed_at = NOW(), reviewed_by_user_id = ? WHERE distribution_id = ? AND status <> 'Approved'")
      ->execute([$reviewedByUserId, $distId]);
  } catch (Throwable $e) {
  }

  try {
    $allocStmt = $pdo->prepare("SELECT id, inventory_item_id, deducted_quantity FROM allocations WHERE distribution_id = ? AND status IN ('Reserved','Allocated','In Distribution','Scheduled','In Transit') AND inventory_deducted = 1");
    $allocStmt->execute([$distId]);
    $linkedAllocs = $allocStmt->fetchAll();
    foreach ($linkedAllocs as $la) {
      $invId = !empty($la['inventory_item_id']) ? (int) $la['inventory_item_id'] : null;
      $dQty = (int) ($la['deducted_quantity'] ?? 0);
      if ($invId && $dQty > 0) {
        $pdo->prepare("UPDATE inventory_items SET allocated = GREATEST(0, allocated - ?), distributed = distributed + ? WHERE id = ?")
          ->execute([$dQty, $dQty, $invId]);
      }
    }
    $pdo->prepare("UPDATE allocations SET status = 'Delivered' WHERE distribution_id = ? AND status IN ('Reserved','Allocated','In Distribution','Scheduled','In Transit')")
      ->execute([$distId]);
    $pdo->prepare("UPDATE assistance_requests SET status = 'Delivered' WHERE id IN (SELECT assistance_request_id FROM allocations WHERE distribution_id = ? AND assistance_request_id IS NOT NULL) AND status NOT IN ('Completed')")
      ->execute([$distId]);
  } catch (Throwable $e) {
  }

  try {
    try_close_linked_request($pdo, $distId);
  } catch (Throwable $e) {
  }
}

if (!function_exists('normalize_proof_status')) {
  function normalize_proof_status(?string $status): string
  {
    $status = trim((string) $status);
    return match ($status) {
      'Verified', 'Proof Verified', 'Approved' => 'Approved',
      'Rejected', 'Proof Rejected' => 'Rejected',
      'Pending Review', 'Under Review', 'Pending', '' => 'Pending',
      default => $status !== '' ? $status : 'Pending',
    };
  }
}

/**
 * Append a chronological donation progress update.
 */
function record_donation_update(
  PDO $pdo,
  int $donationId,
  string $stage,
  ?string $note = null,
  ?array $actor = null
): void {
  try {
    $userId = $actor['id'] ?? null;
    $name = $actor['name'] ?? 'System';
    $stmt = $pdo->prepare('
      INSERT INTO donation_updates (donation_id, stage, note, created_by_user_id, created_by_name)
      VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([
      $donationId,
      $stage,
      $note,
      $userId ? (int) $userId : null,
      (string) $name,
    ]);
  } catch (Throwable $e) {
    // Table may not exist yet before migrate — never break donation flow.
    error_log('[donation_updates] ' . $e->getMessage());
  }
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
  $email = strtolower(trim($email));
  if ($email !== '' && function_exists('is_super_admin_email') && is_super_admin_email($email)) {
    return true;
  }
  $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
  $stmt->execute([$email]);
  return (bool) $stmt->fetchColumn();
}

/** Normalize PH mobile to 11 digits (09XXXXXXXXX). Returns '' if empty. */
function normalize_ph_mobile(?string $phone): string
{
  $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';
  if ($digits === '') {
    return '';
  }
  if (strlen($digits) === 12 && str_starts_with($digits, '63')) {
    $digits = '0' . substr($digits, 2);
  } elseif (strlen($digits) === 10 && str_starts_with($digits, '9')) {
    $digits = '0' . $digits;
  }
  return $digits;
}

function is_valid_ph_mobile(?string $phone): bool
{
  $normalized = normalize_ph_mobile($phone);
  return (bool) preg_match('/^09\d{9}$/', $normalized);
}

function require_valid_email(string $email, string $label = 'Email'): string
{
  $email = strtolower(trim($email));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => "{$label} must be a valid email address."], 400);
  }
  return $email;
}

function is_valid_phone(?string $phone, bool $allowInternational = true): bool
{
  $raw = trim((string) $phone);
  if ($raw === '') {
    return false;
  }
  if (!$allowInternational) {
    return is_valid_ph_mobile($raw);
  }
  if (str_starts_with($raw, '+63') || str_starts_with($raw, '09') || (strlen(preg_replace('/\D+/', '', $raw)) === 12 && str_starts_with(preg_replace('/\D+/', '', $raw), '63'))) {
    return is_valid_ph_mobile($raw);
  }
  if (str_starts_with($raw, '+')) {
    $digits = preg_replace('/\D+/', '', $raw);
    return strlen($digits) >= 7 && strlen($digits) <= 15;
  }
  $digits = preg_replace('/\D+/', '', $raw);
  if (strlen($digits) >= 7 && strlen($digits) <= 15) {
    return true;
  }
  return is_valid_ph_mobile($raw);
}

function require_valid_phone(?string $phone, bool $required = false, string $label = 'Phone', bool $allowInternational = true): string
{
  $raw = trim((string) $phone);
  if ($raw === '') {
    if ($required) {
      json_response(['ok' => false, 'error' => "{$label} is required."], 400);
    }
    return '';
  }
  if (!is_valid_phone($raw, $allowInternational)) {
    if ($allowInternational) {
      json_response(['ok' => false, 'error' => "{$label} must be a valid phone number."], 400);
    } else {
      json_response(['ok' => false, 'error' => "{$label} must be an 11-digit PH mobile number (09XXXXXXXXX)."], 400);
    }
  }
  if (is_valid_ph_mobile($raw)) {
    return normalize_ph_mobile($raw);
  }
  if (str_starts_with($raw, '+')) {
    return '+' . preg_replace('/\D+/', '', $raw);
  }
  return preg_replace('/\D+/', '', $raw);
}

function require_valid_ph_mobile(?string $phone, bool $required = false, string $label = 'Phone'): string
{
  return require_valid_phone($phone, $required, $label, false);
}

function user_role_name(PDO $pdo, int $userId): ?string
{
  $stmt = $pdo->prepare('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $role = $stmt->fetchColumn();
  return $role !== false ? (string) $role : null;
}

function normalize_distribution_status(string $status): string
{
  $map = [
    'Scheduled' => 'Planning',
    'Pending' => 'Planning',
    'In Progress' => 'Preparing',
    'Awaiting Proof' => 'Proof Review',
  ];
  return $map[$status] ?? $status;
}

function is_valid_distribution_status(string $status): bool
{
  return in_array($status, distribution_workflow_steps(), true);
}

function require_setup_cli_or_local(): void
{
  if (PHP_SAPI === 'cli') {
    return;
  }
  $addr = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
  $allowEnv = getenv('ALLOW_SETUP') === '1' || (string) ($_ENV['ALLOW_SETUP'] ?? '') === '1';
  $local = in_array($addr, ['127.0.0.1', '::1'], true);
  if (!$allowEnv && !$local) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Forbidden. Setup/migrate is only allowed from localhost or with ALLOW_SETUP=1.\n";
    exit;
  }
}

function donor_name_taken(PDO $pdo, string $name, string $organization = '', ?int $excludeId = null): bool
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

function create_user_account(PDO $pdo, string $role, string $name, string $email, string $password, string $status = 'ACTIVE', bool $mustChangePassword = false, ?array $nameParts = null): int
{
  $rid = role_id($pdo, $role);
  $hash = password_hash($password, PASSWORD_DEFAULT);
  $last = $nameParts['lastName'] ?? $nameParts['last_name'] ?? null;
  $first = $nameParts['firstName'] ?? $nameParts['first_name'] ?? null;
  $mi = $nameParts['middleInitial'] ?? $nameParts['middle_initial'] ?? null;
  if (($last || $first) && function_exists('format_full_name')) {
    $composed = format_full_name($last, $first, $mi);
    if ($composed !== '') {
      $name = $composed;
    }
  }
  $stmt = $pdo->prepare('INSERT INTO users (role_id, full_name, first_name, last_name, middle_initial, email, password_hash, status, must_change_password, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $rid,
    $name,
    $first !== null && $first !== '' ? trim((string) $first) : null,
    $last !== null && $last !== '' ? trim((string) $last) : null,
    $mi !== null && $mi !== '' ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', (string) $mi) ?: '', 0, 1)) : null,
    strtolower(trim($email)),
    $hash,
    $status,
    $mustChangePassword ? 1 : 0,
    $status === 'ACTIVE' ? date('Y-m-d H:i:s') : null,
  ]);
  return (int) $pdo->lastInsertId();
}

/** Compose "First M. Last" from LN/FN/MI parts. */
function format_full_name(?string $lastName, ?string $firstName, ?string $middleInitial = null): string
{
  $ln = trim((string) $lastName);
  $fn = trim((string) $firstName);
  $mi = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', (string) $middleInitial) ?: '', 0, 1));
  $parts = [];
  if ($fn !== '') {
    $parts[] = $fn;
  }
  if ($mi !== '') {
    $parts[] = $mi . '.';
  }
  if ($ln !== '') {
    $parts[] = $ln;
  }
  return trim(implode(' ', $parts));
}

/**
 * Read LN/FN/MI from a request body (supports camelCase and snake_case).
 * Returns [lastName, firstName, middleInitial, fullName]
 */
function read_name_parts(array $body, string $prefix = ''): array
{
  $p = $prefix;
  $last = trim((string) ($body[$p . 'lastName'] ?? $body[$p . 'last_name'] ?? $body['lastName'] ?? $body['last_name'] ?? ''));
  $first = trim((string) ($body[$p . 'firstName'] ?? $body[$p . 'first_name'] ?? $body['firstName'] ?? $body['first_name'] ?? ''));
  $mi = trim((string) ($body[$p . 'middleInitial'] ?? $body[$p . 'middle_initial'] ?? $body['middleInitial'] ?? $body['middle_initial'] ?? ''));
  $full = format_full_name($last, $first, $mi);
  if ($full === '') {
    $full = trim((string) ($body[$p . 'name'] ?? $body[$p . 'fullName'] ?? $body[$p . 'full_name'] ?? $body['name'] ?? $body['fullName'] ?? $body['full_name'] ?? $body['donorName'] ?? $body['contactPerson'] ?? ''));
  }
  return [$last, $first, $mi, $full];
}

/**
 * After Admin verifies a donation: create Donor login (if needed) and email temp credentials.
 * Returns ['created' => bool, 'userId' => ?int, 'mail' => ?array, 'error' => ?string]
 */
function provision_donor_from_donation(PDO $pdo, array $donationRow): array
{
  $email = strtolower(trim((string) ($donationRow['donor_email'] ?? '')));
  $name = trim((string) ($donationRow['donor_name'] ?? 'Donor'));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return ['created' => false, 'userId' => null, 'mail' => null, 'error' => 'Donor email missing'];
  }

  if (email_taken($pdo, $email)) {
    $stmt = $pdo->prepare('SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1');
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch();
    $userId = (int) ($existingUser['id'] ?? 0);
    $roleName = (string) ($existingUser['role_name'] ?? '');
    if ($userId <= 0 || strcasecmp($roleName, 'Donor') !== 0) {
      return [
        'created' => false,
        'userId' => null,
        'mail' => null,
        'error' => 'That email already belongs to a different account role. Use a unique donor email.',
      ];
    }
    if (!empty($donationRow['donor_id'])) {
      $pdo->prepare('UPDATE donors SET user_id = COALESCE(user_id, ?) WHERE id = ?')
        ->execute([$userId, (int) $donationRow['donor_id']]);
    }
    return ['created' => false, 'userId' => $userId, 'mail' => null, 'error' => null];
  }

  $tempPassword = generate_temp_password();
  $userId = create_user_account($pdo, 'Donor', $name, $email, $tempPassword, 'ACTIVE', true);
  accept_privacy_terms($pdo, $userId);

  if (!empty($donationRow['donor_id'])) {
    $pdo->prepare('UPDATE donors SET user_id = ? WHERE id = ?')
      ->execute([$userId, (int) $donationRow['donor_id']]);
  } else {
    $find = $pdo->prepare('SELECT id FROM donors WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $donorId = $find->fetchColumn();
    if ($donorId) {
      $pdo->prepare('UPDATE donors SET user_id = ? WHERE id = ?')->execute([$userId, (int) $donorId]);
    }
  }

  $mail = send_account_credentials($email, $name, $email, $tempPassword, 'Donor');
  create_notification(
    $pdo,
    'account',
    'Donor account ready',
    'Your donor portal login credentials were emailed. Please sign in and change your temporary password.',
    '/donor',
    $userId
  );

  return ['created' => true, 'userId' => $userId, 'mail' => $mail, 'error' => null];
}

/**
 * Post verified in-kind donations into inventory as pack units.
 */
function post_donation_to_inventory_packs(PDO $pdo, array $donationRow): void
{
  // Idempotent: skip if this donation was already posted to inventory.
  if (!empty($donationRow['inventory_posted_at'])) {
    return;
  }
  $donationId = (int) ($donationRow['id'] ?? 0);
  if ($donationId > 0) {
    try {
      $check = $pdo->prepare('SELECT inventory_posted_at FROM donations WHERE id = ? LIMIT 1');
      $check->execute([$donationId]);
      if ($check->fetchColumn()) {
        return;
      }
    } catch (Throwable $e) {
      // column may be missing pre-migrate — continue
    }
  }

  if (($donationRow['type'] ?? '') !== 'In-Kind') {
    return;
  }
  $label = trim((string) ($donationRow['items_description'] ?? ''));
  if ($label === '') {
    $label = trim((string) ($donationRow['category'] ?? 'In-Kind Donation')) ?: 'In-Kind Donation';
  }
  // Prefer a short inventory item name (category) with packs unit.
  $itemName = trim((string) ($donationRow['category'] ?? '')) ?: (strlen($label) > 80 ? substr($label, 0, 77) . '…' : $label);
  $qty = 1;
  if (preg_match('/\b(\d+)\b/', $label, $m)) {
    $qty = max(1, (int) $m[1]);
  }

  $find = $pdo->prepare('SELECT id, quantity FROM inventory_items WHERE LOWER(item_name) = LOWER(?) LIMIT 1');
  $find->execute([$itemName]);
  $row = $find->fetch();
  if ($row) {
    try {
      $pdo->prepare("UPDATE inventory_items SET quantity = quantity + ?, total_quantity = total_quantity + ?, unit = 'packs', stock_state = 'Available' WHERE id = ?")
        ->execute([$qty, $qty, (int) $row['id']]);
    } catch (PDOException $e) {
      if (str_contains($e->getMessage(), 'stock_state') || $e->getCode() === '42S22' || str_contains((string) $e->getCode(), '1054')) {
        $pdo->prepare("UPDATE inventory_items SET quantity = quantity + ?, total_quantity = total_quantity + ?, unit = 'packs' WHERE id = ?")
          ->execute([$qty, $qty, (int) $row['id']]);
      } else {
        throw $e;
      }
    }
  } else {
    try {
      $pdo->prepare("INSERT INTO inventory_items (code, item_name, category, quantity, total_quantity, unit, stock_state, low_stock_threshold) VALUES (?, ?, ?, ?, ?, 'packs', 'Available', 10)")
        ->execute([
          generate_code('INV'),
          $itemName,
          trim((string) ($donationRow['category'] ?? 'Donated Goods')) ?: 'Donated Goods',
          $qty,
          $qty,
        ]);
    } catch (PDOException $e) {
      if (str_contains($e->getMessage(), 'stock_state') || $e->getCode() === '42S22' || str_contains((string) $e->getCode(), '1054')) {
        $pdo->prepare("INSERT INTO inventory_items (code, item_name, category, quantity, total_quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, 'packs', 10)")
          ->execute([
            generate_code('INV'),
            $itemName,
            trim((string) ($donationRow['category'] ?? 'Donated Goods')) ?: 'Donated Goods',
            $qty,
            $qty,
          ]);
      } else {
        throw $e;
      }
    }
  }
  if ($donationId > 0) {
    try {
      $pdo->prepare('UPDATE donations SET inventory_posted_at = NOW() WHERE id = ? AND inventory_posted_at IS NULL')
        ->execute([$donationId]);
    } catch (Throwable $e) {
      // column may be missing pre-migrate
    }
  }
}

/**
 * After Admin approves a barangay application: create login + email credentials.
 */
function provision_beneficiary_account(PDO $pdo, array $benRow, ?string $customPassword = null): array
{
  $email = strtolower(trim((string) ($benRow['representative_email'] ?? '')));
  $name = trim((string) ($benRow['representative_name'] ?? ''));
  if ($name === '') {
    $name = trim(((string) ($benRow['representative_first_name'] ?? '')) . ' ' . ((string) ($benRow['representative_last_name'] ?? '')));
  }
  if ($name === '') {
    $name = trim((string) ($benRow['full_name'] ?? 'Barangay Representative')) ?: 'Barangay Representative';
  }
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return ['created' => false, 'userId' => null, 'mail' => null, 'error' => 'Representative email is missing'];
  }
  $pdo->beginTransaction();
  try {
    if (!empty($benRow['user_id'])) {
      $pdo->prepare('UPDATE beneficiaries SET status = ?, invitation_status = ? WHERE id = ?')
        ->execute(['Active', 'accepted', (int) $benRow['id']]);
      $pdo->commit();
      return ['created' => false, 'userId' => (int) $benRow['user_id'], 'mail' => null, 'error' => null];
    }
    if (email_taken($pdo, $email)) {
      $stmt = $pdo->prepare('SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1');
      $stmt->execute([$email]);
      $existingUser = $stmt->fetch();
      $uid = (int) ($existingUser['id'] ?? 0);
      $roleName = (string) ($existingUser['role_name'] ?? '');
      if ($uid <= 0 || strcasecmp($roleName, 'Beneficiary') !== 0) {
        $pdo->rollBack();
        return [
          'created' => false,
          'userId' => null,
          'mail' => null,
          'error' => 'That email already belongs to a different account role. Use a unique representative email.',
        ];
      }
      
      if ($customPassword !== null && trim($customPassword) !== '') {
        $customTrimmed = trim($customPassword);
        $pwErr = validate_password_policy($customTrimmed, 'Custom password');
        if ($pwErr !== null) {
          $pdo->rollBack();
          return ['created' => false, 'userId' => null, 'mail' => null, 'error' => $pwErr];
        }
        $tempPassword = $customTrimmed;
      } else {
        $tempPassword = generate_temp_password();
      }
      $hash = password_hash($tempPassword, PASSWORD_DEFAULT);
      $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $uid]);

      $pdo->prepare('UPDATE beneficiaries SET user_id = ?, status = ?, invitation_status = ?, invitation_token = NULL WHERE id = ?')
        ->execute([$uid, 'Active', 'accepted', (int) $benRow['id']]);
      
      $barangayName = trim((string) ($benRow['full_name'] ?? $benRow['barangay'] ?? 'your Barangay'));
      $mail = send_barangay_approval_credentials($email, $name, $barangayName, $email, $tempPassword);

      $pdo->commit();
      return [
        'created' => true,
        'userId' => $uid,
        'temporaryPassword' => $tempPassword,
        'mail' => $mail,
        'error' => null
      ];
    }

    if ($customPassword !== null && trim($customPassword) !== '') {
      $customTrimmed = trim($customPassword);
      $pwErr = validate_password_policy($customTrimmed, 'Custom password');
      if ($pwErr !== null) {
        $pdo->rollBack();
        return ['created' => false, 'userId' => null, 'mail' => null, 'error' => $pwErr];
      }
      $tempPassword = $customTrimmed;
    } else {
      $tempPassword = generate_temp_password();
    }
    $userId = create_user_account($pdo, 'Beneficiary', $name, $email, $tempPassword, 'ACTIVE', true, [
      'lastName' => (string) ($benRow['representative_last_name'] ?? ''),
      'firstName' => (string) ($benRow['representative_first_name'] ?? ''),
      'middleInitial' => (string) ($benRow['representative_middle_initial'] ?? ''),
    ]);
    accept_privacy_terms($pdo, $userId);
    $pdo->prepare('UPDATE beneficiaries SET user_id = ?, status = ?, invitation_status = ?, invitation_token = NULL WHERE id = ?')
      ->execute([$userId, 'Active', 'accepted', (int) $benRow['id']]);
    
    // Use Barangay-specific approval welcome email
    $barangayName = trim((string) ($benRow['full_name'] ?? $benRow['barangay'] ?? 'your Barangay'));
    $mail = send_barangay_approval_credentials($email, $name, $barangayName, $email, $tempPassword);
    
    if (empty($mail['sent'])) {
      throw new Exception($mail['error'] ?? 'Email delivery failed');
    }
    
    $pdo->commit();
    
    $transport = (string) ($mail['transport'] ?? '');
    $includeTemp = $transport === 'outbox' || !in_array($transport, ['brevo', 'nodemailer', 'smtp'], true);
    return [
      'created' => true,
      'userId' => $userId,
      'mail' => $mail,
      'temporaryPassword' => $includeTemp ? $tempPassword : null,
      'error' => null,
    ];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    return [
      'created' => false,
      'userId' => null,
      'mail' => ['sent' => false, 'error' => $e->getMessage()],
      'temporaryPassword' => null,
      'error' => 'Account provisioning failed: ' . $e->getMessage(),
    ];
  }
}

/**
 * After Admin approves a volunteer application: create login + email credentials.
 */
function provision_volunteer_account(PDO $pdo, array $volunteerRow): array
{
  $email = strtolower(trim((string) ($volunteerRow['email'] ?? '')));
  $isIntern = strcasecmp((string) ($volunteerRow['applicant_type'] ?? ''), 'Intern') === 0;
  $accountLabel = $isIntern ? 'Intern' : 'Volunteer';
  $name = trim((string) ($volunteerRow['full_name'] ?? $accountLabel));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return ['created' => false, 'linked' => false, 'userId' => null, 'mail' => null, 'error' => "{$accountLabel} email missing or invalid"];
  }
  if (!empty($volunteerRow['user_id'])) {
    $linkedUserId = (int) $volunteerRow['user_id'];
    $linkedRole = user_role_name($pdo, $linkedUserId);
    // Repair accounts produced by the legacy approval bug, which linked Intern
    // applications to Volunteer users. The explicit profile link makes this
    // conversion safe and avoids creating or emailing replacement credentials.
    if ($isIntern && $linkedRole !== null && strcasecmp($linkedRole, 'Volunteer') === 0) {
      $pdo->prepare('UPDATE users SET role_id = ? WHERE id = ?')
        ->execute([role_id($pdo, 'Intern'), $linkedUserId]);
      $linkedRole = 'Intern';
    }
    if ($linkedRole === null || strcasecmp($linkedRole, $accountLabel) !== 0) {
      return [
        'created' => false,
        'linked' => false,
        'userId' => null,
        'mail' => null,
        'error' => "This {$accountLabel} record is linked to the wrong account role. Expected {$accountLabel}, found " . ($linkedRole ?: 'no active role') . '.',
      ];
    }
    return ['created' => false, 'linked' => true, 'userId' => $linkedUserId, 'mail' => null, 'error' => null];
  }
  if (email_taken($pdo, $email)) {
    $stmt = $pdo->prepare('SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1');
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch();
    $uid = (int) ($existingUser['id'] ?? 0);
    $roleName = (string) ($existingUser['role_name'] ?? '');
    if ($uid <= 0 || strcasecmp($roleName, $accountLabel) !== 0) {
      return [
        'created' => false,
        'linked' => false,
        'userId' => null,
        'mail' => null,
        'error' => "That email already belongs to a different account role. Use a unique {$accountLabel} email.",
      ];
    }
    $pdo->prepare('UPDATE volunteers SET user_id = ?, status = ? WHERE id = ?')
      ->execute([$uid, 'Approved', (int) $volunteerRow['id']]);
    return ['created' => false, 'linked' => true, 'userId' => $uid, 'mail' => null, 'error' => null];
  }

  $tempPassword = generate_temp_password();
  try {
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) {
      $pdo->beginTransaction();
    }
    $userId = create_user_account($pdo, $accountLabel, $name, $email, $tempPassword, 'ACTIVE', true, [
      'lastName' => (string) ($volunteerRow['last_name'] ?? ''),
      'firstName' => (string) ($volunteerRow['first_name'] ?? ''),
      'middleInitial' => (string) ($volunteerRow['middle_initial'] ?? ''),
    ]);
    accept_privacy_terms($pdo, $userId);
    $pdo->prepare('UPDATE volunteers SET user_id = ?, status = ? WHERE id = ?')
      ->execute([$userId, 'Approved', (int) $volunteerRow['id']]);
    if ($ownsTransaction) {
      $pdo->commit();
    }
  } catch (Throwable $e) {
    if (isset($ownsTransaction) && $ownsTransaction && $pdo->inTransaction()) {
      $pdo->rollBack();
    }
    // A concurrent double-click may have provisioned the same role-specific
    // account first. Link it without generating or emailing another password.
    $existingStmt = $pdo->prepare('SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1');
    $existingStmt->execute([$email]);
    $existingUser = $existingStmt->fetch();
    if ($existingUser && strcasecmp((string) ($existingUser['role_name'] ?? ''), $accountLabel) === 0) {
      $existingUserId = (int) ($existingUser['id'] ?? 0);
      if ($existingUserId > 0) {
        $pdo->prepare('UPDATE volunteers SET user_id = ?, status = ? WHERE id = ?')
          ->execute([$existingUserId, 'Approved', (int) $volunteerRow['id']]);
        return ['created' => false, 'linked' => true, 'userId' => $existingUserId, 'mail' => null, 'temporaryPassword' => null, 'error' => null];
      }
    }
    return [
      'created' => false,
      'linked' => false,
      'userId' => null,
      'mail' => null,
      'temporaryPassword' => null,
      'error' => "{$accountLabel} account creation failed: " . $e->getMessage(),
    ];
  }

  // Credentials are sent only after the account and profile link succeed.
  $mail = send_account_credentials($email, $name, $email, $tempPassword, $accountLabel);
  $sent = !empty($mail['sent']);
  $transport = (string) ($mail['transport'] ?? '');
  $includeTemp = !$sent || $transport === 'outbox' || !in_array($transport, ['brevo', 'nodemailer', 'smtp', 'mail'], true);
  return [
    'created' => true,
    'linked' => false,
    'userId' => $userId,
    'mail' => $mail,
    'temporaryPassword' => $includeTemp ? $tempPassword : null,
    'error' => null,
  ];
}

/* ---------------- Email verification ---------------- */

function generate_verification_token(): string
{
  return bin2hex(random_bytes(32));
}

/**
 * Absolute URL to the API verify endpoint (fallback when the frontend is offline).
 * Prefer API_PUBLIC_URL in production when the API host differs from the SPA.
 */
function api_verify_url(string $token): string
{
  if (defined('API_PUBLIC_URL') && API_PUBLIC_URL !== '') {
    return rtrim((string) API_PUBLIC_URL, '/') . '/verify.php?token=' . urlencode($token);
  }
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $fwd = strtolower(trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_PROTO'])[0]));
    if (in_array($fwd, ['http', 'https'], true)) {
      $scheme = $fwd;
    }
  }
  $host = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost'))[0]);
  $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
  $dir = rtrim($dir, '/');
  return "{$scheme}://{$host}{$dir}/verify.php?token=" . urlencode($token);
}

/**
 * Absolute URL the user clicks in the verification email.
 * Hits the API directly (via Vite /api proxy in local, or API_PUBLIC_URL in production).
 * No in-app "Verify" page — activation happens from the email link alone.
 */
function build_verify_url(string $token): string
{
  if (defined('API_PUBLIC_URL') && API_PUBLIC_URL !== '') {
    return rtrim((string) API_PUBLIC_URL, '/') . '/verify.php?token=' . urlencode($token);
  }
  return frontend_url('/api/verify.php?token=' . urlencode($token));
}

/**
 * Send a "Verify it's you" activation email via NodeMailer (preferred).
 * Returns ['url' => string, 'sent' => bool, 'transport' => string, 'error' => string].
 */
function send_verification_email(string $toEmail, string $name, string $token): array
{
  $url = build_verify_url($token);
  $sent = false;

  if (function_exists('nodemailer_send_verification') && function_exists('mail_resolved_transport') && mail_resolved_transport() === 'nodemailer') {
    $sent = nodemailer_send_verification($toEmail, $name, $url);
  } elseif (function_exists('send_mail')) {
    $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    $subject = "Verify it's you";
    $html = "<p style=\"margin:0 0 12px;font-size:1.15rem;font-weight:700;color:#0f172a\">Verify it's you</p>"
      . "<p style=\"margin:0 0 14px\">Hi {$safeName},</p>"
      . '<p style="margin:0 0 14px">We received a request to create a <strong>Rise Above Foundation</strong> account with this email address. '
      . 'Click the button below to verify your email and activate your account. '
      . 'Then sign in with the <strong>same password you created during registration</strong> — you will not be asked to set a new one. '
      . 'This link expires in 24 hours.</p>'
      . '<p style="margin:24px 0;text-align:center">'
      . '<a href="' . $safeUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">Verify it\'s you</a>'
      . '</p>'
      . '<p style="margin:0;color:#64748b;font-size:0.88rem">If you did not create this account, you can safely ignore this email.</p>';
    $sent = (bool) send_mail($toEmail, $name, $subject, $html);
  }

  $result = function_exists('mail_last_result') ? mail_last_result() : ['ok' => $sent, 'transport' => '', 'error' => ''];
  return [
    'url' => $url,
    'sent' => $sent,
    'transport' => (string) ($result['transport'] ?? ''),
    'error' => (string) ($result['error'] ?? ''),
  ];
}

/**
 * Send Barangay approval welcome email with login credentials after Admin approval.
 * Returns ['sent' => bool, 'transport' => string, 'error' => string].
 */
function send_barangay_approval_credentials(string $toEmail, string $name, string $barangayName, string $loginEmail, string $password): array
{
  $sent = false;
  $nodeError = '';

  $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
  $safeBarangay = htmlspecialchars($barangayName, ENT_QUOTES, 'UTF-8');
  $safeEmail = htmlspecialchars($loginEmail, ENT_QUOTES, 'UTF-8');
  $safePassword = htmlspecialchars($password, ENT_QUOTES, 'UTF-8');
  $loginUrl = htmlspecialchars(frontend_url('/login'), ENT_QUOTES, 'UTF-8');
  $year = date('Y');
  $support = function_exists('mail_reply_to_address') ? mail_reply_to_address() : '';
  $safeSupport = htmlspecialchars($support, ENT_QUOTES, 'UTF-8');

  $subject = 'Welcome to Rise Above Foundation Cebu!';
  $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">'
    . '<title>Welcome to Rise Above Foundation Cebu</title></head>'
    . '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">'
    . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">'
    . 'Your Barangay has been approved as a beneficiary of Rise Above Foundation Cebu. Your Barangay Portal account is ready.'
    . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px"><tr><td align="center">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">'
    . '<tr><td style="background:#AF101A;padding:24px 28px;text-align:center">'
    . '<div style="color:#ffffff;font-size:1.25rem;font-weight:800;letter-spacing:-0.02em">Rise Above Foundation Cebu</div>'
    . '<div style="color:rgba(255,255,255,0.92);font-size:0.85rem;margin-top:4px;font-weight:500">Barangay Partner Program</div>'
    . '</td></tr>'
    . '<tr><td style="padding:32px 28px 8px;text-align:center">'
    . '<div style="width:64px;height:64px;margin:0 auto 16px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center">'
    . '<div style="width:40px;height:40px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center">'
    . '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    . '</div></div>'
    . '<h1 style="margin:0 0 12px;font-size:1.65rem;line-height:1.25;color:#0f172a;font-weight:800">Welcome to Rise Above Foundation Cebu!</h1>'
    . "<p style=\"margin:0 0 18px;font-size:1.05rem;line-height:1.65;color:#475569\">We are pleased to inform you that <strong style=\"color:#0f172a\">{$safeBarangay}</strong> has been approved as a beneficiary of Rise Above Foundation Cebu.</p>"
    . '<p style="margin:0;font-size:0.98rem;line-height:1.6;color:#64748b">Your Barangay Portal account is now ready, and your login credentials are provided below.</p>'
    . '</td></tr>'
    . '<tr><td style="padding:24px 28px 12px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px">'
    . '<tr><td style="padding:18px 20px;border-bottom:2px solid #e2e8f0">'
    . '<div style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Email Address</div>'
    . "<div style=\"font-size:1.05rem;font-weight:650;color:#0f172a;word-break:break-all\">{$safeEmail}</div></td></tr>"
    . '<tr><td style="padding:18px 20px">'
    . '<div style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Temporary Password</div>'
    . "<div style=\"font-size:1.2rem;font-weight:800;font-family:Consolas,Monaco,monospace;color:#AF101A;letter-spacing:0.06em\">{$safePassword}</div>"
    . '<div style="font-size:0.75rem;color:#64748b;margin-top:6px">Change this after your first login</div></td></tr>'
    . '</table></td></tr>'
    . '<tr><td style="padding:24px 28px 12px;text-align:center">'
    . '<a href="' . $loginUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:16px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:1.05rem;letter-spacing:0.01em;box-shadow:0 4px 12px rgba(175,16,26,0.25)">Access Barangay Portal</a>'
    . '</td></tr>'
    . '<tr><td style="padding:12px 28px 26px">'
    . '<div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:10px;padding:16px 18px">'
    . '<div style="font-size:0.85rem;font-weight:700;color:#0369a1;margin-bottom:6px">📋 Next Steps:</div>'
    . '<div style="font-size:0.85rem;line-height:1.6;color:#075985">'
    . '1. Log in using your credentials above<br>'
    . '2. Set your own secure password<br>'
    . '3. Complete your barangay profile<br>'
    . '4. Start submitting assistance requests'
    . '</div></div></td></tr>'
    . '<tr><td style="padding:0 28px 26px"><div style="background:#fef3c7;border:2px solid #fde047;border-radius:10px;padding:14px 16px;font-size:0.82rem;line-height:1.55;color:#854d0e">'
    . '<strong style="color:#713f12;display:block;margin-bottom:4px">🔒 Security Reminder:</strong>'
    . 'Keep this password confidential. Change it immediately after your first login. Never share your login details with anyone.</div></td></tr>'
    . '<tr><td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid#e2e8f0;text-align:center;font-size:0.75rem;line-height:1.6;color:#94a3b8">'
    . '<strong style="color:#475569;display:block;margin-bottom:4px">Rise Above Foundation Cebu</strong>'
    . '© ' . $year . ' Rise Above Foundation Cebu. All rights reserved.'
    . ($safeSupport !== '' ? '<br>Questions? Contact <a href="mailto:' . $safeSupport . '" style="color:#2563eb">' . $safeSupport . '</a>' : '')
    . '</td></tr>'
    . '</table></td></tr></table></body></html>';

  if (function_exists('send_mail')) {
    $sent = (bool) send_mail($toEmail, $name, $subject, $html);
  }

  $result = function_exists('mail_last_result') ? mail_last_result() : ['ok' => $sent, 'transport' => '', 'error' => ''];
  return [
    'sent' => $sent,
    'transport' => (string) ($result['transport'] ?? ''),
    'error' => (string) ($result['error'] ?? ($sent ? '' : 'Welcome email was not delivered')),
  ];
}

/**
 * Send login credentials when an admin creates an account for a user.
 * Prefers NodeMailer; falls back to PHP SMTP/outbox so delivery stays consistent.
 * Returns ['sent' => bool, 'transport' => string, 'error' => string].
 */
function send_account_credentials(string $toEmail, string $name, string $loginEmail, string $password, string $role): array
{
  $sent = false;
  $nodeError = '';

  if (function_exists('nodemailer_send_credentials') && function_exists('mail_resolved_transport') && mail_resolved_transport() === 'nodemailer') {
    $sent = nodemailer_send_credentials($toEmail, $name, $loginEmail, $password, $role);
    if (!$sent) {
      $last = function_exists('mail_last_result') ? mail_last_result() : [];
      $nodeError = (string) ($last['error'] ?? 'NodeMailer credentials send failed');
    }
  }

  // Fallback when NodeMailer is down / misconfigured (same pattern as invitations).
  // Do not call send_mail() while MAIL_TRANSPORT=nodemailer — that would retry the same broken service.
  if (!$sent && function_exists('send_mail')) {
    $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($loginEmail, ENT_QUOTES, 'UTF-8');
    $safePassword = htmlspecialchars($password, ENT_QUOTES, 'UTF-8');
    $safeRole = htmlspecialchars($role, ENT_QUOTES, 'UTF-8');
    $loginUrl = htmlspecialchars(frontend_url('/login'), ENT_QUOTES, 'UTF-8');
    $recoveryUrl = htmlspecialchars(recovery_url(), ENT_QUOTES, 'UTF-8');
    $year = date('Y');
    $support = function_exists('mail_reply_to_address') ? mail_reply_to_address() : '';
    $safeSupport = htmlspecialchars($support, ENT_QUOTES, 'UTF-8');

    // Soft subject — avoid spam triggers like “password” / “credentials”.
    $subject = 'Your Rise Above Foundation Cebu portal account is ready';

    $heading = 'Your portal account is ready';
    if (in_array(strtolower($role), ['staff', 'donor', 'volunteer', 'intern'], true)) {
      $heading = 'Welcome to Rise Above Foundation Cebu!';
    }

    $intro = "Hi {$safeName}, an administrator created a <strong style=\"color:#0f172a\">{$safeRole}</strong> account for you on the Rise Above Foundation Cebu portal. Use the temporary password below to sign in, then choose a new password after your first login.";
    if (strcasecmp($role, 'Staff') === 0) {
      $intro = "Hi {$safeName}, welcome to the Rise Above Foundation Cebu team! Your Staff Portal account is ready for managing assigned tasks and supporting operations. Use the temporary password below to sign in, then choose a new password after your first login.";
    } elseif (strcasecmp($role, 'Donor') === 0) {
      $intro = "Hi {$safeName}, welcome and thank you for being a valued donor and partner! Your Donor Portal allows you to manage and track your donations. Use the temporary password below to sign in, then choose a new password after your first login.";
    } elseif (strcasecmp($role, 'Volunteer') === 0) {
      $intro = "Hi {$safeName}, welcome as a volunteer! Your Volunteer Portal allows you to view assigned tasks, schedules, and support relief operations. Use the temporary password below to sign in, then choose a new password after your first login.";
    } elseif (strcasecmp($role, 'Intern') === 0) {
      $intro = "Hi {$safeName}, congratulations on your internship approval! Your Intern Portal account is ready for viewing assigned tasks, schedules, and credited duty hours. Use the temporary password below to sign in, then choose a new password after your first login.";
    }

    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      . '<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">'
      . '<title>Your Rise Above Foundation Cebu portal account</title></head>'
      . '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">'
      . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">'
      . "Your {$safeRole} portal account with Rise Above Foundation Cebu is ready. Sign in to get started."
      . '</div>'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px"><tr><td align="center">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">'
      . '<tr><td style="background:#AF101A;padding:20px 28px">'
      . '<div style="color:#ffffff;font-size:1.08rem;font-weight:700">Rise Above Foundation Cebu</div>'
      . '<div style="color:rgba(255,255,255,0.88);font-size:0.82rem;margin-top:3px">Donation Management System</div>'
      . '</td></tr>'
      . '<tr><td style="padding:30px 28px 6px">'
      . '<p style="margin:0 0 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#AF101A">Account ready</p>'
      . '<h1 style="margin:0 0 14px;font-size:1.45rem;line-height:1.3;color:#0f172a">' . $heading . '</h1>'
      . "<p style=\"margin:0;font-size:0.98rem;line-height:1.65;color:#475569\">" . $intro . "</p>"
      . '</td></tr>'
      . '<tr><td style="padding:16px 28px 8px">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">'
      . '<tr><td style="padding:16px 18px;border-bottom:1px solid #e2e8f0">'
      . '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Sign-in email</div>'
      . "<div style=\"font-size:1rem;font-weight:650;color:#0f172a;word-break:break-all\">{$safeEmail}</div></td></tr>"
      . '<tr><td style="padding:16px 18px">'
      . '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Temporary password</div>'
      . "<div style=\"font-size:1.15rem;font-weight:750;font-family:Consolas,Monaco,monospace;color:#AF101A;letter-spacing:0.04em\">{$safePassword}</div></td></tr>"
      . '</table></td></tr>'
      . '<tr><td style="padding:22px 28px 8px;text-align:center">'
      . '<a href="' . $loginUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:15px 32px;border-radius:10px;text-decoration:none;font-weight:750;font-size:1rem">Open portal sign-in</a>'
      . '</td></tr>'
      . '<tr><td style="padding:10px 28px 8px;text-align:center">'
      . '<a href="' . $recoveryUrl . '" style="display:inline-block;background:#ffffff;color:#AF101A;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;border:2px solid #AF101A">Add recovery number</a>'
      . '</td></tr>'
      . '<tr><td style="padding:0 28px 26px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#475569"><strong style="color:#0f172a">Security note:</strong> This temporary password is only for your Rise Above Foundation Cebu portal account. Sign in soon, set your own password, and never forward this email.</div></td></tr>'
      . '<tr><td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:0.75rem;line-height:1.55;color:#94a3b8"><strong style="color:#475569">Rise Above Foundation Cebu</strong><br>© ' . $year . ' Rise Above Foundation Cebu. All rights reserved.<br>This transactional message was sent because an administrator created a portal account for you.'
      . ($safeSupport !== '' ? '<br>Questions? Contact <a href="mailto:' . $safeSupport . '" style="color:#2563eb">' . $safeSupport . '</a>.' : '')
      . '</td></tr>'
      . '</table></td></tr></table></body></html>';

    $prepared = function_exists('mail_prepare_html') ? mail_prepare_html($subject, $html) : $html;
    $activeTransport = function_exists('mail_resolved_transport') ? mail_resolved_transport() : '';

    if ($activeTransport === 'nodemailer') {
      $smtpReady = defined('SMTP_USER') && SMTP_USER !== '' && defined('SMTP_PASS') && SMTP_PASS !== '' && function_exists('smtp_send');
      if ($smtpReady) {
        $sent = smtp_send($toEmail, $name, $subject, $prepared);
        if (function_exists('mail_archive_outbox')) {
          mail_archive_outbox($toEmail, $name, $subject, $prepared, $sent, $sent ? 'smtp-fallback-ok' : 'smtp-fallback-failed');
        }
      }
      if (!$sent && function_exists('mail_archive_outbox')) {
        $path = mail_archive_outbox($toEmail, $name, $subject, $prepared, true, 'outbox-fallback');
        $sent = $path !== null;
        if ($sent && function_exists('mail_set_result')) {
          $note = 'Saved to outbox after NodeMailer failure';
          if ($nodeError !== '') {
            $note .= ': ' . $nodeError;
          }
          mail_set_result(true, 'outbox', $note);
        }
      } elseif ($sent && $nodeError !== '' && function_exists('mail_set_result')) {
        mail_set_result(true, 'smtp', 'Delivered via SMTP fallback after NodeMailer error: ' . $nodeError);
      }
    } else {
      $sent = (bool) send_mail($toEmail, $name, $subject, $html);
    }
  }

  $result = function_exists('mail_last_result') ? mail_last_result() : ['ok' => $sent, 'transport' => '', 'error' => ''];
  return [
    'sent' => $sent,
    'transport' => (string) ($result['transport'] ?? ''),
    'error' => (string) ($result['error'] ?? ($sent ? '' : ($nodeError !== '' ? $nodeError : 'Credentials email was not delivered'))),
  ];
}

/**
 * Send barangay partnership invitation email with accept-invite link.
 * Returns ['sent' => bool, 'transport' => string, 'error' => string, 'inviteUrl' => string].
 */
function send_invitation_email(string $toEmail, string $barangayName, string $token, int $expiresInDays = 7): array
{
  $inviteUrl = frontend_url('/accept-invite/' . rawurlencode($token));
  $sent = false;
  $days = max(1, $expiresInDays);
  $barangayLabel = trim($barangayName);
  if ($barangayLabel === '') {
    $barangayLabel = 'your barangay';
  } elseif (!preg_match('/^(barangay|brgy\.?)\b/i', $barangayLabel)) {
    $barangayLabel = 'Barangay ' . $barangayLabel;
  }
  $safeBarangay = htmlspecialchars($barangayLabel, ENT_QUOTES, 'UTF-8');
  $safeUrl = htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8');
  $subject = 'Partnership invitation — Rise Above Foundation Cebu';
  $html = '<p style="margin:0 0 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#AF101A">Barangay invitation</p>'
    . '<h1 style="margin:0 0 14px;font-size:1.45rem;line-height:1.3;color:#0f172a">Partner with Rise Above Foundation Cebu</h1>'
    . '<p style="margin:0 0 14px;line-height:1.65;color:#475569">Dear Barangay Representative,</p>'
    . "<p style=\"margin:0 0 14px;line-height:1.65;color:#475569\">Rise Above Foundation Cebu invites <strong>{$safeBarangay}</strong> to join our Donation Management System as an official partner community.</p>"
    . '<p style="margin:0 0 14px;line-height:1.65;color:#475569">Through this partnership, your barangay can request relief assistance, track distributions, submit delivery proofs, and coordinate with our team more efficiently — so aid reaches families who need it most.</p>'
    . "<p style=\"margin:0 0 14px;line-height:1.65;color:#475569\">To accept on behalf of your barangay, please complete the short registration form. Our administrators will review the application. Once approved, login credentials will be emailed to this address. This link expires in {$days} days.</p>"
    . '<p style="margin:24px 0;text-align:center">'
    . '<a href="' . $safeUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:15px 32px;border-radius:10px;text-decoration:none;font-weight:750">Accept Invitation</a>'
    . '</p>';

  if (function_exists('nodemailer_send_invitation') && function_exists('mail_resolved_transport') && mail_resolved_transport() === 'nodemailer') {
    $sent = nodemailer_send_invitation($toEmail, $barangayName, $inviteUrl, $expiresInDays);
  }

  // Fallback when NodeMailer is down / misconfigured.
  // Avoid retrying Node via send_mail() when MAIL_TRANSPORT is already nodemailer.
  if (!$sent && function_exists('send_mail')) {
    $prepared = function_exists('mail_prepare_html') ? mail_prepare_html($subject, $html) : $html;
    $activeTransport = function_exists('mail_resolved_transport') ? mail_resolved_transport() : '';
    if ($activeTransport === 'nodemailer') {
      $smtpReady = defined('SMTP_USER') && SMTP_USER !== '' && defined('SMTP_PASS') && SMTP_PASS !== '' && function_exists('smtp_send');
      if ($smtpReady) {
        $sent = smtp_send($toEmail, 'Barangay Representative', $subject, $prepared);
        if (function_exists('mail_archive_outbox')) {
          mail_archive_outbox($toEmail, 'Barangay Representative', $subject, $prepared, $sent, $sent ? 'smtp-fallback-ok' : 'smtp-fallback-failed');
        }
      }
      if (!$sent && function_exists('mail_archive_outbox')) {
        $path = mail_archive_outbox($toEmail, 'Barangay Representative', $subject, $prepared, true, 'outbox-fallback');
        $sent = $path !== null;
        if ($sent && function_exists('mail_set_result')) {
          mail_set_result(true, 'outbox', 'Saved invitation to outbox after NodeMailer failure');
        }
      }
    } else {
      $sent = (bool) send_mail($toEmail, 'Barangay Representative', $subject, $html);
    }
  }

  $result = function_exists('mail_last_result') ? mail_last_result() : ['ok' => $sent, 'transport' => '', 'error' => ''];
  return [
    'sent' => $sent,
    'transport' => (string) ($result['transport'] ?? ''),
    'error' => (string) ($result['error'] ?? ($sent ? '' : 'Invitation email was not delivered')),
    'inviteUrl' => $inviteUrl,
  ];
}



/**
 * Cryptographically random temporary password (uppercase, lowercase, digits, symbols).
 * Plaintext is emailed once; only password_hash() is stored in the database.
 */
function generate_temp_password(int $length = 14): string
{
  $length = max(12, $length);
  $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  $lower = 'abcdefghijkmnopqrstuvwxyz';
  $digits = '23456789';
  $symbols = '!@#$%&*?';
  $all = $upper . $lower . $digits . $symbols;

  $chars = [
    $upper[random_int(0, strlen($upper) - 1)],
    $lower[random_int(0, strlen($lower) - 1)],
    $digits[random_int(0, strlen($digits) - 1)],
    $symbols[random_int(0, strlen($symbols) - 1)],
  ];
  for ($i = count($chars); $i < $length; $i++) {
    $chars[] = $all[random_int(0, strlen($all) - 1)];
  }
  for ($i = count($chars) - 1; $i > 0; $i--) {
    $j = random_int(0, $i);
    [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
  }
  return implode('', $chars);
}

function validate_password_policy(?string $password, string $fieldLabel = 'Password'): ?string
{
  $pass = (string) ($password ?? '');
  if (strlen($pass) < 8) {
    return "{$fieldLabel} must be at least 8 characters long.";
  }
  if (!preg_match('/[A-Z]/', $pass)) {
    return "{$fieldLabel} must contain at least one uppercase letter (A-Z).";
  }
  if (!preg_match('/[a-z]/', $pass)) {
    return "{$fieldLabel} must contain at least one lowercase letter (a-z).";
  }
  if (!preg_match('/[0-9]/', $pass)) {
    return "{$fieldLabel} must contain at least one number (0-9).";
  }
  if (!preg_match('/[^a-zA-Z0-9]/', $pass)) {
    return "{$fieldLabel} must contain at least one special character.";
  }
  return null;
}

function accept_privacy_terms(PDO $pdo, int $userId): void
{
  $pdo->prepare('UPDATE users SET terms_accepted_at = NOW(), privacy_accepted_at = NOW() WHERE id = ?')
    ->execute([$userId]);
}

function distribution_workflow_steps(): array
{
  return ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Proof Review', 'Completed'];
}

const WORKFLOW_DISTRIBUTION_STEPS = ['Planning', 'Preparing', 'In Transit', 'Delivered', 'Proof Review', 'Completed'];
const WORKFLOW_DISTRIBUTION_TERMINAL = ['Completed'];
const WORKFLOW_DISTRIBUTION_ALIASES = [
  'Scheduled' => 'Planning',
  'Pending' => 'Planning',
  'In Progress' => 'Preparing',
  'Awaiting Proof' => 'Proof Review',
];

const WORKFLOW_DONATION_STEPS = ['Pending Verification', 'Completed'];
const WORKFLOW_DONATION_TERMINAL = ['Completed', 'Rejected', 'Cancelled'];
const WORKFLOW_DONATION_BRANCHES = [
  'Pending Verification' => ['Completed', 'Verified', 'Rejected', 'Cancelled'],
  'Verified' => ['Completed', 'Cancelled'],
  'In Inventory' => ['Completed', 'Cancelled'],
  'Allocated' => ['Completed', 'Cancelled'],
  'In Transit' => ['Completed'],
  'Delivered' => ['Completed'],
];
const WORKFLOW_DONATION_ALIASES = [
  'Verified' => 'Completed',
  'Certificate / Official Receipt' => 'Completed',
];

const WORKFLOW_REQUEST_STEPS = [
  'Pending Review',
  'Under Review',
  'Approved',
  'Allocated',
  'In Transit',
  'Delivered',
  'Proof Review',
  'Completed',
];
const WORKFLOW_REQUEST_TERMINAL = ['Completed', 'Rejected', 'Cancelled'];
const WORKFLOW_REQUEST_BRANCHES = [
  'Pending Review' => ['Under Review', 'Approved', 'Ready for Allocation', 'Rejected', 'Cancelled'],
  'Under Review' => ['Approved', 'Ready for Allocation', 'Rejected', 'Cancelled'],
  'Approved' => ['Ready for Allocation', 'Partially Funded', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Ready for Allocation' => ['Partially Funded', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Funded' => ['Ready for Allocation', 'Partially Allocated', 'Allocated', 'Cancelled'],
  'Partially Allocated' => ['Allocated', 'Cancelled'],
  'Allocated' => ['In Transit', 'Cancelled'],
  'In Transit' => ['Delivered', 'Completed'],
  'Delivered' => ['Proof Review', 'Completed'],
  'Proof Review' => ['Delivered', 'Completed'],
];
const WORKFLOW_REQUEST_ALIASES = [
  'In Progress' => 'Allocated',
  'In Distribution' => 'Allocated',
  'Preparing' => 'Allocated',
  'Scheduled' => 'Allocated',
  'Scheduled for Delivery' => 'Allocated',
  'Ready' => 'Ready for Allocation',
];

/**
 * Resolves standard wholesale/catalog unit cost for relief goods.
 * Checks inventory_items table if pdo provided, or falls back to standard Cebu wholesale rates.
 */
function get_standard_item_unit_cost(string $itemName, ?string $category = null, ?PDO $pdo = null): float
{
  $name = trim($itemName);
  $cat = trim((string) ($category ?? ''));

  if ($pdo && $name !== '') {
    try {
      $stmt = $pdo->prepare('SELECT cost_per_unit FROM inventory_items WHERE LOWER(item_name) = LOWER(?) AND cost_per_unit IS NOT NULL AND cost_per_unit > 0 LIMIT 1');
      $stmt->execute([$name]);
      $dbCost = $stmt->fetchColumn();
      if ($dbCost !== false && (float) $dbCost > 0) {
        return (float) $dbCost;
      }
    } catch (Throwable $e) {}
  }

  $lower = strtolower($name);
  return match(true) {
    str_contains($lower, '25kg') || str_contains($lower, '50kg') || (str_contains($lower, 'rice') && str_contains($lower, 'sack')) => 1250.0,
    str_contains($lower, '5kg') && str_contains($lower, 'rice') => 260.0,
    str_contains($lower, 'rice') => 350.0,
    str_contains($lower, 'canned') && str_contains($lower, 'box') => 2500.0,
    str_contains($lower, 'sardines') || str_contains($lower, 'canned') || str_contains($lower, 'tuna') || str_contains($lower, 'corned beef') => 35.0,
    str_contains($lower, 'noodle') => 18.0,
    str_contains($lower, '5-gallon') || str_contains($lower, '20l') => 75.0,
    str_contains($lower, 'water') && str_contains($lower, 'case') => 240.0,
    str_contains($lower, 'water') => 25.0,
    str_contains($lower, 'hygiene') || str_contains($lower, 'sanitation') || str_contains($lower, 'toiletries') => 300.0,
    str_contains($lower, 'soap') || str_contains($lower, 'alcohol') || str_contains($lower, 'sanitizer') => 85.0,
    str_contains($lower, 'first aid') || str_contains($lower, 'medicine') || str_contains($lower, 'medical') => 450.0,
    str_contains($lower, 'paracetamol') || str_contains($lower, 'vitamin') => 120.0,
    str_contains($lower, 'tarpaulin') || str_contains($lower, 'tarp') || str_contains($lower, 'shelter') => 650.0,
    str_contains($lower, 'mat') || str_contains($lower, 'blanket') => 380.0,
    str_contains($lower, 'school') || str_contains($lower, 'student') || str_contains($lower, 'education') => 400.0,
    str_contains($lower, 'baby') || str_contains($lower, 'infant') => 450.0,
    str_contains($lower, 'clothing') || str_contains($lower, 'clothes') => 250.0,
    str_contains($lower, 'relief pack') || str_contains($lower, 'food pack') || str_contains($lower, 'emergency pack') => 500.0,
    stripos($cat, 'food') !== false => 250.0,
    stripos($cat, 'hygiene') !== false => 250.0,
    stripos($cat, 'medical') !== false => 350.0,
    stripos($cat, 'shelter') !== false => 500.0,
    default => 200.0,
  };
}

/**
 * Builds the current request-item balance from request needs and procurement records.
 * This is the shared source of truth for suggested funding, family coverage, and validation.
 */
function calculate_relief_request_finances(PDO $pdo, array $row): array
{
  $reqId = (int) ($row['id'] ?? 0);
  $requestedFamilies = max(0, (int) ($row['affected_families'] ?? 0));
  if ($requestedFamilies <= 0 && !empty($row['notes'])) {
    if (preg_match('/Families\s*Affected\s*:\s*(\d+)/i', (string) $row['notes'], $m)) {
      $requestedFamilies = max(0, (int) $m[1]);
    } elseif (preg_match('/(\d+)\s*families/i', (string) $row['notes'], $m)) {
      $requestedFamilies = max(0, (int) $m[1]);
    }
  }

  // Request forms currently persist item names. Structured legacy rows with an
  // explicit quantity are kept as-is; plain item names mean one pack per family.
  $needs = [];
  if (!empty($row['needs_json'])) {
    $decoded = json_decode((string) $row['needs_json'], true);
    if (is_array($decoded)) {
      $needs = $decoded;
    }
  }

  if (!$needs && !empty($row['notes']) && preg_match('/(?:Type of Needs|Goods Required):\s*([^\r\n]+)/i', (string) $row['notes'], $m)) {
    $needs = array_filter(array_map('trim', explode(',', $m[1])));
  }
  if (!$needs && !empty($row['assistance_type'])) {
    $needs = array_filter(array_map('trim', explode(',', (string) $row['assistance_type'])));
  }

  $requestedItemsByKey = [];
  foreach ($needs as $need) {
    $isStructured = is_array($need);
    $name = trim((string) ($isStructured ? ($need['item'] ?? $need['name'] ?? '') : $need));
    if ($name === '') continue;
    $quantity = $isStructured
      ? max(0, (int) ($need['quantity'] ?? 0))
      : $requestedFamilies;
    if ($quantity <= 0) continue;
    $unit = trim((string) ($isStructured ? ($need['unit'] ?? 'units') : 'packs')) ?: 'units';
    $unitCost = round(get_standard_item_unit_cost($name, null, $pdo), 2);
    if ($unitCost <= 0) continue;
    $key = strtolower($name) . "\0" . strtolower($unit);
    if (!isset($requestedItemsByKey[$key])) {
      $requestedItemsByKey[$key] = [
        'item' => $name,
        'unit' => $unit,
        'unitCost' => $unitCost,
        'quantity' => 0,
      ];
    }
    $requestedItemsByKey[$key]['quantity'] += $quantity;
  }

  // Parse past procurement line quantities, rather than inferring goods from
  // cash spent. This prevents a repeated plan from funding the same need twice.
  $alreadyFundedAmount = 0.0;
  $allocatedQuantities = [];
  if ($reqId > 0) {
    try {
      $lockRows = $pdo->inTransaction() ? ' FOR UPDATE' : '';
      $stmt = $pdo->prepare('
        SELECT total_amount, items_json
        FROM donation_procurements
        WHERE assistance_request_id = ?
      ' . $lockRows);
      $stmt->execute([$reqId]);
      foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $procurement) {
        $procurementAmount = (float) ($procurement['total_amount'] ?? 0);
        if ($procurementAmount <= 0) continue;
        $alreadyFundedAmount += $procurementAmount;
        $allocatedItems = json_decode((string) ($procurement['items_json'] ?? ''), true);
        if (!is_array($allocatedItems)) continue;
        foreach ($allocatedItems as $allocatedItem) {
          if (!is_array($allocatedItem)) continue;
          $name = trim((string) ($allocatedItem['item'] ?? $allocatedItem['name'] ?? ''));
          $unit = trim((string) ($allocatedItem['unit'] ?? 'units')) ?: 'units';
          $quantity = max(0, (int) ($allocatedItem['quantity'] ?? 0));
          $key = strtolower($name) . "\0" . strtolower($unit);
          if ($name !== '' && $quantity > 0 && isset($requestedItemsByKey[$key])) {
            $allocatedQuantities[$key] = ($allocatedQuantities[$key] ?? 0) + $quantity;
          }
        }
      }
    } catch (Throwable $e) {}

    // Inventory-backed relief allocations also fulfill these same request needs.
    // Monetary allocation rows are excluded because their quantities are already
    // represented in donation_procurements.items_json.
    try {
      $allocationStmt = $pdo->prepare("
        SELECT a.resource_name, a.quantity, a.unit
        FROM allocations a
        WHERE a.assistance_request_id = ?
          AND a.status IN ('Reserved', 'Allocated', 'In Distribution', 'Delivered', 'Completed')
          AND NOT EXISTS (
            SELECT 1 FROM donation_procurements dp WHERE dp.allocation_id = a.id
          )
      " . $lockRows);
      $allocationStmt->execute([$reqId]);
      foreach ($allocationStmt->fetchAll(PDO::FETCH_ASSOC) as $allocation) {
        $name = trim((string) ($allocation['resource_name'] ?? ''));
        $unit = trim((string) ($allocation['unit'] ?? ''));
        $quantity = max(0, (int) ($allocation['quantity'] ?? 0));
        if ($name === '' || $unit === '' || $quantity <= 0) continue;
        $key = strtolower($name) . "\0" . strtolower($unit);
        if (isset($requestedItemsByKey[$key])) {
          $allocatedQuantities[$key] = ($allocatedQuantities[$key] ?? 0) + $quantity;
        }
      }
    } catch (Throwable $e) {}
  }

  $requestedItems = [];
  $remainingItems = [];
  $totalCalculatedCost = 0.0;
  $remainingCost = 0.0;
  $coverageRatio = 1.0;
  foreach ($requestedItemsByKey as $key => $item) {
    $requiredQuantity = (int) $item['quantity'];
    $allocatedQuantity = min($requiredQuantity, (int) ($allocatedQuantities[$key] ?? 0));
    $remainingQuantity = max(0, $requiredQuantity - $allocatedQuantity);
    $lineCost = round($requiredQuantity * $item['unitCost'], 2);
    $remainingLineCost = round($remainingQuantity * $item['unitCost'], 2);
    $totalCalculatedCost += $lineCost;
    $remainingCost += $remainingLineCost;
    if ($requiredQuantity > 0) {
      $coverageRatio = min($coverageRatio, $allocatedQuantity / $requiredQuantity);
    }
    $requestedItems[] = array_merge($item, [
      'requestedQuantity' => $requiredQuantity,
      'allocatedQuantity' => $allocatedQuantity,
      'remainingQuantity' => $remainingQuantity,
      'totalCost' => $lineCost,
    ]);
    if ($remainingQuantity > 0) {
      $remainingItems[] = array_merge($item, [
        'requestedQuantity' => $requiredQuantity,
        'allocatedQuantity' => $allocatedQuantity,
        'remainingQuantity' => $remainingQuantity,
        'quantity' => $remainingQuantity,
        'totalCost' => $remainingLineCost,
      ]);
    }
  }

  $alreadySupportedFamilies = $requestedItems && $requestedFamilies > 0
    ? min($requestedFamilies, (int) floor(($coverageRatio * $requestedFamilies) + 0.00001))
    : 0;
  $remainingFamilies = max(0, $requestedFamilies - $alreadySupportedFamilies);
  $totalCalculatedCost = round($totalCalculatedCost, 2);
  $remainingCost = round($remainingCost, 2);

  return [
    'requestedFamilies' => $requestedFamilies,
    'affectedFamilies' => $requestedFamilies,
    'totalCost' => $totalCalculatedCost,
    'alreadyFundedAmount' => $alreadyFundedAmount,
    'alreadySupportedFamilies' => $alreadySupportedFamilies,
    'remainingCost' => $remainingCost,
    'remainingFamilies' => $remainingFamilies,
    'familiesStillNeedingSupport' => $remainingFamilies,
    'isFullyFunded' => empty($remainingItems),
    'items' => $requestedItems,
    'requestedItems' => $requestedItems,
    'remainingItems' => $remainingItems,
  ];
}

if (!function_exists('ensure_procurement_table')) {
  function ensure_procurement_table(PDO $pdo): void
  {
    static $done = false;
    if ($done) {
      return;
    }
    try {
      $pdo->exec("
        CREATE TABLE IF NOT EXISTS donation_procurements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          donation_id INT NOT NULL,
          mode VARCHAR(50) NOT NULL DEFAULT 'Pack Sponsorship',
          beneficiary_id INT NULL,
          assistance_request_id INT NULL,
          allocation_id INT NULL,
          total_amount DECIMAL(12,2) NOT NULL,
          items_json TEXT NOT NULL,
          allocation_snapshot_json TEXT NULL,
          receipt_number VARCHAR(100) NULL,
          supplier_name VARCHAR(150) NULL,
          families_supported INT UNSIGNED NOT NULL DEFAULT 0,
          notes TEXT NULL,
          created_by_user_id INT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_proc_donation (donation_id),
          INDEX idx_proc_ben (beneficiary_id),
          INDEX idx_proc_req (assistance_request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      ");
    } catch (Throwable $e) {}
    ensure_column($pdo, 'donation_procurements', 'allocation_snapshot_json', 'TEXT NULL AFTER items_json');
    $done = true;
  }
}

const WORKFLOW_TASK_STEPS = ['todo', 'inProgress', 'review', 'done'];
const WORKFLOW_TASK_TERMINAL = ['done'];
const WORKFLOW_TASK_ALIASES = [
  'To Do' => 'todo',
  'In Progress' => 'inProgress',
  'In Review' => 'review',
  'Done' => 'done',
  'Completed' => 'done',
  'Ongoing' => 'inProgress',
];

const WORKFLOW_ALLOCATION_STEPS = ['Allocated', 'Scheduled', 'In Transit', 'Delivered'];
const WORKFLOW_ALLOCATION_TERMINAL = ['Delivered', 'Cancelled'];
const WORKFLOW_ALLOCATION_BRANCHES = [
  'Allocated' => ['Scheduled', 'In Distribution', 'Cancelled'],
  'Scheduled' => ['In Transit', 'Cancelled'],
  'In Distribution' => ['Scheduled', 'In Transit', 'Delivered', 'Cancelled'],
  'In Transit' => ['Delivered'],
];
const WORKFLOW_ALLOCATION_ALIASES = [
  'Pending' => 'Allocated',
  'Reserved' => 'Allocated',
  'Preparing' => 'Scheduled',
  'Scheduled for Delivery' => 'Scheduled',
];

/**
 * Ensures database columns and tables exist for syncing Inventory with Resource Allocation.
 */
function ensure_allocation_inventory_schema(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;
  $ensured = true;

  // Ensure inventory_items columns exist
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN stock_state VARCHAR(40) NOT NULL DEFAULT 'Available' AFTER unit");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN item_type VARCHAR(60) NULL AFTER category");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN brand VARCHAR(80) NULL AFTER item_type");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN variant VARCHAR(100) NULL AFTER brand");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN moderate_stock_threshold INT UNSIGNED NULL AFTER low_stock_threshold");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items ADD COLUMN total_quantity INT UNSIGNED NOT NULL DEFAULT 0 AFTER quantity");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE inventory_items MODIFY COLUMN total_quantity INT UNSIGNED NOT NULL DEFAULT 0");
  } catch (Throwable $e) {}

  // `quantity` is the available balance. Preserve a separate received-stock
  // baseline for legacy rows using every stock bucket we can still account for.
  try {
    $pdo->exec("
      UPDATE inventory_items
      SET total_quantity = GREATEST(
        COALESCE(total_quantity, 0),
        COALESCE(quantity, 0) + COALESCE(allocated, 0) + COALESCE(distributed, 0)
      )
      WHERE total_quantity IS NULL
         OR total_quantity < COALESCE(quantity, 0) + COALESCE(allocated, 0) + COALESCE(distributed, 0)
    ");
  } catch (Throwable $e) {}

  try {
    $pdo->exec("ALTER TABLE allocations ADD COLUMN inventory_item_id BIGINT UNSIGNED NULL AFTER beneficiary_id");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE allocations ADD COLUMN inventory_deducted TINYINT(1) NOT NULL DEFAULT 0 AFTER distribution_id");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE allocations ADD COLUMN deducted_quantity INT UNSIGNED NOT NULL DEFAULT 0 AFTER inventory_deducted");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE allocations ADD COLUMN unit VARCHAR(30) NULL AFTER deducted_quantity");
  } catch (Throwable $e) {}
  try {
    $pdo->exec("ALTER TABLE allocations ADD COLUMN variant VARCHAR(100) NULL AFTER unit");
  } catch (Throwable $e) {}

  // Monetary procurement allocations summarize multiple requested items in
  // resource_name, which can exceed the legacy VARCHAR(120) limit. Expand old
  // databases once before any allocation insert uses the wider summary.
  try {
    $resourceNameColumn = $pdo->query("SHOW COLUMNS FROM allocations LIKE 'resource_name'")->fetch(PDO::FETCH_ASSOC);
    if (!$resourceNameColumn) {
      throw new RuntimeException('allocations.resource_name column was not found.');
    }
    $resourceNameType = strtolower((string) ($resourceNameColumn['Type'] ?? ''));
    if (!preg_match('/^(text|mediumtext|longtext)(\b|$)/', $resourceNameType)) {
      $pdo->exec('ALTER TABLE allocations MODIFY COLUMN resource_name TEXT NOT NULL');
    }
  } catch (Throwable $e) {
    throw new RuntimeException('Unable to expand allocations.resource_name for multi-item procurement summaries.', 0, $e);
  }

  try {
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        inventory_item_id BIGINT UNSIGNED NOT NULL,
        transaction_type ENUM('Allocation', 'Restoration', 'Distribution', 'Adjustment') NOT NULL,
        quantity INT NOT NULL,
        balance_after INT NOT NULL,
        reference_code VARCHAR(50) NULL,
        destination VARCHAR(180) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inv_item (inventory_item_id),
        INDEX idx_ref_code (reference_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $transactionTypeColumn = $pdo->query("SHOW COLUMNS FROM inventory_transactions LIKE 'transaction_type'")->fetch(PDO::FETCH_ASSOC);
    $transactionType = strtolower((string) ($transactionTypeColumn['Type'] ?? ''));
    if (!str_contains($transactionType, "'intake'") || !str_contains($transactionType, "'repacking'")) {
      $pdo->exec("ALTER TABLE inventory_transactions MODIFY COLUMN transaction_type ENUM('Intake','Allocation','Restoration','Distribution','Adjustment','Repacking') NOT NULL");
    }
  } catch (Throwable $e) {}

  // Preserve which verified in-kind donation supplied stock. Inventory remains
  // aggregated, while these small ledgers let donation progress follow the
  // real allocation/distribution records without guessing from item names.
  try {
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS donation_inventory_sources (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        donation_id BIGINT UNSIGNED NOT NULL,
        inventory_item_id BIGINT UNSIGNED NOT NULL,
        received_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        allocated_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_donation_inventory_source (donation_id, inventory_item_id),
        INDEX idx_dis_inventory_available (inventory_item_id, allocated_quantity),
        CONSTRAINT fk_dis_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
        CONSTRAINT fk_dis_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS allocation_donation_sources (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        allocation_id BIGINT UNSIGNED NOT NULL,
        source_id BIGINT UNSIGNED NOT NULL,
        donation_id BIGINT UNSIGNED NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_allocation_source (allocation_id, source_id),
        INDEX idx_ads_donation (donation_id),
        CONSTRAINT fk_ads_allocation FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE CASCADE,
        CONSTRAINT fk_ads_source FOREIGN KEY (source_id) REFERENCES donation_inventory_sources(id) ON DELETE CASCADE,
        CONSTRAINT fk_ads_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
  } catch (Throwable $e) {
    // Legacy installations can continue operating; the API exposes stored
    // statuses until the migration privilege is available.
  }
}

/** Attribute an inventory deduction to the oldest unallocated in-kind sources. */
function consume_donation_inventory_sources(PDO $pdo, int $allocationId, int $inventoryItemId, int $quantity): void
{
  if ($allocationId <= 0 || $inventoryItemId <= 0 || $quantity <= 0) return;
  $stmt = $pdo->prepare("SELECT * FROM donation_inventory_sources WHERE inventory_item_id = ? AND allocated_quantity < received_quantity ORDER BY created_at ASC, id ASC FOR UPDATE");
  $stmt->execute([$inventoryItemId]);
  $remaining = $quantity;
  $touched = [];
  foreach ($stmt->fetchAll() as $source) {
    if ($remaining <= 0) break;
    $available = max(0, (int) $source['received_quantity'] - (int) $source['allocated_quantity']);
    $take = min($available, $remaining);
    if ($take <= 0) continue;
    $pdo->prepare('UPDATE donation_inventory_sources SET allocated_quantity = allocated_quantity + ? WHERE id = ?')
      ->execute([$take, (int) $source['id']]);
    $pdo->prepare('INSERT INTO allocation_donation_sources (allocation_id, source_id, donation_id, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)')
      ->execute([$allocationId, (int) $source['id'], (int) $source['donation_id'], $take]);
    $touched[] = (int) $source['donation_id'];
    $remaining -= $take;
  }
  sync_in_kind_donation_statuses($pdo, $touched);
}

/** Release source attribution when an allocation is cancelled or reduced. */
function release_donation_inventory_sources(PDO $pdo, int $allocationId, ?int $quantity = null): void
{
  $stmt = $pdo->prepare('SELECT * FROM allocation_donation_sources WHERE allocation_id = ? ORDER BY id DESC FOR UPDATE');
  $stmt->execute([$allocationId]);
  $remaining = $quantity === null ? PHP_INT_MAX : max(0, $quantity);
  $touched = [];
  foreach ($stmt->fetchAll() as $link) {
    if ($remaining <= 0) break;
    $release = min((int) $link['quantity'], $remaining);
    $pdo->prepare('UPDATE donation_inventory_sources SET allocated_quantity = GREATEST(0, allocated_quantity - ?) WHERE id = ?')
      ->execute([$release, (int) $link['source_id']]);
    if ($release >= (int) $link['quantity']) {
      $pdo->prepare('DELETE FROM allocation_donation_sources WHERE id = ?')->execute([(int) $link['id']]);
    } else {
      $pdo->prepare('UPDATE allocation_donation_sources SET quantity = quantity - ? WHERE id = ?')->execute([$release, (int) $link['id']]);
    }
    $touched[] = (int) $link['donation_id'];
    $remaining -= $release;
  }
  sync_in_kind_donation_statuses($pdo, $touched);
}

/** Resolve a donation lifecycle from its linked allocation rows. */
function resolve_donation_status_from_process_rows(array $rows): string
{
  if (!$rows) return 'Verified';
  $active = [];
  $hasCompleted = false;
  foreach ($rows as $row) {
    $distribution = normalize_distribution_status((string) ($row['distribution_status'] ?? ''));
    $allocation = trim((string) ($row['allocation_status'] ?? ''));
    $stage = match (true) {
      $distribution === 'Completed' => 'Completed',
      in_array($distribution, ['Delivered', 'Proof Review'], true) => 'Delivered',
      $distribution === 'In Transit' => 'In Transit',
      in_array($allocation, ['Delivered', 'Completed'], true) => $allocation === 'Completed' ? 'Completed' : 'Delivered',
      default => 'Allocated',
    };
    if ($stage === 'Completed') $hasCompleted = true;
    else $active[] = $stage;
  }
  if (!$active) return $hasCompleted ? 'Completed' : 'Allocated';
  $rank = ['Allocated' => 1, 'In Transit' => 2, 'Delivered' => 3];
  usort($active, static fn($a, $b) => ($rank[$b] ?? 0) <=> ($rank[$a] ?? 0));
  return $active[0] ?? 'Allocated';
}

/** Resolve progress from linked batches; remaining stock is balance data only. */
function resolve_linked_donation_status(PDO $pdo, int $donationId, string $type): string
{
  if ($donationId <= 0) return 'Verified';
  if ($type === 'In-Kind') {
    $stmt = $pdo->prepare("SELECT a.id allocation_id, a.status allocation_status, d.status distribution_status
      FROM allocation_donation_sources ads JOIN allocations a ON a.id = ads.allocation_id
      LEFT JOIN distributions d ON d.id = a.distribution_id
      WHERE ads.donation_id = ? AND a.status <> 'Cancelled'
      GROUP BY a.id, a.status, d.status ORDER BY a.id ASC");
  } else {
    $stmt = $pdo->prepare("SELECT a.id allocation_id, a.status allocation_status, d.status distribution_status
      FROM donation_procurements dp LEFT JOIN allocations a ON a.id = dp.allocation_id
      LEFT JOIN distributions d ON d.id = a.distribution_id
      WHERE dp.donation_id = ? AND (a.id IS NULL OR a.status <> 'Cancelled')
      GROUP BY a.id, a.status, d.status, dp.id ORDER BY COALESCE(a.id, dp.id) ASC");
  }
  $stmt->execute([$donationId]);
  $rows = $stmt->fetchAll();
  return resolve_donation_status_from_process_rows($rows);
}

function sync_in_kind_donation_statuses(PDO $pdo, array $donationIds): void
{
  foreach (array_values(array_unique(array_filter(array_map('intval', $donationIds)))) as $donationId) {
    try {
      $totals = $pdo->prepare('SELECT COALESCE(SUM(received_quantity),0) received, COALESCE(SUM(allocated_quantity),0) allocated FROM donation_inventory_sources WHERE donation_id = ?');
      $totals->execute([$donationId]);
      $source = $totals->fetch() ?: [];
      $received = (int) ($source['received'] ?? 0);
      $allocated = (int) ($source['allocated'] ?? 0);
      $status = $allocated <= 0 ? 'Verified' : resolve_linked_donation_status($pdo, $donationId, 'In-Kind');
      $pdo->prepare("UPDATE donations SET status = ? WHERE id = ? AND status NOT IN ('Pending Verification','Rejected','Cancelled')")
        ->execute([$status, $donationId]);
    } catch (Throwable $e) {}
  }
}

/** Keep linked donation records aligned with the furthest real distribution step. */
function sync_donations_for_distribution(PDO $pdo, int $distributionId, string $distributionStatus): void
{
  try {
    $stmt = $pdo->prepare("SELECT DISTINCT donation_id FROM donation_procurements WHERE allocation_id IN (SELECT id FROM allocations WHERE distribution_id = ?) UNION SELECT DISTINCT ads.donation_id FROM allocation_donation_sources ads JOIN allocations a ON a.id = ads.allocation_id WHERE a.distribution_id = ?");
    $stmt->execute([$distributionId, $distributionId]);
    $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    foreach ($ids as $donationId) {
      $donationStmt = $pdo->prepare('SELECT type, amount, status FROM donations WHERE id = ? LIMIT 1');
      $donationStmt->execute([$donationId]);
      $donation = $donationStmt->fetch();
      if (!$donation || in_array($donation['status'], ['Pending Verification', 'Rejected', 'Cancelled'], true)) continue;
      if (($donation['type'] ?? '') === 'In-Kind') {
        sync_in_kind_donation_statuses($pdo, [$donationId]);
        continue;
      }
      $procStmt = $pdo->prepare('SELECT dp.total_amount FROM donation_procurements dp WHERE dp.donation_id = ?');
      $procStmt->execute([$donationId]);
      $processes = $procStmt->fetchAll();
      $utilized = array_sum(array_map(static fn($p) => (float) $p['total_amount'], $processes));
      $status = $utilized <= 0.009 ? 'Verified' : resolve_linked_donation_status($pdo, $donationId, 'Monetary');
      $pdo->prepare('UPDATE donations SET status = ? WHERE id = ?')->execute([$status, $donationId]);
    }
  } catch (Throwable $e) {}
}

/**
 * Safely updates an inventory item's quantity, allocated count, and stock_state.
 * Gracefully falls back to updating without stock_state if the column is absent.
 */
function update_inventory_stock_state(PDO $pdo, int $itemId, int $quantity, int $allocated, string $stockState): void
{
  $oldStmt = $pdo->prepare('SELECT quantity, low_stock_threshold, moderate_stock_threshold FROM inventory_items WHERE id = ? LIMIT 1');
  $oldStmt->execute([$itemId]);
  $oldItem = $oldStmt->fetch();
  $previousLevel = $oldItem
    ? stock_level(
        (int) ($oldItem['quantity'] ?? 0),
        (int) ($oldItem['low_stock_threshold'] ?? 100),
        isset($oldItem['moderate_stock_threshold']) ? (int) $oldItem['moderate_stock_threshold'] : null
      )
    : null;

  try {
    $stmt = $pdo->prepare('UPDATE inventory_items SET quantity = ?, allocated = ?, stock_state = ? WHERE id = ?');
    $stmt->execute([$quantity, $allocated, $stockState, $itemId]);
  } catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'stock_state') || $e->getCode() === '42S22' || str_contains((string) $e->getCode(), '1054')) {
      $stmt = $pdo->prepare('UPDATE inventory_items SET quantity = ?, allocated = ? WHERE id = ?');
      $stmt->execute([$quantity, $allocated, $itemId]);
    } else {
      throw $e;
    }
  }

  sync_inventory_stock_alert($pdo, $itemId, $previousLevel);
}

/** Record one auditable inventory movement without changing stock. */
function record_inventory_transaction(
  PDO $pdo,
  int $inventoryItemId,
  string $type,
  int $quantity,
  int $balanceAfter,
  ?string $referenceCode = null,
  ?string $destination = null,
  ?string $notes = null
): void {
  if ($inventoryItemId <= 0 || $quantity <= 0) return;
  $allowed = ['Intake', 'Allocation', 'Restoration', 'Distribution', 'Adjustment', 'Repacking'];
  $safeType = in_array($type, $allowed, true) ? $type : 'Adjustment';
  $stmt = $pdo->prepare('
    INSERT INTO inventory_transactions (
      inventory_item_id, transaction_type, quantity, balance_after,
      reference_code, destination, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $inventoryItemId,
    $safeType,
    $quantity,
    $balanceAfter,
    $referenceCode,
    $destination,
    $notes,
  ]);
}


const WORKFLOW_VOLUNTEER_STEPS = ['Pending Review', 'Approved', 'Active', 'Assigned', 'Completed'];
const WORKFLOW_VOLUNTEER_TERMINAL = ['Completed', 'Rejected'];
const WORKFLOW_VOLUNTEER_BRANCHES = [
  'Pending Review' => ['Rejected'],
];

const WORKFLOW_CERTIFICATE_STEPS = ['Requested', 'Pending', 'Approved', 'Generated', 'Released'];
const WORKFLOW_CERTIFICATE_TERMINAL = ['Released', 'Rejected'];
const WORKFLOW_CERTIFICATE_BRANCHES = [
  'Requested' => ['Approved', 'Rejected'],
  'Pending' => ['Approved', 'Rejected'],
  'Approved' => ['Generated', 'Rejected'],
];

/**
 * Enforce one-way status workflows and lock finalized states.
 */
function assert_valid_status_transition(
  string $entityName,
  ?string $currentStatus,
  string $nextStatus,
  array $workflowOrder,
  array $terminalStatuses = [],
  array $allowedBranches = [],
  array $aliases = []
): void {
  $curr = trim((string) $currentStatus);
  $next = trim((string) $nextStatus);

  if (isset($aliases[$curr])) {
    $curr = $aliases[$curr];
  }
  if (isset($aliases[$next])) {
    $next = $aliases[$next];
  }

  // Unset or empty initial status is allowed
  if ($curr === '') {
    return;
  }

  // No change in status is always valid
  if ($curr === $next) {
    return;
  }

  // If already in a terminal/completed state, lock from modifications or reverts
  if (in_array($curr, $terminalStatuses, true)) {
    json_response([
      'ok' => false,
      'error' => "{$entityName} is already {$curr} (final status) and cannot be changed or reverted.",
    ], 400);
  }

  // Check if valid alternative branch
  if (!empty($allowedBranches[$curr]) && in_array($next, $allowedBranches[$curr], true)) {
    return;
  }

  $currIndex = array_search($curr, $workflowOrder, true);
  $nextIndex = array_search($next, $workflowOrder, true);

  if ($currIndex !== false && $nextIndex !== false) {
    if ($nextIndex < $currIndex) {
      json_response([
        'ok' => false,
        'error' => "Cannot revert {$entityName} status from \"{$curr}\" back to previous status \"{$next}\". The status workflow is one-way.",
      ], 400);
    }
    return;
  }

  json_response([
    'ok' => false,
    'error' => "Invalid status transition for {$entityName} from \"{$curr}\" to \"{$next}\".",
  ], 400);
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
  $eventName = strtolower((string) ($dist['event_name'] ?? ''));
  if ($location === '' && $eventName === '') {
    return false;
  }
  $brgyName = trim((string) ($ben['barangay'] ?? ($ben['full_name'] ?? '')));
  if ($brgyName !== '') {
    $stripped = trim((string) preg_replace('/^(brgy\.?|barangay)\s+/i', '', $brgyName));
    if ($stripped !== '' && (stripos($location, $stripped) !== false || stripos($eventName, $stripped) !== false)) {
      return true;
    }
    if (stripos($location, $brgyName) !== false || stripos($eventName, $brgyName) !== false) {
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

/**
 * Load donations for a logged-in donor by email and/or linked donors.user_id / donors.email.
 * Deduplicates rows matched by both email and donor_id.
 *
 * @return list<array<string,mixed>>
 */
function donations_for_donor_user(PDO $pdo, array $user): array
{
  $email = trim((string) ($user['email'] ?? ''));
  $userId = (int) ($user['id'] ?? 0);

  $donorIds = [];
  try {
    $donorLookup = $pdo->prepare(
      'SELECT id FROM donors
       WHERE (user_id IS NOT NULL AND user_id = ?)
          OR (email IS NOT NULL AND email <> "" AND LOWER(email) = LOWER(?))'
    );
    $donorLookup->execute([$userId, $email]);
    foreach ($donorLookup->fetchAll() as $dRow) {
      $donorIds[] = (int) $dRow['id'];
    }
    $donorIds = array_values(array_unique(array_filter($donorIds)));
  } catch (Throwable $e) {
    $donorIds = [];
  }

  $sql = 'SELECT * FROM donations WHERE 0=1';
  $params = [];
  if ($email !== '') {
    $sql = 'SELECT * FROM donations WHERE (donor_email IS NOT NULL AND donor_email <> "" AND LOWER(donor_email) = LOWER(?))';
    $params[] = $email;
  }
  if ($donorIds) {
    $placeholders = implode(',', array_fill(0, count($donorIds), '?'));
    if ($params) {
      $sql .= " OR donor_id IN ($placeholders)";
    } else {
      $sql = "SELECT * FROM donations WHERE donor_id IN ($placeholders)";
    }
    foreach ($donorIds as $did) {
      $params[] = $did;
    }
  }

  if (!$params) {
    return [];
  }

  $sql .= ' ORDER BY donation_date DESC, id DESC';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rawRows = $stmt->fetchAll();

  $seen = [];
  $rows = [];
  foreach ($rawRows as $row) {
    $rid = (int) ($row['id'] ?? 0);
    if ($rid > 0) {
      if (isset($seen[$rid])) {
        continue;
      }
      $seen[$rid] = true;
    }
    $rows[] = $row;
  }
  return $rows;
}

/**
 * True when a donor owns a donation row (email or linked donor_id).
 */
function donation_belongs_to_donor_user(PDO $pdo, array $donation, array $user): bool
{
  $email = trim((string) ($user['email'] ?? ''));
  $donationEmail = trim((string) ($donation['donor_email'] ?? ''));
  if ($email !== '' && $donationEmail !== '' && strcasecmp($email, $donationEmail) === 0) {
    return true;
  }

  $donorId = (int) ($donation['donor_id'] ?? 0);
  if ($donorId <= 0) {
    return false;
  }

  try {
    $stmt = $pdo->prepare(
      'SELECT id FROM donors
       WHERE id = ?
         AND (
           (user_id IS NOT NULL AND user_id = ?)
           OR (email IS NOT NULL AND email <> "" AND LOWER(email) = LOWER(?))
         )
       LIMIT 1'
    );
    $stmt->execute([$donorId, (int) ($user['id'] ?? 0), $email]);
    return (bool) $stmt->fetchColumn();
  } catch (Throwable $e) {
    return false;
  }
}


function ensure_distribution_schema(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;
  $ensured = true;

  ensure_column($pdo, 'distributions', 'request_id', 'BIGINT NULL AFTER proof_status');
  ensure_column($pdo, 'distributions', 'source_allocation_ids', 'TEXT NULL AFTER request_id');
  // Keep proof bytes as a durable fallback for serverless/ephemeral filesystems.
  // The existing file_path remains the primary local-storage path.
  ensure_column($pdo, 'distribution_proofs', 'file_data', 'LONGBLOB NULL AFTER file_type');
  try {
    $missing = $pdo->query("SELECT id, file_path FROM distribution_proofs WHERE file_data IS NULL ORDER BY id ASC LIMIT 50")->fetchAll();
    $save = $pdo->prepare('UPDATE distribution_proofs SET file_data = ? WHERE id = ? AND file_data IS NULL');
    foreach ($missing as $proof) {
      $storedName = basename((string) ($proof['file_path'] ?? ''));
      $storedPath = __DIR__ . '/uploads/proofs/' . $storedName;
      if ($storedName !== '' && is_file($storedPath)) {
        $bytes = file_get_contents($storedPath);
        if ($bytes !== false) $save->execute([$bytes, (int) $proof['id']]);
      }
    }
  } catch (Throwable $e) {
    // Existing disk-only installations continue to work if ALTER privileges
    // are unavailable; new uploads still use the local path fallback.
  }
  // Delivery Team assignments use the existing task relationship so the same
  // record powers Admin operations and the assigned volunteer's portal.
  ensure_column($pdo, 'tasks', 'distribution_id', 'BIGINT UNSIGNED NULL AFTER assignee_user_id');
}

function ensure_column(PDO $pdo, string $table, string $column, string $typeDef): void
{
  try {
    $cleanTable = str_replace('`', '', $table);
    $cleanColumn = str_replace('`', '', $column);
    $stmt = $pdo->prepare("SHOW COLUMNS FROM `{$cleanTable}` LIKE ?");
    $stmt->execute([$cleanColumn]);
    if (!$stmt->fetch()) {
      $pdo->exec("ALTER TABLE `{$cleanTable}` ADD COLUMN `{$cleanColumn}` {$typeDef}");
    }
  } catch (Throwable $e) {
    // Ignore if column already exists or table not ready
  }
}

