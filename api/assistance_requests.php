<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();
$action = $_GET['action'] ?? $id ? null : ($_POST['action'] ?? null);

// Parse action from query string for GET requests
if ($method === 'GET' && !empty($_GET['action'])) {
  $action = $_GET['action'];
}

function ensure_request_columns(PDO $pdo): void
{
  static $done = false;
  if ($done) {
    return;
  }
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN needs_json TEXT NULL AFTER notes'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN calamity_tags TEXT NULL AFTER needs_json'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN sla_deadline DATETIME NULL AFTER calamity_tags'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN is_emergency TINYINT(1) NOT NULL DEFAULT 0 AFTER sla_deadline'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN assigned_to VARCHAR(120) NULL AFTER is_emergency'); } catch (Throwable $e) {}
  $done = true;
}

function encode_request_needs($needs): ?string
{
  if (!is_array($needs) || count($needs) === 0) {
    return null;
  }
  $clean = array_values(array_filter(array_map('strval', $needs), fn($n) => trim($n) !== ''));
  return count($clean) > 0 ? json_encode($clean) : null;
}

function map_request(array $row, string $beneficiaryName, ?array $extra = null): array
{
  $mapped = [
    'id' => $row['reference_code'],
    'dbId' => (int) $row['id'],
    'beneficiary' => $beneficiaryName,
    'beneficiaryId' => (int) $row['beneficiary_id'],
    'type' => $row['assistance_type'],
    'status' => $row['status'],
    'date' => format_date($row['request_date']),
    'requestDate' => $row['request_date'],
    'priority' => $row['priority'],
    'notes' => $row['notes'],
    'needs' => [],
    'isEmergency' => !empty($row['is_emergency']),
    'calamityTags' => [],
    'assignedTo' => $row['assigned_to'] ?? null,
    'slaDeadline' => $row['sla_deadline'] ?? null,
    'createdAt' => $row['created_at'] ?? $row['request_date'],
  ];
  // Calamity tags
  if (!empty($row['calamity_tags'])) {
    $decoded = json_decode((string) $row['calamity_tags'], true);
    if (is_array($decoded)) {
      $mapped['calamityTags'] = $decoded;
    }
  }
  if (!empty($row['needs_json'])) {
    $decodedNeeds = json_decode((string) $row['needs_json'], true);
    if (is_array($decodedNeeds)) {
      $mapped['needs'] = array_values(array_filter(array_map('strval', $decodedNeeds)));
    }
  }
  // SLA status computation
  if (!empty($row['sla_deadline']) && !in_array($row['status'], ['Completed', 'Rejected'], true)) {
    $deadline = strtotime($row['sla_deadline']);
    $now = time();
    if ($deadline) {
      $remaining = $deadline - $now;
      $total = $deadline - strtotime($row['created_at'] ?? $row['request_date']);
      if ($remaining <= 0) {
        $mapped['slaStatus'] = 'overdue';
        $mapped['slaOverdueSeconds'] = abs($remaining);
      } elseif ($total > 0 && ($remaining / $total) < 0.5) {
        $mapped['slaStatus'] = 'approaching';
        $mapped['slaRemainingSeconds'] = $remaining;
      } else {
        $mapped['slaStatus'] = 'on_track';
        $mapped['slaRemainingSeconds'] = $remaining;
      }
    }
  }
  // Extra data (beneficiary details, etc.)
  if ($extra) {
    $mapped = array_merge($mapped, $extra);
  }
  return $mapped;
}

