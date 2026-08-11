<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

/**
 * Needs vs Available Stock monitoring + allocation recommendations.
 *
 * Demand = open assistance request needs (needs_json / assistance_type),
 * weighted by families affected.
 * Supply = inventory available (quantity − allocated), matched by category / item name.
 */

$pdo = db();
require_auth(['Admin', 'Staff']);

$action = $_GET['action'] ?? 'overview';

function normalize_need_key(string $s): string
{
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', ' ', $s) ?? $s;
  return trim(preg_replace('/\s+/', ' ', $s) ?? $s);
}

function decode_needs_list(?string $json, ?string $fallbackCsv = null): array
{
  $needs = [];
  if ($json) {
    $decoded = json_decode($json, true);
    if (is_array($decoded)) {
      $needs = $decoded;
    }
  }
  if (!$needs && $fallbackCsv) {
    // assistance_type is often "Rice, Hygiene Kits" — split on commas
    $needs = preg_split('/\s*,\s*/', $fallbackCsv) ?: [];
  }
  $out = [];
  foreach ($needs as $n) {
    $n = trim((string) $n);
    if ($n !== '') {
      $out[] = $n;
    }
  }
  return array_values(array_unique($out));
}

function parse_families_from_notes(?string $notes): int
{
  if ($notes && preg_match('/Families\s*Affected\s*:\s*(\d+)/i', $notes, $m)) {
    return max(1, (int) $m[1]);
  }
  return 0;
}

/**
 * Score how well an inventory row matches a need label.
 * Prefer exact category, then exact item name, then fuzzy contains.
 */
function inventory_match_score(string $needKey, array $inv): int
{
  if ($needKey === '') {
    return 0;
  }
  $catKey = normalize_need_key((string) ($inv['category'] ?? ''));
  $itemKey = normalize_need_key((string) ($inv['item_name'] ?? ''));

  if ($catKey !== '' && $needKey === $catKey) {
    return 100;
  }
  if ($itemKey !== '' && $needKey === $itemKey) {
    return 90;
  }
  // "rice packs" contains "rice", "hygiene kits" ↔ "hygiene"
  if ($catKey !== '' && (str_contains($catKey, $needKey) || str_contains($needKey, $catKey))) {
    return 70;
  }
  if ($itemKey !== '' && (str_contains($itemKey, $needKey) || str_contains($needKey, $itemKey))) {
    return 60;
  }
  return 0;
}

function inventory_available(array $inv): int
{
  return max(0, (int) ($inv['quantity'] ?? 0) - (int) ($inv['allocated'] ?? 0));
}

