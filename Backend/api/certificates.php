<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

// Certificate endpoints must never leak PHP warnings or HTML error pages into
// responses consumed as JSON by the SPA. Detailed failures remain in the
// server log while callers receive a stable JSON error shape.
ini_set('display_errors', '0');
set_exception_handler(static function (Throwable $error): void {
  error_log('[certificates] ' . $error->getMessage());
  json_response([
    'ok' => false,
    'error' => 'The certificate service could not complete the request. Please try again or contact an administrator.',
  ], 500);
});

$pdo = db();
$method = request_method();
$id = get_id_param();

function ensure_certificates_schema(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;
  $ensured = true;

  $columns = $pdo->query('SHOW COLUMNS FROM certificates')->fetchAll(PDO::FETCH_COLUMN);
  $columnList = array_map(static fn($column) => strtolower((string) $column), $columns);

  // These are additive compatibility migrations for installations created
  // from an older schema. Each ALTER is independently guarded by the actual
  // table metadata, so an existing column or certificate record is untouched.
  $additions = [
    'status' => "VARCHAR(50) NOT NULL DEFAULT 'Pending' AFTER cert_date",
    'template_id' => "VARCHAR(50) NOT NULL DEFAULT 'modern_classic' AFTER cert_type",
    'signatory_id' => 'BIGINT UNSIGNED NULL AFTER signatory_title',
    'signature_url' => 'VARCHAR(255) NULL AFTER signatory_id',
    'photo_url' => 'VARCHAR(255) NULL AFTER signature_url',
    'photo_data' => 'LONGTEXT NULL AFTER photo_url',
    'photo_layout' => "VARCHAR(50) NOT NULL DEFAULT 'none' AFTER photo_data",
    'contribution_details' => 'TEXT NULL AFTER photo_layout',
    'location' => "VARCHAR(150) NOT NULL DEFAULT 'Cebu City, Philippines' AFTER cert_date",
  ];

  foreach ($additions as $column => $definition) {
    if (in_array($column, $columnList, true)) continue;
    try {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN {$column} {$definition}");
      $columnList[] = $column;
    } catch (Throwable $error) {
      error_log("[certificates] Could not add missing {$column} column: " . $error->getMessage());
    }
  }

  // Status is part of the original certificate workflow and is required for
  // request/approval/generation persistence. Stop with valid JSON if the
  // database account cannot repair a schema-drifted table.
  $verified = array_map(
    static fn($column) => strtolower((string) $column),
    $pdo->query('SHOW COLUMNS FROM certificates')->fetchAll(PDO::FETCH_COLUMN)
  );
  if (!in_array('status', $verified, true)) {
    throw new RuntimeException('The certificates table is missing its required status column.');
  }

  if (in_array('photo_url', $verified, true)) {
    try {
      $pdo->exec("UPDATE certificates SET photo_url = SUBSTRING_INDEX(photo_url, 'name=', -1) WHERE photo_url LIKE '%name=%'");
    } catch (Throwable $error) {
      error_log('[certificates] Photo URL cleanup skipped: ' . $error->getMessage());
    }
  }
}

ensure_certificates_schema($pdo);

function resolve_file_url(?string $path, string $kind = 'certificates'): string
{
  if (!$path) return '';
  $path = trim($path);
  if ($path === '' || $path === 'null' || $path === 'undefined') return '';
  if (str_starts_with($path, 'data:') || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
    return $path;
  }
  // Prevent double-encoding if already a /api/file.php URL
  if (str_contains($path, 'file.php')) {
    if (preg_match('/name=([^&]+)/', $path, $m)) {
      $cleanName = rawurldecode($m[1]);
      return '/api/file.php?kind=' . $kind . '&name=' . rawurlencode(basename($cleanName));
    }
    return $path;
  }
  return '/api/file.php?kind=' . $kind . '&name=' . rawurlencode(basename($path));
}

