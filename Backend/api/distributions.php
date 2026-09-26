<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
ensure_distribution_schema($pdo);
$method = request_method();
$id = get_id_param();

function map_distribution(PDO $pdo, array $row): array
{
  $barangay = '';
  $barangayMunicipality = '';
  if (!empty($row['beneficiary_id'])) {
    $b = $pdo->prepare('SELECT full_name, affected_families, municipality FROM beneficiaries WHERE id = ?');
    $b->execute([$row['beneficiary_id']]);
    $ben = $b->fetch();
    if ($ben) {
      $barangay = $ben['full_name'] . ' (' . $ben['affected_families'] . ' families)';
      $barangayMunicipality = $ben['municipality'] ?? '';
    }
  }

  $proofCount = $pdo->prepare('SELECT COUNT(*) FROM distribution_proofs WHERE distribution_id = ?');
  $proofCount->execute([$row['id']]);

  $eventName = trim((string) ($row['event_name'] ?? ''));
  if ($eventName === '') {
    $eventName = trim(($row['code'] ?? '') . ' — ' . ($row['location'] ?? 'Distribution'));
  }

  $linkedAllocs = [];
  try {
    $aStmt = $pdo->prepare('SELECT id, code, resource_name, quantity, program, status, allocation_date FROM allocations WHERE distribution_id = ? ORDER BY id ASC');
    $aStmt->execute([(int) $row['id']]);
    foreach ($aStmt->fetchAll() as $a) {
      $linkedAllocs[] = [
        'dbId' => (int) $a['id'],
        'id' => $a['code'],
        'resource' => $a['resource_name'],
        'quantity' => (int) $a['quantity'],
        'program' => $a['program'] ?? '',
        'status' => $a['status'],
        'date' => format_date($a['allocation_date'] ?? null),
      ];
    }
  } catch (Throwable $e) {
    $linkedAllocs = [];
  }

  // Linked request urgency + details
  $requestPriority = null;
  $requestInfo = null;
  $requestId = !empty($row['request_id']) ? (int) $row['request_id'] : null;

  // Fallback: resolve via linked allocation if distribution.request_id is empty
  if (!$requestId) {
    try {
      $ar = $pdo->prepare(
        'SELECT assistance_request_id FROM allocations
         WHERE distribution_id = ? AND assistance_request_id IS NOT NULL
         ORDER BY id ASC LIMIT 1'
      );
      $ar->execute([(int) $row['id']]);
      $fromAlloc = $ar->fetchColumn();
      if ($fromAlloc) {
        $requestId = (int) $fromAlloc;
      }
    } catch (Throwable $e) {
      // column may be missing on older DBs
    }
  }

  if ($requestId) {
    $rp = $pdo->prepare(
      'SELECT id, reference_code, assistance_type, status, priority, notes, request_date
       FROM assistance_requests WHERE id = ? LIMIT 1'
    );
    $rp->execute([$requestId]);
    $reqRow = $rp->fetch();
    if ($reqRow) {
      $requestPriority = $reqRow['priority'] ?: null;
      $requestInfo = [
        'dbId' => (int) $reqRow['id'],
        'id' => $reqRow['reference_code'],
        'type' => $reqRow['assistance_type'],
        'status' => $reqRow['status'],
        'priority' => $reqRow['priority'],
        'notes' => $reqRow['notes'] ?? '',
        'date' => format_date($reqRow['request_date'] ?? null),
        'requestDate' => $reqRow['request_date'] ?? null,
      ];
    }
  }

  // Source allocation IDs for grouped distributions
  $sourceAllocIds = [];
  if (!empty($row['source_allocation_ids'])) {
    $decoded = json_decode((string) $row['source_allocation_ids'], true);
    if (is_array($decoded)) {
      $sourceAllocIds = array_map('intval', $decoded);
    }
  }

  if (!empty($sourceAllocIds)) {
    $existingIds = array_map(fn($a) => $a['dbId'], $linkedAllocs);
    $missingIds = array_values(array_diff($sourceAllocIds, $existingIds));
    if (!empty($missingIds)) {
      try {
        $inClause = implode(',', array_fill(0, count($missingIds), '?'));
        $mStmt = $pdo->prepare("SELECT id, code, resource_name, quantity, program, status, allocation_date FROM allocations WHERE id IN ($inClause)");
        $mStmt->execute($missingIds);
        foreach ($mStmt->fetchAll() as $a) {
          $linkedAllocs[] = [
            'dbId' => (int) $a['id'],
            'id' => $a['code'],
            'resource' => $a['resource_name'],
            'quantity' => (int) $a['quantity'],
            'program' => $a['program'] ?? '',
            'status' => $a['status'],
            'date' => format_date($a['allocation_date'] ?? null),
          ];
        }
      } catch (Throwable $e) {
        // ignore
      }
    }
  }

  $finalItemsSummary = trim((string) ($row['items_summary'] ?? ''));
  if ($finalItemsSummary === '' && !empty($linkedAllocs)) {
    $finalItemsSummary = implode('; ', array_map(fn($a) => "{$a['resource']} × {$a['quantity']}", $linkedAllocs));
  }

  // Volunteer / staff status updates surface via admin notifications (audit trail for detail UI).
  $statusActivity = [];
  $code = (string) ($row['code'] ?? '');
  if ($code !== '') {
    try {
      $act = $pdo->prepare(
        "SELECT title, message, created_at FROM notifications
         WHERE type = 'distribution' AND message LIKE ?
         ORDER BY created_at DESC LIMIT 12"
      );
      $act->execute(['%' . $code . '%']);
      foreach ($act->fetchAll() as $n) {
        $statusActivity[] = [
          'title' => (string) ($n['title'] ?? ''),
          'message' => (string) ($n['message'] ?? ''),
          'at' => format_date($n['created_at'] ?? null),
          'atRaw' => $n['created_at'] ?? null,
        ];
      }
    } catch (Throwable $e) {
      $statusActivity = [];
    }
  }

  $proofs = [];
  try {
    $pStmt = $pdo->prepare('SELECT id, beneficiary_id, file_path, file_name, file_type, notes, proof_category, status, review_remarks, submitted_at, reviewed_at FROM distribution_proofs WHERE distribution_id = ? ORDER BY submitted_at DESC, id DESC');
    $pStmt->execute([(int) $row['id']]);
    foreach ($pStmt->fetchAll() as $p) {
      $fileType = (string) ($p['file_type'] ?? '');
      $fileName = (string) ($p['file_name'] ?? '');
      $isImage = str_starts_with($fileType, 'image/') || (bool) preg_match('/\.(jpe?g|png|gif|webp)$/i', $fileName);
      $cat = (string) ($p['proof_category'] ?? 'other');
      $catLabel = match ($cat) {
        'received_goods' => 'Received goods',
        'distribution' => 'Distribution event photo',
        'acknowledgment' => 'Signed acknowledgment / receipt',
        default => 'Supporting file',
      };
      $proofs[] = [
        'id' => (int) $p['id'],
        'distributionId' => (int) $row['id'],
        'beneficiaryId' => (int) ($p['beneficiary_id'] ?? 0),
        'fileName' => $fileName,
        'fileType' => $fileType,
        'isImage' => $isImage,
        'fileUrl' => '/api/file.php?kind=proofs&name=' . rawurlencode(basename((string) $p['file_path'])),
        'notes' => $p['notes'] ?? '',
        'category' => $cat,
        'categoryLabel' => $catLabel,
        'status' => normalize_proof_status($p['status'] ?? 'Pending'),
        'reviewRemarks' => $p['review_remarks'] ?? '',
        'submittedAt' => format_date($p['submitted_at'] ?? null),
        'submittedAtRaw' => $p['submitted_at'] ?? null,
      ];
    }
  } catch (Throwable $e) {
    $proofs = [];
  }

  $assignedTeam = [];
  try {
    $tStmt = $pdo->prepare('SELECT id, code, title, assignee, board_column FROM tasks WHERE distribution_id = ? ORDER BY id ASC');
    $tStmt->execute([(int) $row['id']]);
    foreach ($tStmt->fetchAll() as $t) {
      $assignedTeam[] = [
        'id' => (int) $t['id'],
        'code' => $t['code'] ?? '',
        'title' => $t['title'] ?? '',
        'assignee' => $t['assignee'] ?? '',
        'status' => $t['board_column'] ?? '',
      ];
    }
  } catch (Throwable $e) {
    $assignedTeam = [];
  }

  return [
    'id' => $row['code'],
    'dbId' => (int) $row['id'],
    'eventName' => $eventName,
    'location' => $row['location'],
    'barangay' => $barangay,
    'barangayMunicipality' => $barangayMunicipality,
    'beneficiaryId' => $row['beneficiary_id'] ? (int) $row['beneficiary_id'] : null,
    'program' => $row['program'],
    'date' => format_date($row['distribution_date']),
    'distributionDate' => $row['distribution_date'],
    'scheduleTime' => $row['schedule_time'] ?? '',
    'beneficiaries' => (int) $row['beneficiaries_count'],
    'volunteers' => (int) $row['volunteers_count'],
    'vehicles' => (int) $row['vehicles_count'],
    'distanceKm' => isset($row['distance_km']) && $row['distance_km'] !== null ? (float) $row['distance_km'] : null,
    'fuelLiters' => isset($row['fuel_liters']) && $row['fuel_liters'] !== null ? (float) $row['fuel_liters'] : null,
    'fuelCost' => isset($row['fuel_cost']) && $row['fuel_cost'] !== null ? (float) $row['fuel_cost'] : null,
    'status' => normalize_distribution_status((string) ($row['status'] ?? 'Planning')),
    'proofStatus' => $row['proof_status'] ?? 'Not Required',
    'receiptStatus' => $row['receipt_status'] ?? 'Awaiting Confirmation',
    'receivedQuantity' => isset($row['received_quantity']) && $row['received_quantity'] !== null ? (int) $row['received_quantity'] : null,
    'receivedAt' => format_date($row['received_at'] ?? null),
    'receiptNotes' => $row['receipt_notes'] ?? '',
    'type' => $row['distribution_type'],
    'itemsSummary' => $finalItemsSummary,
    'items' => $finalItemsSummary,
    'quantity' => isset($row['beneficiaries_count']) ? (int) $row['beneficiaries_count'] : null,
    'coordinator' => $row['coordinator'] ?? '',
    'notes' => $row['notes'] ?? '',
    'allocations' => $linkedAllocs,
    'allocationIds' => array_map(fn($a) => $a['dbId'], $linkedAllocs),
    'proofs' => $proofs,
    'proofsCount' => count($proofs) ?: (int) $proofCount->fetchColumn(),
    'assignedTeam' => $assignedTeam,
    'workflowSteps' => distribution_workflow_steps(),
    'requestId' => $requestId ?: null,
    'requestPriority' => $requestPriority,
    'request' => $requestInfo,
    'sourceAllocationIds' => $sourceAllocIds,
    'statusActivity' => $statusActivity,
    'isAutoDraft' => str_contains($row['notes'] ?? '', 'Auto-created from Allocation'),
  ];
}

