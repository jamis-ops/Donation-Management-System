<?php
declare(strict_types=1);

/**
 * ============================================================================
 * Rise Above Foundation — Comprehensive Database Seeder
 * ============================================================================
 * Seeds realistic, interconnected sample data for testing all system modules:
 * - Staff, Donors, Volunteers, Barangays (Beneficiaries)
 * - Donations & Progress Timelines
 * - Relief Requests & Calamity Needs
 * - Inventory Items, Stock Levels & Warehousing
 * - Resource Allocation & Scheduling Queues
 * - Repacking Jobs & Kit Assembly
 * - Distribution Logistics, Routing, Fuel, Proofs & Receipts
 * - Kanban Tasks & Volunteer Duty Schedules
 * - Certificates of Donation & Volunteer Recognition
 * - System Notifications & CMS Content
 *
 * Usage:
 *   CLI:     C:\xampp\php\php.exe api/seed.php
 *   Browser: http://localhost/DonationSystem/api/seed.php?force_seed=1
 * ============================================================================
 */

if (php_sapi_name() !== 'cli' && !isset($_GET['force_seed'])) {
  header('Content-Type: text/plain; charset=utf-8');
  die("This script should be run from the command line: php api/seed.php\nOr open in browser with: ?force_seed=1\n");
}