function map_certificate(?array $row): ?array
{
  if (!$row || !is_array($row)) return null;

  $sigImage = $row['signature_url'] ?? '';
  if (empty($sigImage) && strcasecmp((string)($row['signatory_name'] ?? ''), 'Flemming Hansen') === 0) {
    $sigImage = 'sig_flemming_hansen.png';
  }

  $photoUrl = $row['photo_url'] ?? '';
  $photoData = $row['photo_data'] ?? null;
  $photoDisplay = resolve_file_url($photoUrl, 'certificates');
  if (empty($photoDisplay) && !empty($photoData) && str_starts_with($photoData, 'data:image/')) {
    $photoDisplay = $photoData;
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'type' => $row['cert_type'],
    'templateId' => $row['template_id'] ?? 'modern_classic',
    'recipientType' => $row['recipient_type'] ?? 'Donor',
    'recipient' => $row['recipient_name'],
    'reference' => $row['reference_code'],
    'details' => $row['details'] ?? '',
    'signatoryId' => !empty($row['signatory_id']) ? (int) $row['signatory_id'] : null,
    'signatoryName' => $row['signatory_name'] ?? 'Flemming Hansen',
    'signatoryTitle' => $row['signatory_title'] ?? 'CEO and Co-Founder',
    'signatureUrl' => $sigImage,
    'signatureDisplayUrl' => resolve_file_url($sigImage, 'certificates'),
    'photoUrl' => $photoUrl,
    'photoDisplayUrl' => $photoDisplay,
    'photoData' => $photoData,
    'photoLayout' => $row['photo_layout'] ?? 'none',
    'contributionDetails' => $row['contribution_details'] ?? '',
    'date' => format_date($row['cert_date']),
    'certDate' => $row['cert_date'],
    'location' => $row['location'] ?? 'Cebu City, Philippines',
    'status' => $row['status'] ?? 'Pending',
  ];
}

function donation_certificate_is_available(PDO $pdo, array $certificate): bool
{
  $reference = trim((string) ($certificate['reference_code'] ?? ''));
  if ($reference === '') return true;
  $stmt = $pdo->prepare('SELECT status FROM donations WHERE tracking_code = ? LIMIT 1');
  $stmt->execute([$reference]);
  $status = $stmt->fetchColumn();
  if ($status === false) return true;
  return in_array((string) $status, ['Completed', 'Verified', 'Certificate / Official Receipt', 'Delivered', 'Distributed'], true);
}

function process_certificate_photo(?string $raw, ?string $existingUrl = null, ?string $existingData = null): array
{
  if ($raw === null) {
    return [$existingUrl, $existingData];
  }
  $raw = trim($raw);
  if ($raw === '' || $raw === 'null' || $raw === 'undefined') {
    return [null, null];
  }

  // Handle uploaded data URL (base64 image)
  if (str_starts_with($raw, 'data:image/')) {
    if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $raw, $matches)) {
      $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
      $binary = base64_decode($matches[2]);
      if ($binary !== false) {
        $dir = __DIR__ . '/uploads/certificates';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $safeName = 'cert_photo_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        @file_put_contents($dir . '/' . $safeName, $binary);
        return [$safeName, $raw];
      }
    }
    return [null, $raw];
  }

  // If already an API URL e.g. /api/file.php?kind=certificates&name=...
  if (str_contains($raw, 'name=')) {
    parse_str(parse_url($raw, PHP_URL_QUERY) ?? '', $query);
    if (!empty($query['name'])) {
      $fn = basename($query['name']);
      return [$fn, $existingData];
    }
  }

  if (preg_match('#^https?://#i', $raw)) {
    return [$raw, $existingData];
  }

  $clean = basename($raw);
  return [$clean ?: null, $existingData];
}

