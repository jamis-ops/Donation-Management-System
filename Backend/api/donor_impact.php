<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Donor']);

if (request_method() !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

ensure_allocation_inventory_schema($pdo);
ensure_distribution_schema($pdo);

function impact_category(?string $category, ?string $itemName = null): string
{
  $value = trim((string) $category);
  if ($value !== '') return $value;
  $name = strtolower(trim((string) $itemName));
  if (preg_match('/food|rice|meal|canned|noodle|grocery|nutrition/', $name)) return 'Food';
  if (preg_match('/cloth|shirt|short|dress|jacket|blanket/', $name)) return 'Clothing';
  if (preg_match('/hygiene|soap|shampoo|tooth|sanitary|diaper/', $name)) return 'Hygiene';
  if (preg_match('/medicine|medical|first aid|vitamin/', $name)) return 'Medical';
  return 'Other';
}

function impact_is_delivered(?string $distributionStatus, ?string $allocationStatus): bool
{
  return in_array((string) $distributionStatus, ['Delivered', 'Proof Review', 'Completed'], true)
    || (empty($distributionStatus) && in_array((string) $allocationStatus, ['Delivered', 'Completed'], true));
}

function impact_barangay_label(array $row): string
{
  $barangay = trim((string) ($row['barangay'] ?? ''));
  return $barangay !== '' ? $barangay : 'Partner Barangay';
}

$allDonations = donations_for_donor_user($pdo, $user);
$donationMap = [];
foreach ($allDonations as $donation) {
  $donationMap[(int) $donation['id']] = $donation;
}
$donationIds = array_keys($donationMap);
$entries = [];

if ($donationIds) {
  $placeholders = implode(',', array_fill(0, count($donationIds), '?'));

  // Exact in-kind source quantities linked to their allocation and delivery.
  try {
    $stmt = $pdo->prepare("SELECT ads.donation_id, ads.quantity, a.id AS allocation_id, a.code AS allocation_code,
      a.status AS allocation_status, a.resource_name, a.unit, a.beneficiary_id,
      d.id AS distribution_id, d.code AS distribution_code, d.status AS distribution_status,
      d.distribution_date, d.beneficiaries_count, b.barangay, b.municipality,
      i.category AS item_category, i.item_name
      FROM allocation_donation_sources ads
      JOIN allocations a ON a.id = ads.allocation_id
      LEFT JOIN distributions d ON d.id = a.distribution_id
      LEFT JOIN beneficiaries b ON b.id = a.beneficiary_id
      LEFT JOIN inventory_items i ON i.id = a.inventory_item_id
      WHERE ads.donation_id IN ($placeholders) AND a.status <> 'Cancelled'
      ORDER BY COALESCE(d.distribution_date, a.allocation_date) DESC, a.id DESC");
    $stmt->execute($donationIds);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
      $donation = $donationMap[(int) $row['donation_id']] ?? [];
      $category = impact_category($row['item_category'] ?? ($donation['category'] ?? null), $row['item_name'] ?? $row['resource_name']);
      $entries[] = [
        'source' => 'In-Kind',
        'donationId' => (int) $row['donation_id'],
        'allocationId' => (int) $row['allocation_id'],
        'allocationCode' => $row['allocation_code'],
        'allocationStatus' => $row['allocation_status'],
        'distributionId' => !empty($row['distribution_id']) ? (int) $row['distribution_id'] : null,
        'distributionCode' => $row['distribution_code'] ?? null,
        'distributionStatus' => $row['distribution_status'] ?? null,
        'distributionDate' => $row['distribution_date'] ?? null,
        'beneficiaryId' => !empty($row['beneficiary_id']) ? (int) $row['beneficiary_id'] : null,
        'barangay' => impact_barangay_label($row),
        'municipality' => trim((string) ($row['municipality'] ?? '')),
        'category' => $category,
        'item' => trim((string) ($row['item_name'] ?? $row['resource_name'] ?? 'Donated items')),
        'quantity' => max(0, (int) ($row['quantity'] ?? 0)),
        'families' => max(0, (int) ($row['beneficiaries_count'] ?? 0)),
        'delivered' => impact_is_delivered($row['distribution_status'] ?? null, $row['allocation_status'] ?? null),
        'entryKey' => 'inkind-' . (int) $row['allocation_id'],
      ];
    }
  } catch (Throwable $e) {
    error_log('[donor impact in-kind] ' . $e->getMessage());
  }

  // Exact monetary procurement records linked to the purchased allocation.
  try {
    $stmt = $pdo->prepare("SELECT dp.id AS procurement_id, dp.donation_id, dp.allocation_id, dp.beneficiary_id,
      dp.items_json, dp.families_supported, dp.total_amount, dp.created_at,
      a.code AS allocation_code, a.status AS allocation_status,
      d.id AS distribution_id, d.code AS distribution_code, d.status AS distribution_status,
      d.distribution_date, d.beneficiaries_count, b.barangay, b.municipality
      FROM donation_procurements dp
      LEFT JOIN allocations a ON a.id = dp.allocation_id
      LEFT JOIN distributions d ON d.id = a.distribution_id
      LEFT JOIN beneficiaries b ON b.id = COALESCE(a.beneficiary_id, dp.beneficiary_id)
      WHERE dp.donation_id IN ($placeholders)
      ORDER BY COALESCE(d.distribution_date, DATE(dp.created_at)) DESC, dp.id DESC");
    $stmt->execute($donationIds);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
      $donation = $donationMap[(int) $row['donation_id']] ?? [];
      $items = json_decode((string) ($row['items_json'] ?? ''), true);
      if (!is_array($items) || !$items) $items = [['item' => 'Procured relief goods', 'quantity' => 0]];
      $isDelivered = impact_is_delivered($row['distribution_status'] ?? null, $row['allocation_status'] ?? null);
      foreach ($items as $index => $item) {
        $itemName = trim((string) ($item['item'] ?? $item['name'] ?? 'Procured relief goods'));
        $category = impact_category($item['category'] ?? ($donation['category'] ?? null), $itemName);
        $entries[] = [
          'source' => 'Monetary',
          'donationId' => (int) $row['donation_id'],
          'procurementId' => (int) $row['procurement_id'],
          'allocationId' => !empty($row['allocation_id']) ? (int) $row['allocation_id'] : null,
          'allocationCode' => $row['allocation_code'] ?? null,
          'allocationStatus' => $row['allocation_status'] ?? null,
          'distributionId' => !empty($row['distribution_id']) ? (int) $row['distribution_id'] : null,
          'distributionCode' => $row['distribution_code'] ?? null,
          'distributionStatus' => $row['distribution_status'] ?? null,
          'distributionDate' => $row['distribution_date'] ?? null,
          'beneficiaryId' => !empty($row['beneficiary_id']) ? (int) $row['beneficiary_id'] : null,
          'barangay' => impact_barangay_label($row),
          'municipality' => trim((string) ($row['municipality'] ?? '')),
          'category' => $category,
          'item' => $itemName,
          'quantity' => max(0, (int) ($item['quantity'] ?? 0)),
          'families' => max(0, (int) (!empty($row['beneficiaries_count']) ? $row['beneficiaries_count'] : ($row['families_supported'] ?? 0))),
          'delivered' => $isDelivered,
          'entryKey' => 'money-' . (int) $row['procurement_id'],
          'allocatedAmount' => (float) ($row['total_amount'] ?? 0),
        ];
      }
    }
  } catch (Throwable $e) {
    // Installations without procurement records still report in-kind impact.
    error_log('[donor impact monetary] ' . $e->getMessage());
  }
}

$from = trim((string) ($_GET['from'] ?? ''));
$to = trim((string) ($_GET['to'] ?? ''));
$type = trim((string) ($_GET['type'] ?? 'All'));
$barangayFilter = trim((string) ($_GET['barangay'] ?? 'All'));
$categoryFilter = trim((string) ($_GET['category'] ?? 'All'));
$statusFilter = trim((string) ($_GET['status'] ?? 'All'));

$allEntriesByDonation = [];
foreach ($entries as $entry) $allEntriesByDonation[$entry['donationId']][] = $entry;

$selectedDonations = [];
foreach ($allDonations as $donation) {
  $date = (string) ($donation['donation_date'] ?? '');
  if ($from !== '' && $date < $from) continue;
  if ($to !== '' && $date > $to) continue;
  if ($type !== 'All' && (string) $donation['type'] !== $type) continue;
  if ($statusFilter !== 'All' && (string) $donation['status'] !== $statusFilter) continue;
  $donationEntries = $allEntriesByDonation[(int) $donation['id']] ?? [];
  if ($barangayFilter !== 'All' && !array_filter($donationEntries, static fn($e) => (string) ($e['beneficiaryId'] ?? '') === $barangayFilter)) continue;
  if ($categoryFilter !== 'All') {
    $donationCategory = impact_category($donation['category'] ?? null, $donation['items_description'] ?? null);
    if ($donationCategory !== $categoryFilter && !array_filter($donationEntries, static fn($e) => $e['category'] === $categoryFilter)) continue;
  }
  $selectedDonations[(int) $donation['id']] = $donation;
}

$selectedEntries = array_values(array_filter($entries, static function ($entry) use ($selectedDonations, $barangayFilter, $categoryFilter): bool {
  if (!isset($selectedDonations[$entry['donationId']])) return false;
  if ($barangayFilter !== 'All' && (string) ($entry['beneficiaryId'] ?? '') !== $barangayFilter) return false;
  if ($categoryFilter !== 'All' && $entry['category'] !== $categoryFilter) {
    $donation = $selectedDonations[$entry['donationId']];
    if (impact_category($donation['category'] ?? null, $donation['items_description'] ?? null) !== $categoryFilter) return false;
  }
  return true;
}));

$totalDonated = 0.0;
$completedDonations = 0;
foreach ($selectedDonations as $donation) {
  if (($donation['type'] ?? '') === 'Monetary' && !in_array((string) $donation['status'], ['Rejected', 'Cancelled'], true)) {
    $totalDonated += (float) ($donation['amount'] ?? 0);
  }
  if (in_array((string) $donation['status'], ['Completed', 'Verified'], true)) $completedDonations++;
}

$barangayGroups = [];
$categoryGroups = [];
$deliveredDistributionFamilies = [];
$fallbackFamilies = [];
$itemsDistributed = 0;

foreach ($selectedEntries as $entry) {
  $bid = (int) ($entry['beneficiaryId'] ?? 0);
  if ($bid <= 0) continue;
  if (!isset($barangayGroups[$bid])) {
    $barangayGroups[$bid] = [
      'barangayId' => $bid,
      'barangay' => $entry['barangay'],
      'municipality' => $entry['municipality'],
      'donationIds' => [], 'allocationIds' => [], 'distributionIds' => [],
      'itemsDistributed' => 0, 'familiesHelped' => 0,
    ];
  }
  $barangayGroups[$bid]['donationIds'][$entry['donationId']] = true;
  if (!empty($entry['allocationId'])) $barangayGroups[$bid]['allocationIds'][(int) $entry['allocationId']] = true;
  if (!empty($entry['distributionId'])) $barangayGroups[$bid]['distributionIds'][(int) $entry['distributionId']] = true;

  $category = $entry['category'];
  if (!isset($categoryGroups[$category])) {
    $categoryGroups[$category] = ['category' => $category, 'itemsDistributed' => 0, 'donationIds' => [], 'allocationIds' => []];
  }
  $categoryGroups[$category]['donationIds'][$entry['donationId']] = true;
  if (!empty($entry['allocationId'])) $categoryGroups[$category]['allocationIds'][(int) $entry['allocationId']] = true;

  if (!empty($entry['delivered'])) {
    $qty = max(0, (int) $entry['quantity']);
    $itemsDistributed += $qty;
    $barangayGroups[$bid]['itemsDistributed'] += $qty;
    $categoryGroups[$category]['itemsDistributed'] += $qty;
    if (!empty($entry['distributionId'])) {
      $key = (int) $entry['distributionId'];
      $deliveredDistributionFamilies[$key] = max($deliveredDistributionFamilies[$key] ?? 0, (int) $entry['families']);
    } else {
      $key = $bid . ':' . $entry['entryKey'];
      $fallbackFamilies[$key] = max($fallbackFamilies[$key] ?? 0, (int) $entry['families']);
    }
  }
}

// Attribute each delivered distribution's recipients once per barangay.
foreach ($barangayGroups as $bid => &$group) {
  foreach (array_keys($group['distributionIds']) as $distId) {
    $group['familiesHelped'] += (int) ($deliveredDistributionFamilies[$distId] ?? 0);
  }
  foreach ($fallbackFamilies as $key => $families) {
    if (str_starts_with((string) $key, $bid . ':')) $group['familiesHelped'] += $families;
  }
  $group['donations'] = count($group['donationIds']);
  $group['allocations'] = count($group['allocationIds']);
  unset($group['donationIds'], $group['allocationIds'], $group['distributionIds']);
}
unset($group);
$whereRows = array_values($barangayGroups);
usort($whereRows, static fn($a, $b) => ($b['itemsDistributed'] <=> $a['itemsDistributed']) ?: ($b['familiesHelped'] <=> $a['familiesHelped']));

$categoryRows = [];
foreach ($categoryGroups as $group) {
  $categoryRows[] = [
    'category' => $group['category'],
    'itemsDistributed' => $group['itemsDistributed'],
    'donations' => count($group['donationIds']),
    'allocations' => count($group['allocationIds']),
  ];
}
usort($categoryRows, static fn($a, $b) => ($b['itemsDistributed'] <=> $a['itemsDistributed']) ?: strcmp($a['category'], $b['category']));

$familiesHelped = array_sum(array_map(static fn($row) => (int) $row['familiesHelped'], $whereRows));
$barangaysReached = count(array_filter($whereRows, static fn($row) => $row['itemsDistributed'] > 0 || $row['familiesHelped'] > 0));

$activity = [];
foreach ($selectedDonations as $donation) {
  $month = substr((string) $donation['donation_date'], 0, 7);
  if (!preg_match('/^\d{4}-\d{2}$/', $month)) continue;
  if (!isset($activity[$month])) $activity[$month] = ['month' => $month, 'donations' => 0, 'monetaryAmount' => 0.0, 'inKindDonations' => 0];
  $activity[$month]['donations']++;
  if (($donation['type'] ?? '') === 'Monetary') $activity[$month]['monetaryAmount'] += (float) ($donation['amount'] ?? 0);
  else $activity[$month]['inKindDonations']++;
}
ksort($activity);

$barangayOptions = [];
$categoryOptions = [];
foreach ($entries as $entry) {
  if (!empty($entry['beneficiaryId'])) $barangayOptions[(int) $entry['beneficiaryId']] = $entry['barangay'];
  $categoryOptions[$entry['category']] = true;
}
foreach ($allDonations as $donation) {
  $categoryOptions[impact_category($donation['category'] ?? null, $donation['items_description'] ?? null)] = true;
}
asort($barangayOptions, SORT_NATURAL | SORT_FLAG_CASE);
ksort($categoryOptions, SORT_NATURAL | SORT_FLAG_CASE);
$statuses = array_values(array_unique(array_map(static fn($d) => (string) $d['status'], $allDonations)));
sort($statuses, SORT_NATURAL | SORT_FLAG_CASE);

json_response([
  'ok' => true,
  'data' => [
    'summary' => [
      'totalDonated' => round($totalDonated, 2),
      'barangaysReached' => $barangaysReached,
      'familiesHelped' => $familiesHelped,
      'itemsDistributed' => $itemsDistributed,
      'completedDonations' => $completedDonations,
    ],
    'whereDonationsWent' => $whereRows,
    'categoryDistribution' => $categoryRows,
    'familiesByBarangay' => array_map(static fn($row) => [
      'barangayId' => $row['barangayId'],
      'barangay' => $row['barangay'],
      'municipality' => $row['municipality'],
      'familiesHelped' => $row['familiesHelped'],
    ], $whereRows),
    'activityOverTime' => array_values($activity),
    'filters' => [
      'barangays' => array_map(static fn($id, $label) => ['value' => (string) $id, 'label' => $label], array_keys($barangayOptions), array_values($barangayOptions)),
      'categories' => array_keys($categoryOptions),
      'statuses' => $statuses,
    ],
  ],
]);
