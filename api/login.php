<?php
declare(strict_types=1);
require __DIR__ . '/cors.php';
require __DIR__ . '/config.php';

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');

if ($email === '' || $password === '') {
  json_response(['ok' => false, 'error' => 'Email and password are required'], 400);
}

$pdo = db();
$stmt = $pdo->prepare("
  SELECT u.id, u.full_name, u.email, u.password_hash, u.status, r.name AS role
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.email = ?
  LIMIT 1
");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
  json_response(['ok' => false, 'error' => 'Invalid email or password'], 401);
}

if ($user['status'] === 'PENDING') {
  json_response(['ok' => false, 'error' => 'Please verify your email before signing in. Check your inbox for the verification link.'], 403);
}
if ($user['status'] !== 'ACTIVE') {
  json_response(['ok' => false, 'error' => 'This account is not active. Please contact the administrator.'], 403);
}

if (!password_verify($password, $user['password_hash'])) {
  json_response(['ok' => false, 'error' => 'Invalid email or password'], 401);
}

$_SESSION['user'] = [
  'id' => $user['id'],
  'name' => $user['full_name'],
  'email' => $user['email'],
  'role' => $user['role'],
];

json_response(['ok' => true, 'user' => $_SESSION['user']]);

