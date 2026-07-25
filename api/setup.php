<?php
declare(strict_types=1);
/**
 * One-time / repeat setup: creates ALL tables + demo login accounts + sample data.
 *
 * Run in PowerShell:
 *   C:\xampp\php\php.exe api/setup.php
 */

require __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

$demoUsers = [
  ['role' => 'Admin', 'name' => 'Maria Dela Cruz', 'email' => 'admin@riseabovefoundation.org', 'password' => 'admin123'],
  ['role' => 'Staff', 'name' => 'Carlos Mendoza', 'email' => 'staff@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Donor', 'name' => 'Juan Reyes', 'email' => 'donor@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Volunteer', 'name' => 'Ana Lim', 'email' => 'volunteer@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Beneficiary', 'name' => 'Roberto Dela Cruz', 'email' => 'beneficiary@riseabovefoundation.org', 'password' => 'demo123'],
];

function runSqlFile(PDO $pdo, string $path): void
{
  $sql = file_get_contents($path);
  if ($sql === false) {
    throw new RuntimeException("Cannot read SQL file: {$path}");
  }
  $pdo->exec($sql);
}

function upsertUser(PDO $pdo, array $demo): int
{
  $findRole = $pdo->prepare('SELECT id FROM roles WHERE name = ? LIMIT 1');
  $findRole->execute([$demo['role']]);
  $roleId = (int) $findRole->fetchColumn();
  if (!$roleId) {
    throw new RuntimeException("Role not found: {$demo['role']}");
  }

  $hash = password_hash($demo['password'], PASSWORD_DEFAULT);
  $findUser = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $findUser->execute([$demo['email']]);
  $userId = $findUser->fetchColumn();

  if ($userId) {
    $stmt = $pdo->prepare('UPDATE users SET role_id = ?, full_name = ?, password_hash = ?, status = ? WHERE id = ?');
    $stmt->execute([$roleId, $demo['name'], $hash, 'ACTIVE', $userId]);
    return (int) $userId;
  }

  $stmt = $pdo->prepare('INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)');
  $stmt->execute([$roleId, $demo['name'], $demo['email'], $hash, 'ACTIVE']);
  return (int) $pdo->lastInsertId();
}

