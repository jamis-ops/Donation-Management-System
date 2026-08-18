<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
require_auth(['Admin', 'Staff']);

/** Format a peso amount into a short, human-readable string (₱1.2M / ₱980K / ₱750). */
function peso_short($amount): string
{
  $value = (float) $amount;
  if ($value >= 1_000_000) {
    return '₱' . rtrim(rtrim(number_format($value / 1_000_000, 1), '0'), '.') . 'M';
  }
  if ($value >= 1_000) {
    return '₱' . rtrim(rtrim(number_format($value / 1_000, 1), '0'), '.') . 'K';
  }
  return '₱' . number_format($value, 0);
}

$year = (int) date('Y');
$monthStart = date('Y-m-01');
$lastMonthStart = date('Y-m-01', strtotime('first day of last month'));
$lastMonthEnd = date('Y-m-t', strtotime('last day of last month'));

// -------- Summary stats (real-time) --------
$donationsThisMonth = (float) $pdo->query(
  "SELECT COALESCE(SUM(amount), 0) FROM donations
   WHERE type = 'Monetary' AND donation_date >= '{$monthStart}'"
)->fetchColumn();

$donationsLastMonth = (float) $pdo->query(
  "SELECT COALESCE(SUM(amount), 0) FROM donations
   WHERE type = 'Monetary' AND donation_date BETWEEN '{$lastMonthStart}' AND '{$lastMonthEnd}'"
)->fetchColumn();

$changePct = $donationsLastMonth > 0
  ? round((($donationsThisMonth - $donationsLastMonth) / $donationsLastMonth) * 100, 1)
  : ($donationsThisMonth > 0 ? 100.0 : 0.0);

$beneficiariesServed = (int) $pdo->query(
  "SELECT COALESCE(SUM(beneficiaries_count), 0) FROM distributions
   WHERE status IN ('Completed','Delivered') AND YEAR(distribution_date) = {$year}"
)->fetchColumn();

$distributionsCompleted = (int) $pdo->query(
  "SELECT COUNT(*) FROM distributions
   WHERE status IN ('Completed','Delivered') AND YEAR(distribution_date) = {$year}"
)->fetchColumn();

$volunteerHours = (int) $pdo->query(
  "SELECT COALESCE(SUM(hours), 0) FROM volunteers WHERE status IN ('Approved','Active','Assigned')"
)->fetchColumn();

$invTotals = $pdo->query(
  'SELECT COALESCE(SUM(quantity), 0) AS on_hand, COALESCE(SUM(distributed), 0) AS distributed FROM inventory_items'
)->fetch();
$onHand = (int) $invTotals['on_hand'];
$distributed = (int) $invTotals['distributed'];
$turnover = ($onHand + $distributed) > 0
  ? (int) round(($distributed / ($onHand + $distributed)) * 100)
  : 0;

// -------- Donations by month (last 6 months, ₱ thousands) --------
$donationRows = $pdo->query(
  "SELECT DATE_FORMAT(donation_date, '%Y-%m') AS ym,
          COALESCE(SUM(CASE WHEN type = 'Monetary' THEN amount ELSE 0 END), 0) AS amt,
          COUNT(*) AS cnt
   FROM donations
   WHERE donation_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
   GROUP BY ym"
)->fetchAll(PDO::FETCH_UNIQUE);

// -------- Beneficiaries served by month (last 6 months) --------
$servedRows = $pdo->query(
  "SELECT DATE_FORMAT(distribution_date, '%Y-%m') AS ym,
          COALESCE(SUM(beneficiaries_count), 0) AS served
   FROM distributions
   WHERE status IN ('Completed','Delivered')
     AND distribution_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
   GROUP BY ym"
)->fetchAll(PDO::FETCH_UNIQUE);

$donationsByMonth = [];
$beneficiariesByMonth = [];
for ($i = 5; $i >= 0; $i--) {
  $ts = strtotime(date('Y-m-01') . " -{$i} months");
  $ym = date('Y-m', $ts);
  $label = date('M', $ts);
  $donationsByMonth[] = [
    'month' => $label,
    'amount' => isset($donationRows[$ym]) ? round(((float) $donationRows[$ym]['amt']) / 1000, 1) : 0,
  ];
  $beneficiariesByMonth[] = [
    'month' => $label,
    'count' => isset($servedRows[$ym]) ? (int) $servedRows[$ym]['served'] : 0,
  ];
}

