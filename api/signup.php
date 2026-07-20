<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();

if (request_method() !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();

$role = ucfirst(strtolower(trim((string) ($body['role'] ?? ''))));
$allowedRoles = ['Donor', 'Volunteer', 'Beneficiary'];
if (!in_array($role, $allowedRoles, true)) {
  json_response(['ok' => false, 'error' => 'Please choose a valid account type.'], 400);
}

$name = trim((string) ($body['name'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');

if ($name === '' || $email === '' || $password === '') {
  json_response(['ok' => false, 'error' => 'Name, email, and password are required.'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'Please enter a valid email address.'], 400);
}
if (strlen($password) < 6) {
  json_response(['ok' => false, 'error' => 'Password must be at least 6 characters.'], 400);
}
if (email_taken($pdo, $email)) {
  json_response(['ok' => false, 'error' => 'An account with this email already exists.'], 409);
}

$token = generate_verification_token();

try {
  $pdo->beginTransaction();

  // Account starts PENDING and cannot log in until the email is verified.
  $userId = create_user_account($pdo, $role, $name, $email, $password, 'PENDING');
  $pdo->prepare('UPDATE users SET verification_token = ?, verification_sent_at = NOW() WHERE id = ?')
    ->execute([$token, $userId]);

  if ($role === 'Donor') {
    $stmt = $pdo->prepare('INSERT INTO donors (code, full_name, email, phone, user_id) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([generate_code('DNR'), $name, $email, $body['phone'] ?? null, $userId]);
  } elseif ($role === 'Volunteer') {
    $programs = $body['programs'] ?? [];
    if (!is_array($programs)) {
      $programs = [];
    }
    $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, email, programs_json, status, hours, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([generate_code('VOL'), $name, $email, json_encode(array_values($programs)), 'Pending Review', 0, $userId]);
  } else { // Beneficiary (Barangay)
    $barangay = trim((string) ($body['barangay'] ?? $name));
    $needs = $body['needs'] ?? [];
    $needsJson = (is_array($needs) && count($needs) > 0)
      ? json_encode(array_values(array_map('strval', $needs)))
      : null;
    $stmt = $pdo->prepare('INSERT INTO beneficiaries (code, full_name, category, barangay_type, barangay, municipality, address, affected_families, representative_name, representative_phone, representative_email, needs, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
      generate_code('BEN'),
      $barangay,
      $needsJson ? implode(', ', array_values(array_map('strval', $needs))) : ($body['category'] ?? null),
      $body['barangayType'] ?? null,
      $barangay,
      $body['municipality'] ?? null,
      $body['address'] ?? null,
      (int) ($body['affectedFamilies'] ?? 0),
      $name,
      $body['phone'] ?? null,
      $email,
      $needsJson,
      'Pending Approval',
      $userId,
    ]);
  }

  $pdo->commit();
} catch (Throwable $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(['ok' => false, 'error' => 'Could not create the account. Please try again.'], 500);
}

// Notify admins (best-effort — must never break signup).
try {
  $labels = [
    'Donor' => ['New donor registered', "{$name} created a donor account.", '/admin/donors'],
    'Volunteer' => ['New volunteer application', "{$name} applied to volunteer.", '/admin/volunteers'],
    'Beneficiary' => ['New barangay registration', "{$name} signed up and awaits approval.", '/admin/beneficiaries'],
  ];
  [$title, $message, $link] = $labels[$role];
  notify_admins($pdo, strtolower($role), $title, $message, $link);
} catch (Throwable $e) {
  // ignore
}

// Send the "Verify it's you" email.
$result = send_verification_email($email, $name, $token);

json_response([
  'ok' => true,
  'pending' => true,
  'message' => 'Account created. Please check your email and click “Verify it’s you” to activate your account before signing in.',
  'emailSent' => (bool) ($result['sent'] ?? false),
  'verifyUrl' => $result['url'] ?? '',
], 201);
