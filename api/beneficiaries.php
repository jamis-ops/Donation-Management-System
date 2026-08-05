<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/mailer.php';

$pdo = db();
$method = request_method();
$id = get_id_param();
$action = $_GET['action'] ?? $_POST['action'] ?? null;
$body = read_json_body();
if (!empty($body['action'])) {
  $action = $body['action'];
}

/**
 * Normalize barangay / municipality labels for duplicate checks.
 * Strips common "Brgy." / "Barangay" prefixes and collapses whitespace.
 */
function normalize_location_label(string $value): string
{
  $value = strtolower(trim($value));
  $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
  $value = preg_replace('/^(brgy\.?|barangay)\s+/u', '', $value) ?? $value;
  return trim($value);
}

/**
 * True when another beneficiary already uses this barangay + municipality/city.
 */
function beneficiary_location_taken(PDO $pdo, string $barangay, string $municipality, ?int $excludeId = null): bool
{
  return find_beneficiary_by_location($pdo, $barangay, $municipality, $excludeId) !== null;
}

/**
 * Find an existing barangay by normalized name + municipality/city.
 */
function find_beneficiary_by_location(PDO $pdo, string $barangay, string $municipality, ?int $excludeId = null): ?array
{
  $barangayKey = normalize_location_label($barangay);
  $muniKey = normalize_location_label($municipality);
  if ($barangayKey === '') {
    return null;
  }

  $sql = 'SELECT * FROM beneficiaries';
  $params = [];
  if ($excludeId !== null && $excludeId > 0) {
    $sql .= ' WHERE id <> ?';
    $params[] = $excludeId;
  }
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  foreach ($stmt->fetchAll() as $row) {
    $existingBarangay = normalize_location_label((string) ($row['barangay'] ?? $row['full_name'] ?? ''));
    $existingMuni = normalize_location_label((string) ($row['municipality'] ?? ''));
    if ($existingBarangay === $barangayKey && $existingMuni === $muniKey) {
      return $row;
    }
  }
  return null;
}

function assert_unique_barangay_location(PDO $pdo, string $barangay, string $municipality, ?int $excludeId = null): void
{
  $barangay = trim($barangay);
  $municipality = trim($municipality);
  if ($barangay === '') {
    json_response(['ok' => false, 'error' => 'Barangay name is required.'], 400);
  }
  if ($municipality === '') {
    json_response(['ok' => false, 'error' => 'Municipality / city is required.'], 400);
  }
  if (beneficiary_location_taken($pdo, $barangay, $municipality, $excludeId)) {
    json_response([
      'ok' => false,
      'error' => "Barangay \"{$barangay}\" in {$municipality} is already registered. Choose a different barangay or municipality/city.",
    ], 409);
  }
}

// ── Unauthenticated Public Actions ──

