<?php
declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/super_admin.php';
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
  // Store path-only links so in-app notifications work in every environment.
  $normalized = $link !== null && $link !== '' ? notification_path($link) : null;
  $stmt = $pdo->prepare('INSERT INTO notifications (user_id, role_target, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)');
  $stmt->execute([$userId, $roleTarget, $type, $title, $message, $normalized]);
}

function notify_admins(PDO $pdo, string $type, string $title, string $message, ?string $link = null): void
{
  create_notification($pdo, $type, $title, $message, $link, null, 'Admin');
  create_notification($pdo, $type, $title, $message, $link, null, 'Staff');
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

  $existing = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $existing->execute([$email]);
  $userId = $existing->fetchColumn();
  if ($userId) {
    $userId = (int) $userId;
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
    $pdo->prepare("UPDATE inventory_items SET quantity = quantity + ?, unit = 'packs', stock_state = 'Available' WHERE id = ?")
      ->execute([$qty, (int) $row['id']]);
  } else {
    $pdo->prepare("INSERT INTO inventory_items (code, item_name, category, quantity, unit, stock_state, low_stock_threshold) VALUES (?, ?, ?, ?, 'packs', 'Available', 10)")
      ->execute([
        generate_code('INV'),
        $itemName,
        trim((string) ($donationRow['category'] ?? 'Donated Goods')) ?: 'Donated Goods',
        $qty,
      ]);
  }
}

/**
 * After Admin approves a barangay application: create login + email credentials.
 */
function provision_beneficiary_account(PDO $pdo, array $benRow): array
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
  if (!empty($benRow['user_id'])) {
    $pdo->prepare('UPDATE beneficiaries SET status = ?, invitation_status = ? WHERE id = ?')
      ->execute(['Active', 'accepted', (int) $benRow['id']]);
    return ['created' => false, 'userId' => (int) $benRow['user_id'], 'mail' => null, 'error' => null];
  }
  if (email_taken($pdo, $email)) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $uid = (int) $stmt->fetchColumn();
    $pdo->prepare('UPDATE beneficiaries SET user_id = ?, status = ?, invitation_status = ?, invitation_token = NULL WHERE id = ?')
      ->execute([$uid, 'Active', 'accepted', (int) $benRow['id']]);
    return ['created' => false, 'userId' => $uid, 'mail' => null, 'error' => 'Email already has an account; linked existing login.'];
  }

  $tempPassword = generate_temp_password();
  $userId = create_user_account($pdo, 'Beneficiary', $name, $email, $tempPassword, 'ACTIVE', true, [
    'lastName' => (string) ($benRow['representative_last_name'] ?? ''),
    'firstName' => (string) ($benRow['representative_first_name'] ?? ''),
    'middleInitial' => (string) ($benRow['representative_middle_initial'] ?? ''),
  ]);
  accept_privacy_terms($pdo, $userId);
  $pdo->prepare('UPDATE beneficiaries SET user_id = ?, status = ?, invitation_status = ?, invitation_token = NULL WHERE id = ?')
    ->execute([$userId, 'Active', 'accepted', (int) $benRow['id']]);
  $mail = send_account_credentials($email, $name, $email, $tempPassword, 'Beneficiary');
  $sent = !empty($mail['sent']);
  $transport = (string) ($mail['transport'] ?? '');
  $includeTemp = !$sent || $transport === 'outbox' || !in_array($transport, ['nodemailer', 'smtp'], true);
  return [
    'created' => true,
    'userId' => $userId,
    'mail' => $mail,
    'temporaryPassword' => $includeTemp ? $tempPassword : null,
    'error' => null,
  ];
}

/**
 * After Admin approves a volunteer application: create login + email credentials.
 */
