<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli' && !isset($_GET['force_seed'])) {
    die("This script should be run from the command line: php seed.php\n(Or add ?force_seed=1 to the URL to run in browser)");
}

require_once __DIR__ . '/config.php';
$pdo = db();

echo "Starting Database Seeder...\n";

$password = password_hash('password123', PASSWORD_DEFAULT);

// Helper function to insert ignore
function insertIgnore($pdo, $table, $data) {
    $keys = array_keys($data);
    $fields = implode(', ', $keys);
    $placeholders = implode(', ', array_fill(0, count($keys), '?'));
    $sql = "INSERT IGNORE INTO $table ($fields) VALUES ($placeholders)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($data));
    return $pdo->lastInsertId();
}

try {
    $pdo->beginTransaction();

    // 1. Roles
    echo "Seeding Roles...\n";
    $roles = ['Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary'];
    $roleIds = [];
    foreach ($roles as $role) {
        $stmt = $pdo->prepare("SELECT id FROM roles WHERE name = ?");
        $stmt->execute([$role]);
        $row = $stmt->fetch();
        if ($row) {
            $roleIds[$role] = $row['id'];
        } else {
            $stmt = $pdo->prepare("INSERT INTO roles (name) VALUES (?)");
            $stmt->execute([$role]);
            $roleIds[$role] = $pdo->lastInsertId();
        }
    }

    // 2. Users
    echo "Seeding Users...\n";
    $testUsers = [
        ['role' => 'Admin', 'email' => 'admin@example.com', 'name' => 'Admin User'],
        ['role' => 'Staff', 'email' => 'staff@example.com', 'name' => 'Staff User'],
        ['role' => 'Donor', 'email' => 'donor@example.com', 'name' => 'Donor User'],
        ['role' => 'Volunteer', 'email' => 'volunteer@example.com', 'name' => 'Volunteer User'],
        ['role' => 'Beneficiary', 'email' => 'beneficiary@example.com', 'name' => 'Beneficiary User'],
    ];

    $userIds = [];
    foreach ($testUsers as $u) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$u['email']]);
        $row = $stmt->fetch();
        if ($row) {
            $userIds[$u['role']] = $row['id'];
        } else {
            $stmt = $pdo->prepare("INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, 'ACTIVE')");
            $stmt->execute([$roleIds[$u['role']], $u['name'], $u['email'], $password]);
            $userIds[$u['role']] = $pdo->lastInsertId();
        }
    }

    // 3. Settings (Types)
    echo "Seeding Settings...\n";
    $needs = ['Rice', 'Canned Goods', 'Bottled Water', 'Medicines', 'Clothes', 'Hygiene Kits'];
    foreach ($needs as $i => $n) {
        insertIgnore($pdo, 'need_types', ['label' => $n, 'sort_order' => $i]);
    }

    $barangays = ['Urban', 'Rural', 'Coastal', 'Mountainous'];
    foreach ($barangays as $i => $b) {
        insertIgnore($pdo, 'barangay_types', ['label' => $b, 'sort_order' => $i]);
    }

    $tasks = ['Repacking', 'Driving', 'Distribution', 'Inventory Checks', 'Administrative', 'Cleanup'];
    foreach ($tasks as $i => $t) {
        insertIgnore($pdo, 'task_types', ['label' => $t, 'sort_order' => $i]);
    }

    // 4. Programs
    echo "Seeding Programs...\n";
    $programs = [
        ['slug' => 'typhoon-relief', 'name' => 'Typhoon Relief Program', 'desc' => 'Emergency response for recent typhoons.'],
        ['slug' => 'community-feeding', 'name' => 'Community Feeding', 'desc' => 'Regular feeding programs for vulnerable communities.'],
        ['slug' => 'back-to-school', 'name' => 'Back to School Drive', 'desc' => 'Providing school supplies to students in need.']
    ];
    foreach ($programs as $p) {
        insertIgnore($pdo, 'programs', ['slug' => $p['slug'], 'name' => $p['name'], 'description' => $p['desc']]);
    }

    // 5. Profiles (Donor, Beneficiary, Volunteer)
    echo "Seeding Profiles...\n";
    
    // Donor Profile
    $stmt = $pdo->prepare("SELECT id FROM donors WHERE user_id = ?");
    $stmt->execute([$userIds['Donor']]);
    $donorRow = $stmt->fetch();
    if (!$donorRow) {
        $stmt = $pdo->prepare("INSERT INTO donors (user_id, code, full_name, donor_type, email) VALUES (?, ?, ?, 'Individual', ?)");
        $stmt->execute([$userIds['Donor'], 'DNR-' . rand(1000, 9999), 'Donor User', 'donor@example.com']);
        $donorId = $pdo->lastInsertId();
    } else {
        $donorId = $donorRow['id'];
    }

    // Beneficiary Profile
    $stmt = $pdo->prepare("SELECT id FROM beneficiaries WHERE user_id = ?");
    $stmt->execute([$userIds['Beneficiary']]);
    $benRow = $stmt->fetch();
    if (!$benRow) {
        $stmt = $pdo->prepare("INSERT INTO beneficiaries (user_id, code, full_name, barangay, municipality, affected_families, status) VALUES (?, ?, ?, ?, ?, ?, 'Approved')");
        $stmt->execute([$userIds['Beneficiary'], 'BEN-' . rand(1000, 9999), 'Beneficiary User', 'Sample Barangay', 'Sample Municipality', 50]);
        $beneficiaryId = $pdo->lastInsertId();
    } else {
        $beneficiaryId = $benRow['id'];
    }

    // Volunteer Profile
    $stmt = $pdo->prepare("SELECT id FROM volunteers WHERE user_id = ?");
    $stmt->execute([$userIds['Volunteer']]);
    $volRow = $stmt->fetch();
    if (!$volRow) {
        $stmt = $pdo->prepare("INSERT INTO volunteers (user_id, code, full_name, email, status) VALUES (?, ?, ?, ?, 'Approved')");
        $stmt->execute([$userIds['Volunteer'], 'VOL-' . rand(1000, 9999), 'Volunteer User', 'volunteer@example.com']);
        $volunteerId = $pdo->lastInsertId();
    } else {
        $volunteerId = $volRow['id'];
    }

    // 6. Inventory Items
    echo "Seeding Inventory...\n";
    $inventoryItems = [
        ['code' => 'INV-001', 'name' => 'Sack of Rice (50kg)', 'cat' => 'Food', 'qty' => 100, 'unit' => 'sacks'],
        ['code' => 'INV-002', 'name' => 'Bottled Water (1L)', 'cat' => 'Water', 'qty' => 500, 'unit' => 'bottles'],
        ['code' => 'INV-003', 'name' => 'Canned Sardines', 'cat' => 'Food', 'qty' => 1000, 'unit' => 'cans'],
        ['code' => 'INV-004', 'name' => 'Rice Pack (5kg)', 'cat' => 'Food', 'qty' => 50, 'unit' => 'packs'],
    ];
    $invIds = [];
    foreach ($inventoryItems as $item) {
        $stmt = $pdo->prepare("SELECT id FROM inventory_items WHERE code = ?");
        $stmt->execute([$item['code']]);
        $row = $stmt->fetch();
        if (!$row) {
            $stmt = $pdo->prepare("INSERT INTO inventory_items (code, item_name, category, quantity, unit) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$item['code'], $item['name'], $item['cat'], $item['qty'], $item['unit']]);
            $invIds[$item['code']] = $pdo->lastInsertId();
        } else {
            $invIds[$item['code']] = $row['id'];
        }
    }

    // 7. Donations
    echo "Seeding Donations...\n";
    $stmt = $pdo->prepare("SELECT id FROM donations LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $stmt = $pdo->prepare("INSERT INTO donations (tracking_code, donor_id, donor_name, type, amount, status, donation_date) VALUES (?, ?, ?, 'Monetary', ?, 'Verified', CURDATE())");
        $stmt->execute(['DON-' . rand(1000, 9999), $donorId, 'Donor User', 5000.00]);
        $monetaryId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("INSERT INTO donation_updates (donation_id, stage, note) VALUES (?, 'Received', 'Funds received in bank account')");
        $stmt->execute([$monetaryId]);

        $stmt = $pdo->prepare("INSERT INTO donations (tracking_code, donor_id, donor_name, type, items_description, status, donation_date) VALUES (?, ?, ?, 'In-Kind', ?, 'Pending Verification', CURDATE())");
        $stmt->execute(['DON-' . rand(1000, 9999), $donorId, 'Donor User', '5 boxes of canned goods']);
    }

    // 8. Assistance Requests
    echo "Seeding Assistance Requests...\n";
    $stmt = $pdo->prepare("SELECT id FROM assistance_requests LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $stmt = $pdo->prepare("INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, status, request_date, needs_json) VALUES (?, ?, ?, 'Approved', CURDATE(), ?)");
        $needsJson = json_encode([['item' => 'Rice Pack (5kg)', 'quantity' => 50], ['item' => 'Bottled Water', 'quantity' => 100]]);
        $stmt->execute(['REQ-' . rand(1000, 9999), $beneficiaryId, 'Relief Goods', $needsJson]);
        $requestId = $pdo->lastInsertId();
    } else {
        // Fallback for foreign key usage
        $stmt = $pdo->prepare("SELECT id FROM assistance_requests ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        $requestId = $row ? $row['id'] : null;
    }

    // 9. Repacking Jobs
    echo "Seeding Repacking Jobs...\n";
    $stmt = $pdo->prepare("SELECT id FROM repacking_jobs LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch() && isset($invIds['INV-001'])) {
        $stmt = $pdo->prepare("INSERT INTO repacking_jobs (code, source_item_id, source_items, source_quantity, output_item, output_unit, quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed')");
        $stmt->execute(['REP-' . rand(1000, 9999), $invIds['INV-001'], 'Sack of Rice (50kg)', 5, 'Rice Pack (5kg)', 'packs', 50]);
    }

    // 10. Distributions & Allocations
    echo "Seeding Distributions & Allocations...\n";
    $stmt = $pdo->prepare("SELECT id FROM distributions LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch()) {
        $stmt = $pdo->prepare("INSERT INTO distributions (code, event_name, location, beneficiary_id, program, distribution_date, status) VALUES (?, ?, ?, ?, ?, CURDATE(), 'Scheduled')");
        $stmt->execute(['DST-' . rand(1000, 9999), 'Barangay Relief Drive', 'Sample Barangay Hall', $beneficiaryId, 'Typhoon Relief Program']);
        $distributionId = $pdo->lastInsertId();

        // Allocations
        if ($requestId) {
            $stmt = $pdo->prepare("INSERT INTO allocations (code, resource_name, quantity, distribution_id, assistance_request_id, status, allocation_date) VALUES (?, ?, ?, ?, ?, 'Approved', CURDATE())");
            $stmt->execute(['ALC-' . rand(1000, 9999), 'Rice Pack (5kg)', 50, $distributionId, $requestId]);
            
            $stmt = $pdo->prepare("INSERT INTO allocations (code, resource_name, quantity, distribution_id, assistance_request_id, status, allocation_date) VALUES (?, ?, ?, ?, ?, 'Approved', CURDATE())");
            $stmt->execute(['ALC-' . rand(1000, 9999), 'Bottled Water (1L)', 100, $distributionId, $requestId]);
        }
    } else {
        $stmt = $pdo->prepare("SELECT id FROM distributions ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        $distributionId = $row ? $row['id'] : null;
    }

    // 11. Tasks
    echo "Seeding Tasks...\n";
    $stmt = $pdo->prepare("SELECT id FROM tasks LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch() && $distributionId) {
        $stmt = $pdo->prepare("INSERT INTO tasks (code, title, assignee_user_id, distribution_id, board_column) VALUES (?, ?, ?, ?, 'todo')");
        $stmt->execute(['TSK-' . rand(1000, 9999), 'Load truck with relief goods', $userIds['Staff'], $distributionId]);

        $stmt = $pdo->prepare("INSERT INTO tasks (code, title, assignee_user_id, distribution_id, board_column) VALUES (?, ?, ?, ?, 'inProgress')");
        $stmt->execute(['TSK-' . rand(1000, 9999), 'Coordinate with local officials', $userIds['Volunteer'], $distributionId]);
    }
    
    // 12. Volunteer Schedule
    echo "Seeding Volunteer Schedule...\n";
    $stmt = $pdo->prepare("SELECT id FROM volunteer_schedule LIMIT 1");
    $stmt->execute();
    if (!$stmt->fetch() && isset($volunteerId)) {
        $stmt = $pdo->prepare("INSERT INTO volunteer_schedule (volunteer_id, event_date, event_title, event_time) VALUES (?, CURDATE(), ?, ?)");
        $stmt->execute([$volunteerId, 'Barangay Relief Drive', '08:00 AM']);
    }

    $pdo->commit();
    echo "Seeding completed successfully!\n";
    echo "Default Password for seeded users: password123\n";

} catch (Exception $e) {
    $pdo->rollBack();
    echo "Error during seeding: " . $e->getMessage() . "\n";
}
