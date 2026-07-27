<?php
/**
 * Rise Above Foundation — v2 Migration Runner
 * Run: C:\xampp\php\php.exe api/migrate_v2.php
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

echo "=== Rise Above v2 Migration ===\n\n";

try {
  $pdo = db();
} catch (Throwable $e) {
  echo "❌ DB connection failed: " . $e->getMessage() . "\n";
  exit(1);
}

function run_alter(PDO $pdo, string $sql): void {
  try {
    $pdo->exec($sql);
    echo "  ✅ " . substr($sql, 0, 70) . "...\n";
  } catch (Throwable $e) {
    if (str_contains($e->getMessage(), 'Duplicate column') || str_contains($e->getMessage(), 'already exists')) {
      echo "  ⏭️  Already exists: " . substr($sql, 0, 60) . "...\n";
    } else {
      echo "  ⚠️  " . $e->getMessage() . "\n";
    }
  }
}

// 1. Beneficiaries
run_alter($pdo, "ALTER TABLE beneficiaries ADD COLUMN invitation_token VARCHAR(64) NULL");
run_alter($pdo, "ALTER TABLE beneficiaries ADD COLUMN invitation_expires DATETIME NULL");
run_alter($pdo, "ALTER TABLE beneficiaries ADD COLUMN invitation_status ENUM('none','invited','accepted','expired') DEFAULT 'none'");

// 2. Users
run_alter($pdo, "ALTER TABLE users ADD COLUMN invited_by_user_id BIGINT NULL");

// 3. Assistance Requests
run_alter($pdo, "ALTER TABLE assistance_requests MODIFY COLUMN priority ENUM('Low','Medium','High','Critical') DEFAULT 'Medium'");
run_alter($pdo, "ALTER TABLE assistance_requests ADD COLUMN calamity_tags JSON NULL");
run_alter($pdo, "ALTER TABLE assistance_requests ADD COLUMN is_emergency TINYINT(1) NOT NULL DEFAULT 0");
run_alter($pdo, "ALTER TABLE assistance_requests ADD COLUMN sla_deadline DATETIME NULL");
run_alter($pdo, "ALTER TABLE assistance_requests ADD COLUMN assigned_to VARCHAR(120) NULL");

// 4. Allocations
run_alter($pdo, "ALTER TABLE allocations MODIFY COLUMN priority ENUM('Low','Medium','High','Critical') DEFAULT 'Medium'");

// 5. Distributions
run_alter($pdo, "ALTER TABLE distributions ADD COLUMN request_id BIGINT NULL");
run_alter($pdo, "ALTER TABLE distributions ADD COLUMN source_allocation_ids JSON NULL");

// 6. Indexes
run_alter($pdo, "CREATE INDEX idx_dist_status ON distributions(status)");
run_alter($pdo, "CREATE INDEX idx_alloc_status_dist ON allocations(status, distribution_id)");
run_alter($pdo, "CREATE INDEX idx_req_priority_status ON assistance_requests(priority, status)");
run_alter($pdo, "CREATE INDEX idx_ben_invitation ON beneficiaries(invitation_status)");
run_alter($pdo, "CREATE INDEX idx_dist_beneficiary ON distributions(beneficiary_id)");
run_alter($pdo, "CREATE INDEX idx_req_beneficiary ON assistance_requests(beneficiary_id)");

// 7. SLA Backfill
echo "\nBackfilling SLA deadlines...\n";
$slaHours = ['Critical' => 4, 'High' => 24, 'Medium' => 72, 'Low' => 168];
$updated = 0;
foreach ($slaHours as $priority => $hours) {
  try {
    $n = $pdo->exec(
      "UPDATE assistance_requests SET sla_deadline = DATE_ADD(created_at, INTERVAL {$hours} HOUR) WHERE priority = '{$priority}' AND sla_deadline IS NULL"
    );
    $updated += $n;
  } catch (Throwable $e) {
    // ignore
  }
}
echo "  ✅ Updated {$updated} request SLA deadlines\n";

echo "\n✅ All migration tasks completed.\n";