$user = require_auth(['Admin', 'Staff', 'Donor', 'Volunteer', 'Intern']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Certificate not found'], 404);
    }
    if (!donation_certificate_is_available($pdo, $row)) {
      json_response(['ok' => false, 'error' => 'Certificate is locked until the donation is completed.'], 403);
    }
    $role = (string) ($user['role'] ?? '');
    if (in_array($role, ['Donor', 'Volunteer', 'Intern'], true)) {
      $allowed = false;
      if ($role === 'Donor') {
        $own = $pdo->prepare('SELECT COUNT(*) FROM donations WHERE tracking_code = ? AND donor_email = ?');
        $own->execute([(string) ($row['reference_code'] ?? ''), (string) $user['email']]);
        $allowed = ((int) $own->fetchColumn() > 0)
          || strcasecmp((string) ($row['recipient_name'] ?? ''), (string) ($user['name'] ?? '')) === 0;
      } else {
        $allowedTypes = $role === 'Intern' ? ['Intern', 'Volunteer', ''] : ['Volunteer', ''];
        $allowed = strcasecmp((string) ($row['recipient_name'] ?? ''), (string) ($user['name'] ?? '')) === 0
          && in_array((string) ($row['recipient_type'] ?? $role), $allowedTypes, true);
      }
      if (!$allowed) {
        json_response(['ok' => false, 'error' => 'You do not have access to this certificate.'], 403);
      }
    }
    json_response(['ok' => true, 'data' => map_certificate($row)]);
  }

  if ($user['role'] === 'Donor') {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE recipient_name = ? OR reference_code IN (SELECT tracking_code FROM donations WHERE donor_email = ?) ORDER BY id DESC');
    $stmt->execute([$user['name'], $user['email']]);
  } elseif (in_array($user['role'], ['Volunteer', 'Intern'], true)) {
    $recipientTypes = $user['role'] === 'Intern' ? ['Intern', 'Volunteer', ''] : ['Volunteer', 'Volunteer', ''];
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE (recipient_name = ? OR reference_code IN (SELECT code FROM volunteers WHERE user_id = ? OR email = ?)) AND (recipient_type = ? OR recipient_type = ? OR recipient_type IS NULL OR recipient_type = ?) ORDER BY id DESC');
    $stmt->execute([$user['name'], $user['id'], $user['email'], ...$recipientTypes]);
  } else {
    $stmt = $pdo->query('SELECT * FROM certificates ORDER BY created_at DESC, id DESC');
  }

  $rows = array_values(array_filter(
    $stmt->fetchAll(),
    static fn(array $row): bool => donation_certificate_is_available($pdo, $row)
  ));
  json_response(['ok' => true, 'data' => array_map('map_certificate', $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  // Donors may request a certificate for one of their own donations.
  if ($user['role'] === 'Donor') {
    $reference = trim((string) ($body['reference'] ?? ''));
    if ($reference !== '') {
      // Prevent duplicate certificate requests
      $checkDup = $pdo->prepare('SELECT * FROM certificates WHERE reference_code = ? AND status <> "Rejected" LIMIT 1');
      $checkDup->execute([$reference]);
      $existingReq = $checkDup->fetch(PDO::FETCH_ASSOC);
      if ($existingReq) {
        json_response([
          'ok' => false,
          'error' => "A certificate request for {$reference} has already been submitted.",
          'alreadyRequested' => true,
          'data' => map_certificate($existingReq)
        ], 409);
      }

      $own = $pdo->prepare('SELECT id, status FROM donations WHERE tracking_code = ? AND donor_email = ? LIMIT 1');
      $own->execute([$reference, $user['email']]);
      $donation = $own->fetch(PDO::FETCH_ASSOC);
      if (!$donation) {
        json_response(['ok' => false, 'error' => 'That donation reference does not belong to your account'], 403);
      }
      $allowed = ['Completed', 'Certificate / Official Receipt'];
      if (!in_array($donation['status'], $allowed, true)) {
        json_response(['ok' => false, 'error' => 'Certificates are only available after the donation is completed'], 400);
      }
    } else {
      json_response(['ok' => false, 'error' => 'A completed donation reference is required'], 400);
    }
    $code = generate_code('CERT');
    $stmt = $pdo->prepare('
      INSERT INTO certificates (code, cert_type, template_id, recipient_type, recipient_name, reference_code, details, cert_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
      $code,
      'Certificate of Donation',
      'modern_classic',
      'Donor',
      $user['name'],
      $reference ?: null,
      trim((string) ($body['details'] ?? '')) ?: null,
      date('Y-m-d'),
      'Requested',
    ]);
    $insertedId = (int) $pdo->lastInsertId();

    notify_admins($pdo, 'certificate', 'Certificate requested', "{$user['name']} requested a certificate" . ($reference ? " for {$reference}" : ''), '/admin/certificates');
    audit_log($pdo, 'request', 'certificate', $code, "{$user['name']} requested a certificate");

    $certRow = null;
    if ($insertedId > 0) {
      $getStmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
      $getStmt->execute([$insertedId]);
      $certRow = $getStmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$certRow && $code) {
      $getStmt = $pdo->prepare('SELECT * FROM certificates WHERE code = ? LIMIT 1');
      $getStmt->execute([$code]);
      $certRow = $getStmt->fetch(PDO::FETCH_ASSOC);
    }
    $mapped = $certRow ? map_certificate($certRow) : [
      'id' => $code,
      'code' => $code,
      'dbId' => $insertedId,
      'type' => 'Certificate of Donation',
      'recipient' => $user['name'],
      'reference' => $reference,
      'status' => 'Requested',
      'date' => date('Y-m-d'),
    ];
    json_response(['ok' => true, 'data' => $mapped, 'message' => 'Certificate requested successfully.'], 201);
  }

  // Volunteers and Interns may request a certificate for their completed volunteer duties/activities.
  if (strcasecmp((string)($user['role'] ?? ''), 'Volunteer') === 0 || strcasecmp((string)($user['role'] ?? ''), 'Intern') === 0) {
    $certType = trim((string) ($body['type'] ?? 'Certificate of Volunteer Service'));
    $allowedTypes = [
      'Certificate of Volunteer Service',
      'Volunteer Certificate',
      'Certificate of Participation',
      'Certificate of Appreciation',
      'Training Certificate',
      'Achievement Award',
      'Special Recognition',
    ];
    if (!in_array($certType, $allowedTypes, true)) {
      $certType = 'Certificate of Volunteer Service';
    }

    $reference = trim((string) ($body['reference'] ?? ''));
    if ($reference === '') {
      json_response(['ok' => false, 'error' => 'For Duty / Activity is required. Please select a completed duty or activity.'], 400);
    }

    // Lookup task in tasks table to ensure it exists and is Completed
    $taskStmt = $pdo->prepare('SELECT * FROM tasks WHERE code = ? OR id = ? LIMIT 1');
    $taskStmt->execute([$reference, is_numeric($reference) ? (int)$reference : 0]);
    $taskRow = $taskStmt->fetch(PDO::FETCH_ASSOC);

    if (!$taskRow) {
      json_response(['ok' => false, 'error' => 'The selected task or activity could not be found in system records.'], 400);
    }

    $isCompleted = ($taskRow['board_column'] ?? '') === 'done'
      || in_array(strtolower((string)($taskRow['status'] ?? '')), ['done', 'completed'], true);

    if (!$isCompleted) {
      json_response(['ok' => false, 'error' => 'Certificates can only be requested for tasks that are already Completed.'], 400);
    }

    $taskCode = (string)($taskRow['code'] ?? $reference);
    $taskTitle = (string)($taskRow['title'] ?? 'Volunteer Duty');
    $taskModule = (string)($taskRow['module'] ?? 'Volunteer Program');

    $details = trim((string) ($body['details'] ?? ''));
    if ($details === '') {
      $details = "In recognition of outstanding volunteer service and completion of duty: {$taskTitle} ({$taskModule}).";
    }

    $code = generate_code('CERT');
    $stmt = $pdo->prepare('
      INSERT INTO certificates (code, cert_type, template_id, recipient_type, recipient_name, reference_code, details, cert_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
      $code,
      $certType,
      'modern_classic',
      $user['role'] === 'Intern' ? 'Intern' : 'Volunteer',
      $user['name'],
      $taskCode,
      $details,
      date('Y-m-d'),
      'Requested',
    ]);
    notify_admins($pdo, 'certificate', 'Certificate requested', "{$user['name']} requested a {$certType} for completed duty {$taskCode} ({$taskTitle})", '/admin/certificates');
    audit_log($pdo, 'request', 'certificate', $code, "{$user['name']} requested a {$certType} for duty {$taskCode}");
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
    $stmt->execute([(int) $pdo->lastInsertId()]);
    json_response([
      'ok' => true,
      'data' => map_certificate($stmt->fetch()),
      'message' => 'Certificate request sent successfully.',
    ], 201);
  }

  if (!in_array($user['role'], ['Admin', 'Staff'], true)) {
    json_response(['ok' => false, 'error' => 'Access denied'], 403);
  }

  $recipient = trim((string) ($body['recipient'] ?? ''));
  if ($recipient === '') {
    json_response(['ok' => false, 'error' => 'Recipient is required'], 400);
  }

  $certType = $body['type'] ?? 'Certificate of Donation';
  if ($certType === 'Official Receipt') {
    json_response(['ok' => false, 'error' => 'Official Receipt module is not available yet. Use Certificate of Donation.'], 400);
  }

  // Validate reference for donations or volunteer tasks
  if (!empty($body['reference'])) {
    $ref = trim((string) $body['reference']);
    $recType = $body['recipientType'] ?? 'Donor';
    if ($recType === 'Donor') {
      $d = $pdo->prepare('SELECT status FROM donations WHERE tracking_code = ? LIMIT 1');
      $d->execute([$ref]);
      $dRow = $d->fetch();
      if (!$dRow) {
        json_response(['ok' => false, 'error' => 'The referenced donation could not be found'], 400);
      }
      $allowed = ['Completed', 'Certificate / Official Receipt'];
      if (!in_array($dRow['status'], $allowed, true)) {
        json_response(['ok' => false, 'error' => 'Donation must be completed before generating a certificate'], 400);
      }
    } elseif (in_array($recType, ['Volunteer', 'Intern'], true)) {
      $tStmt = $pdo->prepare('SELECT board_column, status FROM tasks WHERE code = ? OR id = ? LIMIT 1');
      $tStmt->execute([$ref, is_numeric($ref) ? (int)$ref : 0]);
      $tRow = $tStmt->fetch();
      if ($tRow) {
        $isDone = ($tRow['board_column'] ?? '') === 'done' || in_array(strtolower((string)($tRow['status'] ?? '')), ['done', 'completed'], true);
        if (!$isDone) {
          json_response(['ok' => false, 'error' => 'Cannot create certificate: The referenced volunteer task is not completed yet.'], 400);
        }
      }
    }
  }

  // Resolve signatory from DB
  $signatoryId = !empty($body['signatoryId']) ? (int) $body['signatoryId'] : null;
  $signatoryName = trim((string) ($body['signatoryName'] ?? ''));
  $signatoryTitle = trim((string) ($body['signatoryTitle'] ?? ''));
  $signatureUrl = trim((string) ($body['signatureUrl'] ?? ''));

  if ($signatoryId) {
    $sigRow = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ? LIMIT 1');
    $sigRow->execute([$signatoryId]);
    $sig = $sigRow->fetch(PDO::FETCH_ASSOC);
    if ($sig) {
      if ($signatoryName === '') $signatoryName = $sig['name'];
      if ($signatoryTitle === '') $signatoryTitle = $sig['title'];
      if ($signatureUrl === '') $signatureUrl = $sig['signature_image'] ?? '';
    }
  } elseif ($signatoryName === '') {
    // Default signatory: Flemming Hansen
    $defRow = $pdo->query('SELECT * FROM certificate_signatories WHERE is_default = 1 AND is_active = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if ($defRow) {
      $signatoryId = (int) $defRow['id'];
      $signatoryName = $defRow['name'];
      $signatoryTitle = $defRow['title'];
      $signatureUrl = $defRow['signature_image'] ?? 'sig_flemming_hansen.png';
    } else {
      $signatoryName = 'Flemming Hansen';
      $signatoryTitle = 'CEO and Co-Founder';
      $signatureUrl = 'sig_flemming_hansen.png';
    }
  }

  [$photoUrl, $photoData] = process_certificate_photo($body['photoUrl'] ?? null);
  $validLayouts = ['none', 'featured', 'side', 'panel', 'backdrop', 'card'];
  $photoLayout = in_array(($body['photoLayout'] ?? 'none'), $validLayouts, true) 
    ? ($body['photoLayout'] ?? 'none') 
    : 'none';

  $templateId = trim((string) ($body['templateId'] ?? 'modern_classic'));
  $location = trim((string) ($body['location'] ?? 'Cebu City, Philippines'));
  $contributionDetails = trim((string) ($body['contributionDetails'] ?? ''));

  $code = generate_code('CERT');
  $stmt = $pdo->prepare('
    INSERT INTO certificates (
      code, cert_type, template_id, recipient_type, recipient_name, reference_code, 
      details, signatory_id, signatory_name, signatory_title, signature_url, 
      photo_url, photo_data, photo_layout, contribution_details, cert_date, location, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $code,
    $certType,
    $templateId ?: 'modern_classic',
    $body['recipientType'] ?? 'Donor',
    $recipient,
    $body['reference'] ?? null,
    trim((string) ($body['details'] ?? '')) ?: null,
    $signatoryId,
    $signatoryName ?: null,
    $signatoryTitle ?: null,
    $signatureUrl ?: null,
    $photoUrl,
    $photoData,
    $photoLayout,
    $contributionDetails ?: null,
    $body['certDate'] ?? date('Y-m-d'),
    $location ?: 'Cebu City, Philippines',
    $body['status'] ?? 'Generated',
  ]);
  $newId = (int) $pdo->lastInsertId();

  // Notify the recipient if they have a portal account.
  $findUser = $pdo->prepare('SELECT id, email FROM users WHERE full_name = ? LIMIT 1');
  $findUser->execute([$recipient]);
  $recipientRow = $findUser->fetch();
  if ($recipientRow) {
    $recipientType = (string) ($body['recipientType'] ?? 'Donor');
    $link = $recipientType === 'Intern'
      ? '/intern-portal/certificates'
      : ($recipientType === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates');
    create_notification($pdo, 'certificate', 'Certificate ready', "Your {$body['type']} ({$code}) is ready to view and download.", $link, (int) $recipientRow['id']);
    if (!empty($recipientRow['email']) && ($body['status'] ?? 'Generated') === 'Generated') {
      $safeRecipient = htmlspecialchars($recipient, ENT_QUOTES, 'UTF-8');
      $safeType = htmlspecialchars((string) ($body['type'] ?? 'certificate'), ENT_QUOTES, 'UTF-8');
      $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
      send_mail(
        $recipientRow['email'],
        $recipient,
        "Your certificate {$code} is ready",
        "<p>Hello {$safeRecipient},</p>"
          . "<p>Your <strong>{$safeType}</strong> (Certificate No. <strong>{$safeCode}</strong>) has been issued.</p>"
          . '<p>Log in to your portal to view, download, or print it.</p>'
          . email_link_html($link, 'View certificate')
      );
    }
  }

  audit_log($pdo, 'create', 'certificate', $code, "Issued {$body['type']} for {$recipient}");

  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())], 201);
}

