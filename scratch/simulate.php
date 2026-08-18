<?php
require __DIR__ . '/../api/bootstrap.php';
$pdo = db();

// Clean up
$pdo->query("DELETE FROM users WHERE email='testbarangay@gmail.com'");
$pdo->query("DELETE FROM beneficiaries WHERE representative_email='testbarangay@gmail.com'");

echo "Starting simulation...\n";

// STEP 1: Admin invites
$body = [
    'action' => 'invite',
    'barangay' => 'Test Barangay',
    'municipality' => 'Test City',
    'email' => 'testbarangay@gmail.com'
];
$_POST = [];
// Mock read_json_body by overriding the global body variable if possible, or just calling the logic directly
// Actually, it's easier to just call the API endpoint via file_get_contents on localhost
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode($body)
    ]
]);
// We need to bypass auth for the test or just use the internal logic.
// Let's just execute the internal logic.
$code = generate_code('BEN');
$token = bin2hex(random_bytes(16));
$expires = date('Y-m-d H:i:s', strtotime('+7 days'));
$stmt = $pdo->prepare('
INSERT INTO beneficiaries (code, full_name, barangay, municipality, representative_email, invitation_token, invitation_expires, invitation_status, status)
VALUES (?, ?, ?, ?, ?, ?, ?, "invited", "Pending Approval")
');
$stmt->execute([$code, 'Test Barangay', 'Test Barangay', 'Test City', 'testbarangay@gmail.com', $token, $expires]);
$benId = (int) $pdo->lastInsertId();
echo "Step 1: Invite created. Ben ID: $benId\n";

// STEP 2: Barangay fills out form
$body = [
    'action' => 'apply_invite',
    'token' => $token,
    'barangay' => 'Test Barangay',
    'municipality' => 'Test City',
    'representativeLastName' => 'Doe',
    'representativeFirstName' => 'John',
    'representativePosition' => 'Captain',
    'contactNumber' => '09123456789',
    'email' => 'testbarangay@gmail.com',
    'acceptTerms' => true
];
$pdo->prepare('
UPDATE beneficiaries SET
  full_name = ?, barangay = ?, municipality = ?,
  representative_name = ?, representative_first_name = ?, representative_last_name = ?,
  representative_position = ?, representative_phone = ?,
  representative_email = ?, status = "Pending Approval", invitation_status = "applied"
WHERE id = ?
')->execute([
  'Test Barangay', 'Test Barangay', 'Test City',
  'John Doe', 'John', 'Doe', 'Captain', '09123456789', 'testbarangay@gmail.com', $benId
]);
echo "Step 2: Form filled out.\n";

// STEP 3: Admin approves
$stmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE id = ?');
$stmt->execute([$benId]);
$ben = $stmt->fetch();

// This is exactly what happens in api/beneficiaries.php on approve
$inviteStatus = (string) ($ben['invitation_status'] ?? '');
if (!empty($ben['user_id']) || $inviteStatus === 'accepted' || in_array((string) ($ben['status'] ?? ''), ['Active', 'Approved'], true)) {
    echo "ERROR: This barangay is already registered and approved.\n";
} else {
    $provision = provision_beneficiary_account($pdo, $ben, null);
    echo "Step 3: Provision result: " . json_encode($provision, JSON_PRETTY_PRINT) . "\n";
}

// See if the user exists
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute(['testbarangay@gmail.com']);
$user = $stmt->fetch();
echo "User in DB: " . ($user ? "Yes (ID: {$user['id']}, Role: {$user['role_id']})" : "No") . "\n";
