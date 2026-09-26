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
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN affected_families INT UNSIGNED NOT NULL DEFAULT 0 AFTER priority'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN needs_json TEXT NULL AFTER notes'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN calamity_tags TEXT NULL AFTER needs_json'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN sla_deadline DATETIME NULL AFTER calamity_tags'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN is_emergency TINYINT(1) NOT NULL DEFAULT 0 AFTER sla_deadline'); } catch (Throwable $e) {}
  try { $pdo->exec('ALTER TABLE assistance_requests ADD COLUMN assigned_to VARCHAR(120) NULL AFTER is_emergency'); } catch (Throwable $e) {}

  // Backfill affected_families from notes if existing request has 0
  try {
    $zeroRows = $pdo->query('SELECT id, notes FROM assistance_requests WHERE (affected_families IS NULL OR affected_families = 0) AND notes IS NOT NULL')->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($zeroRows)) {
      $upd = $pdo->prepare('UPDATE assistance_requests SET affected_families = ? WHERE id = ?');
      foreach ($zeroRows as $zr) {
        $n = (string) $zr['notes'];
        if (preg_match('/Families\s*Affected\s*:\s*(\d+)/i', $n, $m) || preg_match('/(\d+)\s*families/i', $n, $m)) {
          $famCount = (int) $m[1];
          if ($famCount > 0) {
            $upd->execute([$famCount, $zr['id']]);
          }
        }
      }
    }
  } catch (Throwable $e) {}

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
  // Affected families belongs strictly to the specific Relief Request
  $families = 0;
  if (isset($row['affected_families']) && (int) $row['affected_families'] > 0) {
    $families = (int) $row['affected_families'];
  } elseif (!empty($row['notes'])) {
    if (preg_match('/Families\s*Affected\s*:\s*(\d+)/i', (string) $row['notes'], $m)) {
      $families = (int) $m[1];
    } elseif (preg_match('/(\d+)\s*families/i', (string) $row['notes'], $m)) {
      $families = (int) $m[1];
    }
  }

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
    'affectedFamilies' => $families,
    'needs' => [],
    'requestedItems' => [],
    'isEmergency' => !empty($row['is_emergency']),
    'calamityTags' => [],
    'assignedTo' => $row['assigned_to'] ?? null,
    'slaDeadline' => $row['sla_deadline'] ?? null,
    'createdAt' => $row['created_at'] ?? $row['request_date'],
    'allocationCount' => (int) ($row['allocation_count'] ?? 0),
    'procurementCount' => (int) ($row['procurement_count'] ?? 0),
    'hasAllocation' => (((int) ($row['allocation_count'] ?? 0)) > 0 || ((int) ($row['procurement_count'] ?? 0)) > 0),
  ];
  // Calamity tags
  if (!empty($row['calamity_tags'])) {
    $decoded = json_decode((string) $row['calamity_tags'], true);
    if (is_array($decoded)) {
      $mapped['calamityTags'] = $decoded;
    }
  }
  if (empty($mapped['calamityTags']) && !empty($row['notes'])) {
    if (preg_match('/Calamity\/Program:\s*([^\n\r]+)/i', (string) $row['notes'], $m)) {
      $calamityVal = trim($m[1]);
      if ($calamityVal !== '') {
        $mapped['calamityTags'] = [$calamityVal];
      }
    }
  }
  if (!empty($row['needs_json'])) {
    $decodedNeeds = json_decode((string) $row['needs_json'], true);
    if (is_array($decodedNeeds)) {
      $extractedNeeds = [];
      $requestedItems = [];
      foreach ($decodedNeeds as $item) {
        if (is_string($item)) {
          $val = trim($item);
          if ($val !== '') {
            $extractedNeeds[] = $val;
            $requestedItems[] = [
              'item' => $val,
              'quantity' => null,
              'unit' => null,
            ];
          }
        } elseif (is_array($item)) {
          $itemName = trim((string) ($item['item'] ?? $item['name'] ?? ''));
          if ($itemName !== '') {
            $qtyStr = !empty($item['quantity']) ? " ({$item['quantity']}" . (!empty($item['unit']) ? " {$item['unit']}" : '') . ')' : '';
            $extractedNeeds[] = $itemName . $qtyStr;
            $quantity = isset($item['quantity']) && is_numeric($item['quantity'])
              ? max(0, (int) $item['quantity'])
              : null;
            $requestedItems[] = [
              'item' => $itemName,
              'quantity' => $quantity,
              'unit' => !empty($item['unit']) ? trim((string) $item['unit']) : null,
            ];
          }
        }
      }
      $mapped['needs'] = array_values(array_unique($extractedNeeds));
      $mapped['requestedItems'] = $requestedItems;
    }
  }
  if (empty($mapped['needs']) && !empty($row['notes'])) {
    if (preg_match('/(?:Goods Required|Type of Needs):\s*([^\n\r]+)/i', (string) $row['notes'], $m)) {
      $extractedNeeds = array_values(array_filter(array_map('trim', explode(',', $m[1]))));
      $mapped['requestedItems'] = array_map(fn($item) => [
        'item' => $item,
        'quantity' => null,
        'unit' => null,
      ], $extractedNeeds);
      if ($extractedNeeds) {
        $mapped['needs'] = $extractedNeeds;
      }
    }
  }

  $cleanNotes = (string) ($row['notes'] ?? '');
  $reason = '';
  if (preg_match('/Calamity\/Program:\s*([^\n\r]+)/i', $cleanNotes, $m)) {
    $reason = trim($m[1]);
  } elseif (!empty($mapped['calamityTags'][0])) {
    $reason = $mapped['calamityTags'][0];
  }
  $additionalNotes = '';
  if (preg_match('/Additional Notes:\s*([\s\S]+)/i', $cleanNotes, $m)) {
    $additionalNotes = trim($m[1]);
  }
  $mapped['reason'] = $reason;
  $mapped['additionalNotes'] = $additionalNotes;

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
  ensure_request_columns($pdo);
  if (function_exists('ensure_procurement_table')) {
    ensure_procurement_table($pdo);
  }

  // ── Single request endpoint ──
  if ($id) {
    $stmt = $pdo->prepare('
      SELECT ar.*, b.full_name AS beneficiary_name, b.municipality, b.representative_name, b.barangay,
             (SELECT COUNT(*) FROM allocations a WHERE a.assistance_request_id = ar.id) AS allocation_count,
             (SELECT COUNT(*) FROM donation_procurements dp WHERE dp.assistance_request_id = ar.id) AS procurement_count
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.id = ? LIMIT 1
    ');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Relief request not found'], 404);
    }
    $extra = [
      'municipality' => $row['municipality'] ?? '',
      'representativeName' => $row['representative_name'] ?? '',
      'barangay' => $row['barangay'] ?? '',
    ];
    json_response(['ok' => true, 'data' => map_request($row, $row['beneficiary_name'], $extra)]);
  }

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

  // ── Eligible Requests & Barangays for Monetary Fund Allocation ──
  if ($action === 'funding_eligible') {
    require_auth(['Admin', 'Staff']);
    ensure_request_columns($pdo);
    ensure_procurement_table($pdo);
    ensure_allocation_inventory_schema($pdo);
    ensure_column($pdo, 'inventory_items', 'cost_per_unit', 'DECIMAL(10,2) NULL AFTER unit');

    // Only approved requests in a funding stage may receive monetary allocations.
    // Include Allocated here only so stale statuses can be repaired from persisted finance data.
    $stmt = $pdo->query("
      SELECT ar.*, b.full_name AS beneficiary_name, b.barangay, b.municipality
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.status IN ('Approved', 'Partially Funded', 'Partially Allocated', 'Allocated')
        AND NOT EXISTS (
          SELECT 1 FROM allocations a
          JOIN distributions d ON d.id = a.distribution_id
          WHERE a.assistance_request_id = ar.id
            AND d.status IN ('Preparing', 'In Transit', 'Delivered', 'Completed')
        )
      ORDER BY ar.created_at DESC, ar.request_date DESC, ar.id DESC
    ");
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $eligibleRequests = [];
    $barangayMap = [];

    foreach ($candidates as $row) {
      $fin = calculate_relief_request_finances($pdo, $row);

      if ($fin['requestedFamilies'] <= 0 || empty($fin['requestedItems'])) {
        continue;
      }

      // Fully covered requests stay out of the funding selector.
      if (empty($fin['remainingItems'])) {
        if ($row['status'] !== 'Allocated') {
          try {
            $pdo->prepare("UPDATE assistance_requests SET status = 'Allocated' WHERE id = ?")->execute([$row['id']]);
          } catch (Throwable $e) {}
        }
        continue;
      }

      // Determine accurate active status
      if ($fin['alreadySupportedFamilies'] > 0) {
        $properStatus = 'Partially Allocated';
      } elseif ($fin['alreadyFundedAmount'] > 0) {
        $properStatus = 'Partially Funded';
      } else {
        $properStatus = in_array($row['status'], ['Under Review', 'Pending Review'], true) ? $row['status'] : 'Approved';
      }

      // Sync status in DB if needed so Admin & Staff see the genuine state
      if ($row['status'] !== $properStatus && !in_array($row['status'], ['Pending Review', 'Under Review'], true)) {
        try {
          $pdo->prepare("UPDATE assistance_requests SET status = ? WHERE id = ?")->execute([$properStatus, $row['id']]);
        } catch (Throwable $e) {}
      }

      // Extract calamity name
      $calamity = 'General Disaster Relief';
      if (!empty($row['calamity_tags'])) {
        $tags = json_decode((string) $row['calamity_tags'], true);
        if (!empty($tags[0])) $calamity = (string) $tags[0];
      }
      if ($calamity === 'General Disaster Relief' && !empty($row['notes'])) {
        if (preg_match('/Calamity\/Program:\s*([^\n\r]+)/i', (string) $row['notes'], $m)) {
          $calamity = trim($m[1]);
        }
      }

      $benId = (int) $row['beneficiary_id'];
      $barangayName = trim((string) ($row['barangay'] ?: $row['beneficiary_name']));
      $muni = trim((string) ($row['municipality'] ?? 'Cebu'));

      $reqData = [
        'id' => $row['reference_code'],
        'dbId' => (int) $row['id'],
        'referenceCode' => $row['reference_code'],
        'beneficiaryId' => $benId,
        'beneficiaryName' => $row['beneficiary_name'],
        'barangay' => $barangayName,
        'municipality' => $muni,
        'assistanceType' => $row['assistance_type'],
        'calamity' => $calamity,
        'priority' => $row['priority'],
        'status' => $properStatus,
        'requestedFamilies' => $fin['requestedFamilies'],
        'affectedFamilies' => $fin['affectedFamilies'],
        'alreadySupportedFamilies' => $fin['alreadySupportedFamilies'],
        'familiesAlreadyCovered' => $fin['alreadySupportedFamilies'],
        'remainingFamilies' => $fin['remainingFamilies'],
        'familiesStillNeedingSupport' => $fin['familiesStillNeedingSupport'],
        'totalCost' => $fin['totalCost'],
        'alreadyFundedAmount' => $fin['alreadyFundedAmount'],
        'remainingCost' => $fin['remainingCost'],
        'items' => $fin['items'],
        'requestedItems' => $fin['requestedItems'],
        'remainingItems' => $fin['remainingItems'],
        'notes' => $row['notes'],
      ];

      $eligibleRequests[] = $reqData;

      // Group into eligible barangays (strict: NO general affected families)
      if (!isset($barangayMap[$benId])) {
        $barangayMap[$benId] = [
          'id' => $benId,
          'dbId' => $benId,
          'name' => $row['beneficiary_name'],
          'barangay' => $barangayName,
          'municipality' => $muni,
          'eligibleRequestsCount' => 0,
        ];
      }
      $barangayMap[$benId]['eligibleRequestsCount']++;
    }

    json_response([
      'ok' => true,
      'data' => [
        'eligibleBarangays' => array_values($barangayMap),
        'eligibleRequests' => $eligibleRequests,
      ],
    ]);
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
      SELECT ar.*, b.full_name AS beneficiary_name,
             (SELECT COUNT(*) FROM allocations a WHERE a.assistance_request_id = ar.id) AS allocation_count,
             (SELECT COUNT(*) FROM donation_procurements dp WHERE dp.assistance_request_id = ar.id) AS procurement_count
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      WHERE ar.beneficiary_id = ?
      ORDER BY ar.created_at DESC, ar.request_date DESC, ar.id DESC
    ');
    $stmt->execute([$benId]);
  } else {
    $stmt = $pdo->query('
      SELECT ar.*, b.full_name AS beneficiary_name,
             (SELECT COUNT(*) FROM allocations a WHERE a.assistance_request_id = ar.id) AS allocation_count,
             (SELECT COUNT(*) FROM donation_procurements dp WHERE dp.assistance_request_id = ar.id) AS procurement_count
      FROM assistance_requests ar
      JOIN beneficiaries b ON b.id = ar.beneficiary_id
      ORDER BY ar.created_at DESC, ar.request_date DESC, ar.id DESC
    ');
  }

  $rows = $stmt->fetchAll();

  // Enrich with beneficiary details (Municipality & Representative)
  $benCache = [];
  $enriched = array_map(function ($r) use ($pdo, &$benCache) {
    $benId = (int) $r['beneficiary_id'];
    if (!isset($benCache[$benId])) {
      $b = $pdo->prepare('SELECT municipality, representative_name FROM beneficiaries WHERE id = ? LIMIT 1');
      $b->execute([$benId]);
      $benCache[$benId] = $b->fetch() ?: [];
    }
    $extra = [
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
  $priority = in_array($body['priority'] ?? 'Low', ['Low', 'Medium', 'High', 'Critical'], true) ? $body['priority'] : 'Low';

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

  // Request-specific affected families
  $reqFamilies = (int) ($body['affectedFamilies'] ?? $body['familiesAffected'] ?? $body['families'] ?? 0);
  if ($reqFamilies <= 0 && !empty($notes)) {
    if (preg_match('/Families\s*Affected\s*:\s*(\d+)/i', (string) $notes, $m)) {
      $reqFamilies = (int) $m[1];
    } elseif (preg_match('/(\d+)\s*families/i', (string) $notes, $m)) {
      $reqFamilies = (int) $m[1];
    }
  }

  $stmt = $pdo->prepare('INSERT INTO assistance_requests (reference_code, beneficiary_id, assistance_type, status, priority, affected_families, request_date, notes, needs_json, calamity_tags, sla_deadline, is_emergency, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $ref,
    $beneficiaryId,
    $type,
    $public ? 'Pending Review' : ($body['status'] ?? 'Pending Review'),
    $priority,
    $reqFamilies,
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

  // Priority is strictly read-only on update and preserved from the original submitted request
  $newPriority = $existing['priority'] ?? 'Medium';
  $slaDeadline = $existing['sla_deadline'] ?? null;

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

  if (!$isBeneficiary && isset($body['status']) && $body['status'] !== $existing['status']) {
    $currentStatus = (string) ($existing['status'] ?? 'Pending Review');
    $requestedStatus = (string) $body['status'];

    // Workflow: Pending -> Approve OR Reject
    // Approved -> no approval/rejection actions permitted
    if ($requestedStatus === 'Approved') {
      if (!in_array($currentStatus, ['Pending Review', 'Under Review', 'Pending'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot approve a request with status '{$currentStatus}'. Once approved or in progress, Approve is no longer permitted."
        ], 400);
      }
    } elseif ($requestedStatus === 'Rejected') {
      if (!in_array($currentStatus, ['Pending Review', 'Under Review', 'Pending'], true)) {
        json_response([
          'ok' => false,
          'error' => "Cannot reject a request with status '{$currentStatus}'. Only pending requests can be rejected."
        ], 400);
      }
    }

    assert_valid_status_transition(
      'Assistance request',
      $currentStatus,
      $newStatus,
      WORKFLOW_REQUEST_STEPS,
      WORKFLOW_REQUEST_TERMINAL,
      WORKFLOW_REQUEST_BRANCHES,
      WORKFLOW_REQUEST_ALIASES
    );
  }
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

  $newFamilies = isset($body['affectedFamilies']) || isset($body['familiesAffected'])
    ? (int) ($body['affectedFamilies'] ?? $body['familiesAffected'])
    : (int) ($existing['affected_families'] ?? 0);

  $update = $pdo->prepare('UPDATE assistance_requests SET assistance_type = ?, status = ?, priority = ?, affected_families = ?, notes = ?, needs_json = ?, calamity_tags = ?, sla_deadline = ?, is_emergency = ?, assigned_to = ? WHERE id = ?');
  $update->execute([
    $body['type'] ?? $existing['assistance_type'],
    $newStatus,
    $newPriority,
    $newFamilies,
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

  $currentStatus = (string) ($existing['status'] ?? '');

  if ($isBeneficiary) {
    if ($beneficiaryOwnedId <= 0 || (int) $existing['beneficiary_id'] !== $beneficiaryOwnedId) {
      json_response(['ok' => false, 'error' => 'You can only cancel your own requests.'], 403);
    }
    if (!in_array($currentStatus, ['Pending Review', 'Under Review', 'Pending'], true)) {
      json_response(['ok' => false, 'error' => 'Only requests still under review can be cancelled.'], 400);
    }
  } else {
    // Admin / Staff deletion:
    // Workflow: Rejected -> Delete only
    // Approved / Allocated / In Progress / Completed -> do not allow Delete
    if ($currentStatus !== 'Rejected') {
      json_response([
        'ok' => false,
        'error' => "Cannot delete request with status '{$currentStatus}'. Only rejected requests can be deleted."
      ], 400);
    }
  }

  if (function_exists('notify_request_lifecycle')) {
    notify_request_lifecycle($pdo, (int) $id, 'Deleted', $currentStatus);
  }
  $pdo->prepare('DELETE FROM assistance_requests WHERE id = ?')->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