if ($method === 'GET' && $action === 'validate_token') {
  $token = trim((string) ($_GET['token'] ?? ''));
  if ($token === '') {
    json_response(['ok' => false, 'error' => 'Token is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE invitation_token = ? LIMIT 1');
  $stmt->execute([$token]);
  $ben = $stmt->fetch();
  if (!$ben) {
    json_response(['ok' => false, 'valid' => false, 'error' => 'Invalid invitation link.'], 404);
  }
  $expired = !empty($ben['invitation_expires']) && strtotime($ben['invitation_expires']) < time();
  $inviteStatus = (string) ($ben['invitation_status'] ?? 'none');
  if ($inviteStatus === 'applied') {
    json_response([
      'ok' => true,
      'valid' => false,
      'alreadyApplied' => true,
      'barangayName' => $ben['full_name'],
      'email' => $ben['representative_email'],
      'error' => 'This invitation was already submitted and is awaiting admin approval.',
    ]);
  }
  if ($inviteStatus === 'accepted') {
    json_response([
      'ok' => true,
      'valid' => false,
      'alreadyAccepted' => true,
      'barangayName' => $ben['full_name'],
      'error' => 'This invitation was already approved. Please sign in to your barangay portal.',
    ]);
  }
  if ($expired) {
    json_response([
      'ok' => true,
      'valid' => false,
      'expired' => true,
      'barangayName' => $ben['full_name'],
      'email' => $ben['representative_email'],
      'error' => 'This invitation has expired. Please contact Rise Above Foundation for a new invite.',
    ]);
  }
  json_response([
    'ok' => true,
    'valid' => true,
    'expired' => false,
    'barangayName' => $ben['barangay'] ?? $ben['full_name'],
    'municipality' => $ben['municipality'] ?? '',
    'email' => $ben['representative_email'] ?? '',
    'representativeName' => $ben['representative_name'] ?? '',
    'representativeFirstName' => $ben['representative_first_name'] ?? '',
    'representativeLastName' => $ben['representative_last_name'] ?? '',
    'representativeMiddleInitial' => $ben['representative_middle_initial'] ?? '',
    'representativePosition' => $ben['representative_position'] ?? '',
    'representativePhone' => $ben['representative_phone'] ?? '',
    'notes' => $ben['notes'] ?? '',
  ]);
}

/**
 * Passwordless application: barangay confirms partnership details for admin review.
 * Does NOT create a user account — that happens on admin approval.
 */
if ($method === 'POST' && ($action === 'accept_invite' || $action === 'apply_invite')) {
  $token = trim((string) ($body['token'] ?? ''));
  if ($token === '') {
    json_response(['ok' => false, 'error' => 'Invitation token is required.'], 400);
  }
  if (empty($body['acceptTerms']) && empty($body['termsAccepted'])) {
    json_response(['ok' => false, 'error' => 'You must agree to the Data Privacy Policy and Terms & Conditions.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE invitation_token = ? LIMIT 1');
  $stmt->execute([$token]);
  $ben = $stmt->fetch();
  if (!$ben) {
    json_response(['ok' => false, 'error' => 'Invalid or expired invitation token.'], 404);
  }
  if (!empty($ben['invitation_expires']) && strtotime($ben['invitation_expires']) < time()) {
    json_response(['ok' => false, 'error' => 'This invitation has expired. Please contact Rise Above Foundation for a new invite.'], 400);
  }
  $inviteStatus = (string) ($ben['invitation_status'] ?? '');
  if ($inviteStatus === 'applied') {
    json_response(['ok' => false, 'error' => 'This application was already submitted and is awaiting admin approval.'], 400);
  }
  if ($inviteStatus === 'accepted' || !empty($ben['user_id'])) {
    json_response(['ok' => false, 'error' => 'This invitation was already approved. Please sign in.'], 400);
  }

  $barangay = trim((string) ($body['barangay'] ?? $body['barangayName'] ?? $ben['barangay'] ?? $ben['full_name'] ?? ''));
  $municipality = trim((string) ($body['municipality'] ?? $ben['municipality'] ?? ''));
  $email = strtolower(trim((string) ($body['email'] ?? $body['representativeEmail'] ?? $ben['representative_email'] ?? '')));
  $notes = trim((string) ($body['notes'] ?? ''));
  $phone = trim((string) ($body['contactNumber'] ?? $body['representativePhone'] ?? ''));
  $position = trim((string) ($body['representativePosition'] ?? $body['position'] ?? ''));

  if ($barangay === '') {
    json_response(['ok' => false, 'error' => 'Barangay name is required.'], 400);
  }
  if ($municipality === '') {
    json_response(['ok' => false, 'error' => 'Municipality / city is required.'], 400);
  }
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'A valid email address is required.'], 400);
  }
  if ($position === '') {
    json_response(['ok' => false, 'error' => 'Position / role is required.'], 400);
  }
  if ($phone === '') {
    json_response(['ok' => false, 'error' => 'Contact number is required.'], 400);
  }

  // Allow same location for this invite record; block colliding with a different barangay.
  if (beneficiary_location_taken($pdo, $barangay, $municipality, (int) $ben['id'])) {
    json_response([
      'ok' => false,
      'error' => "Barangay \"{$barangay}\" in {$municipality} is already registered.",
    ], 409);
  }

  [$repLast, $repFirst, $repMi, $repName] = read_name_parts([
    'lastName' => $body['representativeLastName'] ?? $body['lastName'] ?? '',
    'firstName' => $body['representativeFirstName'] ?? $body['firstName'] ?? '',
    'middleInitial' => $body['representativeMiddleInitial'] ?? $body['middleInitial'] ?? '',
    'name' => $body['representativeName'] ?? '',
  ]);
  if ($repFirst === '' || $repLast === '') {
    json_response(['ok' => false, 'error' => 'Representative first and last name are required.'], 400);
  }
  $repMiDb = $repMi !== '' ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $repMi) ?: '', 0, 1)) : null;

  try {
    $pdo->prepare('
      UPDATE beneficiaries SET
        full_name = ?, barangay = ?, municipality = ?,
        representative_name = ?, representative_first_name = ?, representative_last_name = ?,
        representative_middle_initial = ?, representative_position = ?, representative_phone = ?,
        representative_email = ?, notes = ?,
        status = "Pending Approval", invitation_status = "applied"
      WHERE id = ?
    ')->execute([
      $barangay,
      $barangay,
      $municipality,
      $repName,
      $repFirst,
      $repLast,
      $repMiDb,
      $position,
      $phone,
      $email,
      $notes !== '' ? $notes : null,
      $ben['id'],
    ]);
  } catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'Could not submit application: ' . $e->getMessage()], 500);
  }

  notify_admins(
    $pdo,
    'beneficiary_registration',
    'Barangay registration received',
    'An invited Barangay has accepted the invitation and completed registration. A new Barangay has been registered and is awaiting approval.',
    '/admin/beneficiaries?focus=pending#barangays-table'
  );
  audit_log($pdo, 'apply_invite', 'beneficiary', $ben['code'], "Application submitted for {$barangay}");

  json_response([
    'ok' => true,
    'pendingApproval' => true,
    'message' => 'Your application has been sent for admin review. You will receive login credentials by email once approved.',
  ]);
}