/**
 * Distributions visible to a barangay portal user.
 */
function distributions_for_beneficiary(PDO $pdo, array $ben, bool $forProof = false): array
{
  $benId = (int) $ben['id'];
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE beneficiary_id = ? OR beneficiary_id IS NULL ORDER BY distribution_date DESC, id DESC');
  $stmt->execute([$benId]);
  $rows = array_values(array_filter(
    $stmt->fetchAll(),
    static fn(array $row) => distribution_belongs_to_beneficiary($row, $ben)
  ));

  if ($forProof) {
    $rows = array_values(array_filter($rows, static function (array $row) {
      $proof = $row['proof_status'] ?? 'Not Required';
      $status = $row['status'] ?? '';
      $receipt = $row['receipt_status'] ?? 'Awaiting Confirmation';
      if ($proof === 'Proof Verified') {
        return false;
      }
      // After Confirm Received, barangay should submit proof
      if ($receipt === 'Received') {
        return true;
      }
      if ($proof === 'Proof Rejected' || $proof === 'Proof Submitted' || $proof === 'Awaiting Proof') {
        return true;
      }
      $eligible = ['Delivered', 'Awaiting Proof', 'In Transit', 'Preparing', 'Completed'];
      return in_array($status, $eligible, true);
    }));
  }

  return $rows;
}

/**
 * Resolve accurate geographical coordinates in Cebu for a distribution.
 */
