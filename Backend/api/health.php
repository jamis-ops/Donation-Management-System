<?php
declare(strict_types=1);

/**
 * Health Check Endpoint for Render / Uptime Monitoring
 * Returns simple JSON status without exposing sensitive environment variables or secrets.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

http_response_code(200);
echo json_encode([
  'status' => 'ok',
  'service' => 'Rise Above Foundation API',
  'timestamp' => date('c'),
]);
exit;