// ── Authenticated Actions ──

function map_beneficiary(PDO $pdo, array $row): array
{
  $req = $pdo->prepare('SELECT COUNT(*) FROM assistance_requests WHERE beneficiary_id = ?');
  $req->execute([$row['id']]);
  $requestCount = (int) $req->fetchColumn();

  $last = $pdo->prepare('SELECT MAX(request_date) FROM assistance_requests WHERE beneficiary_id = ? AND status IN ("Approved","Allocated","Completed")');
  $last->execute([$row['id']]);
  $lastDate = $last->fetchColumn();

  $proofs = $pdo->prepare('SELECT COUNT(*) FROM distribution_proofs WHERE beneficiary_id = ?');
  $proofs->execute([$row['id']]);
  $proofCount = (int) $proofs->fetchColumn();

  // Derive highest open request priority
  $prioStmt = $pdo->prepare('SELECT priority FROM assistance_requests WHERE beneficiary_id = ? AND status NOT IN ("Completed","Rejected") ORDER BY FIELD(priority, "Critical", "High", "Medium", "Low") LIMIT 1');
  $prioStmt->execute([$row['id']]);
  $derivedPriority = $prioStmt->fetchColumn() ?: null;

  $needs = [];
  if (!empty($row['needs'])) {
    $decoded = json_decode((string) $row['needs'], true);
    $needs = is_array($decoded) ? $decoded : [];
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'barangay' => $row['barangay'] ?? $row['full_name'],
    'barangayType' => $row['barangay_type'] ?? '',
    'municipality' => $row['municipality'] ?? '',
    'address' => $row['address'] ?? '',
    'affectedFamilies' => (int) ($row['affected_families'] ?? 0),
    'representativeName' => $row['representative_name'] ?? '',
    'representativeFirstName' => $row['representative_first_name'] ?? '',
    'representativeLastName' => $row['representative_last_name'] ?? '',
    'representativeMiddleInitial' => $row['representative_middle_initial'] ?? '',
    'representativePosition' => $row['representative_position'] ?? '',
    'representativePhone' => $row['representative_phone'] ?? '',
    'representativeEmail' => $row['representative_email'] ?? '',
    'category' => $row['category'],
    'needs' => $needs,
    'status' => $row['status'],
    'invitationStatus' => $row['invitation_status'] ?? 'none',
    'invitationExpires' => format_date($row['invitation_expires'] ?? null),
    'invitationToken' => $row['invitation_token'] ?? null,
    'userId' => !empty($row['user_id']) ? (int) $row['user_id'] : null,
    'derivedPriority' => $derivedPriority,
    'notes' => $row['notes'] ?? '',
    'requests' => $requestCount,
    'proofsSubmitted' => $proofCount,
    'lastAssistance' => format_date($lastDate ?: null),
  ];
}