// -------- Trend datasets grouped by week / month / year (client toggles) --------
$trends = ['donations' => [], 'beneficiaries' => []];
foreach (['week', 'month', 'year'] as $gran) {
  $periods = build_periods($gran);

  $dExpr = period_group_expr('donation_date', $gran);
  $trends['donations'][$gran] = trend_series(
    $pdo,
    "SELECT $dExpr AS k,
            COALESCE(SUM(CASE WHEN type = 'Monetary' THEN amount ELSE 0 END), 0) AS amt,
            COUNT(*) AS cnt
     FROM donations GROUP BY k",
    $periods,
    fn($label, $row) => [
      'month' => $label,
      'amount' => $row ? round(((float) $row['amt']) / 1000, 1) : 0,
      'count' => $row ? (int) $row['cnt'] : 0,
    ]
  );

  $bExpr = period_group_expr('distribution_date', $gran);
  $trends['beneficiaries'][$gran] = trend_series(
    $pdo,
    "SELECT $bExpr AS k, COALESCE(SUM(beneficiaries_count), 0) AS served
     FROM distributions
     WHERE status IN ('Completed','Delivered')
     GROUP BY k",
    $periods,
    fn($label, $row) => [
      'month' => $label,
      'count' => $row ? (int) $row['served'] : 0,
    ]
  );
}

// -------- Beneficiaries by category (approved barangays) --------
$beneficiariesByCategory = [];
foreach ($pdo->query(
  "SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS label, COUNT(*) AS value
   FROM beneficiaries WHERE status IN ('Approved','Active')
   GROUP BY label ORDER BY value DESC"
)->fetchAll() as $row) {
  $beneficiariesByCategory[] = ['label' => $row['label'], 'value' => (int) $row['value']];
}

// -------- Distribution reach by location (top 6) --------
$distributionByLocation = [];
foreach ($pdo->query(
  "SELECT location AS label, COALESCE(SUM(beneficiaries_count), 0) AS value
   FROM distributions
   GROUP BY location ORDER BY value DESC LIMIT 6"
)->fetchAll() as $row) {
  $distributionByLocation[] = ['label' => $row['label'], 'value' => (int) $row['value']];
}

// -------- Allocated vs Distributed by program --------
$allocRows = $pdo->query(
  "SELECT COALESCE(NULLIF(program, ''), 'Unassigned') AS program,
          COALESCE(SUM(quantity), 0) AS allocated,
          COALESCE(SUM(CASE WHEN status IN ('Distributed','Completed') THEN quantity ELSE 0 END), 0) AS distributed
   FROM allocations
   GROUP BY program ORDER BY allocated DESC LIMIT 6"
)->fetchAll();

$maxAlloc = 0;
foreach ($allocRows as $row) {
  $maxAlloc = max($maxAlloc, (int) $row['allocated']);
}
$programFulfillment = [];
foreach ($allocRows as $row) {
  $allocated = (int) $row['allocated'];
  $dist = (int) $row['distributed'];
  $programFulfillment[] = [
    'program' => $row['program'],
    'demand' => $maxAlloc > 0 ? (int) round(($allocated / $maxAlloc) * 100) : 0,
    'supply' => $maxAlloc > 0 ? (int) round(($dist / $maxAlloc) * 100) : 0,
    'allocated' => $allocated,
    'distributed' => $dist,
  ];
}

json_response([
  'ok' => true,
  'data' => [
    'summary' => [
      'donationsThisMonth' => peso_short($donationsThisMonth),
      'donationsLastMonth' => peso_short($donationsLastMonth),
      'donationsChangePct' => $changePct,
      'beneficiariesServed' => $beneficiariesServed,
      'distributionsCompleted' => $distributionsCompleted,
      'volunteerHours' => $volunteerHours,
      'inventoryTurnover' => $turnover . '%',
    ],
    'donationsByMonth' => $donationsByMonth,
    'beneficiariesByMonth' => $beneficiariesByMonth,
    'trends' => $trends,
    'beneficiariesByCategory' => $beneficiariesByCategory,
    'distributionByLocation' => $distributionByLocation,
    'programFulfillment' => $programFulfillment,
  ],
]);