// ---------- Inventory (live) ----------
try {
  $invRows = $pdo->query('
    SELECT id, item_name, category, quantity, allocated, unit, stock_state
    FROM inventory_items
    ORDER BY item_name ASC
  ')->fetchAll();
} catch (Throwable $e) {
  $invRows = $pdo->query('
    SELECT id, item_name, category, quantity, allocated, unit
    FROM inventory_items
    ORDER BY item_name ASC
  ')->fetchAll();
}

// ---------- Demand from open beneficiary requests (primary source) ----------
$OPEN_REQUEST_STATUSES = ['Pending Review', 'Under Review', 'Approved', 'Allocated'];
$statusPlaceholders = implode(',', array_fill(0, count($OPEN_REQUEST_STATUSES), '?'));

$reqStmt = $pdo->prepare("
  SELECT
    ar.id,
    ar.reference_code,
    ar.assistance_type,
    ar.notes,
    ar.needs_json,
    ar.status,
    ar.priority,
    ar.beneficiary_id,
    b.full_name AS barangay,
    b.needs AS beneficiary_needs,
    b.category AS beneficiary_category,
    b.affected_families,
    b.status AS beneficiary_status
  FROM assistance_requests ar
  LEFT JOIN beneficiaries b ON b.id = ar.beneficiary_id
  WHERE ar.status IN ({$statusPlaceholders})
  ORDER BY FIELD(ar.priority, 'Critical', 'High', 'Medium', 'Low'), ar.id DESC
");
$reqStmt->execute($OPEN_REQUEST_STATUSES);
$reqRows = $reqStmt->fetchAll();

$needCounts = []; // key => stats
foreach ($reqRows as $row) {
  $needs = decode_needs_list($row['needs_json'] ?? null, $row['assistance_type'] ?? null);
  if (!$needs) {
    // Fall back to barangay profile needs when the request has no structured list
    $needs = decode_needs_list($row['beneficiary_needs'] ?? null, $row['beneficiary_category'] ?? null);
  }
  if (!$needs) {
    continue;
  }

  $families = parse_families_from_notes($row['notes'] ?? null);
  if ($families <= 0) {
    $families = max(1, (int) ($row['affected_families'] ?? 1));
  }

  $seenKeys = [];
  foreach ($needs as $needLabel) {
    $key = normalize_need_key($needLabel);
    if ($key === '' || isset($seenKeys[$key])) {
      continue;
    }
    $seenKeys[$key] = true;

    if (!isset($needCounts[$key])) {
      $needCounts[$key] = [
        'label' => $needLabel,
        'requested' => 0,
        'barangays' => 0,
        'requests' => 0,
        'beneficiaryIds' => [],
      ];
    }
    // 1 pack (unit) per affected family per need type
    $needCounts[$key]['requested'] += $families;
    $needCounts[$key]['requests'] += 1;
    $benId = (int) ($row['beneficiary_id'] ?? 0);
    if ($benId > 0 && !isset($needCounts[$key]['beneficiaryIds'][$benId])) {
      $needCounts[$key]['beneficiaryIds'][$benId] = true;
      $needCounts[$key]['barangays'] += 1;
    }
  }
}

// ---------- Match inventory to needs (each item assigned to best matching need) ----------
$stockForNeed = []; // needKey => ['available' => int, 'unit' =>, 'items' => []]
$unmatchedStock = []; // key => stock for inventory with no open demand

foreach ($invRows as $inv) {
  $avail = inventory_available($inv);
  if ($avail <= 0) {
    continue;
  }
  // Skip items marked unavailable when column exists
  $state = strtolower((string) ($inv['stock_state'] ?? 'available'));
  if ($state !== '' && !in_array($state, ['available', 'in stock', 'active'], true)) {
    // Still count Reserved/Allocated via quantity−allocated; ignore Damaged/Expired if labeled so
    if (in_array($state, ['damaged', 'expired', 'disposed', 'unavailable'], true)) {
      continue;
    }
  }

  $bestKey = null;
  $bestScore = 0;
  foreach ($needCounts as $needKey => $_stats) {
    $score = inventory_match_score($needKey, $inv);
    if ($score > $bestScore) {
      $bestScore = $score;
      $bestKey = $needKey;
    }
  }

  $unit = trim((string) ($inv['unit'] ?? '')) ?: 'packs';
  $itemLabel = trim((string) ($inv['item_name'] ?? 'Item'));

  if ($bestKey !== null && $bestScore >= 60) {
    if (!isset($stockForNeed[$bestKey])) {
      $stockForNeed[$bestKey] = ['available' => 0, 'unit' => $unit, 'items' => []];
    }
    $stockForNeed[$bestKey]['available'] += $avail;
    $stockForNeed[$bestKey]['items'][] = [
      'id' => (int) $inv['id'],
      'item' => $itemLabel,
      'category' => (string) ($inv['category'] ?? ''),
      'available' => $avail,
      'unit' => $unit,
      'matchScore' => $bestScore,
    ];
  } else {
    // Excess / unmatched stock — group by category then item
    $cat = trim((string) ($inv['category'] ?? ''));
    $label = $cat !== '' ? $cat : $itemLabel;
    $key = normalize_need_key($label);
    if ($key === '') {
      continue;
    }
    if (!isset($unmatchedStock[$key])) {
      $unmatchedStock[$key] = ['label' => $label, 'available' => 0, 'unit' => $unit];
    }
    $unmatchedStock[$key]['available'] += $avail;
  }
}

// ---------- Comparison rows ----------
$comparison = [];
foreach ($needCounts as $key => $stats) {
  $available = (int) ($stockForNeed[$key]['available'] ?? 0);
  $requested = (int) $stats['requested'];
  $gap = $available - $requested;
  if ($requested > 0 && $available <= 0) {
    $indicator = 'shortage';
  } elseif ($gap < 0) {
    $indicator = 'shortage';
  } elseif ($gap > max(2, (int) ceil($requested * 0.25))) {
    $indicator = 'excess';
  } else {
    $indicator = 'sufficient';
  }

  $coverage = $requested > 0 ? min(100, (int) round(($available / $requested) * 100)) : ($available > 0 ? 100 : 0);

  $comparison[] = [
    'key' => $key,
    'label' => $stats['label'],
    'requested' => $requested,
    'available' => $available,
    'gap' => $gap,
    'coverage' => $coverage,
    'unit' => $stockForNeed[$key]['unit'] ?? 'packs',
    'indicator' => $indicator,
    'barangays' => (int) $stats['barangays'],
    'requests' => (int) $stats['requests'],
    'matchedItems' => $stockForNeed[$key]['items'] ?? [],
  ];
}

// Inventory with no matching open need → excess signal
foreach ($unmatchedStock as $key => $stock) {
  if (isset($needCounts[$key])) {
    continue;
  }
  $comparison[] = [
    'key' => 'stock:' . $key,
    'label' => $stock['label'],
    'requested' => 0,
    'available' => (int) $stock['available'],
    'gap' => (int) $stock['available'],
    'coverage' => 100,
    'unit' => $stock['unit'],
    'indicator' => 'excess',
    'barangays' => 0,
    'requests' => 0,
    'matchedItems' => [],
  ];
}

usort($comparison, static function ($a, $b) {
  $order = ['shortage' => 0, 'sufficient' => 1, 'excess' => 2];
  return ($order[$a['indicator']] ?? 9) <=> ($order[$b['indicator']] ?? 9)
    ?: $b['requested'] <=> $a['requested']
    ?: strcasecmp((string) $a['label'], (string) $b['label']);
});

$totalAvailablePacks = 0;
foreach ($invRows as $inv) {
  $totalAvailablePacks += inventory_available($inv);
}

$summary = [
  'shortage' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'shortage')),
  'sufficient' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'sufficient')),
  'excess' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'excess')),
  'totalRequested' => (int) array_sum(array_map(fn($c) => (int) $c['requested'], $comparison)),
  'totalAvailablePacks' => $totalAvailablePacks,
  'openRequests' => count($reqRows),
  'inventoryItems' => count($invRows),
];

