<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/**
 * Suggest volunteers for a task based on required skills.
 * GET ?skills=Packing%20%2F%20Repacking,First%20Aid&programs=Disaster%20Relief&availability=weekend
 * Optional: excludeVolunteerId, limit (default 5)
 */

$pdo = db();
require_auth(['Admin', 'Staff']);

function parse_list_param($raw): array
{
  if (is_array($raw)) {
    return array_values(array_filter(array_map(static fn($s) => trim((string) $s), $raw)));
  }
  $raw = trim((string) $raw);
  if ($raw === '') {
    return [];
  }
  // Support JSON array or comma-separated
  if ($raw[0] === '[') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      return array_values(array_filter(array_map(static fn($s) => trim((string) $s), $decoded)));
    }
  }
  return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

function decode_skill_tags(?string $json): array
{
  if (!$json) {
    return [];
  }
  $decoded = json_decode($json, true);
  if (!is_array($decoded)) {
    return [];
  }
  // Support { tags: [...] } or plain array
  if (isset($decoded['tags']) && is_array($decoded['tags'])) {
    $decoded = $decoded['tags'];
  }
  return array_values(array_filter(array_map(static fn($s) => trim((string) $s), $decoded)));
}

$requiredSkills = parse_list_param($_GET['skills'] ?? ($_GET['requiredSkills'] ?? []));
$preferredPrograms = parse_list_param($_GET['programs'] ?? []);
$availabilityHint = strtolower(trim((string) ($_GET['availability'] ?? '')));
$excludeId = (int) ($_GET['excludeVolunteerId'] ?? 0);
$limit = min(10, max(1, (int) ($_GET['limit'] ?? 5)));

$rows = $pdo->query("
  SELECT * FROM volunteers
  WHERE status IN ('Approved', 'Active', 'Assigned')
  ORDER BY full_name ASC
")->fetchAll();

$scored = [];
foreach ($rows as $row) {
  if ($excludeId && (int) $row['id'] === $excludeId) {
    continue;
  }

  $volSkills = decode_skill_tags($row['skills_json'] ?? null);
  $volPrograms = [];
  if (!empty($row['programs_json'])) {
    $decoded = json_decode((string) $row['programs_json'], true);
    if (is_array($decoded)) {
      $volPrograms = array_map(static fn($p) => trim((string) $p), $decoded);
    }
  }
  $availability = trim((string) ($row['availability'] ?? ''));
  $other = trim((string) ($row['skills_other'] ?? ''));

  $matchedSkills = [];
  if ($requiredSkills) {
    foreach ($requiredSkills as $need) {
      foreach ($volSkills as $have) {
        if (strcasecmp($need, $have) === 0) {
          $matchedSkills[] = $need;
          break;
        }
      }
    }
  }
  $skillOverlap = count($matchedSkills);
  $skillTotal = max(1, count($requiredSkills));

  $programHits = [];
  foreach ($preferredPrograms as $prog) {
    foreach ($volPrograms as $vp) {
      if ($prog !== '' && (strcasecmp($prog, $vp) === 0 || stripos($vp, $prog) !== false || stripos($prog, $vp) !== false)) {
        $programHits[] = $vp;
        break;
      }
    }
  }

  $availBoost = 0;
  if ($availabilityHint !== '' && $availability !== '') {
    $availLower = strtolower($availability);
    foreach (preg_split('/[\s,\/\-]+/', $availabilityHint) ?: [] as $tok) {
      $tok = trim($tok);
      if (strlen($tok) >= 3 && str_contains($availLower, $tok)) {
        $availBoost = 1;
        break;
      }
    }
  }

  $openTasks = 0;
  if (!empty($row['user_id'])) {
    $cnt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE (assignee_user_id = ? OR assignee = ?) AND board_column <> 'done'");
    $cnt->execute([(int) $row['user_id'], $row['full_name']]);
    $openTasks = (int) $cnt->fetchColumn();
  } else {
    $cnt = $pdo->prepare("SELECT COUNT(*) FROM tasks WHERE assignee = ? AND board_column <> 'done'");
    $cnt->execute([$row['full_name']]);
    $openTasks = (int) $cnt->fetchColumn();
  }

  $hours = (int) ($row['hours'] ?? 0);

  // Ranking: skill overlap first, then programs, availability, then prefer lighter workload
  $score = ($skillOverlap * 1000)
    + (count($programHits) * 50)
    + ($availBoost * 25)
    - ($openTasks * 15)
    - (int) floor($hours / 10);

  $whyParts = [];
  if ($requiredSkills) {
    $whyParts[] = "{$skillOverlap}/" . count($requiredSkills) . ' skills';
  } else {
    $whyParts[] = count($volSkills) . ' skills on file';
  }
  if ($programHits) {
    $whyParts[] = implode(', ', array_slice($programHits, 0, 2));
  } elseif ($volPrograms) {
    $whyParts[] = $volPrograms[0];
  }
  if ($availability !== '') {
    $whyParts[] = $availability;
  }
  if ($openTasks > 0) {
    $whyParts[] = "{$openTasks} open task" . ($openTasks === 1 ? '' : 's');
  } else {
    $whyParts[] = 'no open tasks';
  }

  $scored[] = [
    'dbId' => (int) $row['id'],
    'id' => $row['code'],
    'name' => $row['full_name'],
    'email' => $row['email'],
    'userId' => $row['user_id'] ? (int) $row['user_id'] : null,
    'status' => $row['status'],
    'skills' => $volSkills,
    'skillsOther' => $other,
    'matchedSkills' => $matchedSkills,
    'skillOverlap' => $skillOverlap,
    'skillTotal' => count($requiredSkills),
    'programs' => $volPrograms,
    'availability' => $availability,
    'openTasks' => $openTasks,
    'hours' => $hours,
    'score' => $score,
    'whyMatched' => implode(' · ', $whyParts),
  ];
}

usort($scored, static function ($a, $b) {
  return $b['score'] <=> $a['score']
    ?: $b['skillOverlap'] <=> $a['skillOverlap']
    ?: $a['openTasks'] <=> $b['openTasks']
    ?: strcasecmp($a['name'], $b['name']);
});

// Prefer people with at least some skill overlap when skills were requested
if ($requiredSkills) {
  $withOverlap = array_values(array_filter($scored, static fn($s) => $s['skillOverlap'] > 0));
  $without = array_values(array_filter($scored, static fn($s) => $s['skillOverlap'] === 0));
  $ordered = array_merge($withOverlap, $without);
} else {
  $ordered = $scored;
}

json_response([
  'ok' => true,
  'data' => array_slice($ordered, 0, $limit),
  'requiredSkills' => $requiredSkills,
  'meta' => [
    'candidates' => count($scored),
    'withSkillMatch' => count(array_filter($scored, static fn($s) => $s['skillOverlap'] > 0)),
  ],
]);