require_auth(['Admin', 'Staff']);

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Certificate id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Certificate not found'], 404);
  }
  $newStatus = $body['status'] ?? $existing['status'];
  assert_valid_status_transition(
    'Certificate',
    (string) ($existing['status'] ?? 'Requested'),
    (string) $newStatus,
    WORKFLOW_CERTIFICATE_STEPS,
    WORKFLOW_CERTIFICATE_TERMINAL,
    WORKFLOW_CERTIFICATE_BRANCHES
  );

  $signatoryId = array_key_exists('signatoryId', $body) 
    ? (!empty($body['signatoryId']) ? (int) $body['signatoryId'] : null) 
    : ($existing['signatory_id'] ?? null);

  $signatoryName = array_key_exists('signatoryName', $body) 
    ? trim((string) $body['signatoryName']) 
    : ($existing['signatory_name'] ?? '');

  $signatoryTitle = array_key_exists('signatoryTitle', $body) 
    ? trim((string) $body['signatoryTitle']) 
    : ($existing['signatory_title'] ?? '');

  $signatureUrl = array_key_exists('signatureUrl', $body) 
    ? trim((string) $body['signatureUrl']) 
    : ($existing['signature_url'] ?? '');

  if ($signatoryId && ($signatoryName === '' || $signatureUrl === '')) {
    $sigRow = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ? LIMIT 1');
    $sigRow->execute([$signatoryId]);
    $sig = $sigRow->fetch(PDO::FETCH_ASSOC);
    if ($sig) {
      if ($signatoryName === '') $signatoryName = $sig['name'];
      if ($signatoryTitle === '') $signatoryTitle = $sig['title'];
      if ($signatureUrl === '') $signatureUrl = $sig['signature_image'] ?? '';
    }
  }

  [$photoUrl, $photoData] = array_key_exists('photoUrl', $body)
    ? process_certificate_photo($body['photoUrl'], $existing['photo_url'] ?? null, $existing['photo_data'] ?? null)
    : [$existing['photo_url'] ?? null, $existing['photo_data'] ?? null];

  $validLayouts = ['none', 'featured', 'side', 'panel', 'backdrop', 'card'];
  $photoLayout = array_key_exists('photoLayout', $body)
    ? (in_array($body['photoLayout'], $validLayouts, true) ? $body['photoLayout'] : 'none')
    : ($existing['photo_layout'] ?? 'none');

  $templateId = array_key_exists('templateId', $body)
    ? trim((string)$body['templateId'])
    : ($existing['template_id'] ?? 'modern_classic');

  $location = array_key_exists('location', $body)
    ? trim((string)$body['location'])
    : ($existing['location'] ?? 'Cebu City, Philippines');

  $contributionDetails = array_key_exists('contributionDetails', $body)
    ? trim((string)$body['contributionDetails'])
    : ($existing['contribution_details'] ?? null);

  $update = $pdo->prepare('
    UPDATE certificates 
    SET cert_type = ?, template_id = ?, recipient_type = ?, recipient_name = ?, reference_code = ?, 
        details = ?, signatory_id = ?, signatory_name = ?, signatory_title = ?, signature_url = ?, 
        photo_url = ?, photo_data = ?, photo_layout = ?, contribution_details = ?, cert_date = ?, location = ?, status = ? 
    WHERE id = ?
  ');
  $update->execute([
    $body['type'] ?? $existing['cert_type'],
    $templateId ?: 'modern_classic',
    $body['recipientType'] ?? ($existing['recipient_type'] ?? 'Donor'),
    $body['recipient'] ?? $existing['recipient_name'],
    $body['reference'] ?? $existing['reference_code'],
    array_key_exists('details', $body) ? (trim((string) $body['details']) ?: null) : ($existing['details'] ?? null),
    $signatoryId,
    $signatoryName ?: null,
    $signatoryTitle ?: null,
    $signatureUrl ?: null,
    $photoUrl,
    $photoData,
    $photoLayout,
    $contributionDetails ?: null,
    $body['certDate'] ?? $existing['cert_date'],
    $location ?: 'Cebu City, Philippines',
    $newStatus,
    $id,
  ]);

  if ($newStatus === 'Approved' && $existing['status'] !== 'Approved') {
    $findUser = $pdo->prepare('SELECT id FROM users WHERE full_name = ? LIMIT 1');
    $findUser->execute([$existing['recipient_name']]);
    $recipientUserId = $findUser->fetchColumn();
    if ($recipientUserId) {
      $existingRecipientType = (string) ($existing['recipient_type'] ?? 'Donor');
      $link = $existingRecipientType === 'Intern'
        ? '/intern-portal/certificates'
        : ($existingRecipientType === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates');
      create_notification($pdo, 'certificate', 'Certificate Request Approved', "Your request for {$existing['cert_type']} ({$existing['code']}) has been approved.", $link, (int) $recipientUserId);
    }
  }

  if ($newStatus === 'Generated' && $existing['status'] !== 'Generated') {
    $findUser = $pdo->prepare('SELECT id, email FROM users WHERE full_name = ? LIMIT 1');
    $findUser->execute([$existing['recipient_name']]);
    $recipientRow = $findUser->fetch();
    if ($recipientRow) {
      $existingRecipientType = (string) ($existing['recipient_type'] ?? 'Donor');
      $link = $existingRecipientType === 'Intern'
        ? '/intern-portal/certificates'
        : ($existingRecipientType === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates');
      create_notification($pdo, 'certificate', 'Certificate ready', "Your {$existing['cert_type']} ({$existing['code']}) is ready to view and download.", $link, (int) $recipientRow['id']);
      if (!empty($recipientRow['email'])) {
        $safeRecipient = htmlspecialchars((string) $existing['recipient_name'], ENT_QUOTES, 'UTF-8');
        $safeType = htmlspecialchars((string) $existing['cert_type'], ENT_QUOTES, 'UTF-8');
        $safeCode = htmlspecialchars((string) $existing['code'], ENT_QUOTES, 'UTF-8');
        send_mail(
          $recipientRow['email'],
          $existing['recipient_name'],
          "Your certificate {$existing['code']} is ready",
          "<p>Hello {$safeRecipient},</p>"
            . "<p>Your <strong>{$safeType}</strong> (Certificate No. <strong>{$safeCode}</strong>) has been issued.</p>"
            . '<p>Log in to your portal to view, download, or print it.</p>'
            . email_link_html($link, 'View certificate')
        );
      }
    }
  }

  audit_log($pdo, 'update', 'certificate', $existing['code'], "Updated certificate" . ($newStatus !== $existing['status'] ? " (status: {$newStatus})" : ''));

  $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Certificate id is required'], 400);
  }
  $del = $pdo->prepare('SELECT code FROM certificates WHERE id = ?');
  $del->execute([$id]);
  $delCode = $del->fetchColumn();
  $pdo->prepare('DELETE FROM certificates WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'certificate', $delCode ?: (string) $id, 'Deleted certificate');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