// ---------- Open allocations (avoid duplicate recommendations) ----------
$allocatedMap = [];
try {
  $openAlloc = $pdo->query("
    SELECT beneficiary_id, LOWER(resource_name) AS resource_key, SUM(quantity) AS qty
    FROM allocations
    WHERE status IN ('Pending', 'Reserved', 'Allocated')
      AND beneficiary_id IS NOT NULL
    GROUP BY beneficiary_id, LOWER(resource_name)
  ")->fetchAll();
  foreach ($openAlloc as $a) {
    $allocatedMap[(int) $a['beneficiary_id'] . '|' . $a['resource_key']] = (int) $a['qty'];
  }
} catch (Throwable $e) {
  // allocations table / columns may differ pre-migrate
}

/**
 * Find best inventory match for a need label and suggest qty based on families.
 */
function build_need_recommendation(
  array $invRows,
  string $needLabel,
  int $families,
  int $alreadyAllocated,
  array $meta
): ?array {
  $needKey = normalize_need_key($needLabel);
  $best = null;
  $bestScore = -1;
  $bestAvail = 0;

  foreach ($invRows as $inv) {
    $avail = inventory_available($inv);
    if ($avail <= 0) {
      continue;
    }
    $match = inventory_match_score($needKey, $inv);
    if ($match < 60) {
      continue;
    }
    $score = $match + min(25, $avail);
    $prioBoost = match ($meta['priority'] ?? 'Medium') {
      'Critical' => 40,
      'High' => 25,
      'Low' => 0,
      default => 10,
    };
    $score += $prioBoost;
    if ($score > $bestScore) {
      $bestScore = $score;
      $best = $inv;
      $bestAvail = $avail;
    }
  }

  if (!$best) {
    return null;
  }

  $needed = max(1, $families);
  $remainingNeed = max(0, $needed - $alreadyAllocated);
  if ($remainingNeed <= 0) {
    return null;
  }
  $qty = min($remainingNeed, $bestAvail);

  $reason = sprintf(
    '%d affected families need "%s"; suggesting %d of %d available %s%s',
    $families,
    $needLabel,
    $qty,
    $bestAvail,
    $best['unit'] ?: 'packs',
    $alreadyAllocated > 0 ? " ({$alreadyAllocated} already allocated)" : ''
  );

  return [
    'assistanceRequestId' => $meta['assistanceRequestId'] ?? null,
    'requestCode' => $meta['requestCode'] ?? null,
    'requestType' => $meta['requestType'] ?? $needLabel,
    'need' => $needLabel,
    'beneficiaryNeeds' => $meta['beneficiaryNeeds'] ?? [],
    'priority' => $meta['priority'] ?? 'Medium',
    'beneficiaryId' => $meta['beneficiaryId'] ?? null,
    'beneficiary' => $meta['beneficiary'] ?? '',
    'affectedFamilies' => $families,
    'resource' => $best['item_name'],
    'inventoryId' => (int) $best['id'],
    'quantity' => $qty,
    'needed' => $needed,
    'alreadyAllocated' => $alreadyAllocated,
    'available' => $bestAvail,
    'unit' => $best['unit'] ?: 'packs',
    'score' => $bestScore,
    'reason' => $reason,
  ];
}

$recommendations = [];
$covered = [];

foreach ($reqRows as $req) {
  $families = parse_families_from_notes($req['notes'] ?? null);
  if ($families <= 0) {
    $families = max(1, (int) ($req['affected_families'] ?? 1));
  }
  $benNeeds = decode_needs_list($req['needs_json'] ?? null, $req['assistance_type'] ?? null);
  if (!$benNeeds) {
    $benNeeds = decode_needs_list($req['beneficiary_needs'] ?? null, $req['beneficiary_category'] ?? null);
  }
  if (!$benNeeds) {
    continue;
  }

  $benId = $req['beneficiary_id'] ? (int) $req['beneficiary_id'] : 0;
  foreach ($benNeeds as $needLabel) {
    $already = 0;
    if ($benId) {
      $needKey = normalize_need_key($needLabel);
      foreach ($allocatedMap as $k => $qty) {
        if (!str_starts_with($k, $benId . '|')) {
          continue;
        }
        $resKey = normalize_need_key(substr($k, strlen((string) $benId) + 1));
        if ($resKey === $needKey || str_contains($resKey, $needKey) || str_contains($needKey, $resKey)) {
          $already += (int) $qty;
        }
      }
    }

    $rec = build_need_recommendation($invRows, $needLabel, $families, $already, [
      'assistanceRequestId' => (int) $req['id'],
      'requestCode' => $req['reference_code'],
      'requestType' => $req['assistance_type'],
      'beneficiaryNeeds' => $benNeeds,
      'priority' => $req['priority'] ?? 'Medium',
      'beneficiaryId' => $benId ?: null,
      'beneficiary' => $req['barangay'] ?? '',
    ]);
    if ($rec) {
      $recommendations[] = $rec;
      if ($benId) {
        $covered[$benId . '|' . normalize_need_key($needLabel)] = true;
      }
    }
  }
}

// Approved/Active barangays with profile needs but no open request covering that need
$benRows = $pdo->query("
  SELECT id, full_name, barangay, municipality, affected_families, needs, category, status
  FROM beneficiaries
  WHERE status IN ('Active', 'Approved', 'Pending Approval')
")->fetchAll();

foreach ($benRows as $ben) {
  if (!in_array($ben['status'] ?? '', ['Active', 'Approved'], true)) {
    continue;
  }
  $families = max(1, (int) ($ben['affected_families'] ?? 0));
  $benNeeds = decode_needs_list($ben['needs'] ?? null, $ben['category'] ?? null);
  if (!$benNeeds) {
    continue;
  }
  $benId = (int) $ben['id'];
  foreach ($benNeeds as $needLabel) {
    $coverKey = $benId . '|' . normalize_need_key($needLabel);
    if (isset($covered[$coverKey])) {
      continue;
    }
    $already = 0;
    $needKey = normalize_need_key($needLabel);
    foreach ($allocatedMap as $k => $qty) {
      if (!str_starts_with($k, $benId . '|')) {
        continue;
      }
      $resKey = normalize_need_key(substr($k, strlen((string) $benId) + 1));
      if ($resKey === $needKey || str_contains($resKey, $needKey) || str_contains($needKey, $resKey)) {
        $already += (int) $qty;
      }
    }
    $rec = build_need_recommendation($invRows, $needLabel, $families, $already, [
      'assistanceRequestId' => null,
      'requestCode' => null,
      'requestType' => $needLabel,
      'beneficiaryNeeds' => $benNeeds,
      'priority' => 'Medium',
      'beneficiaryId' => $benId,
      'beneficiary' => $ben['full_name'] ?? '',
    ]);
    if ($rec) {
      $recommendations[] = $rec;
      $covered[$coverKey] = true;
    }
  }
}

usort($recommendations, fn($a, $b) => $b['score'] <=> $a['score']);

$beneficiaryCards = [];
foreach ($benRows as $ben) {
  if (!in_array($ben['status'] ?? '', ['Active', 'Approved', 'Pending Approval'], true)) {
    continue;
  }
  $needs = decode_needs_list($ben['needs'] ?? null, $ben['category'] ?? null);
  if (!$needs && (int) ($ben['affected_families'] ?? 0) <= 0) {
    continue;
  }
  $beneficiaryCards[] = [
    'beneficiaryId' => (int) $ben['id'],
    'name' => $ben['full_name'] ?? '',
    'barangay' => $ben['barangay'] ?? '',
    'municipality' => $ben['municipality'] ?? '',
    'affectedFamilies' => (int) ($ben['affected_families'] ?? 0),
    'needs' => $needs,
    'status' => $ben['status'] ?? '',
  ];
}

// ========== BARANGAY ANALYSIS ENDPOINT ==========
// GET /api/needs_stock.php?action=barangay_analysis&barangay_id=X
if ($action === 'barangay_analysis') {
  $barangayId = isset($_GET['barangay_id']) ? (int) $_GET['barangay_id'] : 0;
  
  if ($barangayId <= 0) {
    json_response(['ok' => false, 'error' => 'barangay_id is required'], 400);
  }

  // Get barangay/beneficiary details
  $benStmt = $pdo->prepare('
    SELECT id, code, full_name, barangay, municipality, address, affected_families, 
           needs, category, representative_name, representative_phone, status
    FROM beneficiaries
    WHERE id = ?
    LIMIT 1
  ');
  $benStmt->execute([$barangayId]);
  $barangay = $benStmt->fetch();
  
  if (!$barangay) {
    json_response(['ok' => false, 'error' => 'Barangay not found'], 404);
  }

  // Get open assistance requests for this barangay
  $reqStmt = $pdo->prepare('
    SELECT id, reference_code, assistance_type, needs_json, priority, status, 
           request_date, notes
    FROM assistance_requests
    WHERE beneficiary_id = ?
      AND status IN ("Pending Review", "Under Review", "Approved", "Allocated")
    ORDER BY FIELD(priority, "Critical", "High", "Medium", "Low"), request_date DESC
  ');
  $reqStmt->execute([$barangayId]);
  $openRequests = $reqStmt->fetchAll();

  // Aggregate all needs from requests + barangay profile
  $allNeeds = [];
  $priorityWeight = ['Critical' => 4, 'High' => 3, 'Medium' => 2, 'Low' => 1];
  $maxPriority = 'Medium';
  $maxPriorityValue = 2;

  foreach ($openRequests as $req) {
    $reqNeeds = decode_needs_list($req['needs_json'] ?? null, $req['assistance_type'] ?? null);
    foreach ($reqNeeds as $need) {
      $allNeeds[] = $need;
    }
    $reqPrio = $req['priority'] ?? 'Medium';
    if (($priorityWeight[$reqPrio] ?? 2) > $maxPriorityValue) {
      $maxPriority = $reqPrio;
      $maxPriorityValue = $priorityWeight[$reqPrio];
    }
  }

  // Add barangay profile needs
  $profileNeeds = decode_needs_list($barangay['needs'] ?? null, $barangay['category'] ?? null);
  foreach ($profileNeeds as $need) {
    $allNeeds[] = $need;
  }

  // Deduplicate and count occurrences
  $needCounts = [];
  foreach ($allNeeds as $need) {
    $key = normalize_need_key($need);
    if ($key === '') continue;
    if (!isset($needCounts[$key])) {
      $needCounts[$key] = ['label' => $need, 'count' => 0];
    }
    $needCounts[$key]['count']++;
  }

  // Sort by frequency (most requested first)
  usort($needCounts, fn($a, $b) => $b['count'] <=> $a['count']);

  $families = max(1, (int) ($barangay['affected_families'] ?? 1));

  // Get available inventory
  $invStmt = $pdo->query('
    SELECT id, code, item_name, category, quantity, allocated, unit
    FROM inventory_items
    WHERE (quantity - allocated) > 0
    ORDER BY item_name ASC
  ');
  $availableInventory = $invStmt->fetchAll();

  // Build smart pack recommendations
  $packRecommendations = [];
  $totalAvailable = 0;
  $totalNeeded = $families;
  $insufficientItems = [];
  $minPacksPossible = null; // Limit factor: the bottleneck item across all needs

  foreach ($needCounts as $needData) {
    $needLabel = $needData['label'];
    $needKey = normalize_need_key($needLabel);
    
    // Find best matching inventory items
    $matches = [];
    foreach ($availableInventory as $inv) {
      $score = inventory_match_score($needKey, $inv);
      if ($score > 0) {
        $available = inventory_available($inv);
        if ($available > 0) {
          $matches[] = [
            'score' => $score,
            'item' => $inv,
            'available' => $available,
          ];
        }
      }
    }

    // Sort by score (best match first)
    usort($matches, fn($a, $b) => $b['score'] <=> $a['score']);

    if (empty($matches)) {
      $insufficientItems[] = [
        'need' => $needLabel,
        'reason' => 'No matching inventory items found',
        'suggestedQuantity' => $families,
      ];
      $minPacksPossible = 0;
      continue;
    }

    // Take top match
    $bestMatch = $matches[0];
    $item = $bestMatch['item'];
    $available = $bestMatch['available'];
    
    // Calculate quantities
    $quantityPerPack = 1; // Default: 1 item per pack
    $totalRequired = $families * $quantityPerPack;
    $canFulfill = $available >= $totalRequired;
    $maxPacks = (int) floor($available / $quantityPerPack);
    
    // Update bottleneck count
    $minPacksPossible = ($minPacksPossible === null) ? $maxPacks : min($minPacksPossible, $maxPacks);

    $packRecommendations[] = [
      'need' => $needLabel,
      'needFrequency' => $needData['count'],
      'matchScore' => $bestMatch['score'],
      'inventoryItem' => [
        'id' => (int) $item['id'],
        'code' => $item['code'],
        'name' => $item['item_name'],
        'category' => $item['category'] ?? '',
        'unit' => $item['unit'],
        'available' => $available,
      ],
      'quantityPerPack' => $quantityPerPack,
      'totalRequired' => $totalRequired,
      'canFulfill' => $canFulfill,
      'maxPacks' => $maxPacks,
      'sufficiency' => $canFulfill ? 'Sufficient' : ($available > 0 ? 'Partial' : 'Insufficient'),
    ];

    if ($canFulfill) {
      $totalAvailable++;
    } elseif ($available > 0) {
      $insufficientItems[] = [
        'need' => $needLabel,
        'available' => $available,
        'required' => $totalRequired,
        'shortage' => $totalRequired - $available,
        'unit' => $item['unit'],
      ];
    }
  }

  // Handle case where no needs are listed
  if ($minPacksPossible === null) {
    $minPacksPossible = 0;
  }

  // Calculate overall sufficiency
  $sufficientCount = count(array_filter($packRecommendations, fn($r) => $r['sufficiency'] === 'Sufficient'));
  $partialCount = count(array_filter($packRecommendations, fn($r) => $r['sufficiency'] === 'Partial'));
  $insufficientCount = count($packRecommendations) - $sufficientCount - $partialCount + count($insufficientItems);

  $overallSufficiency = 'Insufficient';
  if ($sufficientCount === count($packRecommendations) && count($insufficientItems) === 0) {
    $overallSufficiency = 'Sufficient';
  } elseif ($sufficientCount + $partialCount >= count($packRecommendations) * 0.7) {
    $overallSufficiency = 'Partial';
  }

  // Generate suggested pack contents (top items that can be fulfilled)
  $suggestedContents = [];
  foreach ($packRecommendations as $rec) {
    if ($rec['canFulfill'] || $rec['sufficiency'] === 'Partial') {
      $suggestedContents[] = [
        'item' => $rec['inventoryItem']['name'],
        'itemId' => $rec['inventoryItem']['id'],
        'quantity' => $rec['quantityPerPack'],
        'unit' => $rec['inventoryItem']['unit'],
        'priority' => $rec['needFrequency'],
      ];
    }
  }

  json_response([
    'ok' => true,
    'data' => [
      'barangay' => [
        'id' => (int) $barangay['id'],
        'code' => $barangay['code'],
        'name' => $barangay['full_name'],
        'location' => $barangay['barangay'] ?? '',
        'municipality' => $barangay['municipality'] ?? '',
        'address' => $barangay['address'] ?? '',
        'affectedFamilies' => $families,
        'representative' => $barangay['representative_name'] ?? '',
        'representativePhone' => $barangay['representative_phone'] ?? '',
        'status' => $barangay['status'],
      ],
      'requests' => array_map(function($req) {
        return [
          'id' => (int) $req['id'],
          'code' => $req['reference_code'],
          'type' => $req['assistance_type'],
          'priority' => $req['priority'],
          'status' => $req['status'],
          'date' => $req['request_date'],
        ];
      }, $openRequests),
      'needs' => array_values($needCounts),
      'recommendations' => $packRecommendations,
      'suggestedContents' => $suggestedContents,
      'insufficientItems' => $insufficientItems,
      'analysis' => [
        'targetFamilies' => $families,
        'totalNeedTypes' => count($needCounts),
        'sufficientItems' => $sufficientCount,
        'partialItems' => $partialCount,
        'insufficientItems' => $insufficientCount,
        'overallSufficiency' => $overallSufficiency,
        'highestPriority' => $maxPriority,
        'canCreatePacks' => $overallSufficiency !== 'Insufficient',
        'estimatedPacksFromStock' => min($minPacksPossible, $families),
      ],
      'generatedAt' => date('c'),
    ],
  ]);
}

// ========== DEFAULT: OVERVIEW ENDPOINT ==========
json_response([
  'ok' => true,
  'data' => [
    'summary' => $summary,
    'comparison' => $comparison,
    'recommendations' => array_slice($recommendations, 0, 30),
    'beneficiaries' => $beneficiaryCards,
    'generatedAt' => date('c'),
  ],
]);