function resolve_cebu_coordinates(string $location, string $barangay = '', string $municipality = '', string $eventName = ''): array
{
  $haystack = strtolower(trim($location . ' ' . $barangay . ' ' . $municipality . ' ' . $eventName));

  // Specific landmarks / barangays / municipalities lookup table
  $places = [
    // Cebu City Specific Barangays & Landmarks
    'guadalupe' => [10.3283, 123.8833],
    'tejero' => [10.3015, 123.9094],
    'lahug' => [10.3392, 123.8967],
    'mabolo' => [10.3228, 123.9142],
    'mambaling' => [10.2934, 123.8741],
    'pasil' => [10.2952, 123.8913],
    'ermita' => [10.2917, 123.8972],
    'labangon' => [10.3069, 123.8778],
    'tisa' => [10.3025, 123.8681],
    'banilad' => [10.3478, 123.9133],
    'talamban' => [10.3689, 123.9167],
    'punta princesa' => [10.2981, 123.8722],
    'basak san nicolas' => [10.2925, 123.8690],
    'basak pardo' => [10.2861, 123.8611],
    'inayawan' => [10.2742, 123.8650],
    'sambag' => [10.3117, 123.8925],
    'capitol' => [10.3175, 123.8914],
    'camputhaw' => [10.3194, 123.8972],
    'carreta' => [10.3111, 123.9083],
    'hipodromo' => [10.3167, 123.9056],
    'kasambagan' => [10.3278, 123.9111],
    'busay' => [10.3639, 123.8778],
    'sirao' => [10.4286, 123.8569],
    'tinago' => [10.2986, 123.9042],
    'san roque' => [10.2958, 123.9069],
    'lorega' => [10.3067, 123.9011],
    't. padilla' => [10.3047, 123.9078],
    'day-as' => [10.3042, 123.9028],
    'poblacion pardo' => [10.2861, 123.8611],
    'quiot' => [10.2950, 123.8639],
    'duljo' => [10.2931, 123.8861],
    'pahina' => [10.2972, 123.8944],
    'sawang calero' => [10.2917, 123.8861],
    'suba' => [10.2903, 123.8903],
    'cebu city' => [10.3157, 123.8854],

    // Mandaue City
    'subangdaku' => [10.3236, 123.9317],
    'tipolo' => [10.3267, 123.9356],
    'paknaan' => [10.3467, 123.9511],
    'cabancalan' => [10.3542, 123.9319],
    'maguikay' => [10.3417, 123.9389],
    'bakilid' => [10.3356, 123.9333],
    'jagobiao' => [10.3667, 123.9472],
    'canduman' => [10.3625, 123.9333],
    'umapad' => [10.3361, 123.9556],
    'tabok' => [10.3556, 123.9417],
    'mandaue' => [10.3346, 123.9404],

    // Lapu-Lapu City / Mactan
    'marigondon' => [10.2722, 123.9778],
    'maribago' => [10.2889, 124.0000],
    'mactan' => [10.3014, 124.0042],
    'pusok' => [10.3250, 123.9611],
    'ibo' => [10.3319, 123.9778],
    'gun-ob' => [10.3083, 123.9417],
    'babag' => [10.2972, 123.9333],
    'calawisan' => [10.2861, 123.9222],
    'agus' => [10.2806, 123.9722],
    'punta engaño' => [10.3194, 124.0250],
    'lapu-lapu' => [10.3103, 123.9494],
    'opon' => [10.3103, 123.9494],

    // Talisay City
    'tabunok' => [10.2583, 123.8361],
    'dumlog' => [10.2389, 123.8417],
    'tangke' => [10.2417, 123.8583],
    'bulacao' => [10.2639, 123.8472],
    'cansojong' => [10.2486, 123.8444],
    'lawaan' => [10.2556, 123.8278],
    'linao' => [10.2514, 123.8167],
    'pooc' => [10.2361, 123.8278],
    'mohon' => [10.2472, 123.8333],
    'talisay' => [10.2447, 123.8494],

    // Minglanilla
    'lipata' => [10.2514, 123.8056],
    'tungkop' => [10.2333, 123.7833],
    'pakigne' => [10.2472, 123.8000],
    'calajo-an' => [10.2389, 123.7889],
    'minglanilla' => [10.2458, 123.7961],

    // Naga City
    'tinaan' => [10.1972, 123.7444],
    'inayagan' => [10.2222, 123.7694],
    'colon' => [10.2139, 123.7611],
    'langtad' => [10.1917, 123.7389],
    'naga' => [10.2089, 123.7578],

    // North & Provincial Municipalities
    'camoboan' => [10.7280, 124.0000],
    'tabogon' => [10.9333, 124.0333],
    'medellin' => [11.1286, 123.9622],
    'daanbantayan' => [11.2583, 124.0222],
    'bogo' => [11.0500, 124.0056],
    'san remigio' => [10.9983, 123.9439],
    'borbon' => [10.8333, 124.0333],
    'sogod' => [10.7500, 124.0000],
    'catmon' => [10.6833, 124.0167],
    'carmen' => [10.5833, 124.0167],
    'danao' => [10.5219, 124.0258],
    'compostela' => [10.4578, 124.0125],
    'liloan' => [10.4000, 123.9989],
    'consolacion' => [10.3789, 123.9578],
    'tayud' => [10.3667, 123.9667],
    'cordova' => [10.2528, 123.9486],
    'toledo' => [10.3778, 123.6417],
    'balamban' => [10.5000, 123.7167],
    'asturias' => [10.5667, 123.7167],
    'tuburan' => [10.7333, 123.8333],
    'tabuelan' => [10.9667, 123.8833],
    'carcar' => [10.1086, 123.6417],
    'san fernando' => [10.1611, 123.7083],
    'sibonga' => [10.0167, 123.6167],
    'argao' => [9.8833, 123.6000],
    'dalaguete' => [9.7611, 123.5333],
    'oslob' => [9.5167, 123.4333],
    'moalboal' => [9.9564, 123.4011],
    'badian' => [9.8667, 123.4000],
    'alegria' => [9.7667, 123.3667],
    'malabuyoc' => [9.6667, 123.3333],
    'barili' => [10.1167, 123.5083],
    'dumanjug' => [10.0583, 123.4500],
    'pinamungajan' => [10.2667, 123.5833],
    'aloguinsan' => [10.2167, 123.5500],
    'bantayan' => [11.1556, 123.8056],
  ];

  // Try matching more specific keys first
  foreach ($places as $key => $coord) {
    if (str_contains($haystack, $key)) {
      return $coord;
    }
  }

  // Default to Rise Above Community Center / Guadalupe, Cebu City
  return [10.3157, 123.8854];
}

/**
 * Public distributions list for the Public Site Impact Map.
 * Sanitizes operational data to protect sensitive info while giving real-time visibility.
 */
