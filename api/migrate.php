<?php
declare(strict_types=1);
/**
 * Apply schema migrations for existing databases.
 * Run: C:\xampp\php\php.exe api/migrate.php
 */
require __DIR__ . '/config.php';

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

  echo "\nMigration complete!\n";
} catch (Throwable $e) {
  http_response_code(500);
  echo "Migration failed: " . $e->getMessage() . "\n";
}
