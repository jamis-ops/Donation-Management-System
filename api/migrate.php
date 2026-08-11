<?php
declare(strict_types=1);
/**
 * Apply schema migrations for existing databases.
 * Run: C:\xampp\php\php.exe api/migrate.php
 */
require __DIR__ . '/config.php';

// Lock public HTTP access (CLI and localhost only, unless ALLOW_SETUP=1).
if (PHP_SAPI !== 'cli') {
  $addr = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
  $allow = getenv('ALLOW_SETUP') === '1' || in_array($addr, ['127.0.0.1', '::1'], true);
  if (!$allow) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Forbidden. migrate.php is only allowed from localhost or with ALLOW_SETUP=1.\n";
    exit;
  }
}

header('Content-Type: text/plain; charset=utf-8');

function columnExists(PDO $pdo, string $table, string $column): bool
{
  $stmt = $pdo->prepare("
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  ");
  $stmt->execute([$table, $column]);
  return (bool) $stmt->fetchColumn();
}

function addColumn(PDO $pdo, string $table, string $column, string $definition): void
{
  if (!columnExists($pdo, $table, $column)) {
    $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
    echo "Added {$table}.{$column}\n";
  }
}

function tableExists(PDO $pdo, string $table): bool
{
  $stmt = $pdo->prepare("
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
  ");
  $stmt->execute([$table]);
  return (bool) $stmt->fetchColumn();
}

try {
  $pdo = db();
  echo "Running migrations...\n\n";

  // v8: Email verification (self-registration replaces admin-sent credentials)
  addColumn($pdo, 'users', 'email_verified_at', 'TIMESTAMP NULL AFTER status');
  addColumn($pdo, 'users', 'verification_token', 'VARCHAR(64) NULL AFTER email_verified_at');
  addColumn($pdo, 'users', 'verification_sent_at', 'TIMESTAMP NULL AFTER verification_token');

  // v9: Volunteer duty hours on task assignments
  addColumn($pdo, 'tasks', 'duty_start', 'VARCHAR(10) NULL AFTER due_date');
  addColumn($pdo, 'tasks', 'duty_end', 'VARCHAR(10) NULL AFTER duty_start');
  addColumn($pdo, 'tasks', 'duty_hours', 'DECIMAL(5,2) NULL AFTER duty_end');

  // v10: Named distribution events + link orphans to barangays for proof submission
  addColumn($pdo, 'distributions', 'event_name', 'VARCHAR(160) NULL AFTER code');

  // Backfill event_name from code + location
  $pdo->exec("UPDATE distributions SET event_name = CONCAT(code, ' — ', location) WHERE event_name IS NULL OR event_name = ''");

  // Backfill beneficiary_id by matching location to barangay name fragments
  $bens = $pdo->query('SELECT id, full_name, barangay, municipality, user_id FROM beneficiaries ORDER BY (user_id IS NULL), id ASC')->fetchAll();
  $orphans = $pdo->query('SELECT id, location FROM distributions WHERE beneficiary_id IS NULL')->fetchAll();
  $linkStmt = $pdo->prepare('UPDATE distributions SET beneficiary_id = ? WHERE id = ? AND beneficiary_id IS NULL');
  $linked = 0;
  foreach ($orphans as $dist) {
    $location = strtolower((string) $dist['location']);
    $matchedId = null;
    foreach ($bens as $ben) {
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
      foreach ($keys as $key) {
        if ($key !== '' && str_contains($location, strtolower($key))) {
          $matchedId = (int) $ben['id'];
          break 2;
        }
      }
    }
    if ($matchedId) {
      $linkStmt->execute([$matchedId, $dist['id']]);
      $linked++;
    }
  }
  if ($linked > 0) {
    echo "Linked {$linked} distribution(s) to barangay beneficiaries\n";
  }

  // v11: Proof approval workflow — remarks + Pending/Approved/Rejected statuses
  addColumn($pdo, 'distribution_proofs', 'review_remarks', 'TEXT NULL AFTER status');
  addColumn($pdo, 'distribution_proofs', 'reviewed_by_user_id', 'BIGINT UNSIGNED NULL AFTER review_remarks');
  // Proof category for barangay multi-file submissions (received / distribution / acknowledgment)
  addColumn($pdo, 'distribution_proofs', 'proof_category', "VARCHAR(40) NOT NULL DEFAULT 'other' AFTER notes");

  // Normalize legacy status labels to Pending / Approved / Rejected
  try {
    $pdo->exec("UPDATE distribution_proofs SET status = 'Pending' WHERE status IN ('Pending Review','Under Review')");
    $pdo->exec("UPDATE distribution_proofs SET status = 'Approved' WHERE status IN ('Verified','Proof Verified')");
    // Expand ENUM if still on the old values
    $pdo->exec("ALTER TABLE distribution_proofs MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'Pending'");
    echo "Normalized distribution_proofs.status to Pending/Approved/Rejected\n";
  } catch (Throwable $e) {
    echo "Proof status normalize skipped: " . $e->getMessage() . "\n";
  }

  addColumn($pdo, 'beneficiaries', 'municipality', 'VARCHAR(80) NULL AFTER barangay');
  addColumn($pdo, 'beneficiaries', 'affected_families', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER municipality');
  addColumn($pdo, 'beneficiaries', 'representative_name', 'VARCHAR(120) NULL AFTER affected_families');
  addColumn($pdo, 'beneficiaries', 'representative_phone', 'VARCHAR(40) NULL AFTER representative_name');
  addColumn($pdo, 'beneficiaries', 'representative_email', 'VARCHAR(190) NULL AFTER representative_phone');
  addColumn($pdo, 'beneficiaries', 'notes', 'TEXT NULL AFTER representative_email');

  // v5: Barangay type + POC address + structured needs (CMS-driven)
  addColumn($pdo, 'beneficiaries', 'barangay_type', 'VARCHAR(60) NULL AFTER category');
  addColumn($pdo, 'beneficiaries', 'address', 'VARCHAR(255) NULL AFTER municipality');
  addColumn($pdo, 'beneficiaries', 'needs', 'TEXT NULL AFTER notes');

  // v6: Barangay receipt confirmation workflow
  addColumn($pdo, 'distributions', 'receipt_status', "VARCHAR(40) NOT NULL DEFAULT 'Awaiting Confirmation' AFTER proof_status");
  addColumn($pdo, 'distributions', 'received_quantity', 'INT UNSIGNED NULL AFTER receipt_status');
  addColumn($pdo, 'distributions', 'received_at', 'TIMESTAMP NULL AFTER received_quantity');
  addColumn($pdo, 'distributions', 'receipt_notes', 'TEXT NULL AFTER received_at');

  // v7: Donation category (CMS-driven)
  addColumn($pdo, 'donations', 'category', 'VARCHAR(60) NULL AFTER type');

  // v7: Distribution logistics (schedule time + delivery fuel/manpower estimation)
  addColumn($pdo, 'distributions', 'schedule_time', 'VARCHAR(20) NULL AFTER distribution_date');
  addColumn($pdo, 'distributions', 'distance_km', 'DECIMAL(7,1) NULL AFTER vehicles_count');
  addColumn($pdo, 'distributions', 'fuel_liters', 'DECIMAL(8,2) NULL AFTER distance_km');
  addColumn($pdo, 'distributions', 'fuel_cost', 'DECIMAL(10,2) NULL AFTER fuel_liters');

  addColumn($pdo, 'allocations', 'priority', "ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium' AFTER status");
  addColumn($pdo, 'allocations', 'beneficiary_id', 'BIGINT UNSIGNED NULL AFTER beneficiary_target');
  addColumn($pdo, 'allocations', 'notes', 'TEXT NULL AFTER beneficiary_id');

  addColumn($pdo, 'distributions', 'beneficiary_id', 'BIGINT UNSIGNED NULL AFTER location');
  addColumn($pdo, 'distributions', 'items_summary', 'TEXT NULL AFTER beneficiary_id');
  addColumn($pdo, 'distributions', 'coordinator', 'VARCHAR(120) NULL AFTER items_summary');
  addColumn($pdo, 'distributions', 'notes', 'TEXT NULL AFTER coordinator');
  addColumn($pdo, 'distributions', 'proof_status', "ENUM('Not Required','Awaiting Proof','Proof Submitted','Proof Verified') NOT NULL DEFAULT 'Not Required' AFTER notes");

  addColumn($pdo, 'inventory_items', 'moderate_stock_threshold', 'INT UNSIGNED NULL AFTER low_stock_threshold');

  // v4: Inventory detail + functional repacking
  addColumn($pdo, 'inventory_items', 'category', 'VARCHAR(60) NULL AFTER item_name');
  addColumn($pdo, 'repacking_jobs', 'source_item_id', 'BIGINT UNSIGNED NULL AFTER code');
  addColumn($pdo, 'repacking_jobs', 'source_quantity', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER source_items');
  addColumn($pdo, 'repacking_jobs', 'output_unit', "VARCHAR(30) NULL AFTER output_item");
  addColumn($pdo, 'repacking_jobs', 'notes', 'TEXT NULL AFTER due_date');
  addColumn($pdo, 'repacking_jobs', 'source_items_json', 'JSON NULL AFTER source_quantity');
  addColumn($pdo, 'repacking_jobs', 'target_barangay_id', 'BIGINT UNSIGNED NULL AFTER output_unit');
  addColumn($pdo, 'repacking_jobs', 'recommended_contents_json', 'JSON NULL AFTER target_barangay_id');
  addColumn($pdo, 'repacking_jobs', 'families_targeted', 'INT UNSIGNED NULL AFTER recommended_contents_json');
  addColumn($pdo, 'repacking_jobs', 'sufficiency_status', "ENUM('Insufficient','Partial','Sufficient','Excess') NULL AFTER families_targeted");

  // v3: Certificate management fields
  addColumn($pdo, 'certificates', 'recipient_type', "VARCHAR(30) NOT NULL DEFAULT 'Donor' AFTER cert_type");
  addColumn($pdo, 'certificates', 'details', 'TEXT NULL AFTER reference_code');
  addColumn($pdo, 'certificates', 'signatory_name', "VARCHAR(120) NULL AFTER details");
  addColumn($pdo, 'certificates', 'signatory_title', "VARCHAR(120) NULL AFTER signatory_name");

  if (!tableExists($pdo, 'distribution_proofs')) {
    $pdo->exec("
      CREATE TABLE distribution_proofs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        distribution_id BIGINT UNSIGNED NOT NULL,
        beneficiary_id BIGINT UNSIGNED NOT NULL,
        submitted_by_user_id BIGINT UNSIGNED NULL,
        file_path VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(80) NULL,
        notes TEXT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Pending',
        review_remarks TEXT NULL,
        reviewed_by_user_id BIGINT UNSIGNED NULL,
        submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        CONSTRAINT fk_proof_distribution FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
        CONSTRAINT fk_proof_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
        CONSTRAINT fk_proof_user FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "Created distribution_proofs table\n";
  }

  if (!tableExists($pdo, 'notifications')) {
    $pdo->exec("
      CREATE TABLE notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NULL,
        role_target VARCHAR(50) NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (user_id, is_read),
        INDEX idx_notifications_role (role_target, is_read),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "Created notifications table\n";
  }

  // The Audit Logs feature was removed. Drop its table if it still exists.
  if (tableExists($pdo, 'audit_logs')) {
    $pdo->exec('DROP TABLE audit_logs');
    echo "Dropped audit_logs table (feature removed)\n";
  }

  // The CMS & Master Data module was removed in favour of built-in option lists.
  if (tableExists($pdo, 'cms_options')) {
    $pdo->exec('DROP TABLE cms_options');
    echo "Dropped cms_options table (module removed)\n";
  }

  // Update existing beneficiary seed as barangays
  $pdo->exec("UPDATE beneficiaries SET affected_families = 150, representative_name = 'Roberto Dela Cruz', municipality = 'Talisay City' WHERE code = 'BEN-101'");
  $pdo->exec("UPDATE beneficiaries SET affected_families = 85, representative_name = 'Elena Reyes', municipality = 'Toledo City' WHERE code = 'BEN-102'");
  $pdo->exec("UPDATE beneficiaries SET full_name = 'Brgy. Talisay', barangay = 'Talisay' WHERE code = 'BEN-101'");
  $pdo->exec("UPDATE beneficiaries SET full_name = 'Brgy. Toledo Poblacion', barangay = 'Toledo' WHERE code = 'BEN-102'");

  $uploadDir = __DIR__ . '/uploads/proofs';
  if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
    echo "Created uploads/proofs directory\n";
  }

  // v12: Donor profile enrichment + privacy/terms + donation proof
  addColumn($pdo, 'donors', 'organization', 'VARCHAR(160) NULL AFTER full_name');
  addColumn($pdo, 'donors', 'contact_person', 'VARCHAR(120) NULL AFTER organization');
  addColumn($pdo, 'donors', 'country', 'VARCHAR(80) NULL AFTER phone');
  addColumn($pdo, 'donors', 'address', 'VARCHAR(255) NULL AFTER country');
  addColumn($pdo, 'donors', 'notes', 'TEXT NULL AFTER address');

  addColumn($pdo, 'users', 'terms_accepted_at', 'TIMESTAMP NULL AFTER verification_sent_at');
  addColumn($pdo, 'users', 'privacy_accepted_at', 'TIMESTAMP NULL AFTER terms_accepted_at');

  addColumn($pdo, 'donations', 'payment_method', 'VARCHAR(40) NULL AFTER notes');
  addColumn($pdo, 'donations', 'proof_path', 'VARCHAR(255) NULL AFTER payment_method');
  addColumn($pdo, 'donations', 'proof_file_name', 'VARCHAR(255) NULL AFTER proof_path');
  addColumn($pdo, 'donations', 'proof_file_type', 'VARCHAR(80) NULL AFTER proof_file_name');

  $donationProofDir = __DIR__ . '/uploads/donation_proofs';
  if (!is_dir($donationProofDir)) {
    mkdir($donationProofDir, 0755, true);
    echo "Created uploads/donation_proofs directory\n";
  }

  // v13: Optional recovery phone for account recovery (shown as "None yet" until set)
  addColumn($pdo, 'users', 'recovery_phone', 'VARCHAR(40) NULL AFTER privacy_accepted_at');

  // v14: Donor type + beneficiary representative position
  addColumn($pdo, 'donors', 'donor_type', "VARCHAR(40) NOT NULL DEFAULT 'Individual' AFTER full_name");
  addColumn($pdo, 'beneficiaries', 'representative_position', 'VARCHAR(80) NULL AFTER representative_name');

  // v15: Donation progress updates + volunteer required hours + task completion time
  addColumn($pdo, 'volunteers', 'required_hours', 'INT NOT NULL DEFAULT 0 AFTER hours');
  addColumn($pdo, 'tasks', 'completed_at', 'TIMESTAMP NULL AFTER board_column');

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS donation_updates (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      donation_id BIGINT UNSIGNED NOT NULL,
      stage VARCHAR(80) NOT NULL,
      note TEXT NULL,
      created_by_user_id BIGINT UNSIGNED NULL,
      created_by_name VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_donation_updates_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
      CONSTRAINT fk_donation_updates_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_donation_updates_donation (donation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  echo "Ensured donation_updates table\n";

  // v16: First-login password change + profile photo + inventory lifecycle + CMS + contact
  addColumn($pdo, 'users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER recovery_phone');
  addColumn($pdo, 'users', 'profile_photo', 'VARCHAR(255) NULL AFTER must_change_password');
  addColumn($pdo, 'users', 'phone', 'VARCHAR(40) NULL AFTER email');
  addColumn($pdo, 'inventory_items', 'stock_state', "VARCHAR(40) NOT NULL DEFAULT 'Available' AFTER unit");
  addColumn($pdo, 'allocations', 'assistance_request_id', 'BIGINT UNSIGNED NULL AFTER beneficiary_id');
  addColumn($pdo, 'volunteers', 'skills_json', 'JSON NULL AFTER programs_json');
  addColumn($pdo, 'volunteers', 'availability', 'VARCHAR(255) NULL AFTER skills_json');

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      subject VARCHAR(200) NULL,
      message TEXT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'New',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  echo "Ensured contact_messages table\n";

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS cms_pages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      body LONGTEXT NULL,
      meta_json JSON NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      updated_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  echo "Ensured cms_pages table\n";

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS cms_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      summary TEXT NULL,
      body LONGTEXT NULL,
      image_url VARCHAR(500) NULL,
      link_url VARCHAR(500) NULL,
      meta_json JSON NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      published_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cms_items_type_status (type, status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  echo "Ensured cms_items table\n";

  // Sync full programs/partners catalog + image URLs into cms_items
  require_once __DIR__ . '/content_catalog.php';
  if (function_exists('sync_cms_catalog')) {
    sync_cms_catalog($pdo);
    echo "Synced CMS programs & partners catalog\n";
  }

  // v17: Task required skills for volunteer matching
  addColumn($pdo, 'tasks', 'required_skills_json', 'JSON NULL AFTER module');
  addColumn($pdo, 'volunteers', 'skills_other', 'VARCHAR(255) NULL AFTER skills_json');

  // v18: LN / FN / MI name parts across person tables
  addColumn($pdo, 'users', 'first_name', 'VARCHAR(80) NULL AFTER full_name');
  addColumn($pdo, 'users', 'last_name', 'VARCHAR(80) NULL AFTER first_name');
  addColumn($pdo, 'users', 'middle_initial', 'VARCHAR(5) NULL AFTER last_name');
  addColumn($pdo, 'donors', 'first_name', 'VARCHAR(80) NULL AFTER full_name');
  addColumn($pdo, 'donors', 'last_name', 'VARCHAR(80) NULL AFTER first_name');
  addColumn($pdo, 'donors', 'middle_initial', 'VARCHAR(5) NULL AFTER last_name');
  addColumn($pdo, 'volunteers', 'first_name', 'VARCHAR(80) NULL AFTER full_name');
  addColumn($pdo, 'volunteers', 'last_name', 'VARCHAR(80) NULL AFTER first_name');
  addColumn($pdo, 'volunteers', 'middle_initial', 'VARCHAR(5) NULL AFTER last_name');
  addColumn($pdo, 'beneficiaries', 'representative_first_name', 'VARCHAR(80) NULL AFTER representative_name');
  addColumn($pdo, 'beneficiaries', 'representative_last_name', 'VARCHAR(80) NULL AFTER representative_first_name');
  addColumn($pdo, 'beneficiaries', 'representative_middle_initial', 'VARCHAR(5) NULL AFTER representative_last_name');

  // v20: Barangay invitation workflow columns
  addColumn($pdo, 'beneficiaries', 'invitation_token', 'VARCHAR(64) NULL AFTER status');
  addColumn($pdo, 'beneficiaries', 'invitation_expires', 'DATETIME NULL AFTER invitation_token');
  addColumn($pdo, 'beneficiaries', 'invitation_status', "VARCHAR(20) NOT NULL DEFAULT 'none' AFTER invitation_expires");
  echo "Ensured beneficiaries invitation columns\n";

  // v19: Link allocations → distribution events (handoff)
  addColumn($pdo, 'allocations', 'distribution_id', 'BIGINT UNSIGNED NULL AFTER assistance_request_id');
  echo "Ensured allocations.distribution_id for distribution handoff\n";

  // v21: Shared Type of Needs catalog (Admin-managed, used by Barangay portal + admin barangay forms)
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS need_types (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_need_types_label (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  $needCount = (int) $pdo->query('SELECT COUNT(*) FROM need_types')->fetchColumn();
  if ($needCount === 0) {
    $defaults = [
      'Food', 'Water', 'Clothing', 'Medicine', 'Hygiene Kits',
      'Shelter', 'Financial Assistance', 'Educational Support',
    ];
    $insNeed = $pdo->prepare('INSERT INTO need_types (label, sort_order, is_active) VALUES (?, ?, 1)');
    foreach ($defaults as $i => $label) {
      $insNeed->execute([$label, $i + 1]);
    }
    echo "Seeded need_types catalog\n";
  } else {
    echo "Ensured need_types table\n";
  }
  addColumn($pdo, 'assistance_requests', 'needs_json', 'TEXT NULL AFTER notes');
  // Allow longer joined labels while primary type remains a short display value
  try {
    $pdo->exec('ALTER TABLE assistance_requests MODIFY assistance_type VARCHAR(255) NOT NULL');
  } catch (Throwable $e) {
    // ignore if already widened / unsupported
  }

  // v22: Settings catalogs — barangay_types + task_types (need_types already exists)
  foreach ([
    'barangay_types' => ['Urban', 'Rural', 'Coastal', 'Upland', 'Island', 'Lowland'],
    'task_types' => [
      'Distribution', 'Repacking', 'Verification', 'Fieldwork',
      'Administrative', 'Logistics', 'Outreach', 'Operations',
      'Donations', 'Inventory', 'Distributions',
    ],
  ] as $table => $defaults) {
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS `{$table}` (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(120) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_{$table}_label (label)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $cnt = (int) $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    if ($cnt === 0) {
      $ins = $pdo->prepare("INSERT INTO `{$table}` (label, sort_order, is_active) VALUES (?, ?, 1)");
      foreach (array_values($defaults) as $i => $label) {
        $ins->execute([$label, $i + 1]);
      }
      echo "Seeded {$table}\n";
    } else {
      echo "Ensured {$table} table\n";
    }
  }

  // v23: Link volunteer/staff tasks to distributions (In Transit / Delivered sync)
  addColumn($pdo, 'tasks', 'distribution_id', 'BIGINT UNSIGNED NULL AFTER assignee_user_id');
  try {
    $pdo->exec('CREATE INDEX idx_tasks_distribution ON tasks (distribution_id)');
  } catch (Throwable $e) {
    // index may already exist
  }
  echo "Ensured tasks.distribution_id\n";

  // v24: Integrity fixes from client-ready review
  try {
    $pdo->exec("ALTER TABLE distributions MODIFY proof_status ENUM('Not Required','Awaiting Proof','Proof Submitted','Proof Verified','Proof Rejected') NOT NULL DEFAULT 'Not Required'");
    echo "Widened distributions.proof_status ENUM\n";
  } catch (Throwable $e) {
    echo "proof_status ENUM note: " . $e->getMessage() . "\n";
  }
  try {
    $pdo->exec("ALTER TABLE assistance_requests MODIFY priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium'");
    echo "Widened assistance_requests.priority ENUM\n";
  } catch (Throwable $e) {
    echo "priority ENUM note: " . $e->getMessage() . "\n";
  }
  addColumn($pdo, 'donations', 'inventory_posted_at', 'TIMESTAMP NULL DEFAULT NULL AFTER updated_at');
  // Normalize legacy distribution statuses to Admin workflow
  $pdo->exec("UPDATE distributions SET status = 'Planning' WHERE status IN ('Scheduled','Pending')");
  $pdo->exec("UPDATE distributions SET status = 'Preparing' WHERE status = 'In Progress'");
  echo "Normalized legacy distribution statuses\n";
  // Beneficiary Active counts as approved for metrics
  $pdo->exec("UPDATE beneficiaries SET status = 'Active' WHERE status = 'Approved'");
  echo "Normalized beneficiary Approved → Active\n";
  // Volunteer Active/Assigned → Approved for reporting consistency
  $pdo->exec("UPDATE volunteers SET status = 'Approved' WHERE status IN ('Active','Assigned')");
  echo "Normalized volunteer Active/Assigned → Approved\n";
  // Unique emails where safe (ignore failures if duplicates already exist)
  foreach ([
    'CREATE UNIQUE INDEX uq_donors_email ON donors (email)',
    'CREATE UNIQUE INDEX uq_volunteers_email ON volunteers (email)',
    'CREATE UNIQUE INDEX uq_beneficiaries_rep_email ON beneficiaries (representative_email)',
  ] as $sql) {
    try {
      $pdo->exec($sql);
      echo "Applied: {$sql}\n";
    } catch (Throwable $e) {
      echo "Index skipped (may exist or duplicates present): {$sql}\n";
    }
  }

  echo "\nMigration complete!\n";
} catch (Throwable $e) {
  http_response_code(500);
  echo "Migration failed: " . $e->getMessage() . "\n";
}