function encode_needs($needs): ?string
{
  if (!is_array($needs) || count($needs) === 0) {
    return null;
  }
  return json_encode(array_values(array_filter(array_map('strval', $needs), fn($n) => $n !== '')));
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['ok' => true, 'data' => $row ? [map_beneficiary($pdo, $row)] : []]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_beneficiary($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM beneficiaries ORDER BY municipality ASC, full_name ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_beneficiary($pdo, $r), $rows)]);
}

if ($user['role'] === 'Beneficiary') {
  json_response(['ok' => false, 'error' => 'Access denied'], 403);
}

// ── Invite / Reinvite Actions (Admin / Staff) ──

if ($method === 'POST' && ($action === 'invite' || $action === 'reinvite')) {
  require_auth(['Admin', 'Staff']); // SuperAdmin inherits Admin via require_auth

  $email = strtolower(trim((string) ($body['email'] ?? $body['representativeEmail'] ?? '')));
  $barangay = trim((string) ($body['barangayName'] ?? $body['barangay'] ?? $body['name'] ?? ''));
  $municipality = trim((string) ($body['municipality'] ?? ''));

  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'A valid email address is required.'], 400);
  }
  if ($action === 'invite' && $barangay === '') {
    json_response(['ok' => false, 'error' => 'Barangay name is required.'], 400);
  }
  if ($action === 'invite' && $municipality === '') {
    json_response(['ok' => false, 'error' => 'Municipality / city is required.'], 400);
  }

  $token = bin2hex(random_bytes(16)); // 32 hex chars
  $expires = date('Y-m-d H:i:s', time() + (7 * 86400)); // 7 days
  $targetId = 0;

  // Prefer explicit id (reinvite from details/table).
  if ($action === 'reinvite' || ($id && $id > 0)) {
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
    $stmt->execute([(int) ($id ?: 0)]);
    $existing = $stmt->fetch();
    if (!$existing && $email !== '') {
      $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE LOWER(representative_email) = ? LIMIT 1');
      $stmt->execute([$email]);
      $existing = $stmt->fetch();
    }
    if ($existing) {
      $inviteStatus = (string) ($existing['invitation_status'] ?? 'none');
      $hasAccount = !empty($existing['user_id'])
        || in_array((string) ($existing['status'] ?? ''), ['Active', 'Approved'], true)
        || $inviteStatus === 'accepted';
      if ($hasAccount) {
        json_response([
          'ok' => false,
          'error' => 'This barangay is already registered. Invitation is only for newly invited barangays.',
        ], 409);
      }
      if ($inviteStatus === 'applied') {
        json_response([
          'ok' => false,
          'error' => 'This barangay already submitted registration and is awaiting approval. Use Approve instead of Invite.',
        ], 409);
      }
      $pdo->prepare('
        UPDATE beneficiaries
        SET invitation_token = ?, invitation_expires = ?, invitation_status = "invited",
            representative_email = ?, status = "Pending Approval"
        WHERE id = ?
      ')->execute([$token, $expires, $email, $existing['id']]);
      $barangay = (string) ($existing['full_name'] ?: $existing['barangay'] ?: $barangay);
      $municipality = (string) ($existing['municipality'] ?? $municipality);
      $targetId = (int) $existing['id'];
    } elseif ($action === 'reinvite') {
      json_response(['ok' => false, 'error' => 'Barangay not found for reinvite.'], 404);
    }
  }

  // New invite — if this barangay+municipality already exists, refresh only when still an open invite.
  if ($targetId <= 0) {
    $existingLoc = find_beneficiary_by_location($pdo, $barangay, $municipality);
    if ($existingLoc) {
      $inviteStatus = (string) ($existingLoc['invitation_status'] ?? 'none');
      $hasAccount = !empty($existingLoc['user_id'])
        || in_array((string) ($existingLoc['status'] ?? ''), ['Active', 'Approved'], true)
        || $inviteStatus === 'accepted';
      if ($hasAccount) {
        json_response([
          'ok' => false,
          'error' => "Barangay \"{$barangay}\" in {$municipality} is already registered. Invite is only for new barangays.",
        ], 409);
      }
      if ($inviteStatus === 'applied') {
        json_response([
          'ok' => false,
          'error' => "Barangay \"{$barangay}\" already submitted registration and is awaiting approval.",
        ], 409);
      }
      // Only refresh open invites / rejected / pending without application.
      if (!in_array($inviteStatus, ['invited', 'expired', 'rejected', 'none'], true)) {
        json_response([
          'ok' => false,
          'error' => "Barangay \"{$barangay}\" in {$municipality} already exists.",
        ], 409);
      }
      $pdo->prepare('
        UPDATE beneficiaries
        SET invitation_token = ?, invitation_expires = ?, invitation_status = "invited",
            representative_email = ?, municipality = COALESCE(NULLIF(municipality, ""), ?),
            status = "Pending Approval"
        WHERE id = ?
      ')->execute([$token, $expires, $email, $municipality, $existingLoc['id']]);
      $barangay = (string) ($existingLoc['full_name'] ?: $existingLoc['barangay'] ?: $barangay);
      $targetId = (int) $existingLoc['id'];
    }
  }

  if ($targetId <= 0) {
    try {
      $code = generate_code('BEN');
      $stmt = $pdo->prepare('
        INSERT INTO beneficiaries (code, full_name, barangay, municipality, representative_email, invitation_token, invitation_expires, invitation_status, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, "invited", "Pending Approval")
      ');
      $stmt->execute([$code, $barangay, $barangay, $municipality, $email, $token, $expires]);
      $targetId = (int) $pdo->lastInsertId();
    } catch (Throwable $e) {
      json_response([
        'ok' => false,
        'error' => 'Could not create barangay invitation: ' . $e->getMessage(),
      ], 500);
    }
  }

  // Send invitation email
  $mail = ['sent' => false, 'transport' => '', 'error' => '', 'inviteUrl' => ''];
  try {
    $mail = send_invitation_email($email, $barangay, $token, 7);
  } catch (Throwable $e) {
    $mail['error'] = $e->getMessage();
  }

  $inviteUrl = (string) ($mail['inviteUrl'] ?? frontend_url('/accept-invite/' . rawurlencode($token)));
  $emailSent = !empty($mail['sent']);

  notify_admins($pdo, 'beneficiary', 'Barangay invited', "Invitation sent to {$email} for {$barangay}", '/admin/beneficiaries');
  audit_log($pdo, 'invite', 'beneficiary', (string) $targetId, "Sent invitation to {$email} for {$barangay}");

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$targetId]);
  json_response([
    'ok' => true,
    'data' => map_beneficiary($pdo, $stmt->fetch()),
    'invitationSent' => $emailSent,
    'mailTransport' => (string) ($mail['transport'] ?? ''),
    'mailError' => $emailSent ? '' : (string) ($mail['error'] ?? 'Invitation email was not delivered'),
    'inviteUrl' => $inviteUrl,
    'message' => $emailSent
      ? "Invitation emailed to {$email}."
      : "Invitation saved for {$barangay}, but the email could not be sent. Share this invite link manually: {$inviteUrl}",
  ], 201);
}