function public_distributions_map(PDO $pdo): array
{
  $stmt = $pdo->query("
    SELECT 
      d.id, d.code, d.event_name, d.location, d.program,
      d.distribution_date, d.schedule_time, d.distribution_type,
      d.beneficiaries_count, d.items_summary, d.status, d.created_at,
      b.full_name AS ben_name, b.barangay AS ben_barangay, b.municipality AS ben_municipality
    FROM distributions d
    LEFT JOIN beneficiaries b ON d.beneficiary_id = b.id
    WHERE d.status != 'Cancelled'
    ORDER BY 
      CASE 
        WHEN d.status = 'In Transit' THEN 1
        WHEN d.status = 'Preparing' THEN 2
        WHEN d.status = 'Ready for Dispatch' THEN 3
        WHEN d.status = 'Planning' THEN 4
        WHEN d.status = 'Delivered' THEN 5
        WHEN d.status = 'Completed' THEN 6
        ELSE 7
      END ASC,
      d.distribution_date DESC,
      d.id DESC
    LIMIT 60
  ");

  $rows = $stmt->fetchAll();
  $distributions = [];
  $seenCoords = [];

  $totalFamilies = 0;
  $totalItemsCount = 0;
  $activeCount = 0;
  $completedCount = 0;

  foreach ($rows as $index => $r) {
    $status = normalize_distribution_status((string) ($r['status'] ?? 'Planning'));
    $location = (string) ($r['location'] ?? 'Cebu');
    $barangay = (string) ($r['ben_barangay'] ?? '');
    $municipality = (string) ($r['ben_municipality'] ?? '');
    $eventName = trim((string) ($r['event_name'] ?? ''));
    if ($eventName === '') {
      $eventName = trim(($r['code'] ?? '') . ' — ' . $location);
    }

    [$lat, $lng] = resolve_cebu_coordinates($location, $barangay, $municipality, $eventName);

    // Apply minor offset/jitter if exact coordinate duplicate to keep pins visually separate
    $coordKey = round($lat, 4) . ',' . round($lng, 4);
    if (isset($seenCoords[$coordKey])) {
      $count = $seenCoords[$coordKey]++;
      $angle = ($count * 55) * (M_PI / 180);
      $radius = 0.0035 * (1 + floor($count / 6) * 0.5);
      $lat += sin($angle) * $radius;
      $lng += cos($angle) * $radius;
    } else {
      $seenCoords[$coordKey] = 1;
    }

    $benCount = (int) ($r['beneficiaries_count'] ?? 0);
    $totalFamilies += $benCount;

    $generalStatus = 'Scheduled';
    if (in_array($status, ['In Transit', 'Preparing', 'Ready for Dispatch'], true)) {
      $generalStatus = 'Active Outreach';
    } elseif ($status === 'Completed' || $status === 'Delivered') {
      $generalStatus = 'Completed';
    }

    // Build generalized, privacy-preserving location label
    $areaParts = array_filter([$barangay, $municipality]);
    $areaLabel = !empty($areaParts) ? implode(', ', $areaParts) : $location;

    $distributions[] = [
      'id' => (int) $r['id'],
      'locationName' => $areaLabel,
      'program' => $r['program'] ?: 'Community Program',
      'status' => $generalStatus,
      'rawStatus' => $status,
      'scheduledDate' => $r['distribution_date'] ? format_date($r['distribution_date']) : null,
      'lat' => round($lat, 6),
      'lng' => round($lng, 6),
    ];
  }

  // Fallback defaults if no distributions exist
  if (empty($distributions)) {
    $distributions = [
      [
        'id' => 1,
        'locationName' => 'Guadalupe, Cebu City',
        'program' => 'Community Center & Family Care',
        'status' => 'Active Outreach',
        'rawStatus' => 'Preparing',
        'scheduledDate' => date('M j, Y'),
        'lat' => 10.3157,
        'lng' => 123.8854,
      ],
      [
        'id' => 2,
        'locationName' => 'Tabogon · Camoboan, Cebu',
        'program' => 'Disaster Relief & House Building',
        'status' => 'Active Outreach',
        'rawStatus' => 'Planning',
        'scheduledDate' => date('M j, Y', strtotime('+2 days')),
        'lat' => 10.7280,
        'lng' => 124.0000,
      ],
      [
        'id' => 3,
        'locationName' => 'Medellin, Cebu',
        'program' => 'Educational Sponsorship',
        'status' => 'Scheduled',
        'rawStatus' => 'Planning',
        'scheduledDate' => date('M j, Y', strtotime('+4 days')),
        'lat' => 11.1286,
        'lng' => 123.9622,
      ],
    ];
  }

  return [
    'distributions' => $distributions,
  ];
}

// Check for Public Site Map requests (unauthenticated public access with sanitized output)
if ($method === 'GET' && (isset($_GET['public']) || isset($_GET['map']))) {
  $publicData = public_distributions_map($pdo);
  json_response([
    'ok' => true,
    'data' => $publicData['distributions'],
  ]);
}

$user = require_auth(['Admin', 'Staff', 'Beneficiary']);

if ($method === 'GET') {
  if ($user['role'] === 'Beneficiary') {
    $benStmt = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $benStmt->execute([$user['id']]);
    $ben = $benStmt->fetch();
    if (!$ben) {
      json_response(['ok' => true, 'data' => []]);
    }
    $forProof = isset($_GET['forProof']) && $_GET['forProof'] !== '' && $_GET['forProof'] !== '0';
    $rows = distributions_for_beneficiary($pdo, $ben, $forProof);
    json_response(['ok' => true, 'data' => array_map(fn($r) => map_distribution($pdo, $r), $rows)]);
  }

  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Distribution not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_distribution($pdo, $row)]);
  }

  $rows = $pdo->query('SELECT * FROM distributions ORDER BY created_at DESC, distribution_date DESC, id DESC')->fetchAll();
  json_response(['ok' => true, 'data' => array_map(fn($r) => map_distribution($pdo, $r), $rows)]);
}

$body = read_json_body();

