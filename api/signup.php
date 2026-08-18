<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();

if (request_method() !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();

$role = ucfirst(strtolower(trim((string) ($body['role'] ?? ''))));
// Barangay registration is now by invitation only. No public self-registration.
// Donors: auto-created after donation verification. Volunteers: public application → Admin approve.
$allowedRoles = []; // No roles allow public self-registration
json_response([
  'ok' => false,
  'error' => 'Barangay registration is by invitation only. Please contact Rise Above Foundation for partnership inquiries. Donors submit a donation at /donate; volunteers apply at /volunteer.',
], 403);

[$lastName, $firstName, $middleInitial, $name] = read_name_parts([
  'lastName' => $body['representativeLastName'] ?? $body['representative_last_name'] ?? $body['lastName'] ?? $body['last_name'] ?? '',
  'firstName' => $body['representativeFirstName'] ?? $body['representative_first_name'] ?? $body['firstName'] ?? $body['first_name'] ?? '',
  'middleInitial' => $body['representativeMiddleInitial'] ?? $body['representative_middle_initial'] ?? $body['middleInitial'] ?? $body['middle_initial'] ?? '',
  'name' => $body['name'] ?? $body['representativeName'] ?? '',
]);
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
if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
  json_response(['ok' => false, 'error' => 'You must accept the Data Privacy Policy and Terms & Conditions.'], 400);
}
if (email_taken($pdo, $email)) {
  json_response(['ok' => false, 'error' => 'An account with this email already exists.'], 409);
}

$token = generate_verification_token();
$miDb = $middleInitial !== ''
  ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
  : null;

try {
  $pdo->beginTransaction();

  // Account starts PENDING and cannot log in until the email is verified.
  $userId = create_user_account($pdo, $role, $name, $email, $password, 'PENDING', false, [
    'lastName' => $lastName,
    'firstName' => $firstName,
    'middleInitial' => $middleInitial,
  ]);
  $pdo->prepare('UPDATE users SET verification_token = ?, verification_sent_at = NOW() WHERE id = ?')
    ->execute([$token, $userId]);
  accept_privacy_terms($pdo, $userId);

  if ($role === 'Donor') {
    $donorTypeRaw = trim((string) ($body['donorType'] ?? $body['donor_type'] ?? 'Individual'));
    $donorType = (strcasecmp($donorTypeRaw, 'Company') === 0 || strcasecmp($donorTypeRaw, 'Organization') === 0)
      ? 'Company'
      : 'Individual';
    $organization = $donorType === 'Company'
      ? trim((string) ($body['organization'] ?? $body['company'] ?? ''))
      : '';
    $country = trim((string) ($body['country'] ?? ''));
    $address = trim((string) ($body['address'] ?? ''));
    if ($donorType === 'Company' && $organization === '') {
      throw new RuntimeException('Company / Organization Name is required.');
    }
    if ($organization !== '' && donor_name_taken($pdo, $name, $organization)) {
      throw new RuntimeException('A donor with the same name or company already exists.');
    }
    $stmt = $pdo->prepare('INSERT INTO donors (code, full_name, first_name, last_name, middle_initial, donor_type, organization, contact_person, email, phone, country, address, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
      generate_code('DNR'),
      $organization !== '' ? $organization : $name,
      $firstName !== '' ? $firstName : null,
      $lastName !== '' ? $lastName : null,
      $miDb,
      $donorType,
      $organization !== '' ? $organization : null,
      $name,
      $email,
      $body['phone'] ?? null,
      $country !== '' ? $country : null,
      $address !== '' ? $address : null,
      $userId,
    ]);
  } elseif ($role === 'Volunteer') {
    $programs = $body['programs'] ?? [];
    if (!is_array($programs)) {
      $programs = [];
    }
    $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, first_name, last_name, middle_initial, email, programs_json, status, hours, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
      generate_code('VOL'),
      $name,
      $firstName !== '' ? $firstName : null,
      $lastName !== '' ? $lastName : null,
      $miDb,
      $email,
      json_encode(array_values($programs)),
      'Pending Review',
      0,
      $userId,
    ]);
  } else { // Beneficiary (Barangay)
    $barangay = trim((string) ($body['barangay'] ?? $name));
    $needs = $body['needs'] ?? [];
    $needsJson = (is_array($needs) && count($needs) > 0)
      ? json_encode(array_values(array_map('strval', $needs)))
      : null;
    $stmt = $pdo->prepare('INSERT INTO beneficiaries (code, full_name, category, barangay_type, barangay, municipality, address, affected_families, representative_name, representative_first_name, representative_last_name, representative_middle_initial, representative_position, representative_phone, representative_email, needs, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
      $firstName !== '' ? $firstName : null,
      $lastName !== '' ? $lastName : null,
      $miDb,
      $body['representativePosition'] ?? $body['position'] ?? null,
      $body['phone'] ?? null,
      $email,
      $needsJson,
      'Pending Approval',
      $userId,
    ]);
  }

  $pdo->commit();
} catch (RuntimeException $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(['ok' => false, 'error' => $e->getMessage()], 409);
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
    'Beneficiary' => ['New barangay registration', "{$name} signed up and awaits approval.", '/admin/beneficiaries?focus=pending#barangays-table'],
  ];
  [$title, $message, $link] = $labels[$role];
  notify_admins($pdo, strtolower($role), $title, $message, $link);
} catch (Throwable $e) {
  // ignore
}

// Send the "Verify it's you" email via NodeMailer.
$result = send_verification_email($email, $name, $token);
$emailSent = (bool) ($result['sent'] ?? false);
$mailTransport = (string) ($result['transport'] ?? '');
$mailError = (string) ($result['error'] ?? '');

json_response([
  'ok' => true,
  'pending' => true,
  'message' => $emailSent
    ? 'Account created. Check your email and click “Verify it’s you” to activate your account, then sign in.'
    : 'Account created, but the verification email could not be sent. Please try again later or contact support.',
  'emailSent' => $emailSent && in_array($mailTransport, ['nodemailer', 'smtp'], true),
  'mailTransport' => $mailTransport,
  'mailError' => $emailSent ? '' : $mailError,
], 201);