if ($method === 'GET') {
  $user = require_auth(['Admin', 'Staff', 'Beneficiary']);

  // ── Stats endpoint ──
  if ($action === 'stats') {
    $total = (int) $pdo->query('SELECT COUNT(*) FROM assistance_requests')->fetchColumn();
    $byStatus = [];
    $statusStmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM assistance_requests GROUP BY status");
    foreach ($statusStmt->fetchAll() as $r) {
      $byStatus[$r['status']] = (int) $r['cnt'];
    }
    $criticalCount = (int) $pdo->query("SELECT COUNT(*) FROM assistance_requests WHERE priority = 'Critical' AND status NOT IN ('Completed','Rejected')")->fetchColumn();
    $overdueCount = (int) $pdo->query("SELECT COUNT(*) FROM assistance_requests WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('Completed','Rejected')")->fetchColumn();
    json_response([
      'ok' => true,
      'data' => [
        'total' => $total,
        'byStatus' => $byStatus,
        'criticalCount' => $criticalCount,
        'overdueCount' => $overdueCount,
      ],
    ]);
  }

  // ── Duplicate check endpoint ──
  if ($action === 'check_duplicates') {
    $benId = (int) ($_GET['beneficiary_id'] ?? 0);
    $aType = $_GET['assistance_type'] ?? '';
    $excludeId = (int) ($_GET['exclude_id'] ?? 0);
    $dupes = [];
    if ($benId > 0) {
      $q = "SELECT ar.*, b.full_name AS beneficiary_name FROM assistance_requests ar JOIN beneficiaries b ON b.id = ar.beneficiary_id WHERE ar.beneficiary_id = ? AND ar.priority = 'Critical' AND ar.status NOT IN ('Completed','Rejected')";
      $params = [$benId];
      if ($excludeId > 0) {
        $q .= ' AND ar.id != ?';
        $params[] = $excludeId;
      }
      if ($aType !== '') {
        $q .= ' AND ar.assistance_type = ?';
        $params[] = $aType;
      }
      $stmt = $pdo->prepare($q);
      $stmt->execute($params);
      foreach ($stmt->fetchAll() as $r) {
        $dupes[] = map_request($r, $r['beneficiary_name']);
      }
    }
    json_response(['ok' => true, 'data' => $dupes]);
  }

  // ── Tracker endpoint ──
  if ($action === 'tracker') {
    $reqId = (int) ($_GET['request_id'] ?? $id ?? 0);
    if ($reqId <= 0) {
      json_response(['ok' => false, 'error' => 'request_id is required'], 400);
    }
    $req = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ?');
    $req->execute([$reqId]);
    $reqRow = $req->fetch();
    if (!$reqRow) {
      json_response(['ok' => false, 'error' => 'Request not found'], 404);
    }

    $stages = [];
    $stages[] = ['stage' => 'submitted', 'label' => 'Request Submitted', 'status' => 'completed', 'timestamp' => $reqRow['created_at'] ?? $reqRow['request_date'], 'gate' => false];

    // Reviewed
    if (in_array($reqRow['status'], ['Under Review', 'Approved', 'Allocated', 'Completed'], true)) {
      $stages[] = ['stage' => 'reviewed', 'label' => 'Request Reviewed', 'status' => 'completed', 'timestamp' => null, 'gate' => true];
    } elseif ($reqRow['status'] === 'Rejected') {
      $stages[] = ['stage' => 'reviewed', 'label' => 'Request Reviewed', 'status' => 'completed', 'timestamp' => null, 'gate' => true];
    } else {
      $stages[] = ['stage' => 'reviewed', 'label' => 'Request Reviewed', 'status' => $reqRow['status'] === 'Under Review' ? 'current' : 'pending', 'timestamp' => null, 'gate' => true];
    }

    // Approved
    if ($reqRow['status'] === 'Rejected') {
      $stages[] = ['stage' => 'approved', 'label' => 'Rejected', 'status' => 'rejected', 'timestamp' => null, 'gate' => true];
      json_response(['ok' => true, 'data' => $stages]);
    } elseif (in_array($reqRow['status'], ['Approved', 'Allocated', 'Completed'], true)) {
      $stages[] = ['stage' => 'approved', 'label' => 'Request Approved', 'status' => 'completed', 'timestamp' => null, 'gate' => true];
    } else {
      $stages[] = ['stage' => 'approved', 'label' => 'Request Approved', 'status' => 'pending', 'timestamp' => null, 'gate' => true];
      json_response(['ok' => true, 'data' => $stages]);
    }

    // Allocated — check for linked allocations
    $alloc = $pdo->prepare('SELECT id, distribution_id, status FROM allocations WHERE assistance_request_id = ? ORDER BY id ASC LIMIT 1');
    $alloc->execute([$reqId]);
    $allocRow = $alloc->fetch();
    if ($allocRow) {
      $stages[] = ['stage' => 'allocated', 'label' => 'Allocation Completed', 'status' => 'completed', 'timestamp' => null, 'gate' => false];

      // Check distribution
      $distId = $allocRow['distribution_id'] ?? null;
      if ($distId) {
        $dist = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
        $dist->execute([$distId]);
        $distRow = $dist->fetch();
        if ($distRow) {
          $dStatus = $distRow['status'] ?? 'Planning';
          // Scheduled
          if (in_array($dStatus, ['Preparing', 'In Transit', 'Delivered', 'Awaiting Proof', 'Completed'], true)) {
            $stages[] = ['stage' => 'scheduled', 'label' => 'Distribution Scheduled', 'status' => 'completed', 'timestamp' => $distRow['distribution_date'], 'gate' => false];
          } elseif ($dStatus === 'Planning') {
            $stages[] = ['stage' => 'scheduled', 'label' => 'Distribution Scheduled', 'status' => 'current', 'timestamp' => null, 'gate' => false];
            json_response(['ok' => true, 'data' => $stages]);
          } else {
            $stages[] = ['stage' => 'scheduled', 'label' => 'Distribution Scheduled', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
          }
          // Dispatched
          if (in_array($dStatus, ['In Transit', 'Delivered', 'Awaiting Proof', 'Completed'], true)) {
            $stages[] = ['stage' => 'dispatched', 'label' => 'Resources Dispatched', 'status' => 'completed', 'timestamp' => null, 'gate' => false];
          } elseif ($dStatus === 'Preparing') {
            $stages[] = ['stage' => 'dispatched', 'label' => 'Resources Dispatched', 'status' => 'current', 'timestamp' => null, 'gate' => false];
            json_response(['ok' => true, 'data' => $stages]);
          } else {
            $stages[] = ['stage' => 'dispatched', 'label' => 'Resources Dispatched', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
          }
          // Confirmed
          $receiptStatus = $distRow['receipt_status'] ?? 'Awaiting Confirmation';
          if ($receiptStatus === 'Received' || $dStatus === 'Completed') {
            $stages[] = ['stage' => 'confirmed', 'label' => 'Barangay Confirms Receipt', 'status' => 'completed', 'timestamp' => $distRow['received_at'], 'gate' => false];
          } elseif (in_array($dStatus, ['Delivered', 'Awaiting Proof'], true)) {
            $stages[] = ['stage' => 'confirmed', 'label' => 'Barangay Confirms Receipt', 'status' => 'current', 'timestamp' => null, 'gate' => false];
            // Verified + Completed still pending
            $stages[] = ['stage' => 'verified', 'label' => 'Admin Verifies Receipt', 'status' => 'pending', 'timestamp' => null, 'gate' => true];
            $stages[] = ['stage' => 'completed', 'label' => 'Completed', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
            json_response(['ok' => true, 'data' => $stages]);
          } else {
            $stages[] = ['stage' => 'confirmed', 'label' => 'Barangay Confirms Receipt', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
          }
          // Verified
          $proofStatus = $distRow['proof_status'] ?? 'Not Required';
          if ($proofStatus === 'Proof Verified' || $dStatus === 'Completed') {
            $stages[] = ['stage' => 'verified', 'label' => 'Admin Verifies Receipt', 'status' => 'completed', 'timestamp' => null, 'gate' => true];
          } else {
            $stages[] = ['stage' => 'verified', 'label' => 'Admin Verifies Receipt', 'status' => $receiptStatus === 'Received' ? 'current' : 'pending', 'timestamp' => null, 'gate' => true];
            $stages[] = ['stage' => 'completed', 'label' => 'Completed', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
            json_response(['ok' => true, 'data' => $stages]);
          }
          // Completed
          if ($dStatus === 'Completed') {
            $stages[] = ['stage' => 'completed', 'label' => 'Completed', 'status' => 'completed', 'timestamp' => null, 'gate' => false];
          } else {
            $stages[] = ['stage' => 'completed', 'label' => 'Completed', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
          }
        }
      } else {
        // Allocation exists but no distribution yet
        $stages[] = ['stage' => 'scheduled', 'label' => 'Distribution Scheduled', 'status' => 'pending', 'timestamp' => null, 'gate' => false];
      }
    } else {
      // No allocation yet
      $stages[] = ['stage' => 'allocated', 'label' => 'Allocation Completed', 'status' => $reqRow['status'] === 'Approved' ? 'current' : 'pending', 'timestamp' => null, 'gate' => false];
    }

    json_response(['ok' => true, 'data' => $stages]);
  }

  if (strcasecmp((string) ($user['role'] ?? ''), 'Beneficiary') === 0) {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $benId = (int) $ben->fetchColumn();
    if ($benId <= 0 && !empty($user['email'])) {
      $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE LOWER(representative_email) = LOWER(?) LIMIT 1');
      $ben->execute([(string) $user['email']]);
      $benId = (int) $ben->fetchColumn();
    }
    if ($benId <= 0) {
      json_response(['ok' => true, 'data' => []]);
    }
    $stmt = $pdo->prepare('
      SELECT ar.*, b.full_name AS beneficiary_name
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.beneficiary_id = ?
      ORDER BY FIELD(ar.priority,"Critical","High","Medium","Low"), ar.request_date DESC
    ');
    $stmt->execute([$benId]);
  } else {
    // Keep Relief queue in sync: any request with allocations should be Allocated
    try {
      $pdo->exec("
        UPDATE assistance_requests ar
        SET ar.status = 'Allocated'
        WHERE ar.status NOT IN ('Allocated', 'Completed', 'Rejected', 'Cancelled')
          AND EXISTS (
            SELECT 1 FROM allocations a
            WHERE a.assistance_request_id = ar.id
          )
      ");
    } catch (Throwable $e) {
      // best-effort sync
    }

    $stmt = $pdo->query('
      SELECT ar.*, b.full_name AS beneficiary_name
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      ORDER BY FIELD(ar.priority,"Critical","High","Medium","Low"), ar.request_date ASC
    ');
  }

  $rows = $stmt->fetchAll();

  // Enrich with beneficiary data
  $benCache = [];
  $enriched = array_map(function ($r) use ($pdo, &$benCache) {
    $benId = (int) $r['beneficiary_id'];
    if (!isset($benCache[$benId])) {
      $b = $pdo->prepare('SELECT affected_families, municipality, representative_name FROM beneficiaries WHERE id = ? LIMIT 1');
      $b->execute([$benId]);
      $benCache[$benId] = $b->fetch() ?: [];
    }
    $extra = [
      'affectedFamilies' => (int) ($benCache[$benId]['affected_families'] ?? 0),
      'municipality' => $benCache[$benId]['municipality'] ?? '',
      'representativeName' => $benCache[$benId]['representative_name'] ?? '',
    ];
    return map_request($r, $r['beneficiary_name'], $extra);
  }, $rows);

  json_response(['ok' => true, 'data' => $enriched]);
}

if ($method === 'POST') {
  $body = read_json_body();

  // Handle action-based POST
  if (!empty($body['action']) && $body['action'] === 'pin') {
    require_auth(['Admin', 'Staff']);
    $pinId = (int) ($body['requestId'] ?? $body['request_id'] ?? $id ?? 0);
    if ($pinId <= 0) {
      json_response(['ok' => false, 'error' => 'Request ID is required'], 400);
    }
    try {
      $pdo->prepare('UPDATE assistance_requests SET is_emergency = 1 WHERE id = ?')->execute([$pinId]);
    } catch (Throwable $e) {
      // is_emergency column may not exist yet
    }
    json_response(['ok' => true]);
  }

  $public = !empty($body['public']);
  $user = $public ? null : require_auth(['Admin', 'Staff', 'Beneficiary']);

  $beneficiaryId = (int) ($body['beneficiaryId'] ?? $body['beneficiary_id'] ?? 0);
  if ($user && strcasecmp((string) ($user['role'] ?? ''), 'Beneficiary') === 0) {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $beneficiaryId = (int) $ben->fetchColumn();
    if ($beneficiaryId <= 0 && !empty($user['email'])) {
      $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE LOWER(representative_email) = LOWER(?) LIMIT 1');
      $ben->execute([(string) $user['email']]);
      $beneficiaryId = (int) $ben->fetchColumn();
    }
  }

  // Public form: find matching partner barangay (NO auto-creation)
  if ($beneficiaryId <= 0 && $public) {
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $barangay = trim((string) ($body['barangay'] ?? $body['address'] ?? ''));

    if ($email !== '' && $barangay !== '') {
      $find = $pdo->prepare('
        SELECT id FROM beneficiaries
        WHERE LOWER(representative_email) = ?
          AND (
            LOWER(barangay) = LOWER(?)
            OR LOWER(full_name) = LOWER(?)
            OR LOWER(address) = LOWER(?)
          )
        ORDER BY id ASC
        LIMIT 1
      ');
      $find->execute([$email, $barangay, $barangay, $barangay]);
      $foundId = (int) $find->fetchColumn();
      if ($foundId > 0) {
        $beneficiaryId = $foundId;
      }
    }

    // Do NOT auto-create barangay records from public intake
    if ($beneficiaryId <= 0) {
      json_response([
        'ok' => false,
        'error' => 'No matching partner barangay found. Please contact Rise Above Foundation for partnership inquiries, or nominate a barangay at /assistance.',
      ], 400);
    }
  }

  if ($beneficiaryId <= 0) {
    json_response(['ok' => false, 'error' => 'Beneficiary is required'], 400);
  }

  $type = trim((string) ($body['type'] ?? $body['assistanceType'] ?? $body['assistance_type'] ?? ''));
  if ($type === '') {
    json_response(['ok' => false, 'error' => 'Assistance type is required'], 400);
  }

  $notes = $body['notes'] ?? $body['description'] ?? null;
  $ref = generate_code('AST');
  $priority = in_array($body['priority'] ?? 'Medium', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Medium';

  // Compute SLA deadline
  $slaHours = ['Critical' => 4, 'High' => 24, 'Medium' => 72, 'Low' => 168];
  $slaDeadline = date('Y-m-d H:i:s', time() + ($slaHours[$priority] ?? 72) * 3600);

  // Calamity tags
  $calamityTags = null;
  if (!empty($body['calamityTags']) && is_array($body['calamityTags'])) {
    $calamityTags = json_encode(array_values(array_map('strval', $body['calamityTags'])));
  }

  ensure_request_columns($pdo);
  $needsJson = array_key_exists('needs', $body) ? encode_request_needs($body['needs']) : null;

  $stmt = $pdo->prepare('INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, status, priority, request_date, notes, needs_json, calamity_tags, sla_deadline, is_emergency, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $ref,
    $beneficiaryId,
    $type,
    $public ? 'Pending Review' : ($body['status'] ?? 'Pending Review'),
    $priority,
    $body['requestDate'] ?? date('Y-m-d'),
    $notes,
    $needsJson,
    $calamityTags,
    $slaDeadline,
    !empty($body['isEmergency']) ? 1 : 0,
    $body['assignedTo'] ?? null,
  ]);

  $newId = (int) $pdo->lastInsertId();

  notify_admins(
    $pdo,
    'assistance',
    $priority === 'Critical' ? '🚨 Critical assistance request' : 'New assistance request',
    "Assistance request {$ref} submitted" . ($priority === 'Critical' ? ' — CRITICAL PRIORITY' : ''),
    '/admin/requests'
  );

  $stmt = $pdo->prepare('
    SELECT ar.*, b.full_name AS beneficiary_name
    FROM assistance_requests ar
    JOIN beneficiaries b ON b.id = ar.beneficiary_id
    WHERE ar.id = ?
  ');
  $stmt->execute([$newId]);
  $row = $stmt->fetch();
  json_response([
    'ok' => true,
    'data' => map_request($row, $row['beneficiary_name']),
    'trackingCode' => $ref,
  ], 201);
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);
$isBeneficiary = strcasecmp((string) ($user['role'] ?? ''), 'Beneficiary') === 0;
$beneficiaryOwnedId = 0;
if ($isBeneficiary) {
  $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE user_id = ? LIMIT 1');
  $ben->execute([$user['id']]);
  $beneficiaryOwnedId = (int) $ben->fetchColumn();
  // Fallback: match by login email to representative email when user_id is not linked yet
  if ($beneficiaryOwnedId <= 0 && !empty($user['email'])) {
    $ben = $pdo->prepare('SELECT id FROM beneficiaries WHERE LOWER(representative_email) = LOWER(?) LIMIT 1');
    $ben->execute([(string) $user['email']]);
    $beneficiaryOwnedId = (int) $ben->fetchColumn();
    if ($beneficiaryOwnedId > 0) {
      try {
        $pdo->prepare('UPDATE beneficiaries SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = 0)')
          ->execute([(int) $user['id'], $beneficiaryOwnedId]);
      } catch (Throwable $e) {
        // best-effort link
      }
    }
  }
}

$body = read_json_body();

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Request id is required'], 400);
  }

  // Staff/admin-only pin/assign actions
  $putAction = $body['action'] ?? null;
  if (in_array($putAction, ['pin', 'unpin', 'assign'], true)) {
    if ($isBeneficiary) {
      json_response(['ok' => false, 'error' => 'You do not have permission for this action.'], 403);
    }
    if ($putAction === 'pin') {
      try {
        $pdo->prepare('UPDATE assistance_requests SET is_emergency = 1 WHERE id = ?')->execute([$id]);
      } catch (Throwable $e) {}
      json_response(['ok' => true]);
    }
    if ($putAction === 'unpin') {
      try {
        $pdo->prepare('UPDATE assistance_requests SET is_emergency = 0 WHERE id = ?')->execute([$id]);
      } catch (Throwable $e) {}
      json_response(['ok' => true]);
    }
    if ($putAction === 'assign') {
      $assignedTo = $body['assignedTo'] ?? null;
      try {
        $pdo->prepare('UPDATE assistance_requests SET assigned_to = ? WHERE id = ?')->execute([$assignedTo, $id]);
      } catch (Throwable $e) {}
      json_response(['ok' => true]);
    }
  }

  $stmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Request not found'], 404);
  }

  if ($isBeneficiary) {
    if ($beneficiaryOwnedId <= 0 || (int) $existing['beneficiary_id'] !== $beneficiaryOwnedId) {
      json_response(['ok' => false, 'error' => 'You can only edit your own requests.'], 403);
    }
    if (in_array($existing['status'], ['Completed', 'Rejected', 'Cancelled'], true)) {
      json_response(['ok' => false, 'error' => 'This request can no longer be edited.'], 400);
    }
  }

  $newPriority = in_array($body['priority'] ?? $existing['priority'], ['Low', 'Medium', 'High', 'Critical'], true)
    ? ($body['priority'] ?? $existing['priority'])
    : $existing['priority'];

  // Recalculate SLA if priority changes
  $slaDeadline = $existing['sla_deadline'] ?? null;
  if (($body['priority'] ?? null) !== null && ($body['priority'] ?? '') !== ($existing['priority'] ?? '')) {
    $slaHours = ['Critical' => 4, 'High' => 24, 'Medium' => 72, 'Low' => 168];
    $createdAt = strtotime($existing['created_at'] ?? $existing['request_date']);
    $slaDeadline = date('Y-m-d H:i:s', $createdAt + ($slaHours[$newPriority] ?? 72) * 3600);
  }

  // Calamity tags
  $calamityTags = $existing['calamity_tags'] ?? null;
  if (array_key_exists('calamityTags', $body)) {
    if (is_array($body['calamityTags']) && count($body['calamityTags']) > 0) {
      $calamityTags = json_encode(array_values(array_map('strval', $body['calamityTags'])));
    } else {
      $calamityTags = null;
    }
  }

  // Beneficiaries may update content fields only — status stays as-is
  $newStatus = $isBeneficiary
    ? $existing['status']
    : ($body['status'] ?? $existing['status']);
  $newEmergency = $isBeneficiary
    ? ($existing['is_emergency'] ?? 0)
    : (isset($body['isEmergency']) ? ($body['isEmergency'] ? 1 : 0) : ($existing['is_emergency'] ?? 0));
  $newAssigned = $isBeneficiary
    ? ($existing['assigned_to'] ?? null)
    : ($body['assignedTo'] ?? ($existing['assigned_to'] ?? null));

  ensure_request_columns($pdo);
  $needsJson = array_key_exists('needs', $body)
    ? encode_request_needs($body['needs'])
    : ($existing['needs_json'] ?? null);

  $update = $pdo->prepare('UPDATE assistance_requests SET assistance_type = ?, status = ?, priority = ?, notes = ?, needs_json = ?, calamity_tags = ?, sla_deadline = ?, is_emergency = ?, assigned_to = ? WHERE id = ?');
  $update->execute([
    $body['type'] ?? $existing['assistance_type'],
    $newStatus,
    $newPriority,
    $body['notes'] ?? $existing['notes'],
    $needsJson,
    $calamityTags,
    $slaDeadline,
    $newEmergency,
    $newAssigned,
    $id,
  ]);

  if (!$isBeneficiary && $newStatus !== $existing['status']) {
    if ($newStatus === 'Approved') {
      notify_admins($pdo, 'status_update', 'Assistance request approved', "Request {$existing['reference_code']} has been approved", '/admin/requests');
    } elseif ($newStatus === 'Rejected') {
      notify_admins($pdo, 'status_update', 'Assistance request rejected', "Request {$existing['reference_code']} was rejected", '/admin/requests');
    } elseif ($newStatus === 'Completed') {
      notify_admins($pdo, 'status_update', 'Assistance request completed', "Request {$existing['reference_code']} is complete", '/admin/requests');
    }
    notify_request_lifecycle($pdo, (int) $id, (string) $newStatus, (string) ($existing['status'] ?? ''));
  }

  if ($isBeneficiary) {
    notify_admins(
      $pdo,
      'assistance',
      'Assistance request updated',
      "Barangay updated request {$existing['reference_code']}",
      '/admin/requests'
    );
  }

  $stmt = $pdo->prepare('
    SELECT ar.*, b.full_name AS beneficiary_name
    FROM assistance_requests ar
    JOIN beneficiaries b ON b.id = ar.beneficiary_id
    WHERE ar.id = ?
  ');
  $stmt->execute([$id]);
  $row = $stmt->fetch();
  json_response(['ok' => true, 'data' => map_request($row, $row['beneficiary_name'])]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Request id is required'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Request not found'], 404);
  }

  if ($isBeneficiary) {
    if ($beneficiaryOwnedId <= 0 || (int) $existing['beneficiary_id'] !== $beneficiaryOwnedId) {
      json_response(['ok' => false, 'error' => 'You can only cancel your own requests.'], 403);
    }
    if (!in_array($existing['status'], ['Pending Review', 'Under Review'], true)) {
      json_response(['ok' => false, 'error' => 'Only requests still under review can be cancelled.'], 400);
    }
  }

  $pdo->prepare('DELETE FROM assistance_requests WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
