<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function map_volunteer(PDO $pdo, array $row): array
{
  $taskCount = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE assignee = ? OR assignee_user_id = ?');
  $taskCount->execute([$row['full_name'], $row['user_id'] ? (int) $row['user_id'] : 0]);
  $skills = [];
  if (!empty($row['skills_json'])) {
    $decoded = json_decode((string) $row['skills_json'], true);
    if (is_array($decoded)) {
      if (isset($decoded['tags']) && is_array($decoded['tags'])) {
        $skills = $decoded['tags'];
      } else {
        $skills = $decoded;
      }
    }
  }
  $skills = array_values(array_filter(array_map(static fn($s) => trim((string) $s), $skills)));

  $openCount = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE (assignee = ? OR assignee_user_id = ?) AND board_column <> 'done'");
  $openCount->execute([$row['full_name'], $row['user_id'] ? (int) $row['user_id'] : 0]);

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'firstName' => $row['first_name'] ?? '',
    'lastName' => $row['last_name'] ?? '',
    'middleInitial' => $row['middle_initial'] ?? '',
    'email' => $row['email'],
    'userId' => $row['user_id'] ? (int) $row['user_id'] : null,
    'programs' => decode_programs($row['programs_json']),
    'skills' => $skills,
    'skillsOther' => $row['skills_other'] ?? '',
    'availability' => $row['availability'] ?? '',
    'status' => $row['status'],
    'hours' => (int) $row['hours'],
    'requiredHours' => (int) ($row['required_hours'] ?? 0),
    'remainingHours' => max(0, (int) ($row['required_hours'] ?? 0) - (int) $row['hours']),
    'assignedTasks' => (int) $taskCount->fetchColumn(),
    'openTasks' => (int) $openCount->fetchColumn(),
  ];
}

function encode_skills($skills): ?string
{
  if ($skills === null || $skills === '') {
    return null;
  }
  if (is_string($skills)) {
    $parts = array_values(array_filter(array_map('trim', preg_split('/[,;\n]+/', $skills) ?: [])));
    return $parts ? json_encode(array_values($parts)) : null;
  }
  if (is_array($skills)) {
    $parts = array_values(array_filter(array_map(static fn($s) => trim((string) $s), $skills)));
    return $parts ? json_encode($parts) : null;
  }
  return null;
}

if ($method === 'GET') {
  $user = require_auth(['Admin', 'Staff', 'Volunteer']);

  if ($user['role'] === 'Volunteer') {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    json_response(['ok' => true, 'data' => $row ? [map_volunteer($pdo, $row)] : []]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Volunteer not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_volunteer($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM volunteers ORDER BY full_name ASC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_volunteer($pdo, $r), $rows)]);
}

$body = read_json_body();
$public = !empty($body['public']);

if ($method === 'POST') {
  $user = $public ? null : require_auth(['Admin', 'Staff']);
  if ($user && $user['role'] === 'Volunteer') {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }

  [$lastName, $firstName, $middleInitial, $name] = read_name_parts($body);
  if ($name === '') {
    $name = trim((string) ($body['name'] ?? $body['fullName'] ?? ''));
  }
  $email = strtolower(trim((string) ($body['email'] ?? '')));
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Name is required'], 400);
  }
  if ($public) {
    $email = require_valid_email($email, 'Email');
    if (empty($body['acceptedPolicies']) && empty($body['termsAccepted'])) {
      json_response(['ok' => false, 'error' => 'Please accept the Data Privacy Policy and Terms & Conditions'], 400);
    }
  } elseif ($email !== '') {
    $email = require_valid_email($email, 'Email');
  }
  if ($email !== '' && email_taken($pdo, $email)) {
    // Allow re-apply only when the existing user is already a Volunteer (approval links later).
    $roleCheck = $pdo->prepare("SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1");
    $roleCheck->execute([$email]);
    $existingRole = (string) ($roleCheck->fetchColumn() ?: '');
    if ($existingRole !== '' && strcasecmp($existingRole, 'Volunteer') !== 0) {
      json_response(['ok' => false, 'error' => 'That email already belongs to a different account role.'], 400);
    }
  }

  $programs = $body['programs'] ?? [];
  if (!is_array($programs)) {
    $programs = [];
  }
  $skillsJson = encode_skills($body['skills'] ?? null);
  $skillsOther = trim((string) ($body['skillsOther'] ?? $body['skills_other'] ?? ''));
  $availability = trim((string) ($body['availability'] ?? ''));
  $code = generate_code('VOL');
  $status = $public ? 'Pending Review' : (string) ($body['status'] ?? 'Pending Review');
  $miDb = $middleInitial !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
    : null;

  $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, first_name, last_name, middle_initial, email, programs_json, skills_json, skills_other, availability, status, hours, required_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $name,
    $firstName !== '' ? $firstName : null,
    $lastName !== '' ? $lastName : null,
    $miDb,
    $email !== '' ? $email : null,
    json_encode($programs),
    $skillsJson,
    $skillsOther !== '' ? $skillsOther : null,
    $availability !== '' ? $availability : null,
    $status,
    $public ? 0 : (int) ($body['hours'] ?? 0),
    $public ? 0 : (int) ($body['requiredHours'] ?? $body['required_hours'] ?? 0),
  ]);
  $newId = (int) $pdo->lastInsertId();

  if ($public) {
    notify_admins(
      $pdo,
      'volunteer',
      'New volunteer application',
      "{$name} applied to volunteer ({$code})",
      '/admin/volunteers'
    );
  }

  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
  $stmt->execute([$newId]);
  $mapped = map_volunteer($pdo, $stmt->fetch());
  json_response([
    'ok' => true,
    'data' => $mapped,
    'trackingCode' => $code,
  ], 201);
}

