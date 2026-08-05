<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Donor', 'Volunteer', 'Beneficiary', 'Staff', 'Admin']);

switch ($user['role']) {
  case 'Donor':
    // Real donation history for this logged-in donor (email + linked donor profile).
    $rows = donations_for_donor_user($pdo, $user);

    $total = array_sum(array_map(static function ($r) {
      if (strcasecmp((string) ($r['status'] ?? ''), 'Rejected') === 0) {
        return 0.0;
      }
      if (($r['type'] ?? '') === 'In-Kind') {
        return 0.0;
      }
      return (float) ($r['amount'] ?? 0);
    }, $rows));
    $pending = count(array_filter($rows, static fn($r) => $r['status'] === 'Pending Verification'));
    $certs = $pdo->prepare('SELECT COUNT(*) FROM certificates WHERE recipient_name = ? OR reference_code IN (SELECT tracking_code FROM donations WHERE donor_email = ?)');
    $certs->execute([$user['name'], $user['email']]);
    $certCount = (int) $certs->fetchColumn();

    $mappedDonations = array_map(static function ($row) {
      $program = trim((string) ($row['category'] ?? ''));
      if ($program === '') {
        $program = $row['type'] === 'In-Kind' ? 'In-Kind Support' : 'General Donation';
      }
      return [
        'id' => $row['tracking_code'],
        'trackingCode' => $row['tracking_code'],
        'dbId' => (int) $row['id'],
        'type' => $row['type'],
        'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
        'amountRaw' => $row['amount'] !== null ? (float) $row['amount'] : 0,
        'date' => format_date($row['donation_date']),
        'status' => $row['status'],
        'program' => $program,
        'notes' => $row['notes'] ?? '',
      ];
    }, $rows);

    // Estimate community impact from verified monetary + in-kind volume.
    $verifiedStatuses = ['Verified', 'Distributed', 'Allocated', 'In Inventory', 'Completed'];
    $impactBase = 0.0;
    $inKindBoost = 0;
    foreach ($rows as $r) {
      if (!in_array($r['status'], $verifiedStatuses, true) && $r['status'] !== 'Pending Verification') {
        // Still count most non-rejected donations toward soft impact estimates.
      }
      if (strcasecmp((string) ($r['status'] ?? ''), 'Rejected') === 0) {
        continue;
      }
      $impactBase += (float) ($r['amount'] ?? 0);
      if (($r['type'] ?? '') === 'In-Kind') {
        $inKindBoost += 1;
      }
    }
    $impactStats = [
      'familiesHelped' => (int) max(0, floor($impactBase / 800) + ($inKindBoost * 5)),
      'mealsProvided' => (int) max(0, floor($impactBase / 40) + ($inKindBoost * 20)),
      'childrenEducated' => (int) max(0, floor($impactBase / 2500) + ($inKindBoost * 2)),
      'medicalConsultations' => (int) max(0, floor($impactBase / 500) + ($inKindBoost * 3)),
      'housesBuilt' => (int) max(0, floor($impactBase / 80000)),
      'disasterReliefPackages' => (int) max(0, floor($impactBase / 350) + ($inKindBoost * 10)),
    ];

    $monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    $year = (int) date('Y');
    $byMonth = [];
    for ($m = 1; $m <= 12; $m++) {
      $byMonth[$m] = [
        'month' => $monthNames[$m - 1],
        'monetary' => 0.0,
        'inKind' => 0,
        'total' => 0.0,
        'count' => 0,
      ];
    }
    $activeMonths = [];
    foreach ($rows as $r) {
      if (strcasecmp((string) ($r['status'] ?? ''), 'Rejected') === 0) {
        continue;
      }
      $ts = !empty($r['donation_date']) ? strtotime((string) $r['donation_date']) : false;
      if (!$ts || (int) date('Y', $ts) !== $year) {
        continue;
      }
      $mi = (int) date('n', $ts);
      $activeMonths[$mi] = true;
      $byMonth[$mi]['count'] += 1;
      if (($r['type'] ?? '') === 'Monetary') {
        $amt = (float) ($r['amount'] ?? 0);
        $byMonth[$mi]['monetary'] += $amt;
        $byMonth[$mi]['total'] += $amt;
      } else {
        $byMonth[$mi]['inKind'] += 1;
        // Soft weight for chart height when in-kind has no peso amount.
        $byMonth[$mi]['total'] += 1000;
      }
    }

    $firstDate = null;
    foreach (array_reverse($rows) as $r) {
      if (strcasecmp((string) ($r['status'] ?? ''), 'Rejected') === 0) {
        continue;
      }
      if (!empty($r['donation_date'])) {
        $firstDate = format_date($r['donation_date']);
        break;
      }
    }

    // Count only non-rejected gifts toward milestones (from this donor's donation records).
    $countedRows = array_values(array_filter(
      $rows,
      static fn($r) => strcasecmp((string) ($r['status'] ?? ''), 'Rejected') !== 0
    ));
    $monetaryTotal = 0.0;
    $inKindCount = 0;
    $verifiedCount = 0;
    $donationCount = count($countedRows);
    $firstVerifiedDate = null;
    foreach ($countedRows as $r) {
      if (($r['type'] ?? '') === 'In-Kind') {
        $inKindCount++;
      } else {
        $monetaryTotal += (float) ($r['amount'] ?? 0);
      }
      if (in_array($r['status'], $verifiedStatuses, true)) {
        $verifiedCount++;
      }
    }
    $pesoTotal = max($monetaryTotal, 0);

    $chrono = $countedRows;
    usort($chrono, static function ($a, $b) {
      $da = (string) ($a['donation_date'] ?? '');
      $db = (string) ($b['donation_date'] ?? '');
      if ($da === $db) {
        return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
      }
      return strcmp($da, $db);
    });

    foreach ($chrono as $r) {
      if (in_array($r['status'] ?? '', $verifiedStatuses, true)) {
        $firstVerifiedDate = format_date($r['donation_date'] ?? null);
        break;
      }
    }

    $dateWhenTotalReached = static function (array $chronoRows, float $threshold): ?string {
      $sum = 0.0;
      foreach ($chronoRows as $r) {
        if (($r['type'] ?? '') === 'In-Kind') {
          continue;
        }
        $sum += (float) ($r['amount'] ?? 0);
        if ($sum >= $threshold) {
          return format_date($r['donation_date'] ?? null);
        }
      }
      return null;
    };

    $dateWhenCountReached = static function (array $chronoRows, int $threshold): ?string {
      $n = 0;
      foreach ($chronoRows as $r) {
        $n++;
        if ($n >= $threshold) {
          return format_date($r['donation_date'] ?? null);
        }
      }
      return null;
    };

    $dateWhenInKindReached = static function (array $chronoRows, int $threshold): ?string {
      $n = 0;
      foreach ($chronoRows as $r) {
        if (($r['type'] ?? '') !== 'In-Kind') {
          continue;
        }
        $n++;
        if ($n >= $threshold) {
          return format_date($r['donation_date'] ?? null);
        }
      }
      return null;
    };

    $dateWhenMonthsReached = static function (array $chronoRows, int $threshold, int $year): ?string {
      $months = [];
      foreach ($chronoRows as $r) {
        $ts = !empty($r['donation_date']) ? strtotime((string) $r['donation_date']) : false;
        if (!$ts || (int) date('Y', $ts) !== $year) {
          continue;
        }
        $mi = (int) date('n', $ts);
        $months[$mi] = true;
        if (count($months) >= $threshold) {
          return format_date($r['donation_date'] ?? null);
        }
      }
      return null;
    };

    $buildMilestone = static function (
      int $id,
      string $title,
      string $description,
      bool $achieved,
      ?string $date,
      string $icon,
      string $tier,
      float $current,
      float $target,
      string $unit = 'count'
    ): array {
      $target = max($target, 0.0001);
      $progress = (int) min(100, round(($current / $target) * 100));
      return [
        'id' => $id,
        'title' => $title,
        'description' => $description,
        'achieved' => $achieved,
        'date' => $achieved ? ($date ?: format_date(date('Y-m-d'))) : null,
        'icon' => $icon,
        'tier' => $tier,
        'current' => $unit === 'peso' ? round($current, 2) : (int) $current,
        'target' => $unit === 'peso' ? round($target, 2) : (int) $target,
        'progress' => $achieved ? 100 : $progress,
        'unit' => $unit,
      ];
    };

    $milestones = [
      $buildMilestone(
        1,
        'First Gift',
        'Made your first donation to Rise Above Foundation',
        $donationCount >= 1,
        $firstDate,
        'heart',
        'bronze',
        min($donationCount, 1),
        1
      ),
      $buildMilestone(
        2,
        'Helping Hand',
        '₱5,000 total monetary donations reached',
        $pesoTotal >= 5000,
        $dateWhenTotalReached($chrono, 5000),
        'handHeart',
        'bronze',
        min($pesoTotal, 5000),
        5000,
        'peso'
      ),
      $buildMilestone(
        3,
        'Community Friend',
        '₱10,000 Donation Reached',
        $pesoTotal >= 10000,
        $dateWhenTotalReached($chrono, 10000),
        'users',
        'bronze',
        min($pesoTotal, 10000),
        10000,
        'peso'
      ),
      $buildMilestone(
        4,
        'Rising Supporter',
        '₱25,000 Donation Reached',
        $pesoTotal >= 25000,
        $dateWhenTotalReached($chrono, 25000),
        'trendingUp',
        'silver',
        min($pesoTotal, 25000),
        25000,
        'peso'
      ),
      $buildMilestone(
        5,
        'Generous Giver',
        '₱50,000 Donation Reached',
        $pesoTotal >= 50000,
        $dateWhenTotalReached($chrono, 50000),
        'trophy',
        'silver',
        min($pesoTotal, 50000),
        50000,
        'peso'
      ),
      $buildMilestone(
        6,
        'Major Donor',
        '₱100,000 Donation Reached',
        $pesoTotal >= 100000,
        $dateWhenTotalReached($chrono, 100000),
        'star',
        'gold',
        min($pesoTotal, 100000),
        100000,
        'peso'
      ),
      $buildMilestone(
        7,
        'Champion Benefactor',
        '₱250,000 Donation Reached',
        $pesoTotal >= 250000,
        $dateWhenTotalReached($chrono, 250000),
        'award',
        'gold',
        min($pesoTotal, 250000),
        250000,
        'peso'
      ),
      $buildMilestone(
        8,
        'Repeat Giver',
        'Submitted 3 or more donations',
        $donationCount >= 3,
        $dateWhenCountReached($chrono, 3),
        'gift',
        'bronze',
        min($donationCount, 3),
        3
      ),
      $buildMilestone(
        9,
        'Loyal Donor',
        'Submitted 5 or more donations',
        $donationCount >= 5,
        $dateWhenCountReached($chrono, 5),
        'heartHandshake',
        'silver',
        min($donationCount, 5),
        5
      ),
      $buildMilestone(
        10,
        'Steady Supporter',
        'Donated across 3 different months this year',
        count($activeMonths) >= 3,
        $dateWhenMonthsReached($chrono, 3, $year),
        'calendar',
        'silver',
        min(count($activeMonths), 3),
        3
      ),
      $buildMilestone(
        11,
        'Goods Partner',
        'Made your first in-kind (goods) donation',
        $inKindCount >= 1,
        $dateWhenInKindReached($chrono, 1),
        'package',
        'bronze',
        min($inKindCount, 1),
        1
      ),
      $buildMilestone(
        12,
        'Verified Contributor',
        'Had at least one donation verified by the foundation',
        $verifiedCount >= 1,
        $firstVerifiedDate,
        'badgeCheck',
        'silver',
        min($verifiedCount, 1),
        1
      ),
    ];



    $recentActivity = [];
    foreach (array_slice($mappedDonations, 0, 6) as $d) {
      $status = $d['status'];
      if ($status === 'Verified' || $status === 'Distributed') {
        $recentActivity[] = [
          'type' => 'donation_verified',
          'title' => "Donation {$d['id']} {$status}",
          'date' => $d['date'],
          'icon' => $status === 'Distributed' ? 'package' : 'checkCircle',
          'amount' => $d['amount'],
        ];
      } elseif ($status === 'Pending Verification') {
        $recentActivity[] = [
          'type' => 'donation_submitted',
          'title' => "Donation {$d['id']} awaiting verification",
          'date' => $d['date'],
          'icon' => 'upload',
          'amount' => $d['amount'],
        ];
      } else {
        $recentActivity[] = [
          'type' => 'donation_update',
          'title' => "Donation {$d['id']} - {$status}",
          'date' => $d['date'],
          'icon' => 'heart',
          'amount' => $d['amount'],
        ];
      }
    }
    if ($certCount > 0) {
      array_unshift($recentActivity, [
        'type' => 'certificate_ready',
        'title' => $certCount === 1 ? '1 certificate ready to download' : "{$certCount} certificates ready to download",
        'date' => format_date(date('Y-m-d')),
        'icon' => 'fileText',
      ]);
    }

    $donationImpact = [];
    foreach ($mappedDonations as $d) {
      if (!in_array($d['status'], ['Distributed', 'Verified', 'Completed'], true)) {
        continue;
      }
      $beneficiaries = max(1, (int) floor(($d['amountRaw'] ?: 1000) / 800));
      $donationImpact[] = [
        'donationId' => $d['id'],
        'program' => $d['program'],
        'location' => 'Cebu',
        'date' => $d['date'],
        'beneficiaries' => $beneficiaries,
        'description' => $d['type'] === 'In-Kind'
          ? "Your in-kind gift supported {$d['program']}."
          : "Your contribution of {$d['amount']} helped support {$d['program']}.",
        'images' => [],
      ];
      if (count($donationImpact) >= 6) {
        break;
      }
    }

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Total Donated', 'value' => '₱' . number_format($total), 'icon' => 'heartHandshake'],
          ['label' => 'Donations Made', 'value' => (string) count($rows), 'icon' => 'gift'],
          ['label' => 'Pending Verification', 'value' => (string) $pending, 'icon' => 'clock'],
          ['label' => 'Certificates Ready', 'value' => (string) $certCount, 'icon' => 'award'],
        ],
        'donations' => $mappedDonations,
        'impactStats' => $impactStats,
        'milestones' => $milestones,
        'recentActivity' => array_slice($recentActivity, 0, 8),
        'donationsByMonth' => array_values($byMonth),
        'donationImpact' => $donationImpact,
      ],
    ]);
    break;

  case 'Volunteer':
    $vol = $pdo->prepare('SELECT * FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$user['id']]);
    $profile = $vol->fetch();
    $name = $profile['full_name'] ?? $user['name'];
    $hours = (int) ($profile['hours'] ?? 0);
    $statusLabels = [
      'todo' => 'To Do',
      'inProgress' => 'In Progress',
      'review' => 'In Review',
      'done' => 'Done',
    ];

    $tasks = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY due_date ASC');
    $tasks->execute([$name, $user['id']]);
    $taskRows = $tasks->fetchAll();

    $mappedTasks = array_map(static function ($t) use ($statusLabels) {
      $column = $t['board_column'] ?? 'todo';
      $dutyHours = isset($t['duty_hours']) && $t['duty_hours'] !== null ? (float) $t['duty_hours'] : null;
      return [
        'id' => $t['code'],
        'dbId' => (int) $t['id'],
        'title' => $t['title'],
        'due' => format_date($t['due_date']),
        'status' => $statusLabels[$column] ?? ucfirst((string) $column),
        'boardColumn' => $column,
        'priority' => $t['priority'] ?? 'Medium',
        'category' => $t['module'] ?: 'General',
        'hours' => $dutyHours,
        'completedDate' => !empty($t['completed_at']) ? format_date($t['completed_at']) : null,
      ];
    }, $taskRows);

    $schedule = [];
    if ($profile) {
      $sched = $pdo->prepare('SELECT * FROM volunteer_schedule WHERE volunteer_id = ? ORDER BY event_date ASC');
      $sched->execute([$profile['id']]);
      $schedule = array_map(static function ($s) {
        $title = (string) $s['event_title'];
        $type = 'Community';
        $lower = strtolower($title);
        if (strpos($lower, 'distribut') !== false || strpos($lower, 'relief') !== false || strpos($lower, 'repack') !== false) {
          $type = 'Distribution';
        } elseif (strpos($lower, 'inventor') !== false || strpos($lower, 'warehouse') !== false) {
          $type = 'Inventory';
        } elseif (strpos($lower, 'feed') !== false || strpos($lower, 'program') !== false || strpos($lower, 'mission') !== false) {
          $type = 'Programs';
        } elseif (strpos($lower, 'train') !== false || strpos($lower, 'orient') !== false) {
          $type = 'Training';
        }
        return [
          'id' => 'EVT-' . $s['id'],
          'date' => format_date($s['event_date']),
          'event' => $title,
          'time' => $s['event_time'] ?: 'TBD',
          'location' => 'Rise Against Hunger Cebu',
          'type' => $type,
          'status' => 'Scheduled',
          'attendees' => 0,
          'description' => '',
        ];
      }, $sched->fetchAll());
    }

    $certCount = 0;
    try {
      $certs = $pdo->prepare('SELECT COUNT(*) FROM certificates WHERE recipient_name = ?');
      $certs->execute([$name]);
      $certCount = (int) $certs->fetchColumn();
    } catch (Throwable $e) {
      $certCount = 0;
    }

    $doneTasks = array_values(array_filter($mappedTasks, static fn($t) => $t['boardColumn'] === 'done'));
    $openTasks = array_values(array_filter($mappedTasks, static fn($t) => $t['boardColumn'] !== 'done'));

    $recentActivity = [];
    foreach (array_slice(array_reverse($doneTasks), 0, 5) as $t) {
      $recentActivity[] = [
        'type' => 'task_completed',
        'title' => 'Completed ' . $t['title'],
        'date' => $t['completedDate'] ?: $t['due'],
        'icon' => 'checkCircle',
      ];
    }
    foreach (array_slice($schedule, 0, 2) as $ev) {
      $recentActivity[] = [
        'type' => 'event_registered',
        'title' => 'Upcoming: ' . $ev['event'],
        'date' => $ev['date'],
        'icon' => 'calendar',
      ];
    }
    foreach (array_slice($openTasks, 0, 2) as $t) {
      $recentActivity[] = [
        'type' => 'task_assigned',
        'title' => 'Task: ' . $t['title'],
        'date' => $t['due'],
        'icon' => 'inbox',
      ];
    }

    // Build hours breakdown + activity log from completed tasks with duty hours.
    $monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    $year = (int) date('Y');
    $monthBuckets = [];
    for ($m = 1; $m <= 12; $m++) {
      $monthBuckets[$m] = ['month' => $monthNames[$m - 1], 'hours' => 0.0, 'activities' => 0];
    }
    $activityLog = [];
    foreach ($taskRows as $t) {
      if (($t['board_column'] ?? '') !== 'done') {
        continue;
      }
      $h = isset($t['duty_hours']) ? (float) $t['duty_hours'] : 0;
      $completed = $t['completed_at'] ?: $t['due_date'];
      $ts = $completed ? strtotime((string) $completed) : false;
      if ($ts && (int) date('Y', $ts) === $year) {
        $mi = (int) date('n', $ts);
        $monthBuckets[$mi]['hours'] += $h;
        $monthBuckets[$mi]['activities'] += 1;
      }
      $activityLog[] = [
        'id' => $t['code'],
        'date' => format_date($completed),
        'activity' => $t['title'],
        'type' => $t['module'] ?: 'General',
        'hours' => $h,
        'status' => 'Verified',
      ];
    }
    usort($activityLog, static fn($a, $b) => strcmp($b['date'], $a['date']));

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Hours Rendered', 'value' => (string) $hours, 'icon' => 'clock'],
          ['label' => 'Assigned Tasks', 'value' => (string) count($openTasks), 'icon' => 'checkSquare'],
          ['label' => 'Upcoming Events', 'value' => (string) count($schedule), 'icon' => 'calendar'],
          ['label' => 'Certificates', 'value' => (string) $certCount, 'icon' => 'award'],
        ],
        'tasks' => $mappedTasks,
        'schedule' => $schedule,
        'hoursBreakdown' => array_values($monthBuckets),
        'activityLog' => $activityLog,
        'recentActivity' => array_slice($recentActivity, 0, 8),
      ],
    ]);
    break;

  case 'Beneficiary':
    $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $profile = $ben->fetch();
    $benId = $profile['id'] ?? 0;

    $requests = [];
    $distributions = [];
    if ($benId) {
      $req = $pdo->prepare('SELECT * FROM assistance_requests WHERE beneficiary_id = ? ORDER BY request_date DESC');
      $req->execute([$benId]);
      $requests = array_map(static fn($r) => [
        'id' => $r['reference_code'],
        'type' => $r['assistance_type'],
        'date' => format_date($r['request_date']),
        'status' => $r['status'],
      ], $req->fetchAll());
    }

    $dist = $pdo->query("SELECT * FROM distributions WHERE status IN ('Planning','Preparing','In Transit','Delivered','Awaiting Proof') ORDER BY distribution_date ASC");
    $distributions = array_map(static fn($d) => [
      'date' => format_date($d['distribution_date']),
      'location' => $d['location'],
      'type' => $d['distribution_type'],
      'status' => $d['status'],
    ], $dist->fetchAll());

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Active Requests', 'value' => (string) count(array_filter($requests, static fn($r) => !in_array($r['status'], ['Approved', 'Completed'], true)))],
          ['label' => 'Approved Assistance', 'value' => (string) count(array_filter($requests, static fn($r) => $r['status'] === 'Approved'))],
          ['label' => 'Active Deliveries', 'value' => (string) count($distributions)],
          ['label' => 'Total Received', 'value' => (string) count($requests)],
        ],
        'requests' => $requests,
        'distributions' => $distributions,
      ],
    ]);
    break;

  case 'Staff':
  case 'Admin':
    $statusLabels = [
      'todo' => 'To Do',
      'inProgress' => 'In Progress',
      'review' => 'In Review',
      'done' => 'Done',
    ];

    $pendingDonations = (int) $pdo->query("SELECT COUNT(*) FROM donations WHERE status = 'Pending Verification'")->fetchColumn();
    $lowStockCount = (int) $pdo->query('SELECT COUNT(*) FROM inventory_items WHERE quantity <= low_stock_threshold')->fetchColumn();
    $assignedTasksStmt = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE assignee_user_id = ? OR assignee = ?');
    $assignedTasksStmt->execute([$user['id'], $user['name']]);
    $assignedTaskCount = (int) $assignedTasksStmt->fetchColumn();
    $openTaskStmt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE (assignee_user_id = ? OR assignee = ?) AND board_column <> 'done'");
    $openTaskStmt->execute([$user['id'], $user['name']]);
    $openTaskCount = (int) $openTaskStmt->fetchColumn();
    $distsToday = (int) $pdo->query("SELECT COUNT(*) FROM distributions WHERE distribution_date = CURDATE()")->fetchColumn();

    $taskList = $pdo->prepare("SELECT * FROM tasks WHERE assignee_user_id = ? OR assignee = ? ORDER BY FIELD(priority, 'High', 'Medium', 'Low'), due_date ASC");
    $taskList->execute([$user['id'], $user['name']]);
    $taskRows = $taskList->fetchAll();
    $mappedTasks = [];
    foreach ($taskRows as $t) {
      $column = $t['board_column'] ?? 'todo';
      $status = $statusLabels[$column] ?? 'To Do';
      $completion = $column === 'done' ? 100 : ($column === 'inProgress' ? 50 : ($column === 'review' ? 80 : 0));
      $hours = isset($t['duty_hours']) && $t['duty_hours'] !== null ? (float) $t['duty_hours'] : null;
      $mappedTasks[] = [
        'id' => $t['code'],
        'dbId' => (int) $t['id'],
        'title' => $t['title'],
        'category' => $t['module'] ?: 'General',
        'priority' => $t['priority'] ?: 'Medium',
        'status' => $status,
        'boardColumn' => $column,
        'assignedTo' => $t['assignee'] ?: $user['name'],
        'dueDate' => format_date($t['due_date']),
        'due' => format_date($t['due_date']),
        'description' => $t['title'],
        'estimatedTime' => $hours !== null ? (rtrim(rtrim(number_format($hours, 2), '0'), '.') . ' hrs') : '',
        'completionRate' => $completion,
      ];
    }

    $pendingDonationRows = $pdo->query("SELECT * FROM donations WHERE status = 'Pending Verification' ORDER BY donation_date DESC, id DESC LIMIT 30")->fetchAll();
    $donationsToVerify = array_map(static function ($row) {
      $amount = (float) ($row['amount'] ?? 0);
      $priority = $amount >= 20000 ? 'High' : ($amount >= 5000 ? 'Medium' : 'Low');
      if (($row['type'] ?? '') === 'In-Kind') {
        $priority = 'Medium';
      }
      return [
        'id' => $row['tracking_code'],
        'dbId' => (int) $row['id'],
        'donor' => $row['donor_name'],
        'type' => $row['type'],
        'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
        'submittedDate' => format_date($row['donation_date']),
        'program' => $row['category'] ?: 'General Donation',
        'status' => $row['status'],
        'priority' => $priority,
        'email' => $row['donor_email'] ?? '',
        'notes' => $row['notes'] ?? '',
        'hasProof' => !empty($row['proof_path']),
      ];
    }, $pendingDonationRows);

    $invRows = $pdo->query('SELECT * FROM inventory_items ORDER BY item_name ASC')->fetchAll();
    $inventory = [];
    $inventoryAlerts = [];
    $byCategory = [];
    foreach ($invRows as $row) {
      $low = (int) $row['low_stock_threshold'];
      $moderate = (int) ($row['moderate_stock_threshold'] ?? ($low * 2));
      $qty = (int) $row['quantity'];
      $level = stock_level($qty, $low, $moderate);
      $label = stock_level_label($level);
      $uiStatus = $label === 'Low Stock' && $qty <= max(1, (int) floor($low / 2)) ? 'Critical' : (
        $label === 'Low Stock' ? 'Low Stock' : ($label === 'Moderate' ? 'Low Stock' : 'Adequate')
      );
      $cat = $row['category'] ?: 'General';
      $item = [
        'id' => $row['code'],
        'dbId' => (int) $row['id'],
        'item' => $row['item_name'],
        'category' => $cat,
        'currentStock' => $qty,
        'quantity' => $qty,
        'minStock' => $low,
        'maxStock' => max($moderate * 2, $low * 4, $qty),
        'unit' => $row['unit'] ?: 'units',
        'status' => $uiStatus,
        'lastUpdated' => format_date($row['updated_at'] ?? null),
        'location' => 'Warehouse',
        'costPerUnit' => 0,
      ];
      $inventory[] = $item;
      if (!isset($byCategory[$cat])) {
        $byCategory[$cat] = ['category' => $cat, 'items' => 0, 'totalValue' => '—', 'status' => 'Adequate'];
      }
      $byCategory[$cat]['items'] += 1;
      if ($uiStatus === 'Critical') {
        $byCategory[$cat]['status'] = 'Critical';
      } elseif ($uiStatus === 'Low Stock' && $byCategory[$cat]['status'] !== 'Critical') {
        $byCategory[$cat]['status'] = 'Low Stock';
      }
      if ($level === 'low' || $uiStatus === 'Critical' || $uiStatus === 'Low Stock') {
        $inventoryAlerts[] = [
          'item' => $row['item_name'],
          'currentStock' => $qty,
          'minStock' => $low,
          'severity' => $uiStatus === 'Critical' ? 'Critical' : 'Low',
          'action' => $uiStatus === 'Critical' ? 'Order immediately' : 'Order soon',
          'dbId' => (int) $row['id'],
        ];
      }
    }

    $distRows = $pdo->query('SELECT * FROM distributions ORDER BY distribution_date DESC, id DESC LIMIT 40')->fetchAll();
    $distributions = array_map(static function ($row) {
      return [
        'id' => $row['code'],
        'dbId' => (int) $row['id'],
        'date' => format_date($row['distribution_date']),
        'time' => $row['schedule_time'] ?: 'TBD',
        'location' => $row['location'] ?: '—',
        'program' => $row['program'] ?: 'General',
        'status' => $row['status'],
        'beneficiaries' => (int) ($row['beneficiaries_count'] ?? 0),
        'items' => $row['items_summary'] ?: 'Relief goods',
        'notes' => $row['notes'] ?? '',
        'type' => $row['distribution_type'] ?? 'Delivery',
      ];
    }, $distRows);

    $weekStart = date('Y-m-d', strtotime('monday this week'));
    $monthStart = date('Y-m-01');
    $verifiedWeek = (int) $pdo->query("SELECT COUNT(*) FROM donations WHERE status IN ('Verified','Distributed') AND updated_at >= '{$weekStart}'")->fetchColumn();
    $verifiedMonth = (int) $pdo->query("SELECT COUNT(*) FROM donations WHERE status IN ('Verified','Distributed') AND updated_at >= '{$monthStart}'")->fetchColumn();
    $tasksDoneWeekStmt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE board_column = 'done' AND (assignee_user_id = ? OR assignee = ?) AND completed_at >= ?");
    $tasksDoneWeekStmt->execute([$user['id'], $user['name'], $weekStart . ' 00:00:00']);
    $tasksDoneWeek = (int) $tasksDoneWeekStmt->fetchColumn();
    $tasksDoneMonthStmt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE board_column = 'done' AND (assignee_user_id = ? OR assignee = ?) AND completed_at >= ?");
    $tasksDoneMonthStmt->execute([$user['id'], $user['name'], $monthStart . ' 00:00:00']);
    $tasksDoneMonth = (int) $tasksDoneMonthStmt->fetchColumn();
    $distsCompletedWeek = (int) $pdo->query("SELECT COUNT(*) FROM distributions WHERE status = 'Completed' AND distribution_date >= '{$weekStart}'")->fetchColumn();
    $distsCompletedMonth = (int) $pdo->query("SELECT COUNT(*) FROM distributions WHERE status = 'Completed' AND distribution_date >= '{$monthStart}'")->fetchColumn();

    $recentActivity = [];
    foreach (array_slice($donationsToVerify, 0, 3) as $d) {
      $recentActivity[] = [
        'type' => 'donation_submitted',
        'title' => "Donation {$d['id']} awaiting verification",
        'date' => $d['submittedDate'],
        'time' => '',
      ];
    }
    foreach (array_slice($inventoryAlerts, 0, 3) as $a) {
      $recentActivity[] = [
        'type' => 'alert_generated',
        'title' => "Low stock alert: {$a['item']} ({$a['severity']})",
        'date' => format_date(date('Y-m-d')),
        'time' => '',
      ];
    }
    foreach (array_slice(array_filter($mappedTasks, static fn($t) => $t['status'] === 'Done'), 0, 3) as $t) {
      $recentActivity[] = [
        'type' => 'task_completed',
        'title' => "Completed: {$t['title']}",
        'date' => $t['dueDate'],
        'time' => '',
      ];
    }

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Pending Verifications', 'value' => (string) $pendingDonations, 'icon' => 'clipboardCheck', 'color' => '#d97706'],
          ['label' => 'Low Stock Items', 'value' => (string) $lowStockCount, 'icon' => 'alertTriangle', 'color' => '#dc2626'],
          ['label' => 'Active Tasks', 'value' => (string) $openTaskCount, 'icon' => 'checkSquare', 'color' => '#2563eb'],
          ['label' => 'Distributions Today', 'value' => (string) $distsToday, 'icon' => 'truck', 'color' => '#16a34a'],
        ],
        'quickActions' => [
          ['id' => 'verify', 'label' => 'Verify Donations', 'icon' => 'clipboardCheck', 'count' => $pendingDonations, 'route' => '/staff/verification'],
          ['id' => 'inventory', 'label' => 'Update Inventory', 'icon' => 'package', 'count' => $lowStockCount, 'route' => '/staff/inventory'],
          ['id' => 'distribute', 'label' => 'Coordinate Distribution', 'icon' => 'truck', 'count' => $distsToday, 'route' => '/staff/distributions'],
          ['id' => 'tasks', 'label' => 'View All Tasks', 'icon' => 'listChecks', 'count' => $assignedTaskCount, 'route' => '/staff/tasks'],
        ],
        'tasks' => $mappedTasks,
        'donationsToVerify' => $donationsToVerify,
        'inventory' => $inventory,
        'inventoryAlerts' => $inventoryAlerts,
        'inventoryByCategory' => array_values($byCategory),
        'distributions' => $distributions,
        'performanceMetrics' => [
          'thisWeek' => [
            'donationsVerified' => $verifiedWeek,
            'inventoryUpdates' => $lowStockCount,
            'distributionsCompleted' => $distsCompletedWeek,
            'tasksCompleted' => $tasksDoneWeek,
          ],
          'thisMonth' => [
            'donationsVerified' => $verifiedMonth,
            'inventoryUpdates' => $lowStockCount,
            'distributionsCompleted' => $distsCompletedMonth,
            'tasksCompleted' => $tasksDoneMonth,
          ],
        ],
        'recentActivity' => array_slice($recentActivity, 0, 10),
      ],
    ]);
    break;

  default:
    json_response(['ok' => false, 'error' => 'Unsupported role'], 400);
}
