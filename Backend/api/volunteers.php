<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

try { $pdo->exec("ALTER TABLE volunteers ADD COLUMN resume_path VARCHAR(255) NULL AFTER required_hours"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE volunteers ADD COLUMN resume_file_name VARCHAR(255) NULL AFTER resume_path"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE volunteers ADD COLUMN resume_file_type VARCHAR(80) NULL AFTER resume_file_name"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE volunteers ADD COLUMN resume_file_size INT UNSIGNED NULL AFTER resume_file_type"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE volunteers MODIFY COLUMN availability TEXT NULL"); } catch (Throwable $e) {}

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

  $applicantType = !empty($row['applicant_type']) && strcasecmp((string)$row['applicant_type'], 'Intern') === 0 ? 'Intern' : 'Volunteer';
  $hasResume = !empty($row['resume_path']) && $applicantType === 'Intern';

  $hours = $applicantType === 'Intern' ? (int) $row['hours'] : 0;
  $requiredHours = $applicantType === 'Intern' ? (int) ($row['required_hours'] ?? 0) : 0;
  $remainingHours = $applicantType === 'Intern' ? max(0, $requiredHours - $hours) : 0;

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'name' => $row['full_name'],
    'firstName' => $row['first_name'] ?? '',
    'lastName' => $row['last_name'] ?? '',
    'middleInitial' => $row['middle_initial'] ?? '',
    'email' => $row['email'],
    'phone' => $row['phone'] ?? '',
    'applicantType' => $applicantType,
    'institution' => $row['institution'] ?? null,
    'userId' => $row['user_id'] ? (int) $row['user_id'] : null,
    'programs' => decode_programs($row['programs_json']),
    'skills' => $skills,
    'skillsOther' => $row['skills_other'] ?? '',
    'availability' => $row['availability'] ?? '',
    'status' => $row['status'],
    'hours' => $hours,
    'requiredHours' => $requiredHours,
    'remainingHours' => $remainingHours,
    'assignedTasks' => (int) $taskCount->fetchColumn(),
    'openTasks' => (int) $openCount->fetchColumn(),
    'hasResume' => $hasResume,
    'resumePath' => $hasResume ? ($row['resume_path'] ?? null) : null,
    'resumeFileName' => $hasResume ? ($row['resume_file_name'] ?? null) : null,
    'resumeFileType' => $hasResume ? ($row['resume_file_type'] ?? null) : null,
    'resumeFileSize' => $hasResume && isset($row['resume_file_size']) ? (int) $row['resume_file_size'] : null,
    'resumeUrl' => $hasResume
      ? ('/api/file.php?kind=volunteer_resumes&name=' . rawurlencode(basename((string) $row['resume_path'])))
      : null,
  ];
}