// ---- Beneficiary receipt confirmation / dispute ----
if ($user['role'] === 'Beneficiary') {
  if (!in_array($method, ['PUT', 'POST'], true) || !$id) {
    json_response(['ok' => false, 'error' => 'Invalid request'], 400);
  }

  $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
  $ben->execute([$user['id']]);
  $benRow = $ben->fetch();
  if (!$benRow) {
    json_response(['ok' => false, 'error' => 'No barangay linked to this account'], 403);
  }

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $dist = $stmt->fetch();
  if (!$dist || !distribution_belongs_to_beneficiary($dist, $benRow)) {
    json_response(['ok' => false, 'error' => 'Distribution not found for your barangay'], 404);
  }
  if (empty($dist['beneficiary_id'])) {
    $pdo->prepare('UPDATE distributions SET beneficiary_id = ? WHERE id = ?')->execute([$benRow['id'], $id]);
    $dist['beneficiary_id'] = $benRow['id'];
  }

  $action = $body['action'] ?? 'confirm-receipt';

  if ($action === 'confirm-receipt') {
    $status = normalize_distribution_status((string) ($dist['status'] ?? ''));
    if ($status !== 'Delivered') {
      json_response([
        'ok' => false,
        'error' => 'You can confirm receipt only after the distribution is marked Delivered.',
      ], 400);
    }
    $qty = isset($body['receivedQuantity']) ? (int) $body['receivedQuantity'] : null;
    $notes = trim((string) ($body['notes'] ?? ''));
    $proofStatus = (string) ($dist['proof_status'] ?? 'Not Required');
    $newProof = in_array($proofStatus, ['Proof Verified', 'Proof Submitted'], true)
      ? $proofStatus
      : 'Awaiting Proof';
    $newStatus = 'Proof Review';
    $upd = $pdo->prepare('
      UPDATE distributions
      SET receipt_status = ?, received_quantity = ?, received_at = NOW(), receipt_notes = ?,
          proof_status = ?, status = ?
      WHERE id = ?
    ');
    $upd->execute(['Received', $qty, $notes !== '' ? $notes : null, $newProof, $newStatus, $id]);
    notify_admins(
      $pdo,
      'receipt',
      'Donation receipt confirmed',
      "{$benRow['full_name']} confirmed receipt for {$dist['code']}" . ($qty !== null ? " ({$qty} items)" : '') . '. Awaiting proof submission.',
      '/admin/distributions?id=' . $id . '#distributions-table'
    );
  } elseif ($action === 'report-missing') {
    $notes = trim((string) ($body['notes'] ?? ''));
    if ($notes === '') {
      json_response(['ok' => false, 'error' => 'Please describe the issue so Admin/Staff can follow up.'], 400);
    }
    $upd = $pdo->prepare('UPDATE distributions SET receipt_status = ?, receipt_notes = ? WHERE id = ?');
    $upd->execute(['Not Received', $notes, $id]);
    notify_admins(
      $pdo,
      'alert',
      'Barangay reported a distribution issue',
      "{$benRow['full_name']} reports distribution {$dist['code']} has not been received. Message: {$notes}",
      '/admin/distributions?id=' . $id . '#distributions-table'
    );
  } else {
    json_response(['ok' => false, 'error' => 'Unknown action'], 400);
  }

  audit_log($pdo, $action === 'report-missing' ? 'report-missing' : 'confirm-receipt', 'distribution', $dist['code'], "{$benRow['full_name']}: {$action}");

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response([
    'ok' => true,
    'data' => map_distribution($pdo, $stmt->fetch()),
    'nextStep' => $action === 'confirm-receipt' ? 'submit-proof' : null,
  ]);
}

require_auth(['Admin', 'Staff']);

// ── Grouping action: merge multiple Planning distributions for same barangay ──
if ($method === 'POST' && !empty($body['action']) && $body['action'] === 'group') {
  $distIds = $body['distributionIds'] ?? $body['distribution_ids'] ?? [];
  if (!is_array($distIds) || count($distIds) < 2) {
    json_response(['ok' => false, 'error' => 'At least 2 distribution IDs are required for grouping'], 400);
  }
  $distIds = array_map('intval', $distIds);

  $placeholders = implode(',', array_fill(0, count($distIds), '?'));
  $stmt = $pdo->prepare("SELECT * FROM distributions WHERE id IN ({$placeholders})");
  $stmt->execute($distIds);
  $dists = $stmt->fetchAll();

  if (count($dists) !== count($distIds)) {
    json_response(['ok' => false, 'error' => 'One or more distributions not found'], 400);
  }

  // Validate: all must be same beneficiary and status Planning
  $benIds = [];
  foreach ($dists as $d) {
    if ($d['status'] !== 'Planning') {
      json_response(['ok' => false, 'error' => "Distribution {$d['code']} is not in Planning status"], 400);
    }
    $benIds[] = (int) ($d['beneficiary_id'] ?? 0);
  }
  $benIds = array_unique($benIds);
  if (count($benIds) !== 1 || $benIds[0] === 0) {
    json_response(['ok' => false, 'error' => 'All distributions must belong to the same barangay'], 400);
  }

  // Merge: combine items, notes, source allocation IDs
  $mergedItems = [];
  $mergedNotes = [];
  $allSourceAllocIds = [];
  $mergedPrograms = [];
  $mergedRequestIds = [];

  foreach ($dists as $d) {
    if (!empty($d['items_summary'])) {
      $mergedItems[] = $d['items_summary'];
    }
    if (!empty($d['notes'])) {
      $mergedNotes[] = $d['notes'];
    }
    if (!empty($d['source_allocation_ids'])) {
      $decoded = json_decode($d['source_allocation_ids'], true);
      if (is_array($decoded)) {
        $allSourceAllocIds = array_merge($allSourceAllocIds, $decoded);
      }
    }
    if (!empty($d['program'])) {
      $mergedPrograms[] = $d['program'];
    }
    if (!empty($d['request_id'])) {
      $mergedRequestIds[] = (int) $d['request_id'];
    }
  }

  $benInfo = $pdo->prepare('SELECT full_name, barangay, affected_families FROM beneficiaries WHERE id = ?');
  $benInfo->execute([$benIds[0]]);
  $ben = $benInfo->fetch();
  $barangayName = $ben ? $ben['full_name'] : 'Unknown';

  $code = generate_code('DST');
  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, beneficiaries_count, status, distribution_type, items_summary, notes, proof_status, request_id, source_allocation_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    "Grouped Distribution — {$barangayName}",
    $ben['barangay'] ?? $barangayName,
    $benIds[0],
    implode(', ', array_unique($mergedPrograms)) ?: null,
    (int) ($ben['affected_families'] ?? 0),
    'Planning',
    'Delivery',
    implode('; ', $mergedItems) ?: null,
    'Grouped from: ' . implode(', ', array_map(fn($d) => $d['code'], $dists)),
    'Awaiting Proof',
    $mergedRequestIds ? $mergedRequestIds[0] : null,
    json_encode(array_values(array_unique($allSourceAllocIds))),
  ]);
  $newId = (int) $pdo->lastInsertId();

  // Re-link allocations to the merged distribution
  foreach ($distIds as $oldDistId) {
    $pdo->prepare('UPDATE allocations SET distribution_id = ? WHERE distribution_id = ?')->execute([$newId, $oldDistId]);
  }

  // Delete the individual drafts
  $pdo->prepare("DELETE FROM distributions WHERE id IN ({$placeholders})")->execute($distIds);

  audit_log($pdo, 'group', 'distribution', $code, "Grouped " . count($distIds) . " distributions for {$barangayName}");
  notify_admins($pdo, 'distribution', 'Distributions grouped', "Merged " . count($distIds) . " drafts into {$code} for {$barangayName}", '/admin/distributions');

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())], 201);
}

