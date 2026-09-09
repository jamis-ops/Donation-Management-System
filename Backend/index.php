<?php
declare(strict_types=1);

/**
 * Rise Above Foundation Cebu — API Entrypoint
 * Provides a clean status response when the base backend URL is requested.
 */
require_once __DIR__ . '/api/cors.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo json_encode([
  'status' => 'ok',
  'service' => 'Rise Above Foundation Cebu — Backend API',
  'health' => '/api/health.php',
  'timestamp' => date('c'),
]);
exit;
