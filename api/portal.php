<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$pdo = db();
$user = require_auth(['Donor', 'Volunteer', 'Beneficiary', 'Staff', 'Admin']);

switch ($user['role']) {
  case 'Donor':
    $donations = $pdo->prepare('SELECT * FROM donations WHERE donor_email = ? ORDER BY donation_date DESC');
    $donations->execute([$user['email']]);
    $rows = $donations->fetchAll();
    $total = array_sum(array_map(static fn($r) => (float) ($r['amount'] ?? 0), $rows));
    $pending = count(array_filter($rows, static fn($r) => $r['status'] === 'Pending Verification'));
    $certs = $pdo->prepare('SELECT COUNT(*) FROM certificates WHERE recipient_name = ? OR reference_code IN (SELECT tracking_code FROM donations WHERE donor_email = ?)');
    $certs->execute([$user['name'], $user['email']]);
    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Total Donated', 'value' => '₱' . number_format($total)],
          ['label' => 'Donations Made', 'value' => (string) count($rows)],
          ['label' => 'Pending Verification', 'value' => (string) $pending],
          ['label' => 'Certificates Ready', 'value' => (string) $certs->fetchColumn()],
        ],
        'donations' => array_map(static function ($row) {
          return [
            'id' => $row['tracking_code'],
            'type' => $row['type'],
            'amount' => money_display($row['type'], $row['amount'], $row['items_description']),
            'date' => format_date($row['donation_date']),
            'status' => $row['status'],
          ];
        }, $rows),
      ],
    ]);
    break;

  case 'Volunteer':
    $vol = $pdo->prepare('SELECT * FROM volunteers WHERE user_id = ? LIMIT 1');
    $vol->execute([$user['id']]);
    $profile = $vol->fetch();
    $name = $profile['full_name'] ?? $user['name'];
    $hours = (int) ($profile['hours'] ?? 0);

    $tasks = $pdo->prepare('SELECT * FROM tasks WHERE assignee = ? OR assignee_user_id = ? ORDER BY due_date ASC');
    $tasks->execute([$name, $user['id']]);
    $taskRows = $tasks->fetchAll();

    $schedule = [];
    if ($profile) {
      $sched = $pdo->prepare('SELECT * FROM volunteer_schedule WHERE volunteer_id = ? ORDER BY event_date ASC');
      $sched->execute([$profile['id']]);
      $schedule = array_map(static fn($s) => [
        'date' => format_date($s['event_date']),
        'event' => $s['event_title'],
        'time' => $s['event_time'],
      ], $sched->fetchAll());
    }

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Hours Rendered', 'value' => (string) $hours],
          ['label' => 'Assigned Tasks', 'value' => (string) count($taskRows)],
          ['label' => 'Upcoming Events', 'value' => (string) count($schedule)],
          ['label' => 'Certificates', 'value' => '1'],
        ],
        'tasks' => array_map(static function ($t) {
          $duty = [];
          if (!empty($t['duty_start']) && !empty($t['duty_end'])) {
            $s = strtotime($t['duty_start']);
            $e = strtotime($t['duty_end']);
            $duty[] = ($s ? date('g:i A', $s) : $t['duty_start']) . ' – ' . ($e ? date('g:i A', $e) : $t['duty_end']);
          }
          if (isset($t['duty_hours']) && $t['duty_hours'] !== null && (float) $t['duty_hours'] > 0) {
            $h = rtrim(rtrim(number_format((float) $t['duty_hours'], 2), '0'), '.');
            $duty[] = "{$h} hrs";
          }
          return [
            'id' => $t['code'],
            'title' => $t['title'],
            'due' => format_date($t['due_date']),
            'duty' => implode(' · ', $duty),
            'status' => ucfirst($t['board_column']),
          ];
        }, $taskRows),
        'schedule' => $schedule,
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

    $dist = $pdo->query("SELECT * FROM distributions WHERE status IN ('Scheduled','Planning','Preparing','In Transit','Delivered','Awaiting Proof') ORDER BY distribution_date ASC");
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
          ['label' => 'Scheduled Pickups', 'value' => (string) count($distributions)],
          ['label' => 'Total Received', 'value' => (string) count($requests)],
        ],
        'requests' => $requests,
        'distributions' => $distributions,
      ],
    ]);
    break;

  case 'Staff':
  case 'Admin':
    $pendingDonations = (int) $pdo->query("SELECT COUNT(*) FROM donations WHERE status = 'Pending Verification'")->fetchColumn();
    $inventoryUpdates = (int) $pdo->query('SELECT COUNT(*) FROM inventory_items WHERE quantity <= low_stock_threshold')->fetchColumn();
    $assignedTasks = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE assignee_user_id = ? OR assignee = ?");
    $assignedTasks->execute([$user['id'], $user['name']]);
    $tasksToday = (int) $pdo->query("SELECT COUNT(*) FROM distributions WHERE distribution_date = CURDATE()")->fetchColumn();

    $taskList = $pdo->prepare('SELECT * FROM tasks WHERE assignee_user_id = ? OR assignee = ? ORDER BY due_date ASC LIMIT 10');
    $taskList->execute([$user['id'], $user['name']]);

    json_response([
      'ok' => true,
      'data' => [
        'stats' => [
          ['label' => 'Donations to Verify', 'value' => (string) $pendingDonations],
          ['label' => 'Inventory Updates', 'value' => (string) $inventoryUpdates],
          ['label' => 'Assigned Tasks', 'value' => (string) $assignedTasks->fetchColumn()],
          ['label' => 'Distributions Today', 'value' => (string) $tasksToday],
        ],
        'tasks' => array_map(static fn($t) => [
          'id' => $t['code'],
          'title' => $t['title'],
          'priority' => $t['priority'],
          'due' => format_date($t['due_date']),
        ], $taskList->fetchAll()),
      ],
    ]);
    break;

  default:
    json_response(['ok' => false, 'error' => 'Unsupported role'], 400);
}
