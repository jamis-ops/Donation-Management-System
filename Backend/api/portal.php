<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Donor', 'Volunteer', 'Intern', 'Beneficiary', 'Staff', 'Admin']);

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
  case 'Intern':
    $vol = $pdo->prepare('SELECT * FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$user['id']]);
    $profile = $vol->fetch();
    $name = $profile['full_name'] ?? $user['name'];
    $isIntern = $user['role'] === 'Intern';
    if ($profile) {
      $recordType = !empty($profile['applicant_type']) && strcasecmp((string) $profile['applicant_type'], 'Intern') === 0 ? 'Intern' : 'Volunteer';
      if ($recordType !== $user['role']) {
        json_response(['ok' => false, 'error' => 'Account role does not match the linked applicant record. Contact an administrator.'], 403);
      }
    }
    $hours = $isIntern ? (int) ($profile['hours'] ?? 0) : 0;
    $requiredHours = $isIntern ? (int) ($profile['required_hours'] ?? 0) : 0;
    $remainingHours = $isIntern ? max(0, $requiredHours - $hours) : 0;
    $statusLabels = [
      'todo' => 'To Do',
      'inProgress' => 'In Progress',
      'review' => 'In Review',
      'done' => 'Done',
    ];

    $tasks = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY due_date ASC');
    $tasks->execute([$name, $user['id']]);
    $taskRows = $tasks->fetchAll();

    $mappedTasks = array_map(static function ($t) use ($statusLabels, $isIntern) {
      $column = $t['board_column'] ?? 'todo';
      $dutyHours = ($isIntern && isset($t['duty_hours']) && $t['duty_hours'] !== null) ? (float) $t['duty_hours'] : null;
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
        'dutyHours' => $dutyHours,
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
          'location' => 'Rise Above Foundation Cebu',
          'type' => $type,
          'status' => 'Scheduled',
          'attendees' => 0,
          'description' => '',
        ];
      }, $sched->fetchAll());
    }

    // Integrate volunteer's assigned tasks into schedule
    foreach ($taskRows as $t) {
      if (empty($t['due_date'])) continue;
      $mod = (string) ($t['module'] ?? '');
      $type = 'Community';
      $lower = strtolower($mod . ' ' . $t['title']);
      if (strpos($lower, 'distribut') !== false || strpos($lower, 'relief') !== false || strpos($lower, 'repack') !== false) {
        $type = 'Distribution';
      } elseif (strpos($lower, 'inventor') !== false || strpos($lower, 'warehouse') !== false) {
        $type = 'Inventory';
      } elseif (strpos($lower, 'feed') !== false || strpos($lower, 'program') !== false || strpos($lower, 'mission') !== false) {
        $type = 'Programs';
      } elseif (strpos($lower, 'train') !== false || strpos($lower, 'orient') !== false) {
        $type = 'Training';
      }

      $timeStr = !empty($t['duty_start']) 
        ? (!empty($t['duty_end']) ? "{$t['duty_start']} - {$t['duty_end']}" : $t['duty_start'])
        : 'Scheduled Duty';

      $isTaskDone = ($t['board_column'] ?? '') === 'done' || strtolower((string)($t['status'] ?? '')) === 'completed';

      $schedule[] = [
        'id' => $t['code'],
        'date' => format_date($t['due_date']),
        'rawDate' => $t['due_date'],
        'event' => $t['title'],
        'time' => $timeStr,
        'location' => 'Rise Above Foundation Cebu',
        'type' => $type,
        'status' => $isTaskDone ? 'Completed' : 'Scheduled',
        'priority' => $t['priority'] ?? 'Low',
        'module' => $mod ?: 'Volunteer Program',
        'isTask' => true,
        'code' => $t['code'],
        'description' => "Duty task assigned under {$mod}. Status: " . ($isTaskDone ? 'Completed' : 'Ongoing') . '.',
        'attendees' => 1,
      ];
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

    // Build activity log and (for interns only) hours breakdown
    $monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    $year = (int) date('Y');
    $monthBuckets = [];
    if ($isIntern) {
      for ($m = 1; $m <= 12; $m++) {
        $monthBuckets[$m] = ['month' => $monthNames[$m - 1], 'hours' => 0.0, 'activities' => 0];
      }
    }
    $activityLog = [];
    foreach ($taskRows as $t) {
      if (($t['board_column'] ?? '') !== 'done') {
        continue;
      }
      $h = ($isIntern && isset($t['duty_hours'])) ? (float) $t['duty_hours'] : 0;
      $completed = $t['completed_at'] ?: $t['due_date'];
      $ts = $completed ? strtotime((string) $completed) : false;
      if ($isIntern && $ts && (int) date('Y', $ts) === $year) {
        $mi = (int) date('n', $ts);
        $monthBuckets[$mi]['hours'] += $h;
        $monthBuckets[$mi]['activities'] += 1;
      }
      $activityLog[] = [
        'id' => $t['code'],
        'date' => format_date($completed),
        'rawDate' => $completed && $ts ? date('Y-m-d H:i:s', $ts) : ($completed ?: null),
        'year' => $ts ? (int) date('Y', $ts) : (int) date('Y'),
        'month' => $ts ? (int) date('n', $ts) : (int) date('n'),
        'monthName' => $ts ? $monthNames[(int) date('n', $ts) - 1] : date('F'),
        'activity' => $t['title'],
        'type' => $t['module'] ?: 'General',
        'hours' => $isIntern ? $h : null,
        'dutyStart' => $isIntern ? ($t['duty_start'] ?? null) : null,
        'dutyEnd' => $isIntern ? ($t['duty_end'] ?? null) : null,
        'dutyLabel' => $isIntern ? duty_label($t['duty_start'] ?? null, $t['duty_end'] ?? null, $h) : null,
        'attendance' => 'Present / Completed',
        'status' => 'Verified',
      ];
    }
    usort($activityLog, static fn($a, $b) => strcmp((string) ($b['rawDate'] ?? $b['date']), (string) ($a['rawDate'] ?? $a['date'])));

    $portalStats = $isIntern
      ? [
          ['label' => 'Hours Rendered', 'value' => (string) $hours, 'icon' => 'clock'],
          ['label' => 'Assigned Tasks', 'value' => (string) count($openTasks), 'icon' => 'checkSquare'],
          ['label' => 'Upcoming Events', 'value' => (string) count($schedule), 'icon' => 'calendar'],
          ['label' => 'Certificates', 'value' => (string) $certCount, 'icon' => 'award'],
        ]
      : [
          ['label' => 'Completed Tasks', 'value' => (string) count($doneTasks), 'icon' => 'checkCircle'],
          ['label' => 'Active Tasks', 'value' => (string) count($openTasks), 'icon' => 'checkSquare'],
          ['label' => 'Upcoming Events', 'value' => (string) count($schedule), 'icon' => 'calendar'],
          ['label' => 'Certificates', 'value' => (string) $certCount, 'icon' => 'award'],
        ];

    json_response([
      'ok' => true,
      'data' => [
        'isIntern' => $isIntern,
        'applicantType' => $isIntern ? 'Intern' : 'Volunteer',
        'hoursSummary' => $isIntern ? [
          'requiredHours' => $requiredHours,
          'renderedHours' => $hours,
          'remainingHours' => $remainingHours,
        ] : null,
        'stats' => $portalStats,
        'tasks' => $mappedTasks,
        'schedule' => $schedule,
        'hoursBreakdown' => $isIntern ? array_values($monthBuckets) : [],
        'activityLog' => $activityLog,
        'recentActivity' => array_slice($recentActivity, 0, 8),
      ],
    ]);
    break;

  case 'Beneficiary':
    $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE user_id = ? LIMIT 1');
    $ben->execute([$user['id']]);
    $profile = $ben->fetch();
    if (!$profile && !empty($user['email'])) {
      $ben = $pdo->prepare('SELECT * FROM beneficiaries WHERE LOWER(representative_email) = LOWER(?) LIMIT 1');
      $ben->execute([(string) $user['email']]);
      $profile = $ben->fetch();
    }
    $benId = (int) ($profile['id'] ?? 0);

    $requests = [];
    $rawRequests = [];
    if ($benId > 0) {
      $req = $pdo->prepare('SELECT * FROM assistance_requests WHERE beneficiary_id = ? ORDER BY request_date DESC, id DESC');
      $req->execute([$benId]);
      $rawRequests = $req->fetchAll();
      $requests = array_map(static fn($r) => [
        'id' => $r['reference_code'],
        'dbId' => (int) $r['id'],
        'type' => $r['assistance_type'],
        'priority' => $r['priority'] ?? 'Medium',
        'date' => format_date($r['request_date']),
        'status' => $r['status'],
        'notes' => $r['notes'] ?? '',
      ], $rawRequests);
    }

    $distributions = [];
    $rawDists = [];
    if ($benId > 0) {
      $brgySearch = trim((string) ($profile['barangay'] ?? ($profile['full_name'] ?? '')));
      $stripped = trim((string) preg_replace('/^(brgy\.?|barangay)\s+/i', '', $brgySearch));
      $term = $stripped !== '' ? $stripped : $brgySearch;

      $distStmt = $pdo->prepare("
        SELECT d.* 
        FROM distributions d 
        WHERE (
          d.beneficiary_id = ? 
          OR (d.beneficiary_id IS NULL AND ? != '' AND (d.location LIKE ? OR d.event_name LIKE ?))
        )
        AND d.status IN ('Planning','Preparing','In Transit','Delivered','Awaiting Proof','Scheduled')
        ORDER BY d.distribution_date ASC, d.id ASC
      ");
      $distStmt->execute([$benId, $term, '%' . $term . '%', '%' . $term . '%']);
      $rawDists = $distStmt->fetchAll();

      $distributions = array_map(static fn($d) => [
        'id' => (int) ($d['id'] ?? 0),
        'dbId' => (int) ($d['id'] ?? 0),
        'distributionCode' => $d['code'] ?? ('DST-' . ($d['id'] ?? '1')),
        'event' => !empty($d['event_name']) ? $d['event_name'] : (!empty($d['distribution_type']) ? $d['distribution_type'] : 'Relief Distribution'),
        'date' => format_date($d['distribution_date'] ?? null),
        'time' => $d['schedule_time'] ?? ($d['distribution_time'] ?? ($d['time'] ?? '9:00 AM')),
        'location' => $d['location'] ?? 'Barangay Hall',
        'type' => $d['distribution_type'] ?? 'Relief Goods',
        'status' => normalize_distribution_status((string) ($d['status'] ?? 'Scheduled')),
        'quantity' => (int) ($d['received_quantity'] ?? $d['beneficiaries_count'] ?? $d['quantity'] ?? 0),
        'items' => !empty($d['items_summary']) ? $d['items_summary'] : (!empty($d['items']) ? $d['items'] : 'Assorted Relief Goods'),
      ], $rawDists);
    }

    $completedRequestsCount = (int) count(array_filter($requests, static fn($r) => in_array($r['status'], ['Completed', 'Distributed', 'Done'], true)));
    $activeCount = (int) count(array_filter($requests, static fn($r) => in_array($r['status'], ['Pending Review', 'Under Review', 'Allocated', 'In Transit'], true)));
    $approvedCount = (int) count(array_filter($requests, static fn($r) => $r['status'] === 'Approved'));

    // Fetch actual assistance / turnover history
    $history = [];
    if ($benId > 0) {
      $brgySearch = trim((string) ($profile['barangay'] ?? ($profile['full_name'] ?? '')));
      $stripped = trim((string) preg_replace('/^(brgy\.?|barangay)\s+/i', '', $brgySearch));
      $term = $stripped !== '' ? $stripped : $brgySearch;

      $histStmt = $pdo->prepare("
        SELECT d.* 
        FROM distributions d 
        WHERE (
          d.beneficiary_id = ? 
          OR (d.beneficiary_id IS NULL AND ? != '' AND (d.location LIKE ? OR d.event_name LIKE ?))
        )
        AND d.status IN ('Completed', 'Delivered')
        ORDER BY d.distribution_date DESC, d.id DESC
      ");
      $histStmt->execute([$benId, $term, '%' . $term . '%', '%' . $term . '%']);
      $rawHistory = $histStmt->fetchAll();

      foreach ($rawHistory as $h) {
        $qty = (int) ($h['received_quantity'] ?? $h['beneficiaries_count'] ?? $h['quantity'] ?? 0);
        $val = $qty * 450;
        $history[] = [
          'id' => (int) $h['id'],
          'code' => $h['code'] ?? '',
          'date' => format_date($h['distribution_date']),
          'rawDate' => $h['distribution_date'],
          'item' => $h['items_summary'] ?: ($h['event_name'] ?: 'Relief Goods Package'),
          'program' => $h['program'] ?: ($h['distribution_type'] ?: 'Emergency Relief'),
          'quantity' => $qty . ' packs',
          'location' => $h['location'] ?: ($profile['barangay'] ?? 'Barangay Hall'),
          'value' => '₱' . number_format($val),
          'valueRaw' => (float) $val,
          'status' => 'Received & Verified',
        ];
      }
    }

    $completedDistsCount = count($history);

    // Monthly benefits chart computed from real history for current year
    $monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    $currentYear = (int) date('Y');
    $byMonthMap = [];
    for ($m = 1; $m <= 12; $m++) {
      $byMonthMap[$m] = [
        'month' => $monthNames[$m - 1],
        'value' => 0.0,
        'count' => 0,
      ];
    }
    foreach ($history as $h) {
      if (!empty($h['rawDate'])) {
        $ts = strtotime((string) $h['rawDate']);
        if ($ts && (int) date('Y', $ts) === $currentYear) {
          $mIdx = (int) date('n', $ts);
          $byMonthMap[$mIdx]['count'] += 1;
          $byMonthMap[$mIdx]['value'] += (float) ($h['valueRaw'] ?? 0);
        }
      }
    }
    $benefitsByMonth = array_values($byMonthMap);

    // Benefits summary grouped by program from real history
    $progMap = [];
    foreach ($history as $h) {
      $prog = trim((string) ($h['program'] ?? 'Emergency Relief'));
      if ($prog === '') $prog = 'Emergency Relief';
      if (!isset($progMap[$prog])) {
        $progMap[$prog] = [
          'program' => $prog,
          'count' => 0,
          'totalValue' => 0.0,
        ];
      }
      $progMap[$prog]['count'] += 1;
      $progMap[$prog]['totalValue'] += (float) ($h['valueRaw'] ?? 0);
    }
    $benefitsByProgram = array_values($progMap);

    // Activity feed built dynamically from real requests and distributions
    $recentActivity = [];
    foreach (array_slice($requests, 0, 5) as $reqItem) {
      $recentActivity[] = [
        'title' => "Request {$reqItem['id']} ({$reqItem['type']}) is {$reqItem['status']}",
        'date' => $reqItem['date'],
        'icon' => in_array($reqItem['status'], ['Approved', 'Completed'], true) ? 'checkCircle' : 'inbox',
      ];
    }
    foreach (array_slice($distributions, 0, 3) as $distItem) {
      $recentActivity[] = [
        'title' => "Relief Delivery ({$distItem['event']}) is {$distItem['status']}",
        'date' => $distItem['date'],
        'icon' => 'package',
      ];
    }

    json_response([
      'ok' => true,
      'data' => [
        'profile' => [
          'name' => $profile['full_name'] ?? $user['name'],
          'barangay' => $profile['barangay'] ?? $profile['full_name'] ?? $user['name'],
          'municipality' => $profile['municipality'] ?? '',
          'representative' => $profile['representative_name'] ?? $user['name'],
          'phone' => $profile['representative_phone'] ?? '',
          'families' => (int) ($profile['affected_families'] ?? 0),
          'status' => $profile['status'] ?? 'Active',
        ],
        'stats' => [
          ['label' => 'Total Received', 'value' => (string) $completedDistsCount, 'icon' => 'package'],
          ['label' => 'Total Requests', 'value' => (string) count($requests), 'icon' => 'inbox'],
          ['label' => 'Active Requests', 'value' => (string) $activeCount, 'icon' => 'clock'],
          ['label' => 'Scheduled Deliveries', 'value' => (string) count($distributions), 'icon' => 'calendar'],
        ],
        'requests' => $requests,
        'upcomingSchedule' => $distributions,
        'distributions' => $distributions,
        'history' => $history,
        'benefitsByMonth' => $benefitsByMonth,
        'benefitsByProgram' => $benefitsByProgram,
        'recentActivity' => $recentActivity,
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

    $taskList = $pdo->prepare("SELECT t.*, d.code AS dist_code, d.location AS dist_location, d.program AS dist_program, d.event_name AS dist_event_name, d.status AS dist_status
      FROM tasks t
      LEFT JOIN distributions d ON d.id = t.distribution_id
      WHERE t.assignee_user_id = ? OR t.assignee = ?
      ORDER BY FIELD(t.priority, 'Critical', 'High', 'Medium', 'Low'), t.due_date ASC");
    $taskList->execute([$user['id'], $user['name']]);
    $taskRows = $taskList->fetchAll();
    $mappedTasks = [];
    foreach ($taskRows as $t) {
      $column = $t['board_column'] ?? 'todo';
      $status = $statusLabels[$column] ?? 'To Do';
      $completion = $column === 'done' ? 100 : ($column === 'inProgress' ? 50 : ($column === 'review' ? 80 : 0));
      $hours = isset($t['duty_hours']) && $t['duty_hours'] !== null ? (float) $t['duty_hours'] : null;
      $prog = $t['module'] ?: ($t['dist_program'] ?: 'General Support');
      $loc = !empty($t['location']) ? $t['location'] : (!empty($t['dist_location']) ? $t['dist_location'] : 'Cebu Operations');
      $instructions = !empty($t['instructions']) ? $t['instructions'] : (!empty($t['description']) ? $t['description'] : 'Execute assigned operations according to standard safety, verification, and distribution guidelines.');

      $mappedTasks[] = [
        'id' => $t['code'],
        'dbId' => (int) $t['id'],
        'title' => $t['title'],
        'category' => $prog,
        'program' => $prog,
        'priority' => $t['priority'] ?: 'Medium',
        'status' => $status,
        'boardColumn' => $column,
        'assignedTo' => $t['assignee'] ?: $user['name'],
        'dueDate' => format_date($t['due_date']),
        'due' => format_date($t['due_date']),
        'location' => $loc,
        'instructions' => $instructions,
        'description' => $t['description'] ?? $t['title'],
        'distributionId' => !empty($t['distribution_id']) ? (int) $t['distribution_id'] : null,
        'distributionCode' => $t['dist_code'] ?? '',
        'distributionLabel' => $t['dist_event_name'] ?: ($t['dist_location'] ?: ''),
        'distributionStatus' => $t['dist_status'] ?? '',
        'dutyStart' => $t['duty_start'] ?? null,
        'dutyEnd' => $t['duty_end'] ?? null,
        'schedule' => !empty($t['duty_start']) ? format_date($t['due_date']) . " ({$t['duty_start']} - {$t['duty_end']})" : format_date($t['due_date']),
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
        'priority' => $priority,
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
      $uiStatus = $label === 'Out of Stock' ? 'Out of Stock' : (
        $label === 'Low Stock' && $qty <= max(1, (int) floor($low / 2)) ? 'Critical' : (
          $label === 'Low Stock' ? 'Low Stock' : ($label === 'Moderate' ? 'Low Stock' : 'Adequate')
        )
      );
      $cat = $row['category'] ?: 'General';

      $defaultCost = match(true) {
        stripos($row['item_name'] ?? '', 'rice') !== false => 520.0,
        stripos($row['item_name'] ?? '', 'sardines') !== false || stripos($row['item_name'] ?? '', 'canned') !== false => 35.0,
        stripos($row['item_name'] ?? '', 'water') !== false => 25.0,
        stripos($cat, 'food') !== false => 45.0,
        stripos($cat, 'hygiene') !== false => 85.0,
        stripos($cat, 'medical') !== false => 120.0,
        stripos($cat, 'clothing') !== false => 150.0,
        default => 50.0,
      };
      $cost = isset($row['cost_per_unit']) && $row['cost_per_unit'] !== null && (float)$row['cost_per_unit'] > 0
        ? (float)$row['cost_per_unit']
        : $defaultCost;
      $supplier = !empty($row['supplier']) ? (string)$row['supplier'] : 'Rise Above Logistics / Community Donors';
      $location = !empty($row['location']) ? (string)$row['location'] : ('Warehouse Shelf ' . strtoupper(substr($cat ?: 'G', 0, 1)) . '-1');
      $reorder = !empty($row['reorder_amount']) ? (int)$row['reorder_amount'] : max(10, ($moderate ?: ($low * 2)) - $qty);

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
        'location' => $location,
        'costPerUnit' => $cost,
        'totalValue' => $qty * $cost,
        'supplier' => $supplier,
        'reorderAmount' => $reorder,
      ];
      $inventory[] = $item;
      if (!isset($byCategory[$cat])) {
        $byCategory[$cat] = ['category' => $cat, 'items' => 0, 'totalValueNum' => 0, 'status' => 'Adequate'];
      }
      $byCategory[$cat]['items'] += 1;
      $byCategory[$cat]['totalValueNum'] += ($qty * $cost);
      $byCategory[$cat]['totalValue'] = '₱' . number_format($byCategory[$cat]['totalValueNum'], 2);
      if ($uiStatus === 'Critical' || $uiStatus === 'Out of Stock') {
        $byCategory[$cat]['status'] = 'Critical';
      } elseif ($uiStatus === 'Low Stock' && $byCategory[$cat]['status'] !== 'Critical') {
        $byCategory[$cat]['status'] = 'Low Stock';
      }
      if (in_array($level, ['low', 'out'], true) || $uiStatus === 'Critical' || $uiStatus === 'Low Stock') {
        $inventoryAlerts[] = [
          'item' => $row['item_name'],
          'currentStock' => $qty,
          'minStock' => $low,
          'unit' => $row['unit'] ?: 'units',
          'severity' => in_array($uiStatus, ['Critical', 'Out of Stock'], true) ? 'Critical' : 'Low',
          'action' => in_array($uiStatus, ['Critical', 'Out of Stock'], true) ? 'Order immediately' : 'Order soon',
          'dbId' => (int) $row['id'],
        ];
      }
    }

    $distRows = $pdo->query('SELECT * FROM distributions ORDER BY distribution_date DESC, id DESC LIMIT 40')->fetchAll();
    $distributions = array_map(static function ($row) {
      $rawNotes = (string)($row['notes'] ?? '');
      $assignedVolunteers = [];
      $assignedStaff = $row['coordinator'] ?: 'Operations Staff';
      // Clean notes from embedded "Assigned Team: ..." strings
      if (preg_match('/Assigned Team:\s*([^;\n\r]+)/i', $rawNotes, $m)) {
        $teamStr = trim($m[1]);
        $assignedVolunteers = array_values(array_filter(array_map('trim', explode(',', $teamStr))));
        $cleanNotes = trim(preg_replace('/Assigned Team:\s*[^;\n\r]+/i', '', $rawNotes));
      } else {
        $cleanNotes = $rawNotes;
      }
      if (!empty($row['coordinator']) && !in_array($row['coordinator'], $assignedVolunteers, true)) {
        $assignedStaff = $row['coordinator'];
      }

      return [
        'id' => $row['code'],
        'dbId' => (int) $row['id'],
        'date' => format_date($row['distribution_date']),
        'time' => $row['schedule_time'] ?: '09:00 AM',
        'location' => $row['location'] ?: '—',
        'program' => $row['program'] ?: 'General Relief',
        'status' => normalize_distribution_status((string) ($row['status'] ?? 'Planning')),
        'beneficiaries' => (int) ($row['beneficiaries_count'] ?? 0),
        'items' => $row['items_summary'] ?: 'Relief goods packs',
        'notes' => $cleanNotes,
        'type' => $row['distribution_type'] ?? 'Delivery',
        'assignedStaff' => $assignedStaff,
        'assignedVolunteers' => $assignedVolunteers,
        'route' => $row['location'] ? "Depot → {$row['location']}" : '',
        'vehicleNeeded' => true,
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
          ['label' => 'Donations to Verify', 'value' => (string) $pendingDonations, 'icon' => 'clipboardCheck', 'color' => '#AF101A'],
          ['label' => 'Low Stock Items', 'value' => (string) $lowStockCount, 'icon' => 'alertTriangle', 'color' => '#dc2626'],
          ['label' => 'Assigned Tasks', 'value' => (string) $openTaskCount, 'icon' => 'checkSquare', 'color' => '#2563eb'],
          ['label' => 'Active Deliveries', 'value' => (string) $distsToday, 'icon' => 'truck', 'color' => '#16a34a'],
        ],
        'quickActions' => [
          ['id' => 'verify', 'label' => 'Verify Donations', 'icon' => 'clipboardCheck', 'count' => $pendingDonations, 'route' => '/staff/donations?status=Pending+Verification'],
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
