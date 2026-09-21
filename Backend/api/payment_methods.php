<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

if (!function_exists('get_json_input')) {
  function get_json_input(): array
  {
    return read_json_body();
  }
}

function ensure_payment_methods_table(PDO $pdo): void
{
  static $ready = false;
  if ($ready) {
    return;
  }

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS payment_methods (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'custom',
      description VARCHAR(255) NULL,
      account_name VARCHAR(180) NULL,
      account_number VARCHAR(120) NULL,
      bank_name VARCHAR(180) NULL,
      instructions TEXT NULL,
      qr_image VARCHAR(255) NULL,
      notes TEXT NULL,
      extra_details_json JSON NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_payment_methods_active (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  $count = (int) $pdo->query('SELECT COUNT(*) FROM payment_methods')->fetchColumn();
  if ($count === 0) {
    // Seed default uploads directory
    $uploadDir = __DIR__ . '/uploads/payment_methods';
    if (!is_dir($uploadDir)) {
      @mkdir($uploadDir, 0755, true);
    }

    // Attempt to copy default GCash QR image if frontend asset exists
    $defaultGcashQr = 'gcash_default_qr.png';
    $frontendGcashPath = dirname(__DIR__, 2) . '/Frontend/src/assets/images/gcash-qr.png';
    if (file_exists($frontendGcashPath)) {
      @copy($frontendGcashPath, $uploadDir . '/' . $defaultGcashQr);
    }

    $defaults = [
      [
        'code' => 'gcash',
        'name' => 'GCash',
        'type' => 'gcash',
        'description' => 'GCash Philippines (Scan to Pay / Mobile)',
        'account_name' => 'Rise Above Foundation Cebu Inc',
        'account_number' => '0917-000-0000',
        'bank_name' => 'GCash',
        'instructions' => "1. Open your GCash App\n2. Choose Pay QR (or Scan QR)\n3. Scan the code below or enter the account number\n4. Enter the donation amount\n5. Select Pay and save your screenshot confirmation receipt",
        'qr_image' => file_exists($uploadDir . '/' . $defaultGcashQr) ? $defaultGcashQr : null,
        'notes' => 'After sending via GCash, please upload your transaction screenshot below as proof of donation.',
        'extra_details_json' => null,
        'sort_order' => 1,
      ],
      [
        'code' => 'bank_transfer_bpi',
        'name' => 'Bank Transfer (BPI)',
        'type' => 'bank_transfer',
        'description' => 'Bank of The Philippine Islands (BPI)',
        'account_name' => 'Rise Above Foundation Cebu, Inc.',
        'account_number' => '9131005064',
        'bank_name' => 'Bank of The Philippine Islands',
        'instructions' => "1. Open your online banking app, electronic wallet, or visit any BPI branch.\n2. Transfer or deposit your donation using the account details below.\n3. Take a screenshot or photo of your transfer confirmation or deposit slip.\n4. Enter your donation amount below and upload the proof file.",
        'qr_image' => null,
        'notes' => 'We accept transfers from BPI Online, InstaPay, PESONet, or local & international bank wire.',
        'extra_details_json' => json_encode([
          'SWIFT Code' => 'BOPIPHMM',
          'Branch' => 'BPI Cebu North Reclamation Area',
          'Bank Address' => 'BPI Building, Juan Luna Ave. cor. J. De Veyra St., NRA, Cebu City 6000',
        ]),
        'sort_order' => 2,
      ],
      [
        'code' => 'maya',
        'name' => 'Maya',
        'type' => 'maya',
        'description' => 'Maya Philippines (Scan to Pay / Wallet)',
        'account_name' => 'Rise Above Foundation Cebu Inc',
        'account_number' => '0917-000-0000',
        'bank_name' => 'Maya',
        'instructions' => "1. Open your Maya app\n2. Tap Scan to Pay or Send Money\n3. Input the account number or scan the QR code\n4. Confirm transaction and save the receipt",
        'qr_image' => null,
        'notes' => 'Maya payments can be transferred via InstaPay or Maya app directly.',
        'extra_details_json' => null,
        'sort_order' => 3,
      ],
      [
        'code' => 'paypal',
        'name' => 'PayPal',
        'type' => 'paypal',
        'description' => 'PayPal International Donation',
        'account_name' => 'Rise Above Foundation Cebu, Inc.',
        'account_number' => 'info@riseabove-cebu.org',
        'bank_name' => 'PayPal',
        'instructions' => "1. Log in to your PayPal account.\n2. Send your donation to our official recipient email address.\n3. Save or screenshot your PayPal confirmation receipt.\n4. Enter the amount in PHP and attach your proof below.",
        'qr_image' => null,
        'notes' => 'PayPal donations from all countries and currencies are converted and supported.',
        'extra_details_json' => null,
        'sort_order' => 4,
      ],
      [
        'code' => 'check_donation',
        'name' => 'Check Donation',
        'type' => 'check',
        'description' => 'Bank Check Donation',
        'account_name' => 'Rise Above Foundation Cebu, Inc.',
        'account_number' => '9131005064',
        'bank_name' => 'Bank of The Philippine Islands',
        'instructions' => "1. Make checks payable to: Rise Above Foundation Cebu, Inc.\n2. Deposit the check at any BPI branch to account 9131005064 or mail to our Cebu office.\n3. Take a clear photo or scan of the deposited check / receipt.\n4. Upload the photo as proof below for verification and official receipting.",
        'qr_image' => null,
        'notes' => 'Mailing Address: BPI Building, Juan Luna Ave. cor. J. De Veyra St., NRA, Cebu City 6000',
        'extra_details_json' => null,
        'sort_order' => 5,
      ],
    ];

    $ins = $pdo->prepare('
      INSERT INTO payment_methods 
        (code, name, type, description, account_name, account_number, bank_name, instructions, qr_image, notes, extra_details_json, is_active, sort_order)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ');

    foreach ($defaults as $d) {
      $ins->execute([
        $d['code'],
        $d['name'],
        $d['type'],
        $d['description'],
        $d['account_name'],
        $d['account_number'],
        $d['bank_name'],
        $d['instructions'],
        $d['qr_image'],
        $d['notes'],
        $d['extra_details_json'],
        $d['sort_order'],
      ]);
    }
  }

  $ready = true;
}

ensure_payment_methods_table($pdo);

function map_payment_method(array $row): array
{
  $extra = [];
  if (!empty($row['extra_details_json'])) {
    $decoded = json_decode((string) $row['extra_details_json'], true);
    if (is_array($decoded)) {
      $extra = $decoded;
    }
  }

  $qrImage = $row['qr_image'] ?? null;
  $qrUrl = null;
  if ($qrImage) {
    if (preg_match('/^https?:\/\//i', $qrImage)) {
      $qrUrl = $qrImage;
    } else {
      $qrUrl = '/api/file.php?kind=payment_methods&name=' . rawurlencode(basename($qrImage));
    }
  }

  return [
    'id' => (int) $row['id'],
    'code' => (string) $row['code'],
    'name' => (string) $row['name'],
    'type' => (string) ($row['type'] ?? 'custom'),
    'description' => (string) ($row['description'] ?? ''),
    'accountName' => (string) ($row['account_name'] ?? ''),
    'accountNumber' => (string) ($row['account_number'] ?? ''),
    'bankName' => (string) ($row['bank_name'] ?? ''),
    'instructions' => (string) ($row['instructions'] ?? ''),
    'qrImage' => $qrImage,
    'qrUrl' => $qrUrl,
    'notes' => (string) ($row['notes'] ?? ''),
    'extraDetails' => $extra,
    'isActive' => (bool) ($row['is_active'] ?? 1),
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'donationsCount' => isset($row['donations_count']) ? (int) $row['donations_count'] : 0,
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

function handle_qr_upload(): ?string
{
  if (!isset($_FILES['qr_image']) && !isset($_FILES['qrImage']) && !isset($_FILES['file'])) {
    return null;
  }
  $file = $_FILES['qr_image'] ?? ($_FILES['qrImage'] ?? $_FILES['file']);
  if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    return null;
  }
  if ($file['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Image upload failed. Please retry.'], 400);
  }

  $mime = mime_content_type($file['tmp_name']) ?: '';
  $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!in_array($mime, $allowedMimes, true)) {
    json_response(['ok' => false, 'error' => 'Only JPG, PNG, WEBP, and GIF images are allowed for QR codes.'], 400);
  }

  $ext = pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION) ?: 'png';
  $cleanExt = strtolower(preg_replace('/[^a-z0-9]/i', '', $ext));
  if (!in_array($cleanExt, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
    $cleanExt = 'png';
  }

  $dir = __DIR__ . '/uploads/payment_methods';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }

  $fileName = 'pm_' . bin2hex(random_bytes(10)) . '.' . $cleanExt;
  $targetPath = $dir . '/' . $fileName;

  if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    json_response(['ok' => false, 'error' => 'Failed to save uploaded QR image.'], 500);
  }

  return $fileName;
}

