<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function format_signatory(array $row): array
{
  $sigImage = $row['signature_image'] ?? '';
  $sigUrl = '';
  if (!empty($sigImage)) {
    if (str_starts_with($sigImage, 'data:') || str_starts_with($sigImage, 'http')) {
      $sigUrl = $sigImage;
    } else {
      $sigUrl = '/api/file.php?kind=certificates&name=' . rawurlencode(basename($sigImage));
    }
  }

  return [
    'id' => (int) $row['id'],
    'name' => (string) $row['name'],
    'title' => (string) $row['title'],
    'organization' => (string) ($row['organization'] ?? 'Rise Above Foundation Cebu, Inc.'),
    'signatureImage' => $sigImage,
    'signatureUrl' => $sigUrl,
    'isDefault' => (bool) $row['is_default'],
    'isActive' => (bool) ($row['is_active'] ?? 1),
    'createdAt' => $row['created_at'] ?? null,
  ];
}

if ($method === 'GET') {
  require_auth(['Admin', 'Staff', 'Donor', 'Volunteer']);
  $stmt = $pdo->query('SELECT * FROM certificate_signatories WHERE is_active = 1 ORDER BY is_default DESC, id ASC');
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // If table is somehow empty, seed default Flemming Hansen
  if (empty($rows)) {
    $pdo->exec("
      INSERT INTO certificate_signatories (name, title, organization, signature_image, is_default, is_active)
      VALUES ('Flemming Hansen', 'CEO and Co-Founder', 'Rise Above Foundation Cebu, Inc.', 'sig_flemming_hansen.png', 1, 1)
    ");
    $stmt = $pdo->query('SELECT * FROM certificate_signatories WHERE is_active = 1 ORDER BY is_default DESC, id ASC');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  }

  json_response(['ok' => true, 'data' => array_map('format_signatory', $rows)]);
}

$user = require_auth(['Admin', 'Staff']);

function handle_signature_upload(): ?string
{
  $dir = __DIR__ . '/uploads/certificates';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }

  // Check $_FILES
  if (isset($_FILES['signature']) && is_array($_FILES['signature']) && ($_FILES['signature']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
    $file = $_FILES['signature'];
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['png', 'jpg', 'jpeg', 'svg', 'webp'], true)) {
      json_response(['ok' => false, 'error' => 'Signature must be a PNG, JPG, WEBP, or SVG image'], 400);
    }
    $safeName = 'sig_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (move_uploaded_file($file['tmp_name'], $dir . '/' . $safeName)) {
      return $safeName;
    }
  }

  return null;
}

if ($method === 'POST') {
  $body = read_json_body();
  if (empty($body) && !empty($_POST)) {
    $body = $_POST;
  }

  $name = trim((string) ($body['name'] ?? ''));
  $title = trim((string) ($body['title'] ?? ''));
  $org = trim((string) ($body['organization'] ?? 'Rise Above Foundation Cebu, Inc.'));
  $isDefault = !empty($body['isDefault']) ? 1 : 0;

  if ($name === '' || $title === '') {
    json_response(['ok' => false, 'error' => 'Signatory name and position/title are required.'], 400);
  }

  $sigImage = handle_signature_upload();
  if (!$sigImage && !empty($body['signatureImage'])) {
    $raw = (string) $body['signatureImage'];
    if (str_starts_with($raw, 'data:image/')) {
      // Save data URL to a png file
      if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $raw, $matches)) {
        $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $binary = base64_decode($matches[2]);
        if ($binary !== false) {
          $dir = __DIR__ . '/uploads/certificates';
          if (!is_dir($dir)) @mkdir($dir, 0755, true);
          $safeName = 'sig_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
          file_put_contents($dir . '/' . $safeName, $binary);
          $sigImage = $safeName;
        }
      }
    } else {
      $sigImage = basename($raw);
    }
  }

  if ($isDefault) {
    $pdo->exec('UPDATE certificate_signatories SET is_default = 0');
  }

  $stmt = $pdo->prepare('
    INSERT INTO certificate_signatories (name, title, organization, signature_image, is_default, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  ');
  $stmt->execute([$name, $title, $org ?: 'Rise Above Foundation Cebu, Inc.', $sigImage, $isDefault]);
  $newId = (int) $pdo->lastInsertId();

  audit_log($pdo, 'create', 'signatory', (string)$newId, "Added certificate signatory: {$name} ({$title})");

  $stmt = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => format_signatory($stmt->fetch(PDO::FETCH_ASSOC))], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Signatory ID is required.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ?');
  $stmt->execute([$id]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Signatory not found.'], 404);
  }

  $body = read_json_body();
  if (empty($body) && !empty($_POST)) {
    $body = $_POST;
  }

  $name = isset($body['name']) ? trim((string) $body['name']) : $existing['name'];
  $title = isset($body['title']) ? trim((string) $body['title']) : $existing['title'];
  $org = isset($body['organization']) ? trim((string) $body['organization']) : $existing['organization'];
  $isDefault = isset($body['isDefault']) ? (!empty($body['isDefault']) ? 1 : 0) : (int) $existing['is_default'];
  $isActive = isset($body['isActive']) ? (!empty($body['isActive']) ? 1 : 0) : (int) $existing['is_active'];

  $sigImage = handle_signature_upload();
  if (!$sigImage && isset($body['signatureImage'])) {
    $raw = (string) $body['signatureImage'];
    if (str_starts_with($raw, 'data:image/')) {
      if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $raw, $matches)) {
        $ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $binary = base64_decode($matches[2]);
        if ($binary !== false) {
          $dir = __DIR__ . '/uploads/certificates';
          if (!is_dir($dir)) @mkdir($dir, 0755, true);
          $safeName = 'sig_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
          file_put_contents($dir . '/' . $safeName, $binary);
          $sigImage = $safeName;
        }
      }
    } elseif ($raw !== '') {
      $sigImage = basename($raw);
    }
  }

  if ($sigImage === null) {
    $sigImage = $existing['signature_image'];
  }

  if ($isDefault) {
    $pdo->prepare('UPDATE certificate_signatories SET is_default = 0 WHERE id != ?')->execute([$id]);
  }

  $stmt = $pdo->prepare('
    UPDATE certificate_signatories
    SET name = ?, title = ?, organization = ?, signature_image = ?, is_default = ?, is_active = ?
    WHERE id = ?
  ');
  $stmt->execute([$name, $title, $org, $sigImage, $isDefault, $isActive, $id]);

  audit_log($pdo, 'update', 'signatory', (string)$id, "Updated certificate signatory: {$name}");

  $stmt = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => format_signatory($stmt->fetch(PDO::FETCH_ASSOC))]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Signatory ID is required.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM certificate_signatories WHERE id = ?');
  $stmt->execute([$id]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Signatory not found.'], 404);
  }

  if (!empty($existing['is_default'])) {
    json_response(['ok' => false, 'error' => 'Cannot delete the default active signatory. Please set another signatory as default first.'], 400);
  }

  $pdo->prepare('UPDATE certificate_signatories SET is_active = 0 WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'signatory', (string)$id, "Deactivated signatory: {$existing['name']}");

  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
