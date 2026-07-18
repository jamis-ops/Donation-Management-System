<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
require_auth(['Admin', 'Staff']);

$donationCount = (int) $pdo->query('SELECT COUNT(*) FROM donations')->fetchColumn();
$beneficiaryCount = (int) $pdo->query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'Approved'")->fetchColumn();
$inventoryQty = (int) $pdo->query('SELECT COALESCE(SUM(quantity), 0) FROM inventory_items')->fetchColumn();
$activeDeliveries = (int) $pdo->query("SELECT COUNT(*) FROM distributions WHERE status IN ('Scheduled','Planning','Preparing','In Transit','Delivered','Awaiting Proof')")->fetchColumn();
$pendingDonations = (int) $pdo->query("SELECT COUNT(*) FROM donations WHERE status = 'Pending Verification'")->fetchColumn();
$pendingVolunteers = (int) $pdo->query("SELECT COUNT(*) FROM volunteers WHERE status = 'Pending Review'")->fetchColumn();
$pendingBeneficiaries = (int) $pdo->query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'Pending Approval'")->fetchColumn();
$lowStock = (int) $pdo->query('SELECT COUNT(*) FROM inventory_items WHERE quantity <= low_stock_threshold')->fetchColumn();
$openTasks = (int) $pdo->query("SELECT COUNT(*) FROM tasks WHERE board_column IN ('todo','inProgress','review')")->fetchColumn();

$beneficiariesServed = (int) $pdo->query("SELECT COALESCE(SUM(beneficiaries_count), 0) FROM distributions WHERE status IN ('Completed','Delivered')")->fetchColumn();
$familiesAffected = (int) $pdo->query("SELECT COALESCE(SUM(affected_families), 0) FROM beneficiaries WHERE status = 'Approved'")->fetchColumn();

// Monthly donation trend (last 6 months, missing months filled with zeros)
$trendRows = $pdo->query(
  "SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym,
          COUNT(*) AS cnt,
          COALESCE(SUM(CASE WHEN type = 'Monetary' THEN amount ELSE 0 END), 0) AS amt
   FROM donations
   WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
   GROUP BY ym"
)->fetchAll(PDO::FETCH_UNIQUE);

$monthlyTrend = [];
for ($i = 5; $i >= 0; $i--) {
  $ts = strtotime(date('Y-m-01') . " -{$i} months");
  $ym = date('Y-m', $ts);
  $row = $trendRows[$ym] ?? null;
  $monthlyTrend[] = [
    'month' => date('M', $ts),
    'count' => $row ? (int) $row['cnt'] : 0,
    'amount' => $row ? (float) $row['amt'] : 0.0,
  ];
}

// Donation trend grouped by week / month / year (client toggles between them)
$trend = [];
foreach (['week', 'month', 'year'] as $gran) {
  $expr = period_group_expr('created_at', $gran);
  $trend[$gran] = trend_series(
    $pdo,
    "SELECT $expr AS k,
            COUNT(*) AS cnt,
            COALESCE(SUM(CASE WHEN type = 'Monetary' THEN amount ELSE 0 END), 0) AS amt
     FROM donations GROUP BY k",
    build_periods($gran),
    fn($label, $row) => [
      'month' => $label,
      'count' => $row ? (int) $row['cnt'] : 0,
      'amount' => $row ? (float) $row['amt'] : 0.0,
    ]
  );
}

// Donation type breakdown
$donationTypes = [];
foreach ($pdo->query('SELECT type, COUNT(*) AS cnt FROM donations GROUP BY type ORDER BY cnt DESC')->fetchAll() as $row) {
  $donationTypes[] = ['label' => $row['type'], 'value' => (int) $row['cnt']];
}

// Distribution status breakdown
$distributionStatus = [];
foreach ($pdo->query('SELECT status, COUNT(*) AS cnt FROM distributions GROUP BY status ORDER BY cnt DESC')->fetchAll() as $row) {
  $distributionStatus[] = ['label' => $row['status'], 'value' => (int) $row['cnt']];
}

// Inventory stock levels (top items by quantity)
$inventoryLevels = [];
foreach ($pdo->query('SELECT item_name, quantity, unit, low_stock_threshold, moderate_stock_threshold FROM inventory_items ORDER BY quantity DESC LIMIT 6')->fetchAll() as $row) {
  $low = (int) $row['low_stock_threshold'];
  $moderate = (int) ($row['moderate_stock_threshold'] ?? 0) ?: $low * 2;
  $qty = (int) $row['quantity'];
  $inventoryLevels[] = [
    'item' => $row['item_name'],
    'quantity' => $qty,
    'unit' => $row['unit'],
    'level' => stock_level($qty, $low, $moderate),
    'percent' => $moderate > 0 ? min(100, (int) round(($qty / $moderate) * 100)) : 100,
  ];
}

$recentDonations = $pdo->query('SELECT donor_name, amount, type, items_description, created_at FROM donations ORDER BY created_at DESC LIMIT 3')->fetchAll();
$recentActivity = [];
foreach ($recentDonations as $i => $d) {
  $recentActivity[] = [
    'id' => $i + 1,
    'action' => 'New donation received',
    'detail' => money_display($d['type'], $d['amount'], $d['items_description']) . ' from ' . $d['donor_name'],
    'time' => date('M j, Y', strtotime($d['created_at'])),
    'type' => 'donation',
  ];
}

json_response([
  'ok' => true,
  'data' => [
    'stats' => [
      ['label' => 'Total Donations', 'value' => number_format($donationCount), 'change' => "+{$pendingDonations} pending", 'trend' => 'up'],
      ['label' => 'Active Beneficiaries', 'value' => number_format($beneficiaryCount), 'change' => "+{$pendingBeneficiaries} pending", 'trend' => 'up'],
      ['label' => 'Items in Inventory', 'value' => number_format($inventoryQty), 'change' => "{$lowStock} low stock", 'trend' => $lowStock > 0 ? 'warn' : 'up'],
      ['label' => 'Active Deliveries', 'value' => (string) $activeDeliveries, 'change' => "{$openTasks} open tasks", 'trend' => 'up'],
      ['label' => 'Beneficiaries Served', 'value' => number_format($beneficiariesServed), 'change' => number_format($familiesAffected) . ' families covered', 'trend' => 'up'],
    ],
    'charts' => [
      'monthlyTrend' => $monthlyTrend,
      'trend' => $trend,
      'donationTypes' => $donationTypes,
      'distributionStatus' => $distributionStatus,
      'inventoryLevels' => $inventoryLevels,
    ],
    'recentActivity' => $recentActivity,
    'quickActions' => [
      ['meta' => "{$pendingDonations} pending"],
      ['meta' => "{$pendingVolunteers} pending"],
      ['meta' => "{$pendingBeneficiaries} pending"],
      ['meta' => "{$lowStock} low stock"],
      ['meta' => "{$activeDeliveries} scheduled"],
      ['meta' => "{$openTasks} open"],
    ],
  ],
]);