function seedIfEmpty(PDO $pdo, string $table, callable $seedFn): void
{
  $count = (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
  if ($count === 0) {
    $seedFn();
    echo "Seeded {$table}\n";
  } else {
    echo "Skipped {$table} (already has data)\n";
  }
}

try {
  $pdo = db();
  echo "Creating tables from schema.sql...\n";
  runSqlFile($pdo, __DIR__ . '/schema.sql');
  echo "Tables OK\n\n";

  echo "Setting up login accounts...\n";
  $userIds = [];
  foreach ($demoUsers as $demo) {
    $userIds[$demo['role']] = upsertUser($pdo, $demo);
    echo "  {$demo['role']}: {$demo['email']} / {$demo['password']}\n";
  }
  echo "\n";

  seedIfEmpty($pdo, 'donors', function () use ($pdo, $userIds) {
    $rows = [
      ['DNR-001', 'Juan Reyes', 'donor@riseabovefoundation.org', '+63 917 123 4567', $userIds['Donor']],
      ['DNR-002', 'SM Foundation', 'partnerships@smfoundation.org', '+63 2 8888 888', null],
      ['DNR-003', 'Lisa Tan', 'lisa.tan@email.com', '+63 918 234 5678', null],
      ['DNR-004', 'Cebu Business Council', 'info@cebu-business.org', '+63 32 234 5678', null],
      ['DNR-005', 'Pedro Santos', 'pedro.s@email.com', '+63 919 345 6789', null],
    ];
    $stmt = $pdo->prepare('INSERT INTO donors (code, full_name, email, phone, user_id) VALUES (?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'donations', function () use ($pdo) {
    $donorId = (int) $pdo->query("SELECT id FROM donors WHERE code = 'DNR-001' LIMIT 1")->fetchColumn();
    $rows = [
      ['DON-K2F9A', $donorId, 'Juan Reyes', 'donor@riseabovefoundation.org', 'Monetary', 5000, null, 'Verified', '2026-06-30'],
      ['DON-P7M2C', null, 'SM Foundation', null, 'In-Kind', null, '200 rice sacks', 'Pending Verification', '2026-06-29'],
      ['DON-R4N8D', null, 'Lisa Tan', 'lisa.tan@email.com', 'Monetary', 25000, null, 'Pending Verification', '2026-06-29'],
      ['DON-T1Q5E', null, 'Cebu Business Council', null, 'Monetary', 100000, null, 'Allocated', '2026-06-28'],
      ['DON-W8S3F', null, 'Anonymous', null, 'In-Kind', null, '50 hygiene kits', 'In Inventory', '2026-06-27'],
      ['DON-X2U6G', null, 'Pedro Santos', null, 'Monetary', 2500, null, 'Distributed', '2026-06-25'],
    ];
    $stmt = $pdo->prepare('INSERT INTO donations (tracking_code, donor_id, donor_name, donor_email, type, amount, items_description, status, donation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'beneficiaries', function () use ($pdo, $userIds) {
    $rows = [
      ['BEN-101', 'Roberto Dela Cruz', 'Disaster Relief', 'Talisay', 'Approved', $userIds['Beneficiary']],
      ['BEN-102', 'Elena Reyes', 'Medical Missions', 'Toledo', 'Pending Approval', null],
      ['BEN-103', 'Maria Santos', 'Educational Sponsorship', 'Cebu City', 'Approved', null],
      ['BEN-104', 'Josefa Mendoza', 'Community Outreach', 'Lahug', 'Approved', null],
      ['BEN-105', 'Carlos Villanueva', 'Feeding Programs', 'Minglanilla', 'Pending Approval', null],
    ];
    $stmt = $pdo->prepare('INSERT INTO beneficiaries (code, full_name, category, barangay, status, user_id) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'assistance_requests', function () use ($pdo) {
    $ben = fn(string $code) => (int) $pdo->query("SELECT id FROM beneficiaries WHERE code = '{$code}' LIMIT 1")->fetchColumn();
    $rows = [
      ['AST-M3K1B', $ben('BEN-102'), 'Medical Missions', 'Under Review', 'High', '2026-06-30'],
      ['AST-N7P4C', $ben('BEN-105'), 'Feeding Programs', 'Pending Review', 'Medium', '2026-06-29'],
      ['AST-O2Q8D', $ben('BEN-101'), 'Disaster Relief', 'Approved', 'High', '2026-06-28'],
      ['AST-P5R1E', $ben('BEN-103'), 'Educational Sponsorship', 'Allocated', 'Low', '2026-06-27'],
    ];
    $stmt = $pdo->prepare('INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, status, priority, request_date) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'inventory_items', function () use ($pdo) {
    $rows = [
      ['INV-001', 'Rice (50kg sacks)', 45, 'sacks', 100, 120, 835],
      ['INV-002', 'Canned goods', 1200, 'cans', 100, 300, 4500],
      ['INV-003', 'Hygiene kits', 280, 'kits', 50, 50, 670],
      ['INV-004', 'Relief packs (assembled)', 350, 'packs', 50, 150, 4200],
      ['INV-005', 'School supply kits', 18, 'kits', 30, 30, 452],
      ['INV-006', 'Bottled water (cases)', 500, 'cases', 100, 100, 1200],
    ];
    $stmt = $pdo->prepare('INSERT INTO inventory_items (code, item_name, quantity, unit, low_stock_threshold, allocated, distributed) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'repacking_jobs', function () use ($pdo) {
    $rows = [
      ['RPK-001', 'Rice (50kg sacks)', 'Relief packs', 200, 'In Progress', 'Staff Team A', '2026-07-01'],
      ['RPK-002', 'Canned goods + Hygiene kits', 'Family relief packs', 150, 'Scheduled', 'Volunteer Group B', '2026-07-03'],
      ['RPK-003', 'School supplies', 'School kits', 50, 'Completed', 'Staff Team B', '2026-06-28'],
    ];
    $stmt = $pdo->prepare('INSERT INTO repacking_jobs (code, source_items, output_item, quantity, status, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'allocations', function () use ($pdo) {
    $rows = [
      ['ALC-001', 'Relief packs', 150, 'Disaster Relief', 'Talisay flood victims', 'Reserved', '2026-06-30'],
      ['ALC-002', 'School supply kits', 30, 'Educational Sponsorship', 'Cebu City scholars', 'Allocated', '2026-06-29'],
      ['ALC-003', 'Hygiene kits', 100, 'Medical Missions', 'Toledo barangays', 'Pending', '2026-06-29'],
      ['ALC-004', 'Rice sacks', 50, 'Feeding Programs', 'Minglanilla community kitchen', 'Allocated', '2026-06-28'],
    ];
    $stmt = $pdo->prepare('INSERT INTO allocations (code, resource_name, quantity, program, beneficiary_target, status, allocation_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'distributions', function () use ($pdo) {
    $rows = [
      ['DST-001', 'Talisay', 'Disaster Relief', '2026-07-02', 150, 8, 2, 'Scheduled', 'Delivery'],
      ['DST-002', 'Cebu City', 'Educational Sponsorship', '2026-07-05', 45, 4, 1, 'Scheduled', 'Pickup'],
      ['DST-003', 'Toledo', 'Medical Missions', '2026-06-28', 320, 15, 3, 'Completed', 'Delivery'],
      ['DST-004', 'Minglanilla', 'Feeding Programs', '2026-07-08', 200, 6, 1, 'Planning', 'Delivery'],
    ];
    $stmt = $pdo->prepare('INSERT INTO distributions (code, location, program, distribution_date, beneficiaries_count, volunteers_count, vehicles_count, status, distribution_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'volunteers', function () use ($pdo, $userIds) {
    $rows = [
      ['VOL-201', 'Ana Lim', 'volunteer@riseabovefoundation.org', json_encode(['Disaster Relief']), 'Approved', 48, $userIds['Volunteer']],
      ['VOL-202', 'Mark Rivera', 'mark.r@email.com', json_encode(['Medical Missions', 'Community Outreach']), 'Pending Review', 0, null],
      ['VOL-203', 'Grace Ocampo', 'grace.o@email.com', json_encode(['Feeding Programs']), 'Active', 120, null],
      ['VOL-204', 'Ryan Cruz', 'ryan.cruz@email.com', json_encode(['Educational Sponsorship']), 'Assigned', 24, null],
      ['VOL-205', 'Jenny Morales', 'jenny.m@email.com', json_encode(['Disaster Relief', 'Feeding Programs']), 'Pending Review', 0, null],
    ];
    $stmt = $pdo->prepare('INSERT INTO volunteers (code, full_name, email, programs_json, status, hours, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'volunteer_schedule', function () use ($pdo) {
    $volId = (int) $pdo->query("SELECT id FROM volunteers WHERE code = 'VOL-201' LIMIT 1")->fetchColumn();
    $d1 = date('Y-m-d', strtotime('+3 days'));
    $d2 = date('Y-m-d', strtotime('+7 days'));
    $rows = [
      [$volId, $d1, 'Repacking shift — Cebu HQ', '8:00 AM'],
      [$volId, $d2, 'Talisay relief distribution', '6:00 AM'],
    ];
    $stmt = $pdo->prepare('INSERT INTO volunteer_schedule (volunteer_id, event_date, event_title, event_time) VALUES (?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'tasks', function () use ($pdo, $userIds) {
    $rows = [
      ['TSK-001', 'Verify donation DON-P7M2C', 'Carlos Mendoza', $userIds['Staff'], 'High', '2026-06-30', 'Donations', 'todo'],
      ['TSK-002', 'Review volunteer application — Mark Rivera', 'Patricia Go', null, 'Medium', '2026-07-01', 'Volunteers', 'todo'],
      ['TSK-003', 'Approve beneficiary — Carlos Villanueva', 'Ramon Villareal', null, 'Medium', '2026-07-01', 'Beneficiaries', 'todo'],
      ['TSK-004', 'Repack 200 relief packs', 'Staff Team A', null, 'High', '2026-07-01', 'Inventory', 'inProgress'],
      ['TSK-005', 'Plan Talisay distribution route', 'Patricia Go', null, 'High', '2026-07-02', 'Distribution', 'inProgress'],
      ['TSK-006', 'Generate OR for Lisa Tan donation', 'Carlos Mendoza', $userIds['Staff'], 'Low', '2026-06-30', 'Donations', 'review'],
      ['TSK-007', 'Complete Toledo medical mission report', 'Ramon Villareal', null, 'Medium', '2026-06-28', 'Reports', 'done'],
      ['TSK-008', 'Update inventory after repacking job RPK-003', 'Carlos Mendoza', $userIds['Staff'], 'Medium', '2026-06-28', 'Inventory', 'done'],
    ];
    $stmt = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, priority, due_date, module, board_column) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'certificates', function () use ($pdo) {
    $rows = [
      ['CERT-001', 'Certificate of Donation', 'Juan Reyes', 'DON-K2F9A', '2026-06-30', 'Generated'],
      ['CERT-002', 'Official Receipt', 'Lisa Tan', 'DON-R4N8D', null, 'Pending'],
      ['CERT-003', 'Certificate of Volunteer Service', 'Grace Ocampo', 'VOL-203', '2026-06-25', 'Generated'],
      ['CERT-004', 'Certificate of Participation', 'Ana Lim', 'DST-003', '2026-06-28', 'Generated'],
      ['CERT-005', 'Official Receipt', 'Cebu Business Council', 'DON-T1Q5E', '2026-06-29', 'Generated'],
    ];
    $stmt = $pdo->prepare('INSERT INTO certificates (code, cert_type, recipient_name, reference_code, cert_date, status) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  seedIfEmpty($pdo, 'programs', function () use ($pdo) {
    $rows = [
      ['disaster-relief', 'Disaster Relief', 'Rapid response operations delivering food, water, shelter materials, and medical supplies.', 1],
      ['educational-sponsorship', 'Educational Sponsorship', 'Scholarships, school supplies, and mentorship for students.', 1],
      ['feeding-programs', 'Feeding Programs', 'Community kitchens and meal distributions.', 1],
      ['community-outreach', 'Community Outreach', 'Livelihood training and neighborhood programs.', 1],
      ['medical-missions', 'Medical Missions', 'Free health checkups, medicines, and dental care.', 1],
    ];
    $stmt = $pdo->prepare('INSERT INTO programs (slug, name, description, active) VALUES (?, ?, ?, ?)');
    foreach ($rows as $row) {
      $stmt->execute($row);
    }
  });

  echo "\nSetup complete!\n";
  echo "Next: run npm run api  AND  npm run dev\n";
} catch (Throwable $e) {
  http_response_code(500);
  echo "Setup failed:\n" . $e->getMessage() . "\n";
  echo "\nCheck api/config.php and make sure MySQL is running in XAMPP.\n";
}