// ----------------------------------------------------
// GET: Retrieve payment methods
// ----------------------------------------------------
if ($method === 'GET') {
  $wantAll = isset($_GET['all']) && $_GET['all'] === '1';

  if ($id !== null) {
    $stmt = $pdo->prepare('
      SELECT pm.*, 
        (SELECT COUNT(*) FROM donations d WHERE LOWER(d.payment_method) = LOWER(pm.name) OR LOWER(d.payment_method) = LOWER(pm.code)) AS donations_count
      FROM payment_methods pm
      WHERE pm.id = ?
      LIMIT 1
    ');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Payment method not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_payment_method($row)]);
  }

  if ($wantAll) {
    $user = require_auth(['Admin', 'SuperAdmin']);
    $stmt = $pdo->query('
      SELECT pm.*, 
        (SELECT COUNT(*) FROM donations d WHERE LOWER(d.payment_method) = LOWER(pm.name) OR LOWER(d.payment_method) = LOWER(pm.code)) AS donations_count
      FROM payment_methods pm
      ORDER BY pm.sort_order ASC, pm.id ASC
    ');
    $rows = $stmt->fetchAll();
    json_response(['ok' => true, 'data' => array_map('map_payment_method', $rows)]);
  }

  // Public active list
  $stmt = $pdo->query('
    SELECT * FROM payment_methods 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, id ASC
  ');
  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map('map_payment_method', $rows)]);
}

// ----------------------------------------------------
// POST: Create or Update (multipart support)
// ----------------------------------------------------
if ($method === 'POST') {
  require_auth(['Admin', 'SuperAdmin']);

  $body = read_json_body();
  $isMultipart = !empty($_POST) || !empty($_FILES);
  if ($isMultipart) {
    $body = array_merge($body, $_POST);
  }

  // Check if updating existing record via POST (common for multipart)
  $updateId = $id ?? (isset($body['id']) && is_numeric($body['id']) ? (int) $body['id'] : null);
  if (isset($_GET['action']) && $_GET['action'] === 'toggle_active' && $updateId) {
    $current = $pdo->prepare('SELECT is_active FROM payment_methods WHERE id = ?');
    $current->execute([$updateId]);
    $val = $current->fetchColumn();
    if ($val === false) {
      json_response(['ok' => false, 'error' => 'Payment method not found'], 404);
    }
    $newVal = $val ? 0 : 1;
    $pdo->prepare('UPDATE payment_methods SET is_active = ? WHERE id = ?')->execute([$newVal, $updateId]);
    json_response(['ok' => true, 'isActive' => (bool) $newVal]);
  }

  $uploadedQr = handle_qr_upload();

  if ($updateId) {
    // Perform Update
    $stmt = $pdo->prepare('SELECT * FROM payment_methods WHERE id = ?');
    $stmt->execute([$updateId]);
    $existing = $stmt->fetch();
    if (!$existing) {
      json_response(['ok' => false, 'error' => 'Payment method not found'], 404);
    }

    $name = trim((string) ($body['name'] ?? $existing['name']));
    if ($name === '') {
      json_response(['ok' => false, 'error' => 'Payment method name is required.'], 400);
    }

    $code = trim((string) ($body['code'] ?? $existing['code']));
    if ($code === '') {
      $code = strtolower(preg_replace('/[^a-z0-9_]/i', '_', $name));
    }

    $type = trim((string) ($body['type'] ?? $existing['type'])) ?: 'custom';
    $description = trim((string) ($body['description'] ?? $existing['description']));
    $accountName = trim((string) ($body['accountName'] ?? $body['account_name'] ?? $existing['account_name']));
    $accountNumber = trim((string) ($body['accountNumber'] ?? $body['account_number'] ?? $existing['account_number']));
    $bankName = trim((string) ($body['bankName'] ?? $body['bank_name'] ?? $existing['bank_name']));
    $instructions = trim((string) ($body['instructions'] ?? $existing['instructions']));
    $notes = trim((string) ($body['notes'] ?? $existing['notes']));
    $sortOrder = isset($body['sortOrder']) ? (int) $body['sortOrder'] : (isset($body['sort_order']) ? (int) $body['sort_order'] : (int) $existing['sort_order']);
    
    $isActive = $existing['is_active'];
    if (isset($body['isActive'])) {
      $isActive = filter_var($body['isActive'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    } elseif (isset($body['is_active'])) {
      $isActive = filter_var($body['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }

    $extraJson = $existing['extra_details_json'];
    if (isset($body['extraDetails'])) {
      $extraJson = is_array($body['extraDetails']) ? json_encode($body['extraDetails']) : (string) $body['extraDetails'];
    } elseif (isset($body['extra_details_json'])) {
      $extraJson = (string) $body['extra_details_json'];
    }

    $qrImage = $uploadedQr ?: $existing['qr_image'];
    if (isset($body['removeQr']) && filter_var($body['removeQr'], FILTER_VALIDATE_BOOLEAN)) {
      $qrImage = null;
    }

    $upd = $pdo->prepare('
      UPDATE payment_methods SET
        code = ?,
        name = ?,
        type = ?,
        description = ?,
        account_name = ?,
        account_number = ?,
        bank_name = ?,
        instructions = ?,
        qr_image = ?,
        notes = ?,
        extra_details_json = ?,
        is_active = ?,
        sort_order = ?
      WHERE id = ?
    ');
    $upd->execute([
      $code,
      $name,
      $type,
      $description,
      $accountName,
      $accountNumber,
      $bankName,
      $instructions,
      $qrImage,
      $notes,
      $extraJson,
      $isActive,
      $sortOrder,
      $updateId,
    ]);

    $stmt = $pdo->prepare('
      SELECT pm.*, 
        (SELECT COUNT(*) FROM donations d WHERE LOWER(d.payment_method) = LOWER(pm.name) OR LOWER(d.payment_method) = LOWER(pm.code)) AS donations_count
      FROM payment_methods pm WHERE pm.id = ?
    ');
    $stmt->execute([$updateId]);
    json_response(['ok' => true, 'data' => map_payment_method($stmt->fetch())]);
  }

  // Perform Insert
  $name = trim((string) ($body['name'] ?? ''));
  if ($name === '') {
    json_response(['ok' => false, 'error' => 'Payment method name is required.'], 400);
  }

  $code = trim((string) ($body['code'] ?? ''));
  if ($code === '') {
    $code = strtolower(preg_replace('/[^a-z0-9_]/i', '_', $name));
  }

  // Ensure code uniqueness
  $check = $pdo->prepare('SELECT id FROM payment_methods WHERE code = ? LIMIT 1');
  $check->execute([$code]);
  if ($check->fetchColumn()) {
    $code = $code . '_' . bin2hex(random_bytes(3));
  }

  $type = trim((string) ($body['type'] ?? 'custom')) ?: 'custom';
  $description = trim((string) ($body['description'] ?? ''));
  $accountName = trim((string) ($body['accountName'] ?? $body['account_name'] ?? ''));
  $accountNumber = trim((string) ($body['accountNumber'] ?? $body['account_number'] ?? ''));
  $bankName = trim((string) ($body['bankName'] ?? $body['bank_name'] ?? ''));
  $instructions = trim((string) ($body['instructions'] ?? ''));
  $notes = trim((string) ($body['notes'] ?? ''));
  $sortOrder = isset($body['sortOrder']) ? (int) $body['sortOrder'] : (isset($body['sort_order']) ? (int) $body['sort_order'] : 0);
  $isActive = isset($body['isActive']) ? (filter_var($body['isActive'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0) : 1;

  $extraJson = null;
  if (isset($body['extraDetails'])) {
    $extraJson = is_array($body['extraDetails']) ? json_encode($body['extraDetails']) : (string) $body['extraDetails'];
  } elseif (isset($body['extra_details_json'])) {
    $extraJson = (string) $body['extra_details_json'];
  }

  $ins = $pdo->prepare('
    INSERT INTO payment_methods 
      (code, name, type, description, account_name, account_number, bank_name, instructions, qr_image, notes, extra_details_json, is_active, sort_order)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $ins->execute([
    $code,
    $name,
    $type,
    $description,
    $accountName,
    $accountNumber,
    $bankName,
    $instructions,
    $uploadedQr,
    $notes,
    $extraJson,
    $isActive,
    $sortOrder,
  ]);

  $newId = (int) $pdo->lastInsertId();
  $stmt = $pdo->prepare('SELECT *, 0 AS donations_count FROM payment_methods WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_payment_method($stmt->fetch())], 201);
}

// ----------------------------------------------------
// PUT: Direct JSON Update
// ----------------------------------------------------
if ($method === 'PUT') {
  require_auth(['Admin', 'SuperAdmin']);

  if (!$id) {
    json_response(['ok' => false, 'error' => 'Payment method ID required'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM payment_methods WHERE id = ?');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Payment method not found'], 404);
  }

  $body = read_json_body();

  // Quick toggle active
  if (isset($body['action']) && $body['action'] === 'toggle_active') {
    $newVal = $existing['is_active'] ? 0 : 1;
    $pdo->prepare('UPDATE payment_methods SET is_active = ? WHERE id = ?')->execute([$newVal, $id]);
    json_response(['ok' => true, 'isActive' => (bool) $newVal]);
  }

  $name = trim((string) ($body['name'] ?? $existing['name']));
  $code = trim((string) ($body['code'] ?? $existing['code']));
  $type = trim((string) ($body['type'] ?? $existing['type']));
  $description = trim((string) ($body['description'] ?? $existing['description']));
  $accountName = trim((string) ($body['accountName'] ?? $body['account_name'] ?? $existing['account_name']));
  $accountNumber = trim((string) ($body['accountNumber'] ?? $body['account_number'] ?? $existing['account_number']));
  $bankName = trim((string) ($body['bankName'] ?? $body['bank_name'] ?? $existing['bank_name']));
  $instructions = trim((string) ($body['instructions'] ?? $existing['instructions']));
  $notes = trim((string) ($body['notes'] ?? $existing['notes']));
  $sortOrder = isset($body['sortOrder']) ? (int) $body['sortOrder'] : (isset($body['sort_order']) ? (int) $body['sort_order'] : (int) $existing['sort_order']);

  $isActive = $existing['is_active'];
  if (isset($body['isActive'])) {
    $isActive = filter_var($body['isActive'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
  } elseif (isset($body['is_active'])) {
    $isActive = filter_var($body['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
  }

  $extraJson = $existing['extra_details_json'];
  if (isset($body['extraDetails'])) {
    $extraJson = is_array($body['extraDetails']) ? json_encode($body['extraDetails']) : (string) $body['extraDetails'];
  }

  $upd = $pdo->prepare('
    UPDATE payment_methods SET
      code = ?,
      name = ?,
      type = ?,
      description = ?,
      account_name = ?,
      account_number = ?,
      bank_name = ?,
      instructions = ?,
      notes = ?,
      extra_details_json = ?,
      is_active = ?,
      sort_order = ?
    WHERE id = ?
  ');
  $upd->execute([
    $code,
    $name,
    $type,
    $description,
    $accountName,
    $accountNumber,
    $bankName,
    $instructions,
    $notes,
    $extraJson,
    $isActive,
    $sortOrder,
    $id,
  ]);

  $stmt = $pdo->prepare('
    SELECT pm.*, 
      (SELECT COUNT(*) FROM donations d WHERE LOWER(d.payment_method) = LOWER(pm.name) OR LOWER(d.payment_method) = LOWER(pm.code)) AS donations_count
    FROM payment_methods pm WHERE pm.id = ?
  ');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_payment_method($stmt->fetch())]);
}

// ----------------------------------------------------
// DELETE: Safe deletion check
// ----------------------------------------------------
if ($method === 'DELETE') {
  require_auth(['Admin', 'SuperAdmin']);

  if (!$id) {
    json_response(['ok' => false, 'error' => 'Payment method ID required'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM payment_methods WHERE id = ?');
  $stmt->execute([$id]);
  $methodRow = $stmt->fetch();
  if (!$methodRow) {
    json_response(['ok' => false, 'error' => 'Payment method not found'], 404);
  }

  // Safety check: Check if referenced by existing donations
  $check = $pdo->prepare('
    SELECT COUNT(*) FROM donations 
    WHERE LOWER(payment_method) = LOWER(?) OR LOWER(payment_method) = LOWER(?)
  ');
  $check->execute([$methodRow['name'], $methodRow['code']]);
  $donationsCount = (int) $check->fetchColumn();

  if ($donationsCount > 0) {
    json_response([
      'ok' => false,
      'error' => "Cannot delete '{$methodRow['name']}' because it is referenced in {$donationsCount} existing donation record(s). Please deactivate it instead to hide it from new donations while preserving historical records.",
      'donationsCount' => $donationsCount,
    ], 409);
  }

  // Safe to delete
  $pdo->prepare('DELETE FROM payment_methods WHERE id = ?')->execute([$id]);

  // Clean up uploaded QR image if any
  if (!empty($methodRow['qr_image'])) {
    $qrPath = __DIR__ . '/uploads/payment_methods/' . basename($methodRow['qr_image']);
    if (is_file($qrPath) && !str_contains($methodRow['qr_image'], 'default')) {
      @unlink($qrPath);
    }
  }

  json_response(['ok' => true, 'message' => "Payment method '{$methodRow['name']}' deleted successfully."]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