// ── Approve / Reject barangay applications ──

if ($method === 'POST' && ($action === 'approve' || $action === 'reject')) {
  require_auth(['Admin', 'Staff']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $ben = $stmt->fetch();
  if (!$ben) {
    json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
  }

  if ($action === 'reject') {
    $inviteStatus = (string) ($ben['invitation_status'] ?? '');
    if ($inviteStatus !== 'applied' && (string) ($ben['status'] ?? '') !== 'Pending Approval') {
      json_response(['ok' => false, 'error' => 'Only pending applications can be rejected.'], 400);
    }
    $reason = trim((string) ($body['reason'] ?? $body['notes'] ?? ''));
    $notes = trim((string) ($ben['notes'] ?? ''));
    if ($reason !== '') {
      $notes = trim($notes . ($notes !== '' ? "\n" : '') . 'Rejection reason: ' . $reason);
    }
    $pdo->prepare('
      UPDATE beneficiaries
      SET status = "Rejected", invitation_status = "rejected", invitation_token = NULL, notes = ?
      WHERE id = ?
    ')->execute([$notes !== '' ? $notes : null, $id]);
    notify_admins($pdo, 'beneficiary', 'Barangay application rejected', "{$ben['full_name']} was rejected", '/admin/beneficiaries');
    if (lifecycle_mail_allowed('application', 'Rejected')) {
      $repEmail = strtolower(trim((string) ($ben['representative_email'] ?? '')));
      $repName = trim((string) ($ben['representative_name'] ?? $ben['full_name'] ?? 'Applicant'));
      $barangay = htmlspecialchars((string) ($ben['full_name'] ?: $ben['barangay'] ?: 'your barangay'), ENT_QUOTES, 'UTF-8');
      $reasonHtml = $reason !== ''
        ? '<p style="margin:0 0 12px;line-height:1.6;color:#475569"><strong>Reason:</strong> ' . htmlspecialchars($reason, ENT_QUOTES, 'UTF-8') . '</p>'
        : '';
      send_lifecycle_email(
        $repEmail,
        $repName,
        'Update on your barangay partnership application',
        'Application update',
        "<p style=\"margin:0 0 12px;line-height:1.6;color:#475569\">The partnership application for <strong>{$barangay}</strong> was not approved at this time.</p>"
          . $reasonHtml
          . '<p style="margin:0 0 12px;line-height:1.6;color:#475569">You may contact Rise Above Foundation Cebu if you have questions.</p>',
        '/login',
        'Open portal'
      );
    }
    audit_log($pdo, 'reject', 'beneficiary', $ben['code'], "Rejected barangay application for {$ben['full_name']}");
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch()), 'message' => 'Application rejected.']);
  }

  // approve — only for submitted applications; prevent duplicate provisioning
  $inviteStatus = (string) ($ben['invitation_status'] ?? '');
  if (!empty($ben['user_id']) || $inviteStatus === 'accepted' || in_array((string) ($ben['status'] ?? ''), ['Active', 'Approved'], true)) {
    json_response(['ok' => false, 'error' => 'This barangay is already registered and approved.'], 409);
  }
  if ($inviteStatus !== 'applied' && (string) ($ben['status'] ?? '') !== 'Pending Approval') {
    json_response(['ok' => false, 'error' => 'Only pending barangay applications can be approved.'], 400);
  }

  $provision = provision_beneficiary_account($pdo, $ben);
  if (!empty($provision['error']) && empty($provision['userId']) && empty($provision['created'])) {
    json_response(['ok' => false, 'error' => $provision['error']], 400);
  }
  $mail = $provision['mail'] ?? null;
  $sent = !empty($mail['sent']);
  $barangayLabel = (string) ($ben['full_name'] ?: $ben['barangay'] ?: 'Barangay');
  $repEmail = strtolower(trim((string) ($ben['representative_email'] ?? '')));
  notify_admins(
    $pdo,
    'beneficiary_credentials',
    'Login credentials sent',
    $sent
      ? "Login credentials have been successfully sent to the approved Barangay ({$barangayLabel}" . ($repEmail !== '' ? ", {$repEmail}" : '') . ').'
      : "Barangay {$barangayLabel} was approved, but the credential email could not be delivered" . ($repEmail !== '' ? " to {$repEmail}" : '') . '.',
    '/admin/beneficiaries/' . (int) $id . '?tab=overview'
  );
  audit_log($pdo, 'approve', 'beneficiary', $ben['code'], "Approved barangay {$ben['full_name']}");

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$id]);
  json_response([
    'ok' => true,
    'data' => map_beneficiary($pdo, $stmt->fetch()),
    'accountCreated' => !empty($provision['created']),
    'credentialsSent' => $sent,
    'mailError' => $sent ? '' : (string) ($mail['error'] ?? $provision['error'] ?? ''),
    'temporaryPassword' => $provision['temporaryPassword'] ?? null,
    'message' => $sent
      ? 'Login credentials have been successfully sent to the approved Barangay.'
      : 'Barangay approved.' . (!empty($provision['temporaryPassword'])
        ? ' Email failed — temporary password: ' . $provision['temporaryPassword']
        : (string) ($provision['error'] ?? ' Account linked or credentials may need manual delivery.')),
  ]);
}

