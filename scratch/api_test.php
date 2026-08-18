<?php
require __DIR__ . '/../api/bootstrap.php';
$pdo = db();

$pdo->query("DELETE FROM users WHERE email='testbarangay@gmail.com'");
$pdo->query("DELETE FROM beneficiaries WHERE representative_email='testbarangay@gmail.com'");

function callApi($action, $payload) {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nCookie: XDEBUG_SESSION=1\r\n",
            'content' => json_encode(array_merge(['action' => $action], $payload))
        ]
    ]);
    return file_get_contents('http://localhost/api/beneficiaries.php', false, $context);
}

// 1. Admin sends invitation
// To bypass authentication, we can just insert it manually or hack bootstrap.php
$code = generate_code('BEN');
$token = bin2hex(random_bytes(16));
$expires = date('Y-m-d H:i:s', strtotime('+7 days'));
$stmt = $pdo->prepare('
INSERT INTO beneficiaries (code, full_name, barangay, municipality, representative_email, invitation_token, invitation_expires, invitation_status, status)
VALUES (?, ?, ?, ?, ?, ?, ?, "invited", "Pending Approval")
');
$stmt->execute([$code, 'Test Barangay', 'Test Barangay', 'Test City', 'testbarangay@gmail.com', $token, $expires]);
$benId = (int) $pdo->lastInsertId();

// 2. Barangay receives the invitation -> uses the same email to fill out the registration form
echo "Calling apply_invite...\n";
$res2 = callApi('apply_invite', [
    'token' => $token,
    'barangay' => 'Test Barangay',
    'municipality' => 'Test City',
    'representativeLastName' => 'Doe',
    'representativeFirstName' => 'John',
    'representativePosition' => 'Captain',
    'contactNumber' => '09123456789',
    'email' => 'testbarangay@gmail.com',
    'acceptTerms' => true
]);
echo "apply_invite result: $res2\n\n";

// 3. Admin reviews and approves the registration
echo "Calling approve...\n";
// This will require auth unless we bypass it.
// Let's just bypass auth for the test by creating a quick wrapper
file_put_contents('test_approve.php', '<?php $_SERVER["REQUEST_METHOD"]="POST"; require "api/bootstrap.php"; $body=["action"=>"approve"]; $action="approve"; $id=' . $benId . '; $pdo=db(); $stmt = $pdo->prepare("SELECT * FROM beneficiaries WHERE id = ? LIMIT 1"); $stmt->execute([$id]); $ben = $stmt->fetch(); $provision = provision_beneficiary_account($pdo, $ben, null); echo json_encode($provision);');
$res3 = file_get_contents('http://localhost/scratch/test_approve.php');
echo "approve result: $res3\n";
unlink('test_approve.php');
