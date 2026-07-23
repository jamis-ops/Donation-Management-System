<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

/**
 * Needs vs Available Stock monitoring.
 * Compares beneficiary/request need categories against inventory packs.
 */

$pdo = db();
require_auth(['Admin', 'Staff']);

function normalize_need_key(string $s): string
{
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', ' ', $s) ?? $s;
  return trim($s);
}

// Aggregate needs from approved beneficiaries + open assistance requests
$needCounts = [];

$benRows = $pdo->query("SELECT needs, category FROM beneficiaries WHERE status IN ('Approved','Pending Approval')")->fetchAll();
foreach ($benRows as $row) {
  $needs = [];
  if (!empty($row['needs'])) {
    $decoded = json_decode((string) $row['needs'], true);
    if (is_array($decoded)) {
      $needs = $decoded;
    }
  }
  if (!$needs && !empty($row['category'])) {
    $needs = array_map('trim', explode(',', (string) $row['category']));
  }
  foreach ($needs as $n) {
    $n = trim((string) $n);
    if ($n === '') continue;
    $key = normalize_need_key($n);
    if (!isset($needCounts[$key])) {
      $needCounts[$key] = ['label' => $n, 'requested' => 0];
    }
    $needCounts[$key]['requested'] += 1;
  }
}

$reqRows = $pdo->query("SELECT type, description FROM assistance_requests WHERE status IN ('Pending','Under Review','Approved')")->fetchAll();
foreach ($reqRows as $row) {
  $label = trim((string) ($row['type'] ?? ''));
  if ($label === '') continue;
  $key = normalize_need_key($label);
  if (!isset($needCounts[$key])) {
    $needCounts[$key] = ['label' => $label, 'requested' => 0];
  }
  $needCounts[$key]['requested'] += 1;
}

// Inventory available by category / item name (packs)
$invRows = $pdo->query('SELECT item_name, category, quantity, allocated, unit, stock_state FROM inventory_items')->fetchAll();
$stockByKey = [];
foreach ($invRows as $row) {
  $available = max(0, (int) $row['quantity'] - (int) $row['allocated']);
  foreach ([$row['category'], $row['item_name']] as $label) {
    $label = trim((string) $label);
    if ($label === '') continue;
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

// Simple allocation recommendations from open assistance requests + stock
$recommendations = [];
$openReqs = $pdo->query("
  SELECT ar.id, ar.code, ar.type, ar.description, ar.status, ar.priority, ar.beneficiary_id,
         b.full_name AS barangay, b.needs
  FROM assistance_requests ar
  LEFT JOIN beneficiaries b ON b.id = ar.beneficiary_id
  WHERE ar.status IN ('Pending','Under Review','Approved')
  ORDER BY FIELD(ar.priority,'Critical','High','Medium','Low'), ar.id DESC
  LIMIT 40
")->fetchAll();

foreach ($openReqs as $req) {
  $typeKey = normalize_need_key((string) ($req['type'] ?? ''));
  $best = null;
  $bestScore = -1;
  $bestAvail = 0;
  foreach ($invRows as $inv) {
    $avail = max(0, (int) $inv['quantity'] - (int) $inv['allocated']);
    if ($avail <= 0) continue;
    $catKey = normalize_need_key((string) ($inv['category'] ?? ''));
    $itemKey = normalize_need_key((string) ($inv['item_name'] ?? ''));
    $score = 0;
    if ($typeKey !== '' && ($typeKey === $catKey || $typeKey === $itemKey || str_contains($itemKey, $typeKey) || str_contains($catKey, $typeKey))) {
      $score += 50;
    }
    $score += min(30, $avail);
    $prioBoost = match ($req['priority'] ?? 'Medium') {
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
  if (!$best) continue;
  $qty = min(max(1, (int) ceil($bestAvail * 0.1)), $bestAvail, 50);
  $recommendations[] = [
    'assistanceRequestId' => (int) $req['id'],
    'requestCode' => $req['code'],
    'requestType' => $req['type'],
    'priority' => $req['priority'] ?? 'Medium',
    'beneficiaryId' => $req['beneficiary_id'] ? (int) $req['beneficiary_id'] : null,
    'beneficiary' => $req['barangay'] ?? '',
    'resource' => $best['item_name'],
    'inventoryId' => (int) $best['id'],
    'quantity' => $qty,
    'available' => $bestAvail,
    'unit' => $best['unit'] ?: 'packs',
    'score' => $bestScore,
    'reason' => "Matches need \"{$req['type']}\" with {$bestAvail} packs available",
  ];
}

usort($recommendations, fn($a, $b) => $b['score'] <=> $a['score']);

json_response([
  'ok' => true,
  'data' => [
    'summary' => $summary,
    'comparison' => $comparison,
    'recommendations' => array_slice($recommendations, 0, 20),
  ],
]);