function provision_volunteer_account(PDO $pdo, array $volunteerRow): array
{
  $email = strtolower(trim((string) ($volunteerRow['email'] ?? '')));
  $name = trim((string) ($volunteerRow['full_name'] ?? 'Volunteer'));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return ['created' => false, 'userId' => null, 'mail' => null, 'error' => 'Volunteer email missing'];
  }
  if (!empty($volunteerRow['user_id'])) {
    return ['created' => false, 'userId' => (int) $volunteerRow['user_id'], 'mail' => null, 'error' => null];
  }
  if (email_taken($pdo, $email)) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $uid = (int) $stmt->fetchColumn();
    $pdo->prepare('UPDATE volunteers SET user_id = ? WHERE id = ?')->execute([$uid, (int) $volunteerRow['id']]);
    return ['created' => false, 'userId' => $uid, 'mail' => null, 'error' => null];
  }

  $tempPassword = generate_temp_password();
  $userId = create_user_account($pdo, 'Volunteer', $name, $email, $tempPassword, 'ACTIVE', true);
  accept_privacy_terms($pdo, $userId);
  $pdo->prepare('UPDATE volunteers SET user_id = ?, status = ? WHERE id = ?')
    ->execute([$userId, 'Approved', (int) $volunteerRow['id']]);
  $mail = send_account_credentials($email, $name, $email, $tempPassword, 'Volunteer');
  $sent = !empty($mail['sent']);
  $transport = (string) ($mail['transport'] ?? '');
  $includeTemp = !$sent || $transport === 'outbox' || !in_array($transport, ['nodemailer', 'smtp'], true);
  return [
    'created' => true,
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
      . '<p style="margin:0 0 10px;color:#64748b;font-size:0.88rem">Or copy and paste this link into your browser:</p>'
      . '<p style="margin:0 0 18px;word-break:break-all;font-size:0.85rem"><a href="' . $safeUrl . '" style="color:#2563eb">' . $safeUrl . '</a></p>'
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
 * Send login credentials when an admin creates an account for a user.
 * Uses NodeMailer (preferred) with a professional HTML template.
 * Returns ['sent' => bool, 'transport' => string, 'error' => string].
 */
function send_account_credentials(string $toEmail, string $name, string $loginEmail, string $password, string $role): array
{
  $sent = false;

  if (function_exists('nodemailer_send_credentials') && mail_resolved_transport() === 'nodemailer') {
    $sent = nodemailer_send_credentials($toEmail, $name, $loginEmail, $password, $role);
  } elseif (function_exists('send_mail')) {
    // Fallback template (PHP SMTP / outbox) — still portal-focused, no Gmail-control language
    $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($loginEmail, ENT_QUOTES, 'UTF-8');
    $safePassword = htmlspecialchars($password, ENT_QUOTES, 'UTF-8');
    $safeRole = htmlspecialchars($role, ENT_QUOTES, 'UTF-8');
    $loginUrl = htmlspecialchars(frontend_url('/login'), ENT_QUOTES, 'UTF-8');
    $recoveryUrl = htmlspecialchars(recovery_url(), ENT_QUOTES, 'UTF-8');

    $subject = 'Welcome to Rise Above Foundation Cebu — your account credentials';
    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Rise Above Foundation Cebu</title></head>'
      . '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px"><tr><td align="center">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">'
      . '<tr><td style="background:#AF101A;padding:20px 28px">'
      . '<div style="color:#ffffff;font-size:1.08rem;font-weight:700">Rise Above Foundation Cebu</div>'
      . '<div style="color:rgba(255,255,255,0.88);font-size:0.82rem;margin-top:3px">Donation Management System</div>'
      . '</td></tr>'
      . '<tr><td style="padding:30px 28px 6px">'
      . '<p style="margin:0 0 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#AF101A">Welcome</p>'
      . '<h1 style="margin:0 0 14px;font-size:1.55rem;line-height:1.3;color:#0f172a">Welcome to Rise Above Foundation Cebu</h1>'
      . "<p style=\"margin:0;font-size:0.98rem;line-height:1.65;color:#475569\">Hi {$safeName}, an administrator created a <strong style=\"color:#0f172a\">{$safeRole}</strong> account for you on the Rise Above Foundation portal. Use the temporary password below to sign in, then change it after your first login.</p>"
      . '</td></tr>'
      . '<tr><td style="padding:16px 28px 8px">'
      . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">'
      . '<tr><td style="padding:16px 18px;border-bottom:1px solid #e2e8f0">'
      . '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Email address</div>'
      . "<div style=\"font-size:1rem;font-weight:650;color:#0f172a;word-break:break-all\">{$safeEmail}</div></td></tr>"
      . '<tr><td style="padding:16px 18px">'
      . '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">Temporary password</div>'
      . "<div style=\"font-size:1.2rem;font-weight:750;font-family:Consolas,Monaco,monospace;color:#AF101A;letter-spacing:0.04em\">{$safePassword}</div></td></tr>"
      . '</table></td></tr>'
      . '<tr><td style="padding:22px 28px 8px;text-align:center">'
      . '<a href="' . $loginUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:15px 32px;border-radius:10px;text-decoration:none;font-weight:750;font-size:1rem">Log in to your account</a>'
      . '</td></tr>'
      . '<tr><td style="padding:10px 28px 8px;text-align:center">'
      . '<a href="' . $recoveryUrl . '" style="display:inline-block;background:#ffffff;color:#AF101A;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;border:2px solid #AF101A">Add recovery number</a>'
      . '</td></tr>'
      . '<tr><td style="padding:8px 28px 20px;text-align:center;font-size:0.78rem;color:#94a3b8;word-break:break-all">Or open: <a href="' . $loginUrl . '" style="color:#2563eb">' . $loginUrl . '</a></td></tr>'
      . '<tr><td style="padding:0 28px 26px"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;font-size:0.85rem;line-height:1.55;color:#9a3412"><strong>Security tip:</strong> This temporary password is only for your Rise Above Foundation Cebu portal account. Sign in soon, change your password, and never share this email with others.</div></td></tr>'
      . '<tr><td style="padding:16px 28px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:0.75rem;line-height:1.55;color:#94a3b8"><strong style="color:#475569">Rise Above Foundation Cebu</strong><br>© ' . date('Y') . ' Rise Above Foundation Cebu. All rights reserved.<br>This is an automated message from the Donation Management System.</td></tr>'
      . '</table></td></tr></table></body></html>';

    $sent = (bool) send_mail($toEmail, $name, $subject, $html);
  }

  $result = function_exists('mail_last_result') ? mail_last_result() : ['ok' => $sent, 'transport' => '', 'error' => ''];
  return [
    'sent' => $sent,
    'transport' => (string) ($result['transport'] ?? ''),
    'error' => (string) ($result['error'] ?? ''),
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
    . '</p>'
    . '<p style="margin:0;color:#64748b;font-size:0.88rem;word-break:break-all">Or open: <a href="' . $safeUrl . '">' . $safeUrl . '</a></p>';

  if (function_exists('nodemailer_send_invitation') && function_exists('mail_resolved_transport') && mail_resolved_transport() === 'nodemailer') {
    $sent = nodemailer_send_invitation($toEmail, $barangayName, $inviteUrl, $expiresInDays);
  }

  // Fallback when NodeMailer is down / misconfigured.
  if (!$sent && function_exists('send_mail')) {
    $sent = (bool) send_mail($toEmail, 'Barangay Representative', $subject, $html);
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

function accept_privacy_terms(PDO $pdo, int $userId): void
{
  $pdo->prepare('UPDATE users SET terms_accepted_at = NOW(), privacy_accepted_at = NOW() WHERE id = ?')
    ->execute([$userId]);
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