if ($method === 'POST') {
  $barangay = trim((string) ($body['barangay'] ?? $body['name'] ?? ''));
  $municipality = trim((string) ($body['municipality'] ?? ''));
  assert_unique_barangay_location($pdo, $barangay, $municipality);
  $code = generate_code('BEN');
  $needsArr = is_array($body['needs'] ?? null) ? array_values(array_map('strval', $body['needs'])) : [];
  $category = count($needsArr) > 0 ? implode(', ', $needsArr) : ($body['category'] ?? null);
  [$repLast, $repFirst, $repMi, $repName] = read_name_parts([
    'lastName' => $body['representativeLastName'] ?? $body['representative_last_name'] ?? $body['lastName'] ?? '',
    'firstName' => $body['representativeFirstName'] ?? $body['representative_first_name'] ?? $body['firstName'] ?? '',
    'middleInitial' => $body['representativeMiddleInitial'] ?? $body['representative_middle_initial'] ?? $body['middleInitial'] ?? '',
    'name' => $body['representativeName'] ?? $body['representative_name'] ?? '',
  ]);
  $repMiDb = $repMi !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $repMi) ?: '', 0, 1))
    : null;
  $stmt = $pdo->prepare('
    INSERT INTO beneficiaries (code, full_name, category, barangay_type, barangay, municipality, address, affected_families, representative_name, representative_first_name, representative_last_name, representative_middle_initial, representative_position, representative_phone, representative_email, needs, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $code,
    $barangay,
    $category,
    $body['barangayType'] ?? null,
    $barangay,
    $municipality,
    $body['address'] ?? null,
    (int) ($body['affectedFamilies'] ?? 0),
    $repName !== '' ? $repName : null,
    $repFirst !== '' ? $repFirst : null,
    $repLast !== '' ? $repLast : null,
    $repMiDb,
    $body['representativePosition'] ?? null,
    $body['representativePhone'] ?? null,
    $body['representativeEmail'] ?? null,
    encode_needs($body['needs'] ?? null),
    $body['notes'] ?? null,
    $body['status'] ?? 'Pending Approval',
  ]);
  $newId = (int) $pdo->lastInsertId();
  notify_admins($pdo, 'beneficiary', 'New barangay registered', "{$barangay} registered with " . ($body['affectedFamilies'] ?? 0) . ' affected families', '/admin/beneficiaries');

  audit_log($pdo, 'create', 'beneficiary', $code, "Registered barangay {$barangay}");

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
  }

  $existingStatus = (string) ($existing['status'] ?? '');
  $newStatus = (string) ($body['status'] ?? $existingStatus);
  // After approval, only status/notes changes are allowed (prevents rewriting partnership identity).
  if (in_array($existingStatus, ['Active', 'Approved'], true)) {
    if (!in_array($newStatus, ['Active', 'Approved', 'Suspended', 'Rejected'], true)) {
      json_response(['ok' => false, 'error' => 'Invalid status for an approved barangay.'], 400);
    }
    $notesOnly = trim((string) ($body['notes'] ?? $existing['notes'] ?? ''));
    $pdo->prepare('UPDATE beneficiaries SET status = ?, notes = ? WHERE id = ?')
      ->execute([$newStatus, $notesOnly, $id]);
    if ($newStatus !== $existingStatus) {
      notify_admins($pdo, 'status_update', 'Barangay status updated', "{$existing['full_name']} status changed to {$newStatus}", '/admin/beneficiaries');
    }
    $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())]);
  }

  $barangay = trim((string) ($body['barangay'] ?? $body['name'] ?? $existing['full_name']));
  $municipality = trim((string) ($body['municipality'] ?? $existing['municipality'] ?? ''));
  assert_unique_barangay_location($pdo, $barangay, $municipality, (int) $id);

  $needsValue = array_key_exists('needs', $body) ? encode_needs($body['needs']) : $existing['needs'];
  if (array_key_exists('needs', $body) && is_array($body['needs']) && count($body['needs']) > 0) {
    $category = implode(', ', array_values(array_map('strval', $body['needs'])));
  } else {
    $category = $body['category'] ?? $existing['category'];
  }

  $hasRepParts = array_key_exists('representativeLastName', $body) || array_key_exists('representativeFirstName', $body)
    || array_key_exists('representative_last_name', $body) || array_key_exists('lastName', $body)
    || array_key_exists('firstName', $body);
  if ($hasRepParts) {
    [$repLast, $repFirst, $repMi, $repName] = read_name_parts([
      'lastName' => $body['representativeLastName'] ?? $body['representative_last_name'] ?? $body['lastName'] ?? '',
      'firstName' => $body['representativeFirstName'] ?? $body['representative_first_name'] ?? $body['firstName'] ?? '',
      'middleInitial' => $body['representativeMiddleInitial'] ?? $body['representative_middle_initial'] ?? $body['middleInitial'] ?? '',
      'name' => $body['representativeName'] ?? $body['representative_name'] ?? '',
    ]);
  } else {
    $repLast = trim((string) ($existing['representative_last_name'] ?? ''));
    $repFirst = trim((string) ($existing['representative_first_name'] ?? ''));
    $repMi = trim((string) ($existing['representative_middle_initial'] ?? ''));
    $repName = trim((string) ($body['representativeName'] ?? $existing['representative_name'] ?? ''));
  }
  $repMiDb = $repMi !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $repMi) ?: '', 0, 1))
    : null;

  $repPhone = require_valid_ph_mobile(
    $body['representativePhone'] ?? $existing['representative_phone'] ?? '',
    true,
    'Representative phone'
  );
  $repEmail = require_valid_email(
    (string) ($body['representativeEmail'] ?? $existing['representative_email'] ?? ''),
    'Representative email'
  );

  $update = $pdo->prepare('
    UPDATE beneficiaries SET full_name = ?, category = ?, barangay_type = ?, barangay = ?, municipality = ?, address = ?, affected_families = ?,
    representative_name = ?, representative_first_name = ?, representative_last_name = ?, representative_middle_initial = ?,
    representative_position = ?, representative_phone = ?, representative_email = ?, needs = ?, notes = ?, status = ?
    WHERE id = ?
  ');
  $update->execute([
    $barangay,
    $category,
    $body['barangayType'] ?? $existing['barangay_type'],
    $barangay,
    $municipality,
    $body['address'] ?? $existing['address'],
    (int) ($body['affectedFamilies'] ?? $existing['affected_families']),
    $repName !== '' ? $repName : ($existing['representative_name'] ?? null),
    $repFirst !== '' ? $repFirst : null,
    $repLast !== '' ? $repLast : null,
    $repMiDb,
    $body['representativePosition'] ?? ($existing['representative_position'] ?? null),
    $repPhone,
    $repEmail,
    $needsValue,
    $body['notes'] ?? $existing['notes'],
    $newStatus,
    $id,
  ]);

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Barangay status updated', "{$barangay} status changed to {$newStatus}", '/admin/beneficiaries');
  }

  audit_log($pdo, 'update', 'beneficiary', $existing['code'], "Updated {$barangay}" . ($newStatus !== $existing['status'] ? " (status: {$newStatus})" : ''));

  $stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_beneficiary($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  require_auth(['Admin']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Barangay id is required'], 400);
  }
  $del = $pdo->prepare('SELECT id, code, full_name, user_id FROM beneficiaries WHERE id = ?');
  $del->execute([$id]);
  $delRow = $del->fetch();
  if (!$delRow) {
    json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
  }

  try {
    $pdo->beginTransaction();

    // Collect linked assistance requests so we can clear non-cascading refs first.
    $reqIds = [];
    try {
      $reqStmt = $pdo->prepare('SELECT id FROM assistance_requests WHERE beneficiary_id = ?');
      $reqStmt->execute([$id]);
      $reqIds = array_map('intval', $reqStmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
    } catch (Throwable $e) {
    }

    if ($reqIds) {
      $placeholders = implode(',', array_fill(0, count($reqIds), '?'));
      try {
        $pdo->prepare("UPDATE allocations SET assistance_request_id = NULL WHERE assistance_request_id IN ($placeholders)")->execute($reqIds);
      } catch (Throwable $e) {
      }
      try {
        $pdo->prepare("UPDATE distributions SET request_id = NULL WHERE request_id IN ($placeholders)")->execute($reqIds);
      } catch (Throwable $e) {
      }
    }

    // Clear optional links that may not cascade.
    try {
      $pdo->prepare('UPDATE allocations SET beneficiary_id = NULL WHERE beneficiary_id = ?')->execute([$id]);
    } catch (Throwable $e) {
    }
    try {
      $pdo->prepare('UPDATE distributions SET beneficiary_id = NULL WHERE beneficiary_id = ?')->execute([$id]);
    } catch (Throwable $e) {
    }
    try {
      $pdo->prepare('DELETE FROM distribution_proofs WHERE beneficiary_id = ?')->execute([$id]);
    } catch (Throwable $e) {
    }
    try {
      $pdo->prepare('DELETE FROM assistance_requests WHERE beneficiary_id = ?')->execute([$id]);
    } catch (Throwable $e) {
    }

    $pdo->prepare('DELETE FROM beneficiaries WHERE id = ?')->execute([$id]);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => 'Failed to delete barangay: ' . $e->getMessage()], 500);
  }

  audit_log($pdo, 'delete', 'beneficiary', $delRow['code'], "Deleted barangay {$delRow['full_name']}");
  json_response(['ok' => true, 'message' => 'Barangay deleted']);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
