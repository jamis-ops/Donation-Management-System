<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function ensure_certificates_schema(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;
  $ensured = true;

  try {
    $cols = $pdo->query("SHOW COLUMNS FROM certificates")->fetchAll(PDO::FETCH_COLUMN);
    $colList = array_map('strtolower', $cols);

    if (!in_array('template_id', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN template_id VARCHAR(50) NOT NULL DEFAULT 'modern_classic' AFTER cert_type");
    }
    if (!in_array('signatory_id', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN signatory_id BIGINT UNSIGNED NULL AFTER signatory_title");
    }
    if (!in_array('signature_url', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN signature_url VARCHAR(255) NULL AFTER signatory_id");
    }
    if (!in_array('photo_url', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN photo_url VARCHAR(255) NULL AFTER signature_url");
    }
    if (!in_array('photo_data', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN photo_data LONGTEXT NULL AFTER photo_url");
    }
    if (!in_array('photo_layout', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN photo_layout VARCHAR(50) NOT NULL DEFAULT 'none' AFTER photo_data");
    }
    if (!in_array('contribution_details', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN contribution_details TEXT NULL AFTER photo_layout");
    }
    if (!in_array('location', $colList, true)) {
      $pdo->exec("ALTER TABLE certificates ADD COLUMN location VARCHAR(150) NOT NULL DEFAULT 'Cebu City, Philippines' AFTER cert_date");
    }

    // Repair any corrupted photo_url filenames
    $pdo->exec("UPDATE certificates SET photo_url = SUBSTRING_INDEX(photo_url, 'name=', -1) WHERE photo_url LIKE '%name=%'");
  } catch (Throwable) {}
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

function map_certificate(array $row): array
{
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
    'status' => $row['status'],
  ];
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

$user = require_auth(['Admin', 'Staff', 'Donor', 'Volunteer']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Certificate not found'], 404);
    }
    $role = (string) ($user['role'] ?? '');
    if (in_array($role, ['Donor', 'Volunteer'], true)) {
      $allowed = false;
      if ($role === 'Donor') {
        $own = $pdo->prepare('SELECT COUNT(*) FROM donations WHERE tracking_code = ? AND donor_email = ?');
        $own->execute([(string) ($row['reference_code'] ?? ''), (string) $user['email']]);
        $allowed = ((int) $own->fetchColumn() > 0)
          || strcasecmp((string) ($row['recipient_name'] ?? ''), (string) ($user['name'] ?? '')) === 0;
      } else {
        $allowed = strcasecmp((string) ($row['recipient_name'] ?? ''), (string) ($user['name'] ?? '')) === 0
          && in_array((string) ($row['recipient_type'] ?? 'Volunteer'), ['Volunteer', ''], true);
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
  } elseif ($user['role'] === 'Volunteer') {
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE (recipient_name = ? OR reference_code IN (SELECT code FROM volunteers WHERE user_id = ? OR email = ?)) AND (recipient_type = \'Volunteer\' OR recipient_type IS NULL OR recipient_type = \'\') ORDER BY id DESC');
    $stmt->execute([$user['name'], $user['id'], $user['email']]);
  } else {
    $stmt = $pdo->query('SELECT * FROM certificates ORDER BY created_at DESC, id DESC');
  }

  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map('map_certificate', $rows)]);
}

$body = read_json_body();

if ($method === 'POST') {
  // Donors may request a certificate for one of their own donations.
  if ($user['role'] === 'Donor') {
    $reference = trim((string) ($body['reference'] ?? ''));
    if ($reference !== '') {
      $own = $pdo->prepare('SELECT status FROM donations WHERE tracking_code = ? AND donor_email = ? LIMIT 1');
      $own->execute([$reference, $user['email']]);
      $donation = $own->fetch();
      if (!$donation) {
        json_response(['ok' => false, 'error' => 'That donation reference does not belong to your account'], 403);
      }
      $allowed = ['Verified', 'Allocated', 'Distributed', 'Completed', 'In Inventory', 'Certificate / Official Receipt'];
      if (!in_array($donation['status'], $allowed, true)) {
        json_response(['ok' => false, 'error' => 'Certificates are only available after the donation has been verified by Admin'], 400);
      }
    } else {
      json_response(['ok' => false, 'error' => 'A verified donation reference is required'], 400);
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
    notify_admins($pdo, 'certificate', 'Certificate requested', "{$user['name']} requested a certificate" . ($reference ? " for {$reference}" : ''), '/admin/certificates');
    audit_log($pdo, 'request', 'certificate', $code, "{$user['name']} requested a certificate");
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
    $stmt->execute([(int) $pdo->lastInsertId()]);
    json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())], 201);
  }

  // Volunteers may request a certificate for their volunteer service.
  if ($user['role'] === 'Volunteer') {
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
      $vStmt = $pdo->prepare('SELECT code FROM volunteers WHERE user_id = ? OR email = ? LIMIT 1');
      $vStmt->execute([$user['id'], $user['email']]);
      $vCode = $vStmt->fetchColumn();
      if ($vCode) {
        $reference = (string) $vCode;
      }
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
      'Volunteer',
      $user['name'],
      $reference ?: null,
      trim((string) ($body['details'] ?? '')) ?: null,
      date('Y-m-d'),
      'Requested',
    ]);
    notify_admins($pdo, 'certificate', 'Certificate requested', "{$user['name']} requested a {$certType}" . ($reference ? " ({$reference})" : ''), '/admin/certificates');
    audit_log($pdo, 'request', 'certificate', $code, "{$user['name']} requested a {$certType}");
    $stmt = $pdo->prepare('SELECT * FROM certificates WHERE id = ?');
    $stmt->execute([(int) $pdo->lastInsertId()]);
    json_response(['ok' => true, 'data' => map_certificate($stmt->fetch())], 201);
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

  if (!empty($body['reference'])) {
    $ref = trim((string) $body['reference']);
    $d = $pdo->prepare('SELECT status FROM donations WHERE tracking_code = ? LIMIT 1');
    $d->execute([$ref]);
    $dRow = $d->fetch();
    if ($dRow) {
      $allowed = ['Verified', 'Allocated', 'Distributed', 'Completed', 'In Inventory', 'Certificate / Official Receipt'];
      if (!in_array($dRow['status'], $allowed, true)) {
        json_response(['ok' => false, 'error' => 'Donation must be verified before generating a certificate'], 400);
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
    $link = ($body['recipientType'] ?? 'Donor') === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates';
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
    WORKFLOW_CERTIFICATE_TERMINAL
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

  if ($newStatus === 'Generated' && $existing['status'] !== 'Generated') {
    $findUser = $pdo->prepare('SELECT id, email FROM users WHERE full_name = ? LIMIT 1');
    $findUser->execute([$existing['recipient_name']]);
    $recipientRow = $findUser->fetch();
    if ($recipientRow) {
      $link = ($existing['recipient_type'] ?? 'Donor') === 'Volunteer' ? '/volunteer-portal/certificates' : '/donor/certificates';
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