if ($method === 'POST') {
  $code = generate_code('DST');
  $proofStatus = $body['proofStatus'] ?? 'Awaiting Proof';
  $isDelivery = ($body['type'] ?? 'Delivery') === 'Delivery';

  // Optional handoff: build distribution from confirmed allocations
  $allocationIds = [];
  if (!empty($body['allocationIds']) && is_array($body['allocationIds'])) {
    $allocationIds = array_values(array_unique(array_map('intval', $body['allocationIds'])));
  } elseif (!empty($body['allocationId'])) {
    $allocationIds = [(int) $body['allocationId']];
  }

  $fromAllocations = [];
  if ($allocationIds) {
    $placeholders = implode(',', array_fill(0, count($allocationIds), '?'));
    $stmtA = $pdo->prepare("SELECT * FROM allocations WHERE id IN ({$placeholders})");
    $stmtA->execute($allocationIds);
    $fromAllocations = $stmtA->fetchAll();
    if (count($fromAllocations) !== count($allocationIds)) {
      json_response(['ok' => false, 'error' => 'One or more allocations were not found'], 400);
    }
    foreach ($fromAllocations as $a) {
      if (!in_array($a['status'], ['Reserved', 'Allocated'], true)) {
        json_response(['ok' => false, 'error' => "Allocation {$a['code']} must be Reserved or Allocated before planning distribution"], 400);
      }
      if (!empty($a['distribution_id'])) {
        json_response(['ok' => false, 'error' => "Allocation {$a['code']} is already linked to a distribution"], 400);
      }
    }
    $benIds = array_unique(array_filter(array_map(fn($a) => (int) ($a['beneficiary_id'] ?? 0), $fromAllocations)));
    if (count($benIds) !== 1) {
      json_response(['ok' => false, 'error' => 'All selected allocations must belong to the same barangay'], 400);
    }
  }

  $beneficiaryId = !empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null;
  if (!$beneficiaryId && $fromAllocations) {
    $beneficiaryId = (int) ($fromAllocations[0]['beneficiary_id'] ?? 0) ?: null;
  }
  if (!$beneficiaryId) {
    json_response(['ok' => false, 'error' => 'Target barangay (beneficiary) is required for a distribution event'], 400);
  }

  $benRow = $pdo->prepare('SELECT full_name, barangay, affected_families FROM beneficiaries WHERE id = ?');
  $benRow->execute([$beneficiaryId]);
  $benInfo = $benRow->fetch() ?: [];

  $location = trim((string) ($body['location'] ?? ''));
  if ($location === '') {
    $location = trim((string) ($benInfo['barangay'] ?? $benInfo['full_name'] ?? ''));
  }
  if ($location === '') {
    json_response(['ok' => false, 'error' => 'Drop-off location / address is required for a distribution event'], 400);
  }

  $itemsSummary = trim((string) ($body['itemsSummary'] ?? ''));
  if ($itemsSummary === '' && $fromAllocations) {
    $parts = [];
    foreach ($fromAllocations as $a) {
      $parts[] = trim($a['resource_name']) . ' × ' . (int) $a['quantity'];
    }
    $itemsSummary = implode('; ', $parts);
  }
  if ($itemsSummary === '') {
    json_response(['ok' => false, 'error' => 'Items to deliver / cargo summary cannot be empty'], 400);
  }

  $program = $body['program'] ?? null;
  if (($program === null || $program === '') && $fromAllocations) {
    foreach ($fromAllocations as $a) {
      if (!empty($a['program'])) {
        $program = $a['program'];
        break;
      }
    }
  }

  $beneficiariesCount = (int) ($body['beneficiaries'] ?? 0);
  if ($beneficiariesCount <= 0) {
    $beneficiariesCount = (int) ($benInfo['affected_families'] ?? 0);
  }

  $eventName = trim((string) ($body['eventName'] ?? ''));
  if ($eventName === '') {
    $place = $location !== '' ? $location : 'Distribution';
    $eventName = 'Distribution — ' . $place;
  }

  $notes = $body['notes'] ?? null;
  if (($notes === null || $notes === '') && $fromAllocations) {
    $codes = array_map(fn($a) => $a['code'], $fromAllocations);
    $notes = 'Created from allocation(s): ' . implode(', ', $codes);
  }

  // Determine request_id
  $requestId = $body['requestId'] ?? null;
  if (!$requestId && $fromAllocations) {
    foreach ($fromAllocations as $a) {
      if (!empty($a['assistance_request_id'])) {
        $requestId = (int) $a['assistance_request_id'];
        break;
      }
    }
  }

  // Keep monetary funding completion separate from logistics without changing
  // the existing in-kind allocation workflow for requests with no fund ledger.
  if ($requestId) {
    $requestStmt = $pdo->prepare('SELECT * FROM assistance_requests WHERE id = ? LIMIT 1');
    $requestStmt->execute([(int) $requestId]);
    $linkedRequest = $requestStmt->fetch(PDO::FETCH_ASSOC);
    if (!$linkedRequest) {
      json_response(['ok' => false, 'error' => 'Linked relief request was not found.'], 404);
    }
    ensure_procurement_table($pdo);
    $fundingStmt = $pdo->prepare('SELECT COUNT(*) FROM donation_procurements WHERE assistance_request_id = ?');
    $fundingStmt->execute([(int) $requestId]);
    if ((int) $fundingStmt->fetchColumn() > 0) {
      ensure_allocation_inventory_schema($pdo);
      ensure_column($pdo, 'inventory_items', 'cost_per_unit', 'DECIMAL(10,2) NULL AFTER unit');
      $requestFinances = calculate_relief_request_finances($pdo, $linkedRequest);
      if (!empty($requestFinances['remainingItems'])) {
        json_response(['ok' => false, 'error' => 'This relief request still has an unmet funding requirement and cannot enter distribution yet.'], 409);
      }
      if (!in_array($linkedRequest['status'], ['Allocated', 'In Distribution'], true)) {
        json_response(['ok' => false, 'error' => "This relief request must be fully allocated before distribution (current status: {$linkedRequest['status']})."], 409);
      }
    }
  }

  $distributionDate = !empty($body['distributionDate']) ? trim((string) $body['distributionDate']) : null;
  if ($distributionDate !== null && $distributionDate !== '') {
    if ($distributionDate < date('Y-m-d')) {
      json_response(['ok' => false, 'error' => 'Distribution date cannot be in the past. Please select today or a future date.'], 400);
    }
  }

  $stmt = $pdo->prepare('INSERT INTO distributions (code, event_name, location, beneficiary_id, program, distribution_date, schedule_time, beneficiaries_count, volunteers_count, vehicles_count, distance_km, fuel_liters, fuel_cost, status, distribution_type, items_summary, coordinator, notes, proof_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $code,
    $eventName,
    $location,
    $beneficiaryId,
    $program,
    $distributionDate,
    $body['scheduleTime'] ?? null,
    $beneficiariesCount,
    (int) ($body['volunteers'] ?? 0),
    (int) ($body['vehicles'] ?? 0),
    $isDelivery && isset($body['distanceKm']) && $body['distanceKm'] !== '' ? (float) $body['distanceKm'] : null,
    $isDelivery && isset($body['fuelLiters']) && $body['fuelLiters'] !== '' ? (float) $body['fuelLiters'] : null,
    $isDelivery && isset($body['fuelCost']) && $body['fuelCost'] !== '' ? (float) $body['fuelCost'] : null,
    $body['status'] ?? 'Planning',
    $body['type'] ?? 'Delivery',
    $itemsSummary !== '' ? $itemsSummary : null,
    $body['coordinator'] ?? null,
    $notes,
    $proofStatus,
  ]);
  $newId = (int) $pdo->lastInsertId();

  if ($fromAllocations) {
    $link = $pdo->prepare("UPDATE allocations SET distribution_id = ?, status = 'Scheduled' WHERE id = ?");
    foreach ($fromAllocations as $a) {
      $link->execute([$newId, (int) $a['id']]);
    }

    // Also update linked assistance requests to In Distribution
    $reqIds = array_values(array_unique(array_filter(array_map(fn($a) => !empty($a['assistance_request_id']) ? (int) $a['assistance_request_id'] : null, $fromAllocations))));
    if (!empty($reqIds)) {
      $inReq = implode(',', array_fill(0, count($reqIds), '?'));
      $pdo->prepare("UPDATE assistance_requests SET status = 'In Distribution' WHERE id IN ($inReq) AND status NOT IN ('Completed', 'Rejected', 'Cancelled')")
        ->execute($reqIds);
    }
  }

  notify_admins($pdo, 'distribution', 'New distribution planned', "Distribution {$code} scheduled for {$location}", '/admin/distributions?focus=drafts#distributions-drafts');
  audit_log($pdo, 'create', 'distribution', $code, "Planned distribution for {$location}" . ($allocationIds ? ' from allocations' : ''));
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Distribution id is required'], 400);
  }
  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Distribution not found'], 404);
  }

  $isApproveAction = in_array($body['action'] ?? '', ['approve_proof_and_complete', 'approve-proof'], true);
  if ($isApproveAction) {
    $body['status'] = 'Completed';
    $body['proofStatus'] = 'Proof Verified';
    $body['forceComplete'] = true;
  }

  $newStatus = normalize_distribution_status((string) ($body['status'] ?? $existing['status']));
  if (!is_valid_distribution_status($newStatus)) {
    json_response([
      'ok' => false,
      'error' => 'Invalid distribution status. Use: ' . implode(', ', distribution_workflow_steps()),
    ], 400);
  }

  assert_valid_status_transition(
    'Distribution',
    (string) ($existing['status'] ?? ''),
    $newStatus,
    WORKFLOW_DISTRIBUTION_STEPS,
    WORKFLOW_DISTRIBUTION_TERMINAL,
    [],
    WORKFLOW_DISTRIBUTION_ALIASES
  );
  $proofStatus = $body['proofStatus'] ?? $existing['proof_status'];
  $allowedProof = ['Not Required', 'Awaiting Proof', 'Proof Submitted', 'Proof Verified', 'Proof Rejected'];
  if (!in_array((string) $proofStatus, $allowedProof, true)) {
    $proofStatus = $existing['proof_status'] ?? 'Not Required';
  }

  if ($newStatus === 'Delivered' && in_array((string) $proofStatus, ['Not Required', ''], true)) {
    $proofStatus = 'Awaiting Proof';
  }
  // Completed requires verified proof — Staff/Admin cannot skip barangay receipt/proof.
  if ($newStatus === 'Completed') {
    $existingProof = (string) ($existing['proof_status'] ?? '');
    $hasVerified = ($proofStatus === 'Proof Verified') || ($existingProof === 'Proof Verified');
    if (!$hasVerified && empty($body['forceComplete'])) {
      json_response([
        'ok' => false,
        'error' => 'Cannot mark Completed until proof is verified. Advance to Delivered, then wait for barangay receipt and proof approval.',
      ], 400);
    }
    $proofStatus = 'Proof Verified';
  }
  // Staff may only set early/mid workflow statuses (not Completed without proof).
  if (($user['role'] ?? '') === 'Staff' && $newStatus === 'Completed' && ($existing['proof_status'] ?? '') !== 'Proof Verified') {
    json_response([
      'ok' => false,
      'error' => 'Staff cannot complete a distribution before proof verification.',
    ], 403);
  }

  $type = $body['type'] ?? $existing['distribution_type'];
  $isDelivery = $type === 'Delivery';
  $beneficiaryId = array_key_exists('beneficiaryId', $body)
    ? (!empty($body['beneficiaryId']) ? (int) $body['beneficiaryId'] : null)
    : ($existing['beneficiary_id'] ? (int) $existing['beneficiary_id'] : null);
  if (array_key_exists('beneficiaryId', $body) && !$beneficiaryId) {
    json_response(['ok' => false, 'error' => 'Target barangay (beneficiary) is required for a distribution event'], 400);
  }
  if (array_key_exists('location', $body) && trim((string) $body['location']) === '') {
    json_response(['ok' => false, 'error' => 'Drop-off location / address is required for a distribution event'], 400);
  }
  if (array_key_exists('itemsSummary', $body) && trim((string) $body['itemsSummary']) === '') {
    json_response(['ok' => false, 'error' => 'Items to deliver / cargo summary cannot be empty'], 400);
  }
  $location = trim((string) ($body['location'] ?? $existing['location']));
  $eventName = array_key_exists('eventName', $body)
    ? (trim((string) $body['eventName']) ?: null)
    : ($existing['event_name'] ?? null);
  if ($eventName === null || $eventName === '') {
    $eventName = ($existing['code'] ?? 'DST') . ' — ' . $location;
  }

  if (array_key_exists('distributionDate', $body) && $body['distributionDate'] !== $existing['distribution_date']) {
    $newDistDate = trim((string) $body['distributionDate']);
    if ($newDistDate !== '' && $newDistDate < date('Y-m-d')) {
      json_response([
        'ok' => false,
        'error' => 'Distribution date cannot be in the past. Please select today or a future date.',
      ], 400);
    }
  }

  $update = $pdo->prepare('UPDATE distributions SET event_name = ?, location = ?, beneficiary_id = ?, program = ?, distribution_date = ?, schedule_time = ?, beneficiaries_count = ?, volunteers_count = ?, vehicles_count = ?, distance_km = ?, fuel_liters = ?, fuel_cost = ?, status = ?, distribution_type = ?, items_summary = ?, coordinator = ?, notes = ?, proof_status = ? WHERE id = ?');
  $update->execute([
    $eventName,
    $location,
    $beneficiaryId,
    $body['program'] ?? $existing['program'],
    $body['distributionDate'] ?? $existing['distribution_date'],
    array_key_exists('scheduleTime', $body) ? ($body['scheduleTime'] ?: null) : $existing['schedule_time'],
    (int) ($body['beneficiaries'] ?? $existing['beneficiaries_count']),
    (int) ($body['volunteers'] ?? $existing['volunteers_count']),
    (int) ($body['vehicles'] ?? $existing['vehicles_count']),
    $isDelivery ? (array_key_exists('distanceKm', $body) ? ($body['distanceKm'] !== '' ? (float) $body['distanceKm'] : null) : $existing['distance_km']) : null,
    $isDelivery ? (array_key_exists('fuelLiters', $body) ? ($body['fuelLiters'] !== '' ? (float) $body['fuelLiters'] : null) : $existing['fuel_liters']) : null,
    $isDelivery ? (array_key_exists('fuelCost', $body) ? ($body['fuelCost'] !== '' ? (float) $body['fuelCost'] : null) : $existing['fuel_cost']) : null,
    $newStatus,
    $type,
    $body['itemsSummary'] ?? $existing['items_summary'],
    $body['coordinator'] ?? $existing['coordinator'],
    $body['notes'] ?? $existing['notes'],
    $proofStatus,
    $id,
  ]);

  if (isset($body['allocationIds']) && is_array($body['allocationIds'])) {
    $allocIds = array_values(array_unique(array_filter(array_map('intval', $body['allocationIds']))));
    if (!empty($allocIds)) {
      $inClause = implode(',', array_fill(0, count($allocIds), '?'));
      // Unlink allocations previously linked to this distribution that were removed
      $pdo->prepare("UPDATE allocations SET distribution_id = NULL, status = 'Allocated' WHERE distribution_id = ? AND id NOT IN ($inClause)")
        ->execute(array_merge([(int) $id], $allocIds));
      // Link the updated allocation batch IDs
      $pdo->prepare("UPDATE allocations SET distribution_id = ?, status = 'In Distribution' WHERE id IN ($inClause)")
        ->execute(array_merge([(int) $id], $allocIds));
    } else {
      $pdo->prepare("UPDATE allocations SET distribution_id = NULL, status = 'Allocated' WHERE distribution_id = ?")
        ->execute([(int) $id]);
    }
  }

  if ($newStatus !== $existing['status']) {
    notify_admins($pdo, 'status_update', 'Distribution status updated', "Distribution {$existing['code']} is now {$newStatus}", '/admin/distributions?id=' . (int) $id . '#distributions-table');
    if ($newStatus === 'In Transit') {
      try {
        $pdo->prepare("UPDATE allocations SET status = 'In Transit' WHERE distribution_id = ? AND status <> 'Cancelled'")->execute([$id]);
        $pdo->prepare("UPDATE assistance_requests SET status = 'In Transit' WHERE id IN (SELECT assistance_request_id FROM allocations WHERE distribution_id = ? AND assistance_request_id IS NOT NULL) AND status NOT IN ('Delivered', 'Completed')")->execute([$id]);
      } catch (Throwable $e) {}
    }
    if (in_array($newStatus, ['Delivered', 'Completed'], true)) {
      try {
        $allocStmt = $pdo->prepare("SELECT id, inventory_item_id, deducted_quantity FROM allocations WHERE distribution_id = ? AND status IN ('Reserved','Allocated','In Distribution','Scheduled','In Transit') AND inventory_deducted = 1");
        $allocStmt->execute([$id]);
        $linkedAllocs = $allocStmt->fetchAll();
        foreach ($linkedAllocs as $la) {
          $invId = !empty($la['inventory_item_id']) ? (int) $la['inventory_item_id'] : null;
          $dQty = (int) ($la['deducted_quantity'] ?? 0);
          if ($invId && $dQty > 0) {
            $pdo->prepare("UPDATE inventory_items SET allocated = GREATEST(0, allocated - ?), distributed = distributed + ? WHERE id = ?")
              ->execute([$dQty, $dQty, $invId]);
          }
        }
        $pdo->prepare("UPDATE allocations SET status = 'Delivered' WHERE distribution_id = ? AND status IN ('Reserved','Allocated','In Distribution','Scheduled','In Transit')")
          ->execute([$id]);
        $pdo->prepare("UPDATE assistance_requests SET status = 'Delivered' WHERE id IN (SELECT assistance_request_id FROM allocations WHERE distribution_id = ? AND assistance_request_id IS NOT NULL) AND status NOT IN ('Completed')")->execute([$id]);
      } catch (Throwable $e) {
        // column may not exist yet pre-migrate
      }
    }
    // Auto-close linked request and finalize proofs/inventory when distribution is Completed
    if ($newStatus === 'Completed') {
      try {
        complete_distribution($pdo, (int) $id, (int) ($user['id'] ?? null));
      } catch (Throwable $e) {
        // best-effort
      }
    }
    // Revert allocations to Active/Allocated if distribution is Cancelled
    if ($newStatus === 'Cancelled') {
      try {
        $pdo->prepare("UPDATE allocations SET distribution_id = NULL, status = 'Allocated' WHERE distribution_id = ? AND status = 'In Distribution'")
          ->execute([$id]);
      } catch (Throwable $e) {}
    }
    // Email + in-app for barangay on In Transit / Delivered / Completed
    $freshForMail = array_merge($existing, [
      'status' => $newStatus,
      'beneficiary_id' => $beneficiaryId ?? ($existing['beneficiary_id'] ?? null),
    ]);
    notify_distribution_lifecycle($pdo, $freshForMail, (string) $newStatus, (string) ($existing['status'] ?? ''));
  }

  audit_log($pdo, 'update', 'distribution', $existing['code'], "Updated distribution" . ($newStatus !== $existing['status'] ? " (status: {$newStatus})" : ''));

  $stmt = $pdo->prepare('SELECT * FROM distributions WHERE id = ?');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_distribution($pdo, $stmt->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Distribution id is required'], 400);
  }
  $del = $pdo->prepare('SELECT code FROM distributions WHERE id = ?');
  $del->execute([$id]);
  $delCode = $del->fetchColumn();
  try {
    $pdo->prepare("UPDATE allocations SET distribution_id = NULL, status = 'Allocated' WHERE distribution_id = ?")->execute([$id]);
  } catch (Throwable $e) {
    // ignore if column missing
  }
  $pdo->prepare('DELETE FROM distributions WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'distribution', $delCode ?: (string) $id, 'Deleted distribution');
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