$user = require_auth(['Admin', 'Staff']);
if ($user['role'] === 'Volunteer') {
  json_response(['ok' => false, 'error' => 'Access denied'], 403);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Volunteer id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Volunteer not found'], 404);
  }
  $programs = isset($body['programs']) ? json_encode($body['programs']) : $existing['programs_json'];
  $skillsJson = array_key_exists('skills', $body)
    ? encode_skills($body['skills'])
    : ($existing['skills_json'] ?? null);
  $skillsOther = array_key_exists('skillsOther', $body) || array_key_exists('skills_other', $body)
    ? (trim((string) ($body['skillsOther'] ?? $body['skills_other'] ?? '')) ?: null)
    : ($existing['skills_other'] ?? null);
  $availability = array_key_exists('availability', $body)
    ? (trim((string) $body['availability']) ?: null)
    : ($existing['availability'] ?? null);
  $newStatus = (string) ($body['status'] ?? $existing['status']);

  $hasNameParts = array_key_exists('lastName', $body) || array_key_exists('firstName', $body)
    || array_key_exists('last_name', $body) || array_key_exists('first_name', $body);
  if ($hasNameParts) {
    [$lastName, $firstName, $middleInitial, $name] = read_name_parts($body);
    if ($name === '') {
      $name = trim((string) ($body['name'] ?? $existing['full_name']));
    }
  } else {
    $lastName = trim((string) ($existing['last_name'] ?? ''));
    $firstName = trim((string) ($existing['first_name'] ?? ''));
    $middleInitial = trim((string) ($existing['middle_initial'] ?? ''));
    $name = trim((string) ($body['name'] ?? $existing['full_name']));
  }
  $miDb = $middleInitial !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
    : null;

  $email = require_valid_email((string) ($body['email'] ?? $existing['email'] ?? ''), 'Email');

  $update = $pdo->prepare('UPDATE volunteers SET full_name = ?, first_name = ?, last_name = ?, middle_initial = ?, email = ?, programs_json = ?, skills_json = ?, skills_other = ?, availability = ?, status = ?, hours = ?, required_hours = ? WHERE id = ?');
  $update->execute([
    $name,
    $firstName !== '' ? $firstName : null,
    $lastName !== '' ? $lastName : null,
    $miDb,
    $email,
    $programs,
    $skillsJson,
    $skillsOther,
    $availability,
    $newStatus,
    (int) ($body['hours'] ?? $existing['hours']),
    (int) ($body['requiredHours'] ?? $body['required_hours'] ?? ($existing['required_hours'] ?? 0)),
    $id,
  ]);

  $accountCreated = false;
  $credentialsSent = false;
  $mailTransport = '';
  $mailError = '';
  $temporaryPassword = null;

  if ($newStatus === 'Approved' && ($existing['status'] ?? '') !== 'Approved') {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
    $stmt->execute([$id]);
    $fresh = $stmt->fetch();
    if ($fresh) {
      $provision = provision_volunteer_account($pdo, $fresh);
      $accountCreated = !empty($provision['created']);
      $mail = is_array($provision['mail'] ?? null) ? $provision['mail'] : null;
      if ($mail) {
        $mailTransport = (string) ($mail['transport'] ?? '');
        $mailError = (string) ($mail['error'] ?? '');
        $credentialsSent = !empty($mail['sent']) && in_array($mailTransport, ['nodemailer', 'smtp', 'outbox', 'mail'], true);
      }
      if (!empty($provision['error'])) {
        $mailError = $mailError !== '' ? $mailError : (string) $provision['error'];
      }
      if (!empty($provision['temporaryPassword'])) {
        $temporaryPassword = (string) $provision['temporaryPassword'];
      }
    }
  }

  if (
    $newStatus === 'Rejected'
    && ($existing['status'] ?? '') !== 'Rejected'
    && lifecycle_mail_allowed('application', 'Rejected')
  ) {
    $volEmail = strtolower(trim((string) ($existing['email'] ?? '')));
    $volName = trim((string) ($existing['full_name'] ?? 'Volunteer'));
    send_lifecycle_email(
      $volEmail,
      $volName,
      'Update on your volunteer application',
      'Application update',
      '<p style="margin:0 0 12px;line-height:1.6;color:#475569">Your volunteer application with Rise Above Foundation Cebu was not approved at this time.</p>'
        . '<p style="margin:0 0 12px;line-height:1.6;color:#475569">You may apply again later or contact the foundation if you have questions.</p>',
      '/login',
      'Open portal'
    );
    if (!empty($existing['user_id'])) {
      create_notification(
        $pdo,
        'volunteer',
        'Application update',
        'Your volunteer application was not approved.',
        '/login',
        (int) $existing['user_id']
      );
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
  $stmt->execute([$id]);
  json_response([
    'ok' => true,
    'data' => map_volunteer($pdo, $stmt->fetch()),
    'accountCreated' => $accountCreated,
    'credentialsSent' => $credentialsSent,
    'mailTransport' => $mailTransport,
    'mailError' => $mailError,
    'temporaryPassword' => $temporaryPassword,
  ]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Volunteer id is required'], 400);
  }
  $pdo->prepare('DELETE FROM volunteers WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
