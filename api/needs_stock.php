<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

/**
 * Needs vs Available Stock monitoring + allocation recommendations.
 * Recommendations use beneficiary needs × affected families, matched to inventory.
 */

$pdo = db();
require_auth(['Admin', 'Staff']);

function normalize_need_key(string $s): string
{
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', ' ', $s) ?? $s;
  return trim($s);
}

function decode_needs_list(?string $json, ?string $categoryFallback = null): array
{
  $needs = [];
  if ($json) {
    $decoded = json_decode($json, true);
    if (is_array($decoded)) {
      $needs = $decoded;
    }
  }
  if (!$needs && $categoryFallback) {
    $needs = array_map('trim', explode(',', $categoryFallback));
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

function inventory_match_score(string $needKey, array $inv): int
{
  if ($needKey === '') {
    return 0;
  }
  $catKey = normalize_need_key((string) ($inv['category'] ?? ''));
  $itemKey = normalize_need_key((string) ($inv['item_name'] ?? ''));
  if ($needKey === $catKey || $needKey === $itemKey) {
    return 80;
  }
  if ($catKey !== '' && (str_contains($itemKey, $needKey) || str_contains($catKey, $needKey) || str_contains($needKey, $catKey) || str_contains($needKey, $itemKey))) {
    return 55;
  }
  return 0;
}

// ---------- Aggregate needs (families × need labels) ----------
$needCounts = [];

$benRows = $pdo->query("
  SELECT id, full_name, barangay, municipality, affected_families, needs, category, status
  FROM beneficiaries
  WHERE status IN ('Approved','Pending Approval')
")->fetchAll();

foreach ($benRows as $row) {
  $families = max(1, (int) ($row['affected_families'] ?? 0));
  $needs = decode_needs_list($row['needs'] ?? null, $row['category'] ?? null);
  foreach ($needs as $n) {
    $key = normalize_need_key($n);
    if (!isset($needCounts[$key])) {
      $needCounts[$key] = ['label' => $n, 'requested' => 0, 'barangays' => 0];
    }
    $needCounts[$key]['requested'] += $families; // packs ≈ 1 per family per need
    $needCounts[$key]['barangays'] += 1;
  }
}

$reqRows = $pdo->query("SELECT type, description FROM assistance_requests WHERE status IN ('Pending','Under Review','Approved')")->fetchAll();
foreach ($reqRows as $row) {
  $label = trim((string) ($row['type'] ?? ''));
  if ($label === '') {
    continue;
  }
  $key = normalize_need_key($label);
  if (!isset($needCounts[$key])) {
    $needCounts[$key] = ['label' => $label, 'requested' => 0, 'barangays' => 0];
  }
  // Requests without family context still count as demand signal
  $needCounts[$key]['requested'] += 1;
}

// Inventory available by category / item name (packs)
$invRows = $pdo->query('SELECT id, item_name, category, quantity, allocated, unit, stock_state FROM inventory_items')->fetchAll();
$stockByKey = [];
foreach ($invRows as $row) {
  $available = max(0, (int) $row['quantity'] - (int) $row['allocated']);
  foreach ([$row['category'], $row['item_name']] as $label) {
    $label = trim((string) $label);
    if ($label === '') {
      continue;
    }
    $key = normalize_need_key($label);
    if (!isset($stockByKey[$key])) {
      $stockByKey[$key] = ['label' => $label, 'available' => 0, 'unit' => $row['unit'] ?: 'packs'];
    }
    $stockByKey[$key]['available'] += $available;
  }
}

$comparison = [];
$allKeys = array_unique(array_merge(array_keys($needCounts), array_keys($stockByKey)));
sort($allKeys);

foreach ($allKeys as $key) {
  $requested = (int) ($needCounts[$key]['requested'] ?? 0);
  $available = (int) ($stockByKey[$key]['available'] ?? 0);
  $label = $needCounts[$key]['label'] ?? $stockByKey[$key]['label'] ?? $key;
  $gap = $available - $requested;
  if ($requested > 0 && $available <= 0) {
    $indicator = 'shortage';
  } elseif ($gap < 0) {
    $indicator = 'shortage';
  } elseif ($requested === 0 && $available > 0) {
    $indicator = 'excess';
  } elseif ($gap > max(2, (int) ceil($requested * 0.25))) {
    $indicator = 'excess';
  } else {
    $indicator = 'sufficient';
  }
  $comparison[] = [
    'key' => $key,
    'label' => $label,
    'requested' => $requested,
    'available' => $available,
    'gap' => $gap,
    'unit' => $stockByKey[$key]['unit'] ?? 'packs',
    'indicator' => $indicator,
    'barangays' => (int) ($needCounts[$key]['barangays'] ?? 0),
  ];
}

usort($comparison, static function ($a, $b) {
  $order = ['shortage' => 0, 'sufficient' => 1, 'excess' => 2];
  return ($order[$a['indicator']] ?? 9) <=> ($order[$b['indicator']] ?? 9)
    ?: $b['requested'] <=> $a['requested'];
});

$summary = [
  'shortage' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'shortage')),
  'sufficient' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'sufficient')),
  'excess' => count(array_filter($comparison, fn($c) => $c['indicator'] === 'excess')),
  'totalAvailablePacks' => (int) array_sum(array_column($invRows, 'quantity')) - (int) array_sum(array_map(fn($r) => (int) $r['allocated'], $invRows)),
];

