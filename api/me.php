<?php
declare(strict_types=1);
require __DIR__ . '/cors.php';
require __DIR__ . '/config.php';

session_start();

$user = $_SESSION['user'] ?? null;
if (!$user) {
  json_response(['ok' => false, 'user' => null], 200);
}

json_response(['ok' => true, 'user' => $user], 200);