if (php_sapi_name() !== 'cli') {
  header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/config.php';
$pdo = db();

echo "================================================================\n";
echo "  Rise Above Foundation — Comprehensive Database Seeder\n";
echo "================================================================\n\n";

$defaultPassword = 'password123';
$defaultPasswordHash = password_hash($defaultPassword, PASSWORD_DEFAULT);
$adminPasswordHash = password_hash('admin123', PASSWORD_DEFAULT);

try {
  $pdo->beginTransaction();

  // --------------------------------------------------------------------------
  // 1. ROLES
  // --------------------------------------------------------------------------
  echo "[1/17] Seeding Roles...\n";
  $roleNames = ['Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary'];
  $roleIds = [];

  foreach ($roleNames as $rName) {
    $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = ? LIMIT 1');
    $stmt->execute([$rName]);
    $existingId = $stmt->fetchColumn();
    if ($existingId) {
      $roleIds[$rName] = (int) $existingId;
    } else {
      $ins = $pdo->prepare('INSERT INTO roles (name) VALUES (?)');
      $ins->execute([$rName]);
      $roleIds[$rName] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 2. USERS (Login Accounts)
  // --------------------------------------------------------------------------
  echo "[2/17] Seeding System Users & Login Accounts...\n";

  $seedUsers = [
    // Admins
    [
      'role' => 'Admin',
      'email' => 'admin@riseabovefoundation.org',
      'password_hash' => $adminPasswordHash,
      'full_name' => 'Maria Dela Cruz',
      'first_name' => 'Maria',
      'last_name' => 'Dela Cruz',
      'phone' => '+63 917 100 0001',
    ],
    [
      'role' => 'Admin',
      'email' => 'admin@example.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'System Administrator',
      'first_name' => 'System',
      'last_name' => 'Administrator',
      'phone' => '+63 917 100 0002',
    ],
    // Staff
    [
      'role' => 'Staff',
      'email' => 'staff@riseabovefoundation.org',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Carlos Mendoza',
      'first_name' => 'Carlos',
      'last_name' => 'Mendoza',
      'phone' => '+63 918 200 0001',
    ],
    [
      'role' => 'Staff',
      'email' => 'patricia.go@riseabovefoundation.org',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Patricia Go',
      'first_name' => 'Patricia',
      'last_name' => 'Go',
      'phone' => '+63 918 200 0002',
    ],
    [
      'role' => 'Staff',
      'email' => 'staff@example.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Staff Coordinator',
      'first_name' => 'Staff',
      'last_name' => 'Coordinator',
      'phone' => '+63 918 200 0003',
    ],
    // Donors
    [
      'role' => 'Donor',
      'email' => 'donor@riseabovefoundation.org',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Juan Reyes',
      'first_name' => 'Juan',
      'last_name' => 'Reyes',
      'phone' => '+63 917 300 0001',
    ],
    [
      'role' => 'Donor',
      'email' => 'lisa.tan@email.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Lisa Tan',
      'first_name' => 'Lisa',
      'last_name' => 'Tan',
      'phone' => '+63 917 300 0002',
    ],
    [
      'role' => 'Donor',
      'email' => 'donor@example.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Demonstration Donor',
      'first_name' => 'Demonstration',
      'last_name' => 'Donor',
      'phone' => '+63 917 300 0003',
    ],
    // Volunteers
    [
      'role' => 'Volunteer',
      'email' => 'volunteer@riseabovefoundation.org',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Ana Lim',
      'first_name' => 'Ana',
      'last_name' => 'Lim',
      'phone' => '+63 919 400 0001',
    ],
    [
      'role' => 'Volunteer',
      'email' => 'mark.rivera@email.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Mark Rivera',
      'first_name' => 'Mark',
      'last_name' => 'Rivera',
      'phone' => '+63 919 400 0002',
    ],
    [
      'role' => 'Volunteer',
      'email' => 'grace.ocampo@email.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Grace Ocampo',
      'first_name' => 'Grace',
      'last_name' => 'Ocampo',
      'phone' => '+63 919 400 0003',
    ],
    [
      'role' => 'Volunteer',
      'email' => 'volunteer@example.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Demonstration Volunteer',
      'first_name' => 'Demonstration',
      'last_name' => 'Volunteer',
      'phone' => '+63 919 400 0004',
    ],
    // Beneficiary / Barangay Portal Users
    [
      'role' => 'Beneficiary',
      'email' => 'beneficiary@riseabovefoundation.org',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Roberto Dela Cruz',
      'first_name' => 'Roberto',
      'last_name' => 'Dela Cruz',
      'phone' => '+63 920 500 0001',
    ],
    [
      'role' => 'Beneficiary',
      'email' => 'brgy.talisay@cebu.gov.ph',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Hon. Manuel Tan',
      'first_name' => 'Manuel',
      'last_name' => 'Tan',
      'phone' => '+63 920 500 0002',
    ],
    [
      'role' => 'Beneficiary',
      'email' => 'brgy.guadalupe@cebucity.gov.ph',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Hon. Michael Rama Jr.',
      'first_name' => 'Michael',
      'last_name' => 'Rama',
      'phone' => '+63 920 500 0003',
    ],
    [
      'role' => 'Beneficiary',
      'email' => 'beneficiary@example.com',
      'password_hash' => $defaultPasswordHash,
      'full_name' => 'Demonstration Barangay Rep',
      'first_name' => 'Demonstration',
      'last_name' => 'Rep',
      'phone' => '+63 920 500 0004',
    ],
  ];

  $userIdsByEmail = [];
  foreach ($seedUsers as $u) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$u['email']]);
    $existingUserId = $stmt->fetchColumn();

    $roleId = $roleIds[$u['role']] ?? 1;
    if ($existingUserId) {
      $upd = $pdo->prepare('UPDATE users SET role_id = ?, full_name = ?, first_name = ?, last_name = ?, password_hash = ?, phone = ?, status = "ACTIVE", email_verified_at = NOW(), terms_accepted_at = NOW(), privacy_accepted_at = NOW() WHERE id = ?');
      $upd->execute([$roleId, $u['full_name'], $u['first_name'], $u['last_name'], $u['password_hash'], $u['phone'], $existingUserId]);
      $userIdsByEmail[$u['email']] = (int) $existingUserId;
    } else {
      $ins = $pdo->prepare('INSERT INTO users (role_id, full_name, first_name, last_name, email, password_hash, phone, status, email_verified_at, terms_accepted_at, privacy_accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, "ACTIVE", NOW(), NOW(), NOW())');
      $ins->execute([$roleId, $u['full_name'], $u['first_name'], $u['last_name'], $u['email'], $u['password_hash'], $u['phone']]);
      $userIdsByEmail[$u['email']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 3. SETTINGS & CATALOGS
  // --------------------------------------------------------------------------
  echo "[3/17] Seeding Settings & Catalogs (Need Types, Barangay Types, Task Types)...\n";

  $needTypes = [
    'Rice & Grains',
    'Canned & Preserved Goods',
    'Bottled Clean Water',
    'Family Hygiene Kits',
    'First Aid & Medicines',
    'School Supplies & Books',
    'Emergency Blankets & Mats',
    'Temporary Shelter Tarps',
    'Baby & Infant Care Packs',
  ];
  foreach ($needTypes as $i => $nt) {
    $ins = $pdo->prepare('INSERT INTO need_types (label, sort_order, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
    $ins->execute([$nt, $i + 1]);
  }

  $barangayTypes = ['Urban', 'Rural', 'Coastal', 'Mountainous', 'Upland / Remote', 'Island Community'];
  foreach ($barangayTypes as $i => $bt) {
    $ins = $pdo->prepare('INSERT INTO barangay_types (label, sort_order, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
    $ins->execute([$bt, $i + 1]);
  }

  $taskTypes = [
    'Repacking & Assembling',
    'Logistics & Loading',
    'Driving & Transport',
    'On-Site Distribution',
    'Inventory Audit',
    'Beneficiary Coordination',
    'Administrative & Documentation',
    'Medical Mission Support',
    'Feeding Preparation',
  ];
  foreach ($taskTypes as $i => $tt) {
    $ins = $pdo->prepare('INSERT INTO task_types (label, sort_order, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
    $ins->execute([$tt, $i + 1]);
  }

  // Create tables if not exist for volunteer_programs and volunteer_skills
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS volunteer_programs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_volunteer_programs_label (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $volunteerProgramsList = [
    'Disaster Relief and House Building Project',
    'Community Feeding & Nutrition Program',
    'Educational Sponsorship & Youth Development',
    'Medical and Dental Missions',
    'Family Hygiene & Preventive Health',
    'Livelihood & Skills Training',
  ];
  foreach ($volunteerProgramsList as $i => $vp) {
    $ins = $pdo->prepare('INSERT INTO volunteer_programs (label, sort_order, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
    $ins->execute([$vp, $i + 1]);
  }

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS volunteer_skills (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_volunteer_skills_label (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $volunteerSkillsList = [
    'First Aid & Medical',
    'Relief Goods Packing',
    'Teaching & Tutoring',
    'Driving & Logistics',
    'Cooking & Food Prep',
    'Community Engagement',
    'Documentation & Photos',
    'Warehouse Sorting',
    'Heavy Lifting & Loading',
    'Counseling & Social Work',
    'Administrative Support',
  ];
  foreach ($volunteerSkillsList as $i => $vs) {
    $ins = $pdo->prepare('INSERT INTO volunteer_skills (label, sort_order, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
    $ins->execute([$vs, $i + 1]);
  }

  // --------------------------------------------------------------------------
  // 4. CMS PROGRAMS
  // --------------------------------------------------------------------------
  echo "[4/17] Seeding Foundation Programs...\n";

  $programs = [
    [
      'slug' => 'disaster-relief',
      'name' => 'Disaster Relief and House Building Project',
      'description' => 'Immediate emergency aid, food packs, clean water, and shelter rebuilding materials for communities affected by natural calamities in Visayas.',
    ],
    [
      'slug' => 'community-feeding',
      'name' => 'Community Feeding & Nutrition Program',
      'description' => 'Nutritious daily meals, vitamins, and feeding outreach for malnourished children and families in underserved barangays.',
    ],
    [
      'slug' => 'educational-sponsorship',
      'name' => 'Educational Sponsorship & Youth Development',
      'description' => 'Full scholarships, school supplies, uniform assistance, and educational mentoring for deserving elementary, high school, and college scholars.',
    ],
    [
      'slug' => 'medical-dental-missions',
      'name' => 'Medical and Dental Missions',
      'description' => 'Free medical consultations, dental treatments, essential prescription medicines, and healthcare education in rural and coastal areas.',
    ],
    [
      'slug' => 'livelihood-training',
      'name' => 'Livelihood & Skills Training',
      'description' => 'Empowering parents and youth with vocational skills, baking, sewing, and small business starter toolkits for sustainable family income.',
    ],
    [
      'slug' => 'hygiene-health',
      'name' => 'Family Hygiene & Preventive Health',
      'description' => 'Distributing essential family hygiene kits, clean water filters, and conducting handwashing and sanitation seminars.',
    ],
  ];

  foreach ($programs as $p) {
    $ins = $pdo->prepare('INSERT INTO programs (slug, name, description, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), active = 1');
    $ins->execute([$p['slug'], $p['name'], $p['description']]);
  }

  // --------------------------------------------------------------------------
  // 5. DONORS
  // --------------------------------------------------------------------------
  echo "[5/17] Seeding Donors...\n";

  $seedDonors = [
    [
      'code' => 'DNR-1001',
      'full_name' => 'Juan Reyes',
      'first_name' => 'Juan',
      'last_name' => 'Reyes',
      'donor_type' => 'Individual',
      'email' => 'donor@riseabovefoundation.org',
      'phone' => '+63 917 300 0001',
      'address' => 'Banilad, Cebu City',
      'country' => 'Philippines',
      'user_id' => $userIdsByEmail['donor@riseabovefoundation.org'] ?? null,
      'notes' => 'Regular monthly monetary donor supporting educational scholarships.',
    ],
    [
      'code' => 'DNR-1002',
      'full_name' => 'Lisa Tan',
      'first_name' => 'Lisa',
      'last_name' => 'Tan',
      'donor_type' => 'Individual',
      'email' => 'lisa.tan@email.com',
      'phone' => '+63 917 300 0002',
      'address' => 'Ayala Alabang, Muntinlupa City',
      'country' => 'Philippines',
      'user_id' => $userIdsByEmail['lisa.tan@email.com'] ?? null,
      'notes' => 'Major supporter for Disaster Relief and emergency relief kits.',
    ],
    [
      'code' => 'DNR-1003',
      'full_name' => 'SM Foundation Inc.',
      'first_name' => 'SM',
      'last_name' => 'Foundation',
      'donor_type' => 'Corporate',
      'organization' => 'SM Investments Corporation',
      'contact_person' => 'Atty. Maria Theresa Laurel',
      'email' => 'partnerships@smfoundation.org',
      'phone' => '+63 2 8888 8888',
      'address' => 'Mall of Asia Complex, Pasay City',
      'country' => 'Philippines',
      'user_id' => null,
      'notes' => 'Corporate partner providing bulk rice sacks and food packs for disaster relief.',
    ],
    [
      'code' => 'DNR-1004',
      'full_name' => 'Roskilde Rotary Club',
      'first_name' => 'Roskilde',
      'last_name' => 'Rotary Club',
      'donor_type' => 'Foundation',
      'organization' => 'Rotary International District 1480',
      'contact_person' => 'Lars Henrik Nielsen',
      'email' => 'international@roskilderotary.dk',
      'phone' => '+45 46 35 12 34',
      'address' => 'Stændertorvet 1, 4000 Roskilde',
      'country' => 'Denmark',
      'user_id' => null,
      'notes' => 'International partner funding community health clinics and dental equipment.',
    ],
    [
      'code' => 'DNR-1005',
      'full_name' => 'Cebu Business Council',
      'first_name' => 'Cebu',
      'last_name' => 'Business Council',
      'donor_type' => 'Organization',
      'organization' => 'Cebu Chamber of Commerce & Industry',
      'contact_person' => 'Enrique Gomez',
      'email' => 'info@cebu-business.org',
      'phone' => '+63 32 234 5678',
      'address' => 'Cebu Business Park, Cebu City',
      'country' => 'Philippines',
      'user_id' => null,
      'notes' => 'Local business consortium providing emergency logistics and livelihood grants.',
    ],
    [
      'code' => 'DNR-1006',
      'full_name' => 'Demonstration Donor',
      'first_name' => 'Demonstration',
      'last_name' => 'Donor',
      'donor_type' => 'Individual',
      'email' => 'donor@example.com',
      'phone' => '+63 917 300 0003',
      'address' => 'Mandaue City, Cebu',
      'country' => 'Philippines',
      'user_id' => $userIdsByEmail['donor@example.com'] ?? null,
      'notes' => 'Demo donor profile for testing donor portal donation tracking and receipts.',
    ],
  ];

  $donorDbIds = [];
  foreach ($seedDonors as $d) {
    $stmt = $pdo->prepare('SELECT id FROM donors WHERE code = ? OR (email IS NOT NULL AND email = ?) LIMIT 1');
    $stmt->execute([$d['code'], $d['email'] ?? '']);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE donors SET user_id = ?, code = ?, full_name = ?, first_name = ?, last_name = ?, donor_type = ?, organization = ?, contact_person = ?, email = ?, phone = ?, country = ?, address = ?, notes = ? WHERE id = ?');
      $upd->execute([$d['user_id'], $d['code'], $d['full_name'], $d['first_name'], $d['last_name'], $d['donor_type'], $d['organization'] ?? null, $d['contact_person'] ?? null, $d['email'], $d['phone'], $d['country'], $d['address'], $d['notes'], $existing]);
      $donorDbIds[$d['code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO donors (user_id, code, full_name, first_name, last_name, donor_type, organization, contact_person, email, phone, country, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$d['user_id'], $d['code'], $d['full_name'], $d['first_name'], $d['last_name'], $d['donor_type'], $d['organization'] ?? null, $d['contact_person'] ?? null, $d['email'], $d['phone'], $d['country'], $d['address'], $d['notes']]);
      $donorDbIds[$d['code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 6. INVENTORY ITEMS (Warehousing)
  // --------------------------------------------------------------------------
  echo "[6/17] Seeding Inventory Items & Stock Quantities...\n";

  $inventoryItems = [
    [
      'code' => 'INV-1001',
      'item_name' => 'Rice (50kg sacks)',
      'category' => 'Food',
      'quantity' => 180,
      'unit' => 'sacks',
      'low_stock_threshold' => 30,
      'moderate_stock_threshold' => 80,
      'allocated' => 45,
      'distributed' => 320,
    ],
    [
      'code' => 'INV-1002',
      'item_name' => '5kg Family Rice Packs',
      'category' => 'Food',
      'quantity' => 450,
      'unit' => 'packs',
      'low_stock_threshold' => 100,
      'moderate_stock_threshold' => 250,
      'allocated' => 150,
      'distributed' => 820,
    ],
    [
      'code' => 'INV-1003',
      'item_name' => 'Canned Sardines (155g)',
      'category' => 'Food',
      'quantity' => 2400,
      'unit' => 'cans',
      'low_stock_threshold' => 300,
      'moderate_stock_threshold' => 800,
      'allocated' => 600,
      'distributed' => 4500,
    ],
    [
      'code' => 'INV-1004',
      'item_name' => 'Canned Corned Beef / Tuna',
      'category' => 'Food',
      'quantity' => 1850,
      'unit' => 'cans',
      'low_stock_threshold' => 250,
      'moderate_stock_threshold' => 600,
      'allocated' => 400,
      'distributed' => 3200,
    ],
    [
      'code' => 'INV-1005',
      'item_name' => 'Bottled Drinking Water (1L)',
      'category' => 'Food',
      'quantity' => 1200,
      'unit' => 'bottles',
      'low_stock_threshold' => 200,
      'moderate_stock_threshold' => 500,
      'allocated' => 300,
      'distributed' => 2400,
    ],
    [
      'code' => 'INV-1006',
      'item_name' => 'Family Emergency Relief Pack (Assembled)',
      'category' => 'Food',
      'quantity' => 320,
      'unit' => 'packs',
      'low_stock_threshold' => 50,
      'moderate_stock_threshold' => 150,
      'allocated' => 120,
      'distributed' => 1650,
    ],
    [
      'code' => 'INV-1007',
      'item_name' => 'Family Hygiene Kit (Soap, Toothpaste, Shampoo, Towel)',
      'category' => 'Medical / Hygiene',
      'quantity' => 280,
      'unit' => 'kits',
      'low_stock_threshold' => 50,
      'moderate_stock_threshold' => 120,
      'allocated' => 80,
      'distributed' => 950,
    ],
    [
      'code' => 'INV-1008',
      'item_name' => 'Essential First Aid & Medicine Pack',
      'category' => 'Medical / Hygiene',
      'quantity' => 140,
      'unit' => 'kits',
      'low_stock_threshold' => 30,
      'moderate_stock_threshold' => 70,
      'allocated' => 40,
      'distributed' => 410,
    ],
    [
      'code' => 'INV-1009',
      'item_name' => 'Elementary Student School Supply Kit',
      'category' => 'Educational',
      'quantity' => 210,
      'unit' => 'kits',
      'low_stock_threshold' => 40,
      'moderate_stock_threshold' => 100,
      'allocated' => 60,
      'distributed' => 750,
    ],
    [
      'code' => 'INV-1010',
      'item_name' => 'Emergency Shelter Tarpaulin (4x6m)',
      'category' => 'Shelter',
      'quantity' => 95,
      'unit' => 'units',
      'low_stock_threshold' => 20,
      'moderate_stock_threshold' => 50,
      'allocated' => 30,
      'distributed' => 380,
    ],
  ];

  $inventoryDbIds = [];
  foreach ($inventoryItems as $item) {
    $stmt = $pdo->prepare('SELECT id FROM inventory_items WHERE code = ? OR item_name = ? LIMIT 1');
    $stmt->execute([$item['code'], $item['item_name']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE inventory_items SET code = ?, item_name = ?, category = ?, quantity = ?, unit = ?, low_stock_threshold = ?, moderate_stock_threshold = ?, allocated = ?, distributed = ? WHERE id = ?');
      $upd->execute([$item['code'], $item['item_name'], $item['category'], $item['quantity'], $item['unit'], $item['low_stock_threshold'], $item['moderate_stock_threshold'], $item['allocated'], $item['distributed'], $existing]);
      $inventoryDbIds[$item['code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO inventory_items (code, item_name, category, quantity, unit, low_stock_threshold, moderate_stock_threshold, allocated, distributed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$item['code'], $item['item_name'], $item['category'], $item['quantity'], $item['unit'], $item['low_stock_threshold'], $item['moderate_stock_threshold'], $item['allocated'], $item['distributed']]);
      $inventoryDbIds[$item['code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 7. INBOUND DONATIONS & PROGRESS TIMELINES
  // --------------------------------------------------------------------------
  echo "[7/17] Seeding Inbound Donations & Timeline Updates...\n";

  $seedDonations = [
    [
      'tracking_code' => 'DON-90101',
      'donor_code' => 'DNR-1001',
      'donor_name' => 'Juan Reyes',
      'donor_email' => 'donor@riseabovefoundation.org',
      'type' => 'Monetary',
      'category' => 'Educational Sponsorship',
      'amount' => 15000.00,
      'items_description' => null,
      'payment_method' => 'Bank Transfer - BDO',
      'status' => 'Verified',
      'donation_date' => date('Y-m-d', strtotime('-5 days')),
      'notes' => 'Donation designated for college scholar tuition and textbooks.',
      'proof_file_name' => 'bdo_transfer_receipt_90101.pdf',
      'proof_path' => 'uploads/donations/bdo_receipt_90101.pdf',
      'proof_file_type' => 'application/pdf',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'Donation submitted online with bank transfer proof.'],
        ['stage' => 'Verification', 'note' => 'Bank deposit verified by accounting staff.'],
      ],
    ],
    [
      'tracking_code' => 'DON-90102',
      'donor_code' => 'DNR-1002',
      'donor_name' => 'Lisa Tan',
      'donor_email' => 'lisa.tan@email.com',
      'type' => 'Monetary',
      'category' => 'Disaster Relief',
      'amount' => 50000.00,
      'items_description' => null,
      'payment_method' => 'GCash',
      'status' => 'Allocated',
      'donation_date' => date('Y-m-d', strtotime('-12 days')),
      'notes' => 'Emergency fund for Talisay and Cebu coastal relief operations.',
      'proof_file_name' => 'gcash_confirmation_90102.png',
      'proof_path' => 'uploads/donations/gcash_90102.png',
      'proof_file_type' => 'image/png',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'GCash transaction submitted.'],
        ['stage' => 'Verification', 'note' => 'Funds verified and added to Disaster Relief Ledger.'],
        ['stage' => 'Allocation', 'note' => 'Allocated 150 Emergency Relief Packs for Talisay operation.'],
      ],
    ],
    [
      'tracking_code' => 'DON-90103',
      'donor_code' => 'DNR-1003',
      'donor_name' => 'SM Foundation Inc.',
      'donor_email' => 'partnerships@smfoundation.org',
      'type' => 'In-Kind',
      'category' => 'Food',
      'amount' => null,
      'items_description' => '100 sacks of Premium Sinandomeng Rice (50kg each)',
      'payment_method' => null,
      'status' => 'In Inventory',
      'donation_date' => date('Y-m-d', strtotime('-8 days')),
      'notes' => 'Delivered to Rise Above Cebu Central Warehouse via SM Logistics.',
      'proof_file_name' => 'delivery_receipt_sm_90103.pdf',
      'proof_path' => 'uploads/donations/dr_sm_90103.pdf',
      'proof_file_type' => 'application/pdf',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'In-kind corporate delivery pledge registered.'],
        ['stage' => 'Verification', 'note' => 'Warehouse inspection completed. Quality and sack count verified.'],
        ['stage' => 'Inventory', 'note' => 'Logged into Central Warehouse stock under INV-1001.'],
      ],
    ],
    [
      'tracking_code' => 'DON-90104',
      'donor_code' => 'DNR-1004',
      'donor_name' => 'Roskilde Rotary Club',
      'donor_email' => 'international@roskilderotary.dk',
      'type' => 'Monetary',
      'category' => 'Medical Missions',
      'amount' => 125000.00,
      'items_description' => null,
      'payment_method' => 'Wire Transfer (SWIFT)',
      'status' => 'Completed',
      'donation_date' => date('Y-m-d', strtotime('-25 days')),
      'notes' => 'International grant for Toledo dental mission and medical supplies.',
      'proof_file_name' => 'swift_transfer_90104.pdf',
      'proof_path' => 'uploads/donations/swift_90104.pdf',
      'proof_file_type' => 'application/pdf',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'SWIFT international wire instruction received.'],
        ['stage' => 'Verification', 'note' => 'Funds credited to foreign currency donation account.'],
        ['stage' => 'Inventory', 'note' => 'Purchased medical packs, dental tools, and medicines.'],
        ['stage' => 'Distribution', 'note' => 'Toledo medical and dental mission conducted successfully.'],
        ['stage' => 'Completed', 'note' => 'Official certificate and comprehensive mission report issued.'],
      ],
    ],
    [
      'tracking_code' => 'DON-90105',
      'donor_code' => 'DNR-1005',
      'donor_name' => 'Cebu Business Council',
      'donor_email' => 'info@cebu-business.org',
      'type' => 'Monetary',
      'category' => 'Community Feeding',
      'amount' => 35000.00,
      'items_description' => null,
      'payment_method' => 'Bank Transfer - BPI',
      'status' => 'Pending Verification',
      'donation_date' => date('Y-m-d', strtotime('-1 days')),
      'notes' => 'Pledge for weekly feeding outreach in Barangay Guadalupe.',
      'proof_file_name' => 'bpi_deposit_90105.jpg',
      'proof_path' => 'uploads/donations/bpi_90105.jpg',
      'proof_file_type' => 'image/jpeg',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'Deposit slip uploaded by donor coordinator.'],
      ],
    ],
    [
      'tracking_code' => 'DON-90106',
      'donor_code' => 'DNR-1006',
      'donor_name' => 'Demonstration Donor',
      'donor_email' => 'donor@example.com',
      'type' => 'In-Kind',
      'category' => 'Educational',
      'amount' => null,
      'items_description' => '50 complete elementary backpack school supply sets',
      'payment_method' => null,
      'status' => 'Pending Verification',
      'donation_date' => date('Y-m-d'),
      'notes' => 'Sample in-kind donation ready for verification in admin and staff portals.',
      'proof_file_name' => 'school_packs_photo_90106.jpg',
      'proof_path' => 'uploads/donations/school_packs_90106.jpg',
      'proof_file_type' => 'image/jpeg',
      'updates' => [
        ['stage' => 'Submission', 'note' => 'In-kind donation logged with item photo.'],
      ],
    ],
  ];

  $donationDbIds = [];
  foreach ($seedDonations as $dn) {
    $donorId = $donorDbIds[$dn['donor_code']] ?? null;

    $stmt = $pdo->prepare('SELECT id FROM donations WHERE tracking_code = ? LIMIT 1');
    $stmt->execute([$dn['tracking_code']]);
    $existingDonationId = $stmt->fetchColumn();

    $itemsDesc = $dn['items_description'] ?? null;
    $amountVal = $dn['amount'] ?? null;
    $paymentMethodVal = $dn['payment_method'] ?? null;
    $proofFile = $dn['proof_file_name'] ?? null;
    $proofPath = $dn['proof_path'] ?? null;
    $proofType = $dn['proof_file_type'] ?? null;

    if ($existingDonationId) {
      $upd = $pdo->prepare('UPDATE donations SET donor_id = ?, donor_name = ?, donor_email = ?, type = ?, category = ?, amount = ?, items_description = ?, payment_method = ?, status = ?, donation_date = ?, notes = ?, proof_file_name = ?, proof_path = ?, proof_file_type = ? WHERE id = ?');
      $upd->execute([$donorId, $dn['donor_name'], $dn['donor_email'], $dn['type'], $dn['category'], $amountVal, $itemsDesc, $paymentMethodVal, $dn['status'], $dn['donation_date'], $dn['notes'], $proofFile, $proofPath, $proofType, $existingDonationId]);
      $donationId = (int) $existingDonationId;
    } else {
      $ins = $pdo->prepare('INSERT INTO donations (tracking_code, donor_id, donor_name, donor_email, type, category, amount, items_description, payment_method, status, donation_date, notes, proof_file_name, proof_path, proof_file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$dn['tracking_code'], $donorId, $dn['donor_name'], $dn['donor_email'], $dn['type'], $dn['category'], $amountVal, $itemsDesc, $paymentMethodVal, $dn['status'], $dn['donation_date'], $dn['notes'], $proofFile, $proofPath, $proofType]);
      $donationId = (int) $pdo->lastInsertId();
    }
    $donationDbIds[$dn['tracking_code']] = $donationId;

    // Seed progress timeline updates
    if (!empty($dn['updates'])) {
      $staffUserId = $userIdsByEmail['carlos.mendoza@riseabovefoundation.org'] ?? $userIdsByEmail['staff@riseabovefoundation.org'] ?? null;
      foreach ($dn['updates'] as $up) {
        $chk = $pdo->prepare('SELECT id FROM donation_updates WHERE donation_id = ? AND stage = ? LIMIT 1');
        $chk->execute([$donationId, $up['stage']]);
        if (!$chk->fetchColumn()) {
          $insUp = $pdo->prepare('INSERT INTO donation_updates (donation_id, stage, note, created_by_user_id, created_by_name) VALUES (?, ?, ?, ?, "Carlos Mendoza (Staff)")');
          $insUp->execute([$donationId, $up['stage'], $up['note'], $staffUserId]);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. BENEFICIARIES (Partner Barangays)
  // --------------------------------------------------------------------------
  echo "[8/17] Seeding Beneficiaries & Partner Barangays...\n";

  $seedBeneficiaries = [
    [
      'code' => 'BEN-2001',
      'full_name' => 'Barangay Poblacion, Talisay City',
      'category' => 'Disaster Relief',
      'barangay_type' => 'Coastal',
      'barangay' => 'Poblacion',
      'municipality' => 'Talisay City',
      'address' => 'Talisay City Hall Compound, Cebu',
      'affected_families' => 180,
      'representative_name' => 'Hon. Manuel Tan',
      'representative_position' => 'Barangay Captain',
      'representative_phone' => '+63 920 500 0002',
      'representative_email' => 'brgy.talisay@cebu.gov.ph',
      'user_id' => $userIdsByEmail['brgy.talisay@cebu.gov.ph'] ?? null,
      'status' => 'Approved',
      'needs' => 'Relief packs (rice, canned goods, water), emergency hygiene kits, shelter tarpaulins for storm surge affected households.',
      'notes' => 'Active partner barangay with regular coastal relief operations.',
    ],
    [
      'code' => 'BEN-2002',
      'full_name' => 'Barangay Guadalupe, Cebu City',
      'category' => 'Feeding Programs',
      'barangay_type' => 'Urban',
      'barangay' => 'Guadalupe',
      'municipality' => 'Cebu City',
      'address' => 'Guadalupe Barangay Hall, V. Rama Ave, Cebu City',
      'affected_families' => 120,
      'representative_name' => 'Hon. Michael Rama Jr.',
      'representative_position' => 'Barangay Captain',
      'representative_phone' => '+63 920 500 0003',
      'representative_email' => 'brgy.guadalupe@cebucity.gov.ph',
      'user_id' => $userIdsByEmail['brgy.guadalupe@cebucity.gov.ph'] ?? null,
      'status' => 'Approved',
      'needs' => 'Nutritious supplemental feeding ingredients, 5kg rice packs, vitamins for children.',
      'notes' => 'Weekly community kitchen site hosting Rise Above child feeding sessions.',
    ],
    [
      'code' => 'BEN-2003',
      'full_name' => 'Barangay Lahug, Cebu City',
      'category' => 'Educational Sponsorship',
      'barangay_type' => 'Urban',
      'barangay' => 'Lahug',
      'municipality' => 'Cebu City',
      'address' => 'Gorordo Ave, Lahug, Cebu City',
      'affected_families' => 75,
      'representative_name' => 'Elena Cruz',
      'representative_position' => 'Education & Youth Committee Head',
      'representative_phone' => '+63 920 500 0015',
      'representative_email' => 'lahug.youth@cebucity.gov.ph',
      'user_id' => null,
      'status' => 'Approved',
      'needs' => 'Elementary school supply kits, notebooks, writing materials, backpacks for underprivileged pupils.',
      'notes' => 'Partner for youth educational support and library literacy programs.',
    ],
    [
      'code' => 'BEN-2004',
      'full_name' => 'Barangay Bato, Toledo City',
      'category' => 'Medical Missions',
      'barangay_type' => 'Rural',
      'barangay' => 'Bato',
      'municipality' => 'Toledo City',
      'address' => 'National Highway, Bato, Toledo City, Cebu',
      'affected_families' => 220,
      'representative_name' => 'Dr. Fernando Gomez',
      'representative_position' => 'Municipal Health Coordinator',
      'representative_phone' => '+63 920 500 0022',
      'representative_email' => 'health.toledo@cebu.gov.ph',
      'user_id' => null,
      'status' => 'Approved',
      'needs' => 'Medical mission supplies, dental extraction tools, essential antibiotics, vitamins, pain relief medicines.',
      'notes' => 'Location of comprehensive mobile dental and medical clinic outreaches.',
    ],
    [
      'code' => 'BEN-2005',
      'full_name' => 'Barangay Tungkil, Minglanilla',
      'category' => 'Disaster Relief',
      'barangay_type' => 'Coastal',
      'barangay' => 'Tungkil',
      'municipality' => 'Minglanilla',
      'address' => 'Tungkil Coastal Road, Minglanilla, Cebu',
      'affected_families' => 95,
      'representative_name' => 'Roberto Dela Cruz',
      'representative_position' => 'Disaster Risk Officer',
      'representative_phone' => '+63 920 500 0001',
      'representative_email' => 'beneficiary@riseabovefoundation.org',
      'user_id' => $userIdsByEmail['beneficiary@riseabovefoundation.org'] ?? null,
      'status' => 'Approved',
      'needs' => 'Emergency family food packs, water purification kits, hygiene packs for flood-prone puroks.',
      'notes' => 'Linked to demo beneficiary portal account for relief status tracking.',
    ],
    [
      'code' => 'BEN-2006',
      'full_name' => 'Barangay Cantabaco, Lutopan, Toledo',
      'category' => 'Livelihood & Skills',
      'barangay_type' => 'Mountainous',
      'barangay' => 'Cantabaco',
      'municipality' => 'Toledo City',
      'address' => 'Cantabaco Upland Center, Toledo, Cebu',
      'affected_families' => 60,
      'representative_name' => 'Corazon Alcantara',
      'representative_position' => 'Women Livelihood Association Head',
      'representative_phone' => '+63 920 500 0033',
      'representative_email' => 'cantabaco.women@gmail.com',
      'user_id' => null,
      'status' => 'Pending Approval',
      'needs' => 'Baking starter ovens, sewing kits, fabric rolls, vocational workshop materials.',
      'notes' => 'New partnership application under review by admin team.',
    ],
  ];

  $beneficiaryDbIds = [];
  foreach ($seedBeneficiaries as $b) {
    $stmt = $pdo->prepare('SELECT id FROM beneficiaries WHERE code = ? OR full_name = ? LIMIT 1');
    $stmt->execute([$b['code'], $b['full_name']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE beneficiaries SET user_id = ?, code = ?, full_name = ?, category = ?, barangay_type = ?, barangay = ?, municipality = ?, address = ?, affected_families = ?, representative_name = ?, representative_position = ?, representative_phone = ?, representative_email = ?, needs = ?, notes = ?, status = ? WHERE id = ?');
      $upd->execute([$b['user_id'], $b['code'], $b['full_name'], $b['category'], $b['barangay_type'], $b['barangay'], $b['municipality'], $b['address'], $b['affected_families'], $b['representative_name'], $b['representative_position'], $b['representative_phone'], $b['representative_email'], $b['needs'], $b['notes'], $b['status'], $existing]);
      $beneficiaryDbIds[$b['code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO beneficiaries (user_id, code, full_name, category, barangay_type, barangay, municipality, address, affected_families, representative_name, representative_position, representative_phone, representative_email, needs, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$b['user_id'], $b['code'], $b['full_name'], $b['category'], $b['barangay_type'], $b['barangay'], $b['municipality'], $b['address'], $b['affected_families'], $b['representative_name'], $b['representative_position'], $b['representative_phone'], $b['representative_email'], $b['needs'], $b['notes'], $b['status']]);
      $beneficiaryDbIds[$b['code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 9. ASSISTANCE REQUESTS (Barangay Relief Requests)
  // --------------------------------------------------------------------------
  echo "[9/17] Seeding Assistance Requests & Calamity Needs...\n";

  $seedRequests = [
    [
      'reference_code' => 'AST-80101',
      'ben_code' => 'BEN-2001',
      'assistance_type' => 'Disaster Relief Goods',
      'priority' => 'Critical',
      'status' => 'Approved',
      'request_date' => date('Y-m-d', strtotime('-4 days')),
      'is_emergency' => 1,
      'calamity_tags' => json_encode(['Typhoon Relief', 'Coastal Storm Surge']),
      'sla_deadline' => date('Y-m-d H:i:s', strtotime('+12 hours')),
      'assigned_to' => 'Carlos Mendoza (Staff)',
      'needs_json' => json_encode([
        ['item' => 'Family Emergency Relief Pack (Assembled)', 'quantity' => 150, 'unit' => 'packs'],
        ['item' => 'Bottled Drinking Water (1L)', 'quantity' => 300, 'unit' => 'bottles'],
        ['item' => 'Emergency Shelter Tarpaulin (4x6m)', 'quantity' => 30, 'unit' => 'units'],
      ]),
      'notes' => "Calamity/Program: Typhoon Relief\nFamilies Affected: 150\nType of Needs: Food Packs, Water, Tarpaulins\nAdditional Notes: Immediate relief required for 150 coastal families evacuated at Poblacion Gym.",
    ],
    [
      'reference_code' => 'AST-80102',
      'ben_code' => 'BEN-2002',
      'assistance_type' => 'Community Feeding Supplies',
      'priority' => 'High',
      'status' => 'Allocated',
      'request_date' => date('Y-m-d', strtotime('-7 days')),
      'is_emergency' => 0,
      'calamity_tags' => json_encode(['Community Feeding', 'Malnutrition Prevention']),
      'sla_deadline' => date('Y-m-d H:i:s', strtotime('+48 hours')),
      'assigned_to' => 'Patricia Go (Staff)',
      'needs_json' => json_encode([
        ['item' => '5kg Family Rice Packs', 'quantity' => 120, 'unit' => 'packs'],
        ['item' => 'Canned Sardines (155g)', 'quantity' => 240, 'unit' => 'cans'],
        ['item' => 'Canned Corned Beef / Tuna', 'quantity' => 120, 'unit' => 'cans'],
      ]),
      'notes' => "Calamity/Program: Community Feeding\nFamilies Affected: 120\nType of Needs: Rice, Canned Goods\nAdditional Notes: Support for monthly nutritional outreach for pre-school and elementary children.",
    ],
    [
      'reference_code' => 'AST-80103',
      'ben_code' => 'BEN-2003',
      'assistance_type' => 'Elementary Student School Packs',
      'priority' => 'Medium',
      'status' => 'Under Review',
      'request_date' => date('Y-m-d', strtotime('-2 days')),
      'is_emergency' => 0,
      'calamity_tags' => json_encode(['Educational Sponsorship', 'Back to School']),
      'sla_deadline' => date('Y-m-d H:i:s', strtotime('+72 hours')),
      'assigned_to' => 'Carlos Mendoza (Staff)',
      'needs_json' => json_encode([
        ['item' => 'Elementary Student School Supply Kit', 'quantity' => 60, 'unit' => 'kits'],
      ]),
      'notes' => "Calamity/Program: Educational Sponsorship\nFamilies Affected: 60\nType of Needs: School Supply Kits\nAdditional Notes: Back-to-school initiative for indigent pupils of Lahug Elementary School.",
    ],
    [
      'reference_code' => 'AST-80104',
      'ben_code' => 'BEN-2004',
      'assistance_type' => 'Medical & Hygiene Assistance',
      'priority' => 'High',
      'status' => 'Completed',
      'request_date' => date('Y-m-d', strtotime('-20 days')),
      'is_emergency' => 0,
      'calamity_tags' => json_encode(['Medical Missions', 'Hygiene Outreach']),
      'sla_deadline' => null,
      'assigned_to' => 'Patricia Go (Staff)',
      'needs_json' => json_encode([
        ['item' => 'Essential First Aid & Medicine Pack', 'quantity' => 40, 'unit' => 'kits'],
        ['item' => 'Family Hygiene Kit (Soap, Toothpaste, Shampoo, Towel)', 'quantity' => 80, 'unit' => 'kits'],
      ]),
      'notes' => "Calamity/Program: Medical Missions\nFamilies Affected: 200\nType of Needs: Medicines, Hygiene Kits\nAdditional Notes: Successfully served 200 patients during the Toledo Rural Health Mission.",
    ],
    [
      'reference_code' => 'AST-80105',
      'ben_code' => 'BEN-2005',
      'assistance_type' => 'Emergency Flash Flood Relief',
      'priority' => 'High',
      'status' => 'Pending Review',
      'request_date' => date('Y-m-d', strtotime('-1 days')),
      'is_emergency' => 1,
      'calamity_tags' => json_encode(['Flash Flood', 'Heavy Monsoon Rain']),
      'sla_deadline' => date('Y-m-d H:i:s', strtotime('+24 hours')),
      'assigned_to' => null,
      'needs_json' => json_encode([
        ['item' => 'Family Emergency Relief Pack (Assembled)', 'quantity' => 80, 'unit' => 'packs'],
        ['item' => 'Bottled Drinking Water (1L)', 'quantity' => 160, 'unit' => 'bottles'],
      ]),
      'notes' => "Calamity/Program: Disaster Relief\nFamilies Affected: 80\nType of Needs: Food, Clean Drinking Water\nAdditional Notes: Floodwaters inundated Purok 3 and 4 in Tungkil. Clean drinking water urgent.",
    ],
  ];

  $requestDbIds = [];
  foreach ($seedRequests as $req) {
    $benId = $beneficiaryDbIds[$req['ben_code']] ?? null;
    if (!$benId) continue;

    $stmt = $pdo->prepare('SELECT id FROM assistance_requests WHERE reference_code = ? LIMIT 1');
    $stmt->execute([$req['reference_code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE assistance_requests SET beneficiary_id = ?, assistance_type = ?, priority = ?, status = ?, request_date = ?, notes = ?, needs_json = ?, calamity_tags = ?, is_emergency = ?, sla_deadline = ?, assigned_to = ? WHERE id = ?');
      $upd->execute([$benId, $req['assistance_type'], $req['priority'], $req['status'], $req['request_date'], $req['notes'], $req['needs_json'], $req['calamity_tags'], $req['is_emergency'], $req['sla_deadline'], $req['assigned_to'], $existing]);
      $requestDbIds[$req['reference_code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, priority, status, request_date, notes, needs_json, calamity_tags, is_emergency, sla_deadline, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$req['reference_code'], $benId, $req['assistance_type'], $req['priority'], $req['status'], $req['request_date'], $req['notes'], $req['needs_json'], $req['calamity_tags'], $req['is_emergency'], $req['sla_deadline'], $req['assigned_to']]);
      $requestDbIds[$req['reference_code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 10. REPACKING JOBS (Warehouse Repacking & Assembly)
  // --------------------------------------------------------------------------
  echo "[10/17] Seeding Repacking Jobs & Assembly Runs...\n";

  $seedRepacking = [
    [
      'code' => 'RPK-3001',
      'source_code' => 'INV-1001',
      'source_items' => 'Rice (50kg sacks)',
      'source_quantity' => 15,
      'output_item' => '5kg Family Rice Packs',
      'output_unit' => 'packs',
      'quantity' => 150,
      'status' => 'Completed',
      'assigned_to' => 'Staff Team Alpha & Volunteers',
      'due_date' => date('Y-m-d', strtotime('-5 days')),
      'families_targeted' => 150,
      'sufficiency_status' => 'Sufficient',
      'notes' => 'Repacked 15 bulk sacks into 150 handy 5kg distribution bags for Talisay relief.',
    ],
    [
      'code' => 'RPK-3002',
      'source_code' => 'INV-1003',
      'source_items' => 'Rice + Canned Goods + Water + Hygiene',
      'source_quantity' => 450,
      'output_item' => 'Family Emergency Relief Pack (Assembled)',
      'output_unit' => 'packs',
      'quantity' => 150,
      'status' => 'In Progress',
      'assigned_to' => 'Volunteer Shift Group B (Ana Lim, Mark Rivera)',
      'due_date' => date('Y-m-d', strtotime('+1 days')),
      'families_targeted' => 150,
      'sufficiency_status' => 'Sufficient',
      'notes' => 'Assembling 150 complete family boxes (5kg rice + 4 cans + 2L water + hygiene set).',
    ],
    [
      'code' => 'RPK-3003',
      'source_code' => 'INV-1009',
      'source_items' => 'Notebooks, Pens, Crayons, Bags',
      'source_quantity' => 180,
      'output_item' => 'Elementary Student School Supply Kit',
      'output_unit' => 'kits',
      'quantity' => 60,
      'status' => 'Scheduled',
      'assigned_to' => 'Patricia Go & Education Scholars',
      'due_date' => date('Y-m-d', strtotime('+4 days')),
      'families_targeted' => 60,
      'sufficiency_status' => 'Sufficient',
      'notes' => 'Assembly of back-to-school kits for Lahug Elementary School pupils.',
    ],
  ];

  foreach ($seedRepacking as $rpk) {
    $srcId = $inventoryDbIds[$rpk['source_code']] ?? null;

    $stmt = $pdo->prepare('SELECT id FROM repacking_jobs WHERE code = ? LIMIT 1');
    $stmt->execute([$rpk['code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE repacking_jobs SET source_item_id = ?, source_items = ?, source_quantity = ?, output_item = ?, output_unit = ?, quantity = ?, status = ?, assigned_to = ?, due_date = ?, families_targeted = ?, sufficiency_status = ?, notes = ? WHERE id = ?');
      $upd->execute([$srcId, $rpk['source_items'], $rpk['source_quantity'], $rpk['output_item'], $rpk['output_unit'], $rpk['quantity'], $rpk['status'], $rpk['assigned_to'], $rpk['due_date'], $rpk['families_targeted'], $rpk['sufficiency_status'], $rpk['notes'], $existing]);
    } else {
      $ins = $pdo->prepare('INSERT INTO repacking_jobs (code, source_item_id, source_items, source_quantity, output_item, output_unit, quantity, status, assigned_to, due_date, families_targeted, sufficiency_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$rpk['code'], $srcId, $rpk['source_items'], $rpk['source_quantity'], $rpk['output_item'], $rpk['output_unit'], $rpk['quantity'], $rpk['status'], $rpk['assigned_to'], $rpk['due_date'], $rpk['families_targeted'], $rpk['sufficiency_status'], $rpk['notes']]);
    }
  }

  // --------------------------------------------------------------------------
  // 11. DISTRIBUTIONS (Logistics & Delivery Events)
  // --------------------------------------------------------------------------
  echo "[11/17] Seeding Distributions & Logistics Events...\n";

  $seedDistributions = [
    [
      'code' => 'DST-4001',
      'event_name' => 'Talisay Coastal Typhoon Relief Delivery',
      'location' => 'Barangay Poblacion Gym, Talisay City',
      'ben_code' => 'BEN-2001',
      'program' => 'Disaster Relief and House Building Project',
      'distribution_date' => date('Y-m-d', strtotime('+1 days')),
      'schedule_time' => '08:30 AM',
      'distribution_type' => 'Delivery',
      'beneficiaries_count' => 150,
      'volunteers_count' => 8,
      'vehicles_count' => 2,
      'distance_km' => 18.5,
      'fuel_liters' => 12.0,
      'fuel_cost' => 840.00,
      'items_summary' => '150 Family Emergency Relief Packs, 300L Water, 30 Tarpaulins',
      'coordinator' => 'Carlos Mendoza (Staff)',
      'status' => 'Preparing',
      'proof_status' => 'Awaiting Proof',
      'receipt_status' => 'Awaiting Confirmation',
      'notes' => '2 delivery trucks loading at Cebu Central Warehouse 7:00 AM.',
    ],
    [
      'code' => 'DST-4002',
      'event_name' => 'Guadalupe Community Kitchen Food Distribution',
      'location' => 'Guadalupe Barangay Hall, V. Rama Ave, Cebu City',
      'ben_code' => 'BEN-2002',
      'program' => 'Community Feeding & Nutrition Program',
      'distribution_date' => date('Y-m-d', strtotime('+3 days')),
      'schedule_time' => '10:00 AM',
      'distribution_type' => 'Delivery',
      'beneficiaries_count' => 120,
      'volunteers_count' => 5,
      'vehicles_count' => 1,
      'distance_km' => 6.2,
      'fuel_liters' => 5.0,
      'fuel_cost' => 350.00,
      'items_summary' => '120 5kg Rice Packs, 360 Cans Sardines/Corned Beef',
      'coordinator' => 'Patricia Go (Staff)',
      'status' => 'Planning',
      'proof_status' => 'Awaiting Proof',
      'receipt_status' => 'Awaiting Confirmation',
      'notes' => 'On-site feeding and family dry ration pickup.',
    ],
    [
      'code' => 'DST-4003',
      'event_name' => 'Lahug Elementary School Kit Handover',
      'location' => 'Lahug Elementary School, Gorordo Ave, Cebu City',
      'ben_code' => 'BEN-2003',
      'program' => 'Educational Sponsorship & Youth Development',
      'distribution_date' => date('Y-m-d', strtotime('+5 days')),
      'schedule_time' => '01:30 PM',
      'distribution_type' => 'Pickup',
      'beneficiaries_count' => 60,
      'volunteers_count' => 4,
      'vehicles_count' => 1,
      'distance_km' => 4.8,
      'fuel_liters' => 3.5,
      'fuel_cost' => 245.00,
      'items_summary' => '60 Elementary Student School Supply Kits with Backpacks',
      'coordinator' => 'Carlos Mendoza (Staff)',
      'status' => 'Planning',
      'proof_status' => 'Awaiting Proof',
      'receipt_status' => 'Awaiting Confirmation',
      'notes' => 'School principal and PTA officers confirmed attendance.',
    ],
    [
      'code' => 'DST-4004',
      'event_name' => 'Toledo Rural Health & Hygiene Mission',
      'location' => 'Barangay Bato Health Center, Toledo City',
      'ben_code' => 'BEN-2004',
      'program' => 'Medical and Dental Missions',
      'distribution_date' => date('Y-m-d', strtotime('-18 days')),
      'schedule_time' => '07:00 AM',
      'distribution_type' => 'Delivery',
      'beneficiaries_count' => 200,
      'volunteers_count' => 14,
      'vehicles_count' => 3,
      'distance_km' => 54.0,
      'fuel_liters' => 38.0,
      'fuel_cost' => 2660.00,
      'items_summary' => '40 First Aid Kits, 80 Family Hygiene Kits, Dental Consumables',
      'coordinator' => 'Patricia Go (Staff)',
      'status' => 'Completed',
      'proof_status' => 'Proof Verified',
      'receipt_status' => 'Received',
      'received_quantity' => 200,
      'received_at' => date('Y-m-d H:i:s', strtotime('-18 days +5 hours')),
      'receipt_notes' => 'Received in full by Dr. Fernando Gomez. 200 patients treated.',
      'notes' => 'Full medical mission completed with verified photo and receipt proof.',
    ],
  ];

  $distributionDbIds = [];
  foreach ($seedDistributions as $dst) {
    $benId = $beneficiaryDbIds[$dst['ben_code']] ?? null;

    $stmt = $pdo->prepare('SELECT id FROM distributions WHERE code = ? LIMIT 1');
    $stmt->execute([$dst['code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE distributions SET event_name = ?, location = ?, beneficiary_id = ?, program = ?, distribution_date = ?, schedule_time = ?, distribution_type = ?, beneficiaries_count = ?, volunteers_count = ?, vehicles_count = ?, distance_km = ?, fuel_liters = ?, fuel_cost = ?, items_summary = ?, coordinator = ?, status = ?, proof_status = ?, receipt_status = ?, received_quantity = ?, received_at = ?, receipt_notes = ?, notes = ? WHERE id = ?');
      $upd->execute([$dst['event_name'], $dst['location'], $benId, $dst['program'], $dst['distribution_date'], $dst['schedule_time'], $dst['distribution_type'], $dst['beneficiaries_count'], $dst['volunteers_count'], $dst['vehicles_count'], $dst['distance_km'], $dst['fuel_liters'], $dst['fuel_cost'], $dst['items_summary'], $dst['coordinator'], $dst['status'], $dst['proof_status'], $dst['receipt_status'], $dst['received_quantity'] ?? null, $dst['received_at'] ?? null, $dst['receipt_notes'] ?? null, $dst['notes'], $existing]);
      $distributionDbIds[$dst['code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, distribution_date, schedule_time, distribution_type, beneficiaries_count, volunteers_count, vehicles_count, distance_km, fuel_liters, fuel_cost, items_summary, coordinator, status, proof_status, receipt_status, received_quantity, received_at, receipt_notes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$dst['code'], $dst['event_name'], $dst['location'], $benId, $dst['program'], $dst['distribution_date'], $dst['schedule_time'], $dst['distribution_type'], $dst['beneficiaries_count'], $dst['volunteers_count'], $dst['vehicles_count'], $dst['distance_km'], $dst['fuel_liters'], $dst['fuel_cost'], $dst['items_summary'], $dst['coordinator'], $dst['status'], $dst['proof_status'], $dst['receipt_status'], $dst['received_quantity'] ?? null, $dst['received_at'] ?? null, $dst['receipt_notes'] ?? null, $dst['notes']]);
      $distributionDbIds[$dst['code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 12. RESOURCE ALLOCATIONS
  // --------------------------------------------------------------------------
  echo "[12/17] Seeding Resource Allocations & Request Linkages...\n";

  $seedAllocations = [
    [
      'code' => 'ALC-5001',
      'resource_name' => 'Family Emergency Relief Pack (Assembled)',
      'quantity' => 150,
      'program' => 'Disaster Relief and House Building Project',
      'beneficiary_target' => 'Barangay Poblacion, Talisay City (150 families)',
      'ben_code' => 'BEN-2001',
      'req_code' => 'AST-80101',
      'dist_code' => 'DST-4001',
      'status' => 'Reserved',
      'priority' => 'Critical',
      'allocation_date' => date('Y-m-d', strtotime('-3 days')),
      'notes' => 'Allocated from central warehouse for immediate Talisay delivery.',
    ],
    [
      'code' => 'ALC-5002',
      'resource_name' => 'Bottled Drinking Water (1L)',
      'quantity' => 300,
      'program' => 'Disaster Relief and House Building Project',
      'beneficiary_target' => 'Barangay Poblacion, Talisay City (150 families)',
      'ben_code' => 'BEN-2001',
      'req_code' => 'AST-80101',
      'dist_code' => 'DST-4001',
      'status' => 'Reserved',
      'priority' => 'Critical',
      'allocation_date' => date('Y-m-d', strtotime('-3 days')),
      'notes' => '300L bottled clean water reserved for evacuation center.',
    ],
    [
      'code' => 'ALC-5003',
      'resource_name' => '5kg Family Rice Packs',
      'quantity' => 120,
      'program' => 'Community Feeding & Nutrition Program',
      'beneficiary_target' => 'Barangay Guadalupe, Cebu City (120 families)',
      'ben_code' => 'BEN-2002',
      'req_code' => 'AST-80102',
      'dist_code' => 'DST-4002',
      'status' => 'Allocated',
      'priority' => 'High',
      'allocation_date' => date('Y-m-d', strtotime('-6 days')),
      'notes' => 'Dedicated for Guadalupe feeding session and food dry packs.',
    ],
    [
      'code' => 'ALC-5004',
      'resource_name' => 'Elementary Student School Supply Kit',
      'quantity' => 60,
      'program' => 'Educational Sponsorship & Youth Development',
      'beneficiary_target' => 'Lahug Elementary School Scholars (60 pupils)',
      'ben_code' => 'BEN-2003',
      'req_code' => 'AST-80103',
      'dist_code' => 'DST-4003',
      'status' => 'Pending',
      'priority' => 'Medium',
      'allocation_date' => date('Y-m-d', strtotime('-1 days')),
      'notes' => 'Pending repacking completion of 60 backpacks with school supplies.',
    ],
    [
      'code' => 'ALC-5005',
      'resource_name' => 'Family Hygiene Kit (Soap, Toothpaste, Shampoo, Towel)',
      'quantity' => 80,
      'program' => 'Medical and Dental Missions',
      'beneficiary_target' => 'Barangay Bato, Toledo City (80 households)',
      'ben_code' => 'BEN-2004',
      'req_code' => 'AST-80104',
      'dist_code' => 'DST-4004',
      'status' => 'Delivered',
      'priority' => 'High',
      'allocation_date' => date('Y-m-d', strtotime('-19 days')),
      'notes' => 'Delivered and acknowledged during the Toledo health caravan.',
    ],
  ];

  foreach ($seedAllocations as $alc) {
    $benId = $beneficiaryDbIds[$alc['ben_code']] ?? null;
    $reqId = $requestDbIds[$alc['req_code']] ?? null;
    $dstId = $distributionDbIds[$alc['dist_code']] ?? null;

    $stmt = $pdo->prepare('SELECT id FROM allocations WHERE code = ? LIMIT 1');
    $stmt->execute([$alc['code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE allocations SET resource_name = ?, quantity = ?, program = ?, beneficiary_target = ?, beneficiary_id = ?, assistance_request_id = ?, distribution_id = ?, status = ?, priority = ?, allocation_date = ?, notes = ? WHERE id = ?');
      $upd->execute([$alc['resource_name'], $alc['quantity'], $alc['program'], $alc['beneficiary_target'], $benId, $reqId, $dstId, $alc['status'], $alc['priority'], $alc['allocation_date'], $alc['notes'], $existing]);
    } else {
      $ins = $pdo->prepare('INSERT INTO allocations (code, resource_name, quantity, program, beneficiary_target, beneficiary_id, assistance_request_id, distribution_id, status, priority, allocation_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$alc['code'], $alc['resource_name'], $alc['quantity'], $alc['program'], $alc['beneficiary_target'], $benId, $reqId, $dstId, $alc['status'], $alc['priority'], $alc['allocation_date'], $alc['notes']]);
    }
  }

  // --------------------------------------------------------------------------
  // 13. DISTRIBUTION PROOFS (Signed Receipts & Delivery Photos)
  // --------------------------------------------------------------------------
  echo "[13/17] Seeding Distribution Proofs & Verification Records...\n";

  if (isset($distributionDbIds['DST-4004'], $beneficiaryDbIds['BEN-2004'])) {
    $toledoDistId = $distributionDbIds['DST-4004'];
    $toledoBenId = $beneficiaryDbIds['BEN-2004'];
    $adminUserId = $userIdsByEmail['admin@riseabovefoundation.org'] ?? 1;

    $chk = $pdo->prepare('SELECT id FROM distribution_proofs WHERE distribution_id = ? LIMIT 1');
    $chk->execute([$toledoDistId]);
    if (!$chk->fetchColumn()) {
      $ins = $pdo->prepare('INSERT INTO distribution_proofs (distribution_id, beneficiary_id, submitted_by_user_id, file_path, file_name, file_type, notes, proof_category, status, review_remarks, reviewed_by_user_id, submitted_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
      $ins->execute([
        $toledoDistId,
        $toledoBenId,
        $adminUserId,
        'uploads/proofs/toledo_signed_receipt_dst4004.pdf',
        'toledo_signed_receipt_dst4004.pdf',
        'application/pdf',
        'Official signed attendance sheet and distribution photo documentation for 200 patients.',
        'signed_receipt',
        'Approved',
        'Verified by Admin Maria Dela Cruz. Complete patient signatures and barangay seal attached.',
        $adminUserId,
      ]);
    }
  }

  // --------------------------------------------------------------------------
  // 14. VOLUNTEERS (Profiles, Roster, Skills & Hours)
  // --------------------------------------------------------------------------
  echo "[14/17] Seeding Volunteers, Skills & Rendered Hours...\n";

  $seedVolunteers = [
    [
      'code' => 'VOL-6001',
      'full_name' => 'Ana Lim',
      'first_name' => 'Ana',
      'last_name' => 'Lim',
      'email' => 'volunteer@riseabovefoundation.org',
      'user_id' => $userIdsByEmail['volunteer@riseabovefoundation.org'] ?? null,
      'programs' => ['Disaster Relief', 'Community Feeding', 'Medical Missions'],
      'skills' => ['First Aid & Medical', 'Relief Goods Packing', 'Community Engagement', 'Documentation & Photos'],
      'skills_other' => 'Basic conversational Cebuano & Tagalog',
      'availability' => 'Weekends & Friday Afternoons',
      'status' => 'Approved',
      'hours' => 0,
      'required_hours' => 0,
    ],
    [
      'code' => 'VOL-6002',
      'full_name' => 'Mark Rivera',
      'first_name' => 'Mark',
      'last_name' => 'Rivera',
      'email' => 'mark.rivera@email.com',
      'user_id' => $userIdsByEmail['mark.rivera@email.com'] ?? null,
      'programs' => ['Disaster Relief', 'Logistics & Transport'],
      'skills' => ['Driving & Logistics', 'Heavy Lifting & Loading', 'Warehouse Sorting'],
      'skills_other' => 'Professional Driver License (Codes 1, 2, 3)',
      'availability' => 'Flexible / On-Call for Calamity Response',
      'status' => 'Active',
      'hours' => 0,
      'required_hours' => 0,
    ],
    [
      'code' => 'VOL-6003',
      'full_name' => 'Grace Ocampo',
      'first_name' => 'Grace',
      'last_name' => 'Ocampo',
      'email' => 'grace.ocampo@email.com',
      'user_id' => $userIdsByEmail['grace.ocampo@email.com'] ?? null,
      'programs' => ['Educational Sponsorship', 'Community Feeding'],
      'skills' => ['Teaching & Tutoring', 'Cooking & Food Prep', 'Arts & Crafts'],
      'skills_other' => 'Licensed Professional Teacher (Elementary)',
      'availability' => 'Saturday Mornings',
      'status' => 'Active',
      'hours' => 0,
      'required_hours' => 0,
    ],
    [
      'code' => 'VOL-6004',
      'full_name' => 'Ryan Cruz',
      'first_name' => 'Ryan',
      'last_name' => 'Cruz',
      'email' => 'ryan.cruz@email.com',
      'user_id' => null,
      'programs' => ['Disaster Relief', 'Logistics & Transport'],
      'skills' => ['Driving & Logistics', 'Relief Goods Packing'],
      'skills_other' => 'Certified Forklift Operator',
      'availability' => 'Weekdays 8:00 AM - 12:00 PM',
      'status' => 'Assigned',
      'hours' => 0,
      'required_hours' => 0,
    ],
    [
      'code' => 'VOL-6005',
      'full_name' => 'Jenny Morales',
      'first_name' => 'Jenny',
      'last_name' => 'Morales',
      'email' => 'jenny.m@email.com',
      'user_id' => null,
      'programs' => ['Medical Missions', 'Community Feeding'],
      'skills' => ['First Aid & Medical', 'Cooking & Food Prep'],
      'skills_other' => 'Registered Nurse (RN)',
      'availability' => 'Sundays Full Day',
      'status' => 'Pending Review',
      'hours' => 0,
      'required_hours' => 0,
    ],
    [
      'code' => 'VOL-6006',
      'full_name' => 'Demonstration Volunteer',
      'first_name' => 'Demonstration',
      'last_name' => 'Volunteer',
      'email' => 'volunteer@example.com',
      'user_id' => $userIdsByEmail['volunteer@example.com'] ?? null,
      'programs' => ['Disaster Relief', 'Educational Sponsorship'],
      'skills' => ['Relief Goods Packing', 'Teaching & Tutoring'],
      'skills_other' => null,
      'availability' => 'Weekends',
      'status' => 'Approved',
      'hours' => 0,
      'required_hours' => 0,
    ],
  ];

  $volunteerDbIds = [];
  foreach ($seedVolunteers as $v) {
    $stmt = $pdo->prepare('SELECT id FROM volunteers WHERE code = ? OR (email IS NOT NULL AND email = ?) LIMIT 1');
    $stmt->execute([$v['code'], $v['email'] ?? '']);
    $existing = $stmt->fetchColumn();

    $progJson = json_encode($v['programs']);
    $skillsJson = json_encode($v['skills']);

    if ($existing) {
      $upd = $pdo->prepare('UPDATE volunteers SET user_id = ?, code = ?, full_name = ?, first_name = ?, last_name = ?, email = ?, programs_json = ?, skills_json = ?, skills_other = ?, availability = ?, status = ?, hours = ?, required_hours = ? WHERE id = ?');
      $upd->execute([$v['user_id'], $v['code'], $v['full_name'], $v['first_name'], $v['last_name'], $v['email'], $progJson, $skillsJson, $v['skills_other'], $v['availability'], $v['status'], $v['hours'], $v['required_hours'], $existing]);
      $volunteerDbIds[$v['code']] = (int) $existing;
    } else {
      $ins = $pdo->prepare('INSERT INTO volunteers (user_id, code, full_name, first_name, last_name, email, programs_json, skills_json, skills_other, availability, status, hours, required_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$v['user_id'], $v['code'], $v['full_name'], $v['first_name'], $v['last_name'], $v['email'], $progJson, $skillsJson, $v['skills_other'], $v['availability'], $v['status'], $v['hours'], $v['required_hours']]);
      $volunteerDbIds[$v['code']] = (int) $pdo->lastInsertId();
    }
  }

  // --------------------------------------------------------------------------
  // 15. VOLUNTEER SCHEDULES
  // --------------------------------------------------------------------------
  echo "[15/17] Seeding Volunteer Duty Schedules...\n";

  if (isset($volunteerDbIds['VOL-6001'])) {
    $anaId = $volunteerDbIds['VOL-6001'];
    $schedules = [
      ['volunteer_id' => $anaId, 'event_date' => date('Y-m-d', strtotime('+1 days')), 'event_title' => 'Talisay Relief Pack Distribution Shift', 'event_time' => '07:30 AM - 12:30 PM'],
      ['volunteer_id' => $anaId, 'event_date' => date('Y-m-d', strtotime('+3 days')), 'event_title' => 'Guadalupe Community Kitchen Prep', 'event_time' => '09:00 AM - 01:00 PM'],
      ['volunteer_id' => $anaId, 'event_date' => date('Y-m-d', strtotime('-18 days')), 'event_title' => 'Toledo Rural Health & Hygiene Mission', 'event_time' => '06:30 AM - 04:30 PM'],
    ];

    foreach ($schedules as $sc) {
      $chk = $pdo->prepare('SELECT id FROM volunteer_schedule WHERE volunteer_id = ? AND event_date = ? AND event_title = ? LIMIT 1');
      $chk->execute([$sc['volunteer_id'], $sc['event_date'], $sc['event_title']]);
      if (!$chk->fetchColumn()) {
        $ins = $pdo->prepare('INSERT INTO volunteer_schedule (volunteer_id, event_date, event_title, event_time) VALUES (?, ?, ?, ?)');
        $ins->execute([$sc['volunteer_id'], $sc['event_date'], $sc['event_title'], $sc['event_time']]);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 16. TASKS (Kanban Board for Staff & Volunteers)
  // --------------------------------------------------------------------------
  echo "[16/17] Seeding Kanban Tasks for Staff & Volunteers...\n";

  $staffCarlosId = $userIdsByEmail['carlos.mendoza@riseabovefoundation.org'] ?? $userIdsByEmail['staff@riseabovefoundation.org'] ?? null;
  $staffPatriciaId = $userIdsByEmail['patricia.go@riseabovefoundation.org'] ?? null;
  $volAnaId = $userIdsByEmail['volunteer@riseabovefoundation.org'] ?? null;
  $volMarkId = $userIdsByEmail['mark.rivera@email.com'] ?? null;

  $talisayDistId = $distributionDbIds['DST-4001'] ?? null;
  $guadalupeDistId = $distributionDbIds['DST-4002'] ?? null;
  $lahugDistId = $distributionDbIds['DST-4003'] ?? null;
  $toledoDistId = $distributionDbIds['DST-4004'] ?? null;

  $seedTasks = [
    [
      'code' => 'TSK-7001',
      'title' => 'Verify inbound donation DON-90105 from Cebu Business Council',
      'assignee' => 'Carlos Mendoza',
      'assignee_user_id' => $staffCarlosId,
      'distribution_id' => null,
      'priority' => 'High',
      'due_date' => date('Y-m-d', strtotime('+1 days')),
      'duty_start' => '09:00',
      'duty_end' => '10:30',
      'duty_hours' => 1.5,
      'module' => 'Donations',
      'required_skills_json' => json_encode(['Documentation & Photos']),
      'board_column' => 'todo',
    ],
    [
      'code' => 'TSK-7002',
      'title' => 'Load 150 Emergency Relief Packs into Truck 1 for Talisay Delivery',
      'assignee' => 'Mark Rivera (Volunteer)',
      'assignee_user_id' => $volMarkId,
      'distribution_id' => $talisayDistId,
      'priority' => 'Critical',
      'due_date' => date('Y-m-d', strtotime('+1 days')),
      'duty_start' => '07:00',
      'duty_end' => '09:00',
      'duty_hours' => 2.0,
      'module' => 'Distribution',
      'required_skills_json' => json_encode(['Driving & Logistics', 'Heavy Lifting & Loading']),
      'board_column' => 'inProgress',
    ],
    [
      'code' => 'TSK-7003',
      'title' => 'Assist with beneficiary registration and crowd flow at Talisay Gym',
      'assignee' => 'Ana Lim (Volunteer)',
      'assignee_user_id' => $volAnaId,
      'distribution_id' => $talisayDistId,
      'priority' => 'High',
      'due_date' => date('Y-m-d', strtotime('+1 days')),
      'duty_start' => '08:30',
      'duty_end' => '13:00',
      'duty_hours' => 4.5,
      'module' => 'Distribution',
      'required_skills_json' => json_encode(['Community Engagement', 'First Aid & Medical']),
      'board_column' => 'inProgress',
    ],
    [
      'code' => 'TSK-7004',
      'title' => 'Review volunteer application for Jenny Morales (Registered Nurse)',
      'assignee' => 'Patricia Go',
      'assignee_user_id' => $staffPatriciaId,
      'distribution_id' => null,
      'priority' => 'Medium',
      'due_date' => date('Y-m-d', strtotime('+2 days')),
      'duty_start' => '14:00',
      'duty_end' => '15:00',
      'duty_hours' => 1.0,
      'module' => 'Volunteers',
      'required_skills_json' => json_encode(['Community Engagement']),
      'board_column' => 'todo',
    ],
    [
      'code' => 'TSK-7005',
      'title' => 'Prepare 120 meal containers and rice packs for Guadalupe Outreach',
      'assignee' => 'Patricia Go',
      'assignee_user_id' => $staffPatriciaId,
      'distribution_id' => $guadalupeDistId,
      'priority' => 'High',
      'due_date' => date('Y-m-d', strtotime('+3 days')),
      'duty_start' => '08:00',
      'duty_end' => '11:00',
      'duty_hours' => 3.0,
      'module' => 'Inventory',
      'required_skills_json' => json_encode(['Cooking & Food Prep', 'Relief Goods Packing']),
      'board_column' => 'todo',
    ],
    [
      'code' => 'TSK-7006',
      'title' => 'Audit warehouse stock for school supply packs (INV-1009)',
      'assignee' => 'Carlos Mendoza',
      'assignee_user_id' => $staffCarlosId,
      'distribution_id' => $lahugDistId,
      'priority' => 'Medium',
      'due_date' => date('Y-m-d', strtotime('+4 days')),
      'duty_start' => '15:00',
      'duty_end' => '17:00',
      'duty_hours' => 2.0,
      'module' => 'Inventory',
      'required_skills_json' => json_encode(['Warehouse Sorting']),
      'board_column' => 'review',
    ],
    [
      'code' => 'TSK-7007',
      'title' => 'Upload signed delivery receipt and patient photo sheet for Toledo Mission',
      'assignee' => 'Carlos Mendoza',
      'assignee_user_id' => $staffCarlosId,
      'distribution_id' => $toledoDistId,
      'priority' => 'High',
      'due_date' => date('Y-m-d', strtotime('-17 days')),
      'duty_start' => '10:00',
      'duty_end' => '11:30',
      'duty_hours' => 1.5,
      'module' => 'Distribution',
      'required_skills_json' => json_encode(['Documentation & Photos']),
      'board_column' => 'done',
      'completed_at' => date('Y-m-d H:i:s', strtotime('-17 days +2 hours')),
    ],
    [
      'code' => 'TSK-7008',
      'title' => 'Generate Certificate of Donation for Roskilde Rotary Club (DON-90104)',
      'assignee' => 'Patricia Go',
      'assignee_user_id' => $staffPatriciaId,
      'distribution_id' => null,
      'priority' => 'Medium',
      'due_date' => date('Y-m-d', strtotime('-24 days')),
      'duty_start' => '13:30',
      'duty_end' => '14:30',
      'duty_hours' => 1.0,
      'module' => 'Donations',
      'required_skills_json' => json_encode(['Documentation & Photos']),
      'board_column' => 'done',
      'completed_at' => date('Y-m-d H:i:s', strtotime('-24 days +1 hours')),
    ],
  ];

  foreach ($seedTasks as $tsk) {
    $stmt = $pdo->prepare('SELECT id FROM tasks WHERE code = ? LIMIT 1');
    $stmt->execute([$tsk['code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE tasks SET title = ?, assignee = ?, assignee_user_id = ?, distribution_id = ?, priority = ?, due_date = ?, duty_start = ?, duty_end = ?, duty_hours = ?, module = ?, required_skills_json = ?, board_column = ?, completed_at = ? WHERE id = ?');
      $upd->execute([$tsk['title'], $tsk['assignee'], $tsk['assignee_user_id'], $tsk['distribution_id'], $tsk['priority'], $tsk['due_date'], $tsk['duty_start'], $tsk['duty_end'], $tsk['duty_hours'], $tsk['module'], $tsk['required_skills_json'], $tsk['board_column'], $tsk['completed_at'] ?? null, $existing]);
    } else {
      $ins = $pdo->prepare('INSERT INTO tasks (code, title, assignee, assignee_user_id, distribution_id, priority, due_date, duty_start, duty_end, duty_hours, module, required_skills_json, board_column, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$tsk['code'], $tsk['title'], $tsk['assignee'], $tsk['assignee_user_id'], $tsk['distribution_id'], $tsk['priority'], $tsk['due_date'], $tsk['duty_start'], $tsk['duty_end'], $tsk['duty_hours'], $tsk['module'], $tsk['required_skills_json'], $tsk['board_column'], $tsk['completed_at'] ?? null]);
    }
  }

  // --------------------------------------------------------------------------
  // 17. CERTIFICATES, NOTIFICATIONS & CMS CONTENT
  // --------------------------------------------------------------------------
  echo "[17/17] Seeding Certificates, Notifications, Announcements & Stories...\n";

  $seedCerts = [
    [
      'code' => 'CRT-9001',
      'cert_type' => 'Certificate of Donation',
      'recipient_type' => 'Donor',
      'recipient_name' => 'Roskilde Rotary Club',
      'reference_code' => 'DON-90104',
      'details' => 'In grateful recognition of your generous donation of ₱125,000.00 in support of the Toledo Rural Medical and Dental Mission.',
      'signatory_name' => 'Maria Dela Cruz',
      'signatory_title' => 'Executive Director',
      'cert_date' => date('Y-m-d', strtotime('-24 days')),
      'status' => 'Released',
    ],
    [
      'code' => 'CRT-9002',
      'cert_type' => 'Certificate of Donation',
      'recipient_type' => 'Donor',
      'recipient_name' => 'Juan Reyes',
      'reference_code' => 'DON-90101',
      'details' => 'In heartfelt appreciation for your scholarship grant of ₱15,000.00 empowering Cebu youth education.',
      'signatory_name' => 'Maria Dela Cruz',
      'signatory_title' => 'Executive Director',
      'cert_date' => date('Y-m-d', strtotime('-4 days')),
      'status' => 'Generated',
    ],
    [
      'code' => 'CRT-9003',
      'cert_type' => 'Certificate of Volunteer Service',
      'recipient_type' => 'Volunteer',
      'recipient_name' => 'Grace Ocampo',
      'reference_code' => 'VOL-6003',
      'details' => 'In recognition of completing over 80 hours of selfless volunteer service in community feeding and youth development.',
      'signatory_name' => 'Maria Dela Cruz',
      'signatory_title' => 'Executive Director',
      'cert_date' => date('Y-m-d', strtotime('-10 days')),
      'status' => 'Released',
    ],
    [
      'code' => 'CRT-9004',
      'cert_type' => 'Certificate of Appreciation',
      'recipient_type' => 'Partner',
      'recipient_name' => 'SM Foundation Inc.',
      'reference_code' => 'DON-90103',
      'details' => 'In sincere appreciation of donating 100 sacks of rice for the Disaster Relief Operations in Visayas.',
      'signatory_name' => 'Maria Dela Cruz',
      'signatory_title' => 'Executive Director',
      'cert_date' => date('Y-m-d', strtotime('-7 days')),
      'status' => 'Pending',
    ],
  ];

  foreach ($seedCerts as $crt) {
    $stmt = $pdo->prepare('SELECT id FROM certificates WHERE code = ? LIMIT 1');
    $stmt->execute([$crt['code']]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
      $upd = $pdo->prepare('UPDATE certificates SET cert_type = ?, recipient_type = ?, recipient_name = ?, reference_code = ?, details = ?, signatory_name = ?, signatory_title = ?, cert_date = ?, status = ? WHERE id = ?');
      $upd->execute([$crt['cert_type'], $crt['recipient_type'], $crt['recipient_name'], $crt['reference_code'], $crt['details'], $crt['signatory_name'], $crt['signatory_title'], $crt['cert_date'], $crt['status'], $existing]);
    } else {
      $ins = $pdo->prepare('INSERT INTO certificates (code, cert_type, recipient_type, recipient_name, reference_code, details, signatory_name, signatory_title, cert_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$crt['code'], $crt['cert_type'], $crt['recipient_type'], $crt['recipient_name'], $crt['reference_code'], $crt['details'], $crt['signatory_name'], $crt['signatory_title'], $crt['cert_date'], $crt['status']]);
    }
  }

  // Seed Announcements
  $seedAnnouncements = [
    [
      'title' => 'Urgent Call for Volunteers: Coastal Relief Repacking Shift',
      'category' => 'Volunteer Call',
      'excerpt' => 'Join our team this Friday at the Cebu Central Warehouse to help pack 300 emergency relief kits.',
      'published_date' => date('Y-m-d', strtotime('-2 days')),
    ],
    [
      'title' => 'Annual Educational Scholarship Grants Awarded to 75 Cebu Scholars',
      'category' => 'Education',
      'excerpt' => 'Rise Above Foundation celebrates the induction of 75 new scholars from partner barangays.',
      'published_date' => date('Y-m-d', strtotime('-15 days')),
    ],
    [
      'title' => '200 Patients Served in Toledo Rural Dental & Medical Caravan',
      'category' => 'Healthcare',
      'excerpt' => 'Free dental treatments, medical checkups, and prescription medicines delivered in Barangay Bato.',
      'published_date' => date('Y-m-d', strtotime('-17 days')),
    ],
  ];

  foreach ($seedAnnouncements as $ann) {
    $stmt = $pdo->prepare('SELECT id FROM announcements WHERE title = ? LIMIT 1');
    $stmt->execute([$ann['title']]);
    if (!$stmt->fetchColumn()) {
      $ins = $pdo->prepare('INSERT INTO announcements (title, category, excerpt, published_date) VALUES (?, ?, ?, ?)');
      $ins->execute([$ann['title'], $ann['category'], $ann['excerpt'], $ann['published_date']]);
    }
  }

  // Seed Partners
  $seedPartners = [
    ['name' => 'SM Foundation Inc.', 'category' => 'Corporate Partner', 'description' => 'Disaster relief food supplies and nationwide foundation partnership.', 'website' => 'https://sm-foundation.org', 'initials' => 'SMF'],
    ['name' => 'Roskilde Rotary Club', 'category' => 'International Partner', 'description' => 'Rotary International district 1480 supporting health missions.', 'website' => 'https://roskilderotary.dk', 'initials' => 'RRC'],
    ['name' => 'Ramon Aboitiz Foundation Inc. (RAFI)', 'category' => 'Community Partner', 'description' => 'Collaborative community development and youth education in Cebu.', 'website' => 'https://rafi.org.ph', 'initials' => 'RAFI'],
    ['name' => 'Developing World Connections', 'category' => 'International Volunteer Partner', 'description' => 'Canadian volunteer teams for house building and education.', 'website' => 'https://developingworldconnections.org', 'initials' => 'DWC'],
  ];

  foreach ($seedPartners as $pt) {
    $stmt = $pdo->prepare('SELECT id FROM partners WHERE name = ? LIMIT 1');
    $stmt->execute([$pt['name']]);
    if (!$stmt->fetchColumn()) {
      $ins = $pdo->prepare('INSERT INTO partners (name, category, description, website, initials) VALUES (?, ?, ?, ?, ?)');
      $ins->execute([$pt['name'], $pt['category'], $pt['description'], $pt['website'], $pt['initials']]);
    }
  }

  // Seed Success Stories
  $seedStories = [
    [
      'title' => 'From Scholar to Registered Nurse: Maricar’s Inspiring Journey',
      'category' => 'Education',
      'excerpt' => 'Thanks to dedicated donor sponsorship, Maricar graduated with honors and now serves in rural medical missions.',
      'content' => 'Growing up in a coastal barangay in Cebu, Maricar dreamed of becoming a nurse. With four years of scholarship funding from Rise Above donors, she graduated top of her class and is now actively volunteering in healthcare caravans.',
      'testimonial' => '“Without Rise Above Foundation and the generous donors, my dream of becoming a nurse would not have been possible. Now I give back by treating children in the very barangays where I grew up.”',
      'story_date' => date('Y-m-d', strtotime('-30 days')),
    ],
    [
      'title' => 'Rebuilding Hope: 150 Families Receive Food & Shelter Support in Talisay',
      'category' => 'Disaster Relief',
      'excerpt' => 'Fast-acting emergency response provided dry food packs, clean water, and roofing tarpaulins within 24 hours of the storm.',
      'content' => 'When severe storm surges hit coastal Talisay, the Rise Above emergency response team mobilized warehouse stock immediately. 150 family packs were assembled, loaded, and distributed directly at the evacuation gym.',
      'testimonial' => '“The relief arrived right when we had nothing left. We are deeply grateful to the volunteers and donors for being here with us.”',
      'story_date' => date('Y-m-d', strtotime('-14 days')),
    ],
  ];

  foreach ($seedStories as $st) {
    $stmt = $pdo->prepare('SELECT id FROM success_stories WHERE title = ? LIMIT 1');
    $stmt->execute([$st['title']]);
    if (!$stmt->fetchColumn()) {
      $ins = $pdo->prepare('INSERT INTO success_stories (title, category, excerpt, content, testimonial, story_date) VALUES (?, ?, ?, ?, ?, ?)');
      $ins->execute([$st['title'], $st['category'], $st['excerpt'], $st['content'], $st['testimonial'], $st['story_date']]);
    }
  }

  // Seed Notifications
  $adminUserId = $userIdsByEmail['admin@riseabovefoundation.org'] ?? 1;
  $donorUserId = $userIdsByEmail['donor@riseabovefoundation.org'] ?? null;
  $volUserId = $userIdsByEmail['volunteer@riseabovefoundation.org'] ?? null;
  $benUserId = $userIdsByEmail['beneficiary@riseabovefoundation.org'] ?? null;

  $seedNotifs = [
    ['user_id' => $adminUserId, 'role_target' => 'Admin', 'type' => 'relief_request', 'title' => 'New Urgent Relief Request', 'message' => 'Barangay Poblacion, Talisay submitted a Critical assistance request (AST-80101).', 'link' => '/admin/requests', 'is_read' => 0],
    ['user_id' => $adminUserId, 'role_target' => 'Admin', 'type' => 'donation_received', 'title' => 'Donation Received', 'message' => 'Lisa Tan donated ₱50,000.00 via GCash for Disaster Relief (DON-90102).', 'link' => '/admin/donations', 'is_read' => 0],
    ['user_id' => $donorUserId, 'role_target' => 'Donor', 'type' => 'donation_verified', 'title' => 'Donation Verified', 'message' => 'Your monetary donation DON-90101 of ₱15,000.00 has been verified by accounting.', 'link' => '/donor/donations', 'is_read' => 0],
    ['user_id' => $volUserId, 'role_target' => 'Volunteer', 'type' => 'task_assigned', 'title' => 'New Duty Assignment', 'message' => 'You have been assigned to assist registration at the Talisay Relief Delivery on ' . date('M j, Y', strtotime('+1 days')) . '.', 'link' => '/volunteer-portal/tasks', 'is_read' => 0],
    ['user_id' => $benUserId, 'role_target' => 'Beneficiary', 'type' => 'delivery_scheduled', 'title' => 'Delivery Scheduled', 'message' => 'Your relief delivery (DST-4001) has been scheduled for ' . date('M j, Y', strtotime('+1 days')) . ' at 08:30 AM.', 'link' => '/beneficiary/distributions', 'is_read' => 0],
  ];

  foreach ($seedNotifs as $ntf) {
    if (!$ntf['user_id']) continue;
    $chk = $pdo->prepare('SELECT id FROM notifications WHERE user_id = ? AND title = ? LIMIT 1');
    $chk->execute([$ntf['user_id'], $ntf['title']]);
    if (!$chk->fetchColumn()) {
      $ins = $pdo->prepare('INSERT INTO notifications (user_id, role_target, type, title, message, link, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)');
      $ins->execute([$ntf['user_id'], $ntf['role_target'], $ntf['type'], $ntf['title'], $ntf['message'], $ntf['link'], $ntf['is_read']]);
    }
  }

  if ($pdo->inTransaction()) {
    $pdo->commit();
  }

  echo "\n================================================================\n";
  echo "  DATABASE SEEDING COMPLETED SUCCESSFULLY!\n";
  echo "================================================================\n\n";

  echo "Demo Login Accounts (Password for all accounts is: password123, Admin: admin123):\n";
  echo "  1. Admin Portal:       admin@riseabovefoundation.org       (pass: admin123)\n";
  echo "  2. Staff Portal:       staff@riseabovefoundation.org       (pass: password123)\n";
  echo "  3. Donor Portal:       donor@riseabovefoundation.org       (pass: password123)\n";
  echo "  4. Volunteer Portal:   volunteer@riseabovefoundation.org   (pass: password123)\n";
  echo "  5. Barangay Portal:    beneficiary@riseabovefoundation.org (pass: password123)\n\n";

  echo "Additional Sample Logins:\n";
  echo "  - Admin User:          admin@example.com                   (pass: password123)\n";
  echo "  - Staff User:          patricia.go@riseabovefoundation.org (pass: password123)\n";
  echo "  - Donor (Lisa Tan):    lisa.tan@email.com                  (pass: password123)\n";
  echo "  - Volunteer (Mark R.): mark.rivera@email.com               (pass: password123)\n";
  echo "  - Barangay (Talisay):  brgy.talisay@cebu.gov.ph            (pass: password123)\n";
  echo "  - Barangay (Guadalupe):brgy.guadalupe@cebucity.gov.ph      (pass: password123)\n\n";

} catch (Throwable $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  echo "\n[ERROR] Database seeding failed:\n";
  echo "  " . $e->getMessage() . "\n";
  echo "  File: " . $e->getFile() . " (Line " . $e->getLine() . ")\n\n";
  exit(1);
}