// Existing open allocations (avoid duplicate recommendations for same barangay + resource)
$openAlloc = $pdo->query("
  SELECT beneficiary_id, LOWER(resource_name) AS resource_key, SUM(quantity) AS qty
  FROM allocations
  WHERE status IN ('Pending','Reserved','Allocated')
    AND beneficiary_id IS NOT NULL
  GROUP BY beneficiary_id, LOWER(resource_name)
")->fetchAll();
$allocatedMap = [];
foreach ($openAlloc as $a) {
  $allocatedMap[(int) $a['beneficiary_id'] . '|' . $a['resource_key']] = (int) $a['qty'];
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
    $avail = max(0, (int) $inv['quantity'] - (int) $inv['allocated']);
    if ($avail <= 0) {
      continue;
    }
    $match = inventory_match_score($needKey, $inv);
    if ($match <= 0) {
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

  $needed = max(1, $families); // 1 pack per affected family for this need
  $remainingNeed = max(0, $needed - $alreadyAllocated);
  if ($remainingNeed <= 0) {
    return null;
  }
  $qty = min($remainingNeed, $bestAvail);

  $reason = sprintf(
    '%d affected families need "%s"; suggesting %d of %d available packs%s',
    $families,
    $needLabel,
    $qty,
    $bestAvail,
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

// 1) Assistance requests (preferred when present)
$openReqs = $pdo->query("
  SELECT ar.id, ar.code, ar.type, ar.description, ar.status, ar.priority, ar.beneficiary_id,
         b.full_name AS barangay, b.needs, b.category, b.affected_families
  FROM assistance_requests ar
  LEFT JOIN beneficiaries b ON b.id = ar.beneficiary_id
  WHERE ar.status IN ('Pending','Under Review','Approved')
  ORDER BY FIELD(ar.priority,'Critical','High','Medium','Low'), ar.id DESC
  LIMIT 50
")->fetchAll();

foreach ($openReqs as $req) {
  $families = max(1, (int) ($req['affected_families'] ?? 0));
  $benNeeds = decode_needs_list($req['needs'] ?? null, $req['category'] ?? null);
  $requestNeed = trim((string) ($req['type'] ?? ''));
  $needLabels = $requestNeed !== '' ? array_values(array_unique(array_merge([$requestNeed], $benNeeds))) : $benNeeds;
  if (!$needLabels) {
    continue;
  }

  foreach ($needLabels as $needLabel) {
    $resourceGuess = ''; // match against inventory later
    // Prefer inventory item that matches; alreadyAllocated keyed by resource name after match — use need key loosely
    $already = 0;
    $benId = $req['beneficiary_id'] ? (int) $req['beneficiary_id'] : 0;
    // Sum any open allocation whose resource loosely matches this need
    if ($benId) {
      foreach ($allocatedMap as $k => $qty) {
        if (!str_starts_with($k, $benId . '|')) {
          continue;
        }
        $resKey = substr($k, strlen((string) $benId) + 1);
        $needKey = normalize_need_key($needLabel);
        if ($resKey === $needKey || str_contains($resKey, $needKey) || str_contains($needKey, $resKey)) {
          $already += (int) $qty;
        }
      }
    }

    $rec = build_need_recommendation($invRows, $needLabel, $families, $already, [
      'assistanceRequestId' => (int) $req['id'],
      'requestCode' => $req['code'],
      'requestType' => $req['type'],
      'beneficiaryNeeds' => $benNeeds,
      'priority' => $req['priority'] ?? 'Medium',
      'beneficiaryId' => $benId ?: null,
      'beneficiary' => $req['barangay'] ?? '',
    ]);
    if ($rec) {
      $recommendations[] = $rec;
    }
  }
}

// 2) Approved beneficiaries with needs but no duplicate of above request-based rows
$covered = [];
foreach ($recommendations as $r) {
  if (!empty($r['beneficiaryId']) && !empty($r['need'])) {
    $covered[$r['beneficiaryId'] . '|' . normalize_need_key($r['need'])] = true;
  }
}

foreach ($benRows as $ben) {
  if (($ben['status'] ?? '') !== 'Approved') {
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
    foreach ($allocatedMap as $k => $qty) {
      if (!str_starts_with($k, $benId . '|')) {
        continue;
      }
      $resKey = substr($k, strlen((string) $benId) + 1);
      $needKey = normalize_need_key($needLabel);
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

// Beneficiary needs cards for Allocation UI
$beneficiaryCards = [];
foreach ($benRows as $ben) {
  if (!in_array($ben['status'] ?? '', ['Approved', 'Pending Approval'], true)) {
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

json_response([
  'ok' => true,
  'data' => [
    'summary' => $summary,
    'comparison' => $comparison,
    'recommendations' => array_slice($recommendations, 0, 30),
    'beneficiaries' => $beneficiaryCards,
  ],
]);