function save_volunteer_resume_upload(): ?array
{
  $fileKey = isset($_FILES['resume']) ? 'resume' : (isset($_FILES['cv']) ? 'cv' : (isset($_FILES['cover_letter']) ? 'cover_letter' : null));
  if (!$fileKey || !isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] === UPLOAD_ERR_NO_FILE) {
    return null;
  }
  if ($_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Cover letter / Resume upload failed. Please try again.'], 400);
  }

  $file = $_FILES[$fileKey];
  $origName = (string) ($file['name'] ?? 'document.pdf');
  $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION) ?: '');
  $allowedExts = ['pdf', 'doc', 'docx'];
  if (!in_array($ext, $allowedExts, true)) {
    json_response(['ok' => false, 'error' => 'File must be a PDF or Word document (.pdf, .doc, .docx)'], 400);
  }

  // 10 MB limit
  if ($file['size'] > 10 * 1024 * 1024) {
    json_response(['ok' => false, 'error' => 'File size must be under 10MB'], 400);
  }

  $dir = __DIR__ . '/uploads/volunteer_resumes';
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }

  $mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
  if (!$mime || $mime === 'application/octet-stream') {
    if ($ext === 'pdf') $mime = 'application/pdf';
    elseif ($ext === 'doc') $mime = 'application/msword';
    elseif ($ext === 'docx') $mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  $safeExt = $ext ?: 'pdf';
  $safeName = 'resume_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $safeExt;
  $moved = is_uploaded_file($file['tmp_name'])
    ? move_uploaded_file($file['tmp_name'], $dir . '/' . $safeName)
    : copy($file['tmp_name'], $dir . '/' . $safeName);
  if (!$moved) {
    json_response(['ok' => false, 'error' => 'Failed to save CV/Resume file on the server.'], 500);
  }

  return [
    'path' => $safeName,
    'name' => $origName,
    'type' => $mime,
    'size' => (int) $file['size'],
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

  $rows = $pdo->query('SELECT * FROM volunteers ORDER BY created_at DESC, id DESC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_volunteer($pdo, $r), $rows)]);
}

$isMultipart = isset($_SERVER['CONTENT_TYPE'])
  && stripos((string) $_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;

if ($isMultipart) {
  $body = $_POST;
  if (isset($body['programs']) && is_string($body['programs'])) {
    $decoded = json_decode($body['programs'], true);
    $body['programs'] = is_array($decoded) ? $decoded : (preg_split('/[,;\n]+/', $body['programs']) ?: []);
  }
  if (isset($body['skills']) && is_string($body['skills'])) {
    $decoded = json_decode($body['skills'], true);
    $body['skills'] = is_array($decoded) ? $decoded : (preg_split('/[,;\n]+/', $body['skills']) ?: []);
  }
  $public = !empty($body['public']);
} else {
  $body = read_json_body();
  $public = !empty($body['public']);
}

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
    $hasTerms = !empty($body['acceptedTerms']) || !empty($body['termsAccepted']) || !empty($body['acceptedPolicies']);
    $hasPrivacy = !empty($body['acceptedPrivacy']) || !empty($body['privacyAccepted']) || !empty($body['acceptedPolicies']);
    if (!$hasTerms || !$hasPrivacy) {
      json_response(['ok' => false, 'error' => 'You must accept both the Data Privacy Policy and Terms & Conditions before submitting your application.'], 400);
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

  $applicantType = !empty($body['applicantType']) && strcasecmp((string) $body['applicantType'], 'Intern') === 0
    ? 'Intern'
    : (!empty($body['applicant_type']) && strcasecmp((string) $body['applicant_type'], 'Intern') === 0 ? 'Intern' : 'Volunteer');
  $institution = trim((string) ($body['institution'] ?? ''));

  $programs = $body['programs'] ?? [];
  if (!is_array($programs)) {
    $programs = [];
  }
  $skillsJson = encode_skills($body['skills'] ?? null);
  $skillsOther = trim((string) ($body['skillsOther'] ?? $body['skills_other'] ?? ''));
  $availability = trim((string) ($body['availability'] ?? ''));
  $code = generate_code($applicantType === 'Intern' ? 'INT' : 'VOL');
  $status = $public ? 'Pending Review' : (string) ($body['status'] ?? 'Pending Review');
  $miDb = $middleInitial !== ''
    ? strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $middleInitial) ?: '', 0, 1))
    : null;

  if ($applicantType === 'Intern') {
    $resume = save_volunteer_resume_upload();
  } else {
    // Volunteers do not upload CV
    $resume = null;
    $institution = '';
  }

  $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, first_name, last_name, middle_initial, email, phone, applicant_type, institution, programs_json, skills_json, skills_other, availability, status, hours, required_hours, resume_path, resume_file_name, resume_file_type, resume_file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $name,
    $firstName !== '' ? $firstName : null,
    $lastName !== '' ? $lastName : null,
    $miDb,
    $email !== '' ? $email : null,
    !empty($body['phone']) ? trim((string) $body['phone']) : null,
    $applicantType,
    $institution !== '' ? $institution : null,
    json_encode($programs),
    $skillsJson,
    $skillsOther !== '' ? $skillsOther : null,
    $availability !== '' ? $availability : null,
    $status,
    ($public || $applicantType !== 'Intern') ? 0 : (int) ($body['hours'] ?? 0),
    ($public || $applicantType !== 'Intern') ? 0 : (int) ($body['requiredHours'] ?? $body['required_hours'] ?? 0),
    $resume ? $resume['path'] : null,
    $resume ? $resume['name'] : null,
    $resume ? $resume['type'] : null,
    $resume ? $resume['size'] : null,
  ]);
  $newId = (int) $pdo->lastInsertId();

  if ($public) {
    $entityTitle = $applicantType === 'Intern' ? 'intern' : 'volunteer';
    $appLabel = $applicantType === 'Intern' ? 'Internship application' : 'Volunteer application';
    notify_admins(
      $pdo,
      'application',
      "New {$appLabel}",
      "{$name} submitted a {$entityTitle} application ({$code}).",
      '/admin/volunteers'
    );
  }

  $accountCreated = false;
  $accountLinked = false;
  $credentialsSent = false;
  $mailTransport = '';
  $mailError = '';
  $temporaryPassword = null;

  if (!$public && $status === 'Approved') {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
    $stmt->execute([$newId]);
    $fresh = $stmt->fetch();
    if ($fresh) {
      $provision = provision_volunteer_account($pdo, $fresh);
      $accountCreated = !empty($provision['created']);
      $accountLinked = !empty($provision['linked']);
      $mail = is_array($provision['mail'] ?? null) ? $provision['mail'] : null;
      if ($mail) {
        $mailTransport = (string) ($mail['transport'] ?? '');
        $mailError = (string) ($mail['error'] ?? '');
        $credentialsSent = !empty($mail['sent']) && in_array($mailTransport, ['brevo', 'nodemailer', 'smtp', 'mail'], true);
      }
      if (!empty($provision['error'])) {
        $mailError = $mailError !== '' ? $mailError : (string) $provision['error'];
      }
      if (!empty($provision['temporaryPassword'])) {
        $temporaryPassword = (string) $provision['temporaryPassword'];
      }
      if (empty($provision['userId'])) {
        $pdo->prepare("UPDATE volunteers SET status = 'Pending Review' WHERE id = ?")->execute([$newId]);
        json_response([
          'ok' => false,
          'error' => $mailError !== '' ? $mailError : "{$applicantType} account could not be created. The application remains pending review.",
        ], 400);
      }
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
  $stmt->execute([$newId]);
  json_response([
    'ok' => true,
    'data' => map_volunteer($pdo, $stmt->fetch()),
    'accountCreated' => $accountCreated,
    'accountLinked' => $accountLinked,
    'credentialsSent' => $credentialsSent,
    'mailTransport' => $mailTransport,
    'mailError' => $mailError,
    'temporaryPassword' => $temporaryPassword,
  ], 201);
}

if ($method === 'PUT') {
  $user = require_auth(['Admin', 'Staff', 'Volunteer']);
  if ($user['role'] === 'Volunteer') {
    $vIdStmt = $pdo->prepare('SELECT id FROM volunteers WHERE user_id = ? LIMIT 1');
    $vIdStmt->execute([$user['id']]);
    $id = (int) ($vIdStmt->fetchColumn() ?: 0);
    if (!$id) {
      json_response(['ok' => false, 'error' => 'Volunteer record not found for your account.'], 404);
    }
  } else {
    if (!$id) {
      json_response(['ok' => false, 'error' => 'Volunteer id is required'], 400);
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Volunteer not found'], 404);
  }

  $isVolunteerOwner = ($user['role'] === 'Volunteer' && (int) ($existing['user_id'] ?? 0) === (int) $user['id']);
  if ($user['role'] === 'Volunteer' && !$isVolunteerOwner) {
    json_response(['ok' => false, 'error' => 'Access denied: you can only update your own volunteer profile.'], 403);
  }

  $programs = isset($body['programs']) ? json_encode($body['programs']) : $existing['programs_json'];
  $skillsJson = array_key_exists('skills', $body)
    ? encode_skills($body['skills'])
    : ($existing['skills_json'] ?? null);
  $skillsOther = array_key_exists('skillsOther', $body) || array_key_exists('skills_other', $body)
    ? (trim((string) ($body['skillsOther'] ?? $body['skills_other'] ?? '')) ?: null)
    : ($existing['skills_other'] ?? null);
  $availability = array_key_exists('availability', $body)
    ? (trim((string) ($body['availability']) ?: null))
    : ($existing['availability'] ?? null);
  $applicantType = array_key_exists('applicantType', $body) || array_key_exists('applicant_type', $body)
    ? (strcasecmp((string) ($body['applicantType'] ?? $body['applicant_type']), 'Intern') === 0 ? 'Intern' : 'Volunteer')
    : ($existing['applicant_type'] ?? 'Volunteer');
  $institution = array_key_exists('institution', $body)
    ? (trim((string) ($body['institution']) ?: null))
    : ($existing['institution'] ?? null);

  if ($isVolunteerOwner) {
    // Keep volunteer status and hours unchanged when updated by volunteer themselves
    $newStatus = (string) ($existing['status'] ?? 'Pending Review');
  } else {
    $newStatus = (string) ($body['status'] ?? $existing['status']);
    assert_valid_status_transition(
      'Volunteer application',
      (string) ($existing['status'] ?? 'Pending Review'),
      $newStatus,
      WORKFLOW_VOLUNTEER_STEPS,
      WORKFLOW_VOLUNTEER_TERMINAL,
      WORKFLOW_VOLUNTEER_BRANCHES
    );
  }

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

  $updateHours = $applicantType === 'Intern'
    ? (int) ($body['hours'] ?? $existing['hours'])
    : 0;
  $updateRequiredHours = $applicantType === 'Intern'
    ? (int) ($body['requiredHours'] ?? $body['required_hours'] ?? ($existing['required_hours'] ?? 0))
    : 0;

  $update = $pdo->prepare('UPDATE volunteers SET full_name = ?, first_name = ?, last_name = ?, middle_initial = ?, email = ?, applicant_type = ?, institution = ?, programs_json = ?, skills_json = ?, skills_other = ?, availability = ?, status = ?, hours = ?, required_hours = ? WHERE id = ?');
  $update->execute([
    $name,
    $firstName !== '' ? $firstName : null,
    $lastName !== '' ? $lastName : null,
    $miDb,
    $email,
    $applicantType,
    $institution,
    $programs,
    $skillsJson,
    $skillsOther,
    $availability,
    $newStatus,
    $updateHours,
    $updateRequiredHours,
    $id,
  ]);

  $accountCreated = false;
  $accountLinked = false;
  $credentialsSent = false;
  $mailTransport = '';
  $mailError = '';
  $temporaryPassword = null;

  if (
    $newStatus === 'Approved'
    && (($existing['status'] ?? '') !== 'Approved' || empty($existing['user_id']))
  ) {
    $stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ?');
    $stmt->execute([$id]);
    $fresh = $stmt->fetch();
    if ($fresh) {
      $provision = provision_volunteer_account($pdo, $fresh);
      $accountCreated = !empty($provision['created']);
      $accountLinked = !empty($provision['linked']);
      $mail = is_array($provision['mail'] ?? null) ? $provision['mail'] : null;
      if ($mail) {
        $mailTransport = (string) ($mail['transport'] ?? '');
        $mailError = (string) ($mail['error'] ?? '');
        $credentialsSent = !empty($mail['sent']) && in_array($mailTransport, ['brevo', 'nodemailer', 'smtp', 'mail'], true);
      }
      if (!empty($provision['error'])) {
        $mailError = $mailError !== '' ? $mailError : (string) $provision['error'];
      }
      if (!empty($provision['temporaryPassword'])) {
        $temporaryPassword = (string) $provision['temporaryPassword'];
      }
      if (empty($provision['userId'])) {
        $pdo->prepare('UPDATE volunteers SET status = ? WHERE id = ?')
          ->execute([(string) ($existing['status'] ?? 'Pending Review'), $id]);
        json_response([
          'ok' => false,
          'error' => $mailError !== '' ? $mailError : "{$applicantType} account could not be created. The application remains pending review.",
        ], 400);
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
    'accountLinked' => $accountLinked,
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
