<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

// Ensure tasks.module can hold full program names
try { $pdo->exec("ALTER TABLE tasks MODIFY COLUMN module VARCHAR(160) NULL"); } catch (Throwable $e) {}

$DEFAULT_TASK_TITLES = [
  // Disaster Relief and House Building Project
  ['title' => 'Emergency Relief Goods Repacking', 'program' => 'Disaster Relief and House Building Project', 'description' => 'Sort, pack, and prepare disaster relief goods and family food packs.'],
  ['title' => 'On-site Relief Goods Distribution', 'program' => 'Disaster Relief and House Building Project', 'description' => 'Assist in organizing distribution lines, verifying stubs, and handing out packages.'],
  ['title' => 'Shelter Assessment & Needs Survey', 'program' => 'Disaster Relief and House Building Project', 'description' => 'Conduct ground assessments of affected homes and structural rehabilitation needs.'],
  ['title' => 'House Repair & Carpentry Assistance', 'program' => 'Disaster Relief and House Building Project', 'description' => 'Aid builders and carpenters in community rebuilding and shelter repairs.'],
  ['title' => 'Logistics & Supply Transport', 'program' => 'Disaster Relief and House Building Project', 'description' => 'Coordinate vehicle loading, route logistics, and cargo offloading at site.'],

  // Community Feeding & Nutrition Program
  ['title' => 'Hot Meals Cooking & Preparation', 'program' => 'Community Feeding & Nutrition Program', 'description' => 'Assist head cooks in meal prep, vegetable chopping, and cooking hot meals.'],
  ['title' => 'Nutritional Feeding Station Setup', 'program' => 'Community Feeding & Nutrition Program', 'description' => 'Set up tables, washing areas, and food staging counters in target communities.'],
  ['title' => 'Beneficiary Attendance & Crowd Marshalling', 'program' => 'Community Feeding & Nutrition Program', 'description' => 'Check in children and families, distribute meal tags, and ensure orderly queues.'],
  ['title' => 'Food Hygiene & Sanitization', 'program' => 'Community Feeding & Nutrition Program', 'description' => 'Ensure proper food safety protocols, utensil washing, and hand disinfection stations.'],
  ['title' => 'Post-Feeding Cleanup & Inventory', 'program' => 'Community Feeding & Nutrition Program', 'description' => 'Clean venue, collect food waste responsibly, and inventory remaining supplies.'],

  // Educational Sponsorship & Youth Development
  ['title' => 'School Supplies Kit Assembly', 'program' => 'Educational Sponsorship & Youth Development', 'description' => 'Package notebooks, stationery, and backpacks tailored for student recipients.'],
  ['title' => 'Tutorial & Literacy Workshop Facilitation', 'program' => 'Educational Sponsorship & Youth Development', 'description' => 'Conduct reading, writing, and math mentoring sessions for sponsored children.'],
  ['title' => 'Youth Mentorship & Values Formation', 'program' => 'Educational Sponsorship & Youth Development', 'description' => 'Lead group discussions and motivational activities for youth scholars.'],
  ['title' => 'Student Progress & Attendance Monitoring', 'program' => 'Educational Sponsorship & Youth Development', 'description' => 'Check grade reports, attendance cards, and write progress summaries.'],
  ['title' => 'Scholarship Document Verification', 'program' => 'Educational Sponsorship & Youth Development', 'description' => 'Review school enrollment forms, IDs, and financial need proof documents.'],

  // Medical and Dental Missions
  ['title' => 'Patient Triage & Vital Signs Check', 'program' => 'Medical and Dental Missions', 'description' => 'Take patient temperature, blood pressure, weight, and initial complaint notes.'],
  ['title' => 'Pharmacy & Medicine Dispensing Assistance', 'program' => 'Medical and Dental Missions', 'description' => 'Organize prescription medicine stock and guide patients on doctor dosages.'],
  ['title' => 'Dental Clinic Sterilization & Setup', 'program' => 'Medical and Dental Missions', 'description' => 'Prepare dental chairs, sanitize equipment, and assist attending dentists.'],
  ['title' => 'Medical Records Registration', 'program' => 'Medical and Dental Missions', 'description' => 'Enter patient demographic details and assign consultation priority numbers.'],
  ['title' => 'Health Education & Patient Guidance', 'program' => 'Medical and Dental Missions', 'description' => 'Distribute pamphlets and explain preventive care habits to waiting patients.'],

  // Family Hygiene & Preventive Health
  ['title' => 'Hygiene Kit Packing & Distribution', 'program' => 'Family Hygiene & Preventive Health', 'description' => 'Assemble hygiene packs (soap, toothbrushes, sanitizers) and distribute to families.'],
  ['title' => 'WASH Demonstration Facilitator', 'program' => 'Family Hygiene & Preventive Health', 'description' => 'Demonstrate proper handwashing and clean water sanitation practices.'],
  ['title' => 'Preventive Health Information Drive', 'program' => 'Family Hygiene & Preventive Health', 'description' => 'Share guidelines on communicable disease prevention in community gatherings.'],
  ['title' => 'Community Health Surveying', 'program' => 'Family Hygiene & Preventive Health', 'description' => 'Gather basic household health metrics and sanitary facility access status.'],

  // Livelihood & Skills Training
  ['title' => 'Skills Training Workshop Assistant', 'program' => 'Livelihood & Skills Training', 'description' => 'Set up sewing machines, baking equipment, or craft materials for trainees.'],
  ['title' => 'Livelihood Starter Kit Distribution', 'program' => 'Livelihood & Skills Training', 'description' => 'Verify graduates and hand over specialized livelihood equipment starter kits.'],
  ['title' => 'Participant Registration & Toolkit Handover', 'program' => 'Livelihood & Skills Training', 'description' => 'Register training attendees and hand over toolkits and course manuals.'],
  ['title' => 'Post-Training Follow-up & Documentation', 'program' => 'Livelihood & Skills Training', 'description' => 'Record participant business start progress and collect program feedback.'],

  // All Programs / Foundation Operations
  ['title' => 'Administrative Support & Data Entry', 'program' => 'All Programs', 'description' => 'Support office staff with filing, document scanning, and computer data entry.'],
  ['title' => 'Warehouse Sorting & Inventory Count', 'program' => 'All Programs', 'description' => 'Count stored goods, reorganize shelves, and report low stock thresholds.'],
  ['title' => 'Event Documentation & Photography', 'program' => 'All Programs', 'description' => 'Capture photo and video highlights of operations for reports and donor updates.'],
  ['title' => 'Volunteer Coordinator Assistant', 'program' => 'All Programs', 'description' => 'Brief arriving volunteers, distribute vests and IDs, and monitor field assignments.'],
  ['title' => 'Community Fieldwork & Inquiries', 'program' => 'All Programs', 'description' => 'Liaise with local leaders and respond to general community beneficiary inquiries.'],
];

function ensure_task_titles_table(PDO $pdo, array $defaults): void
{
  static $ready = false;
  if ($ready) {
    return;
  }
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS task_titles (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      program VARCHAR(160) NOT NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_task_titles_program (program),
      INDEX idx_task_titles_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $count = (int) $pdo->query('SELECT COUNT(*) FROM task_titles')->fetchColumn();
  if ($count === 0) {
    $ins = $pdo->prepare('INSERT INTO task_titles (title, program, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1)');
    foreach (array_values($defaults) as $i => $item) {
      $ins->execute([
        $item['title'],
        $item['program'],
        $item['description'] ?? null,
        $i + 1,
      ]);
    }
  }
  $ready = true;
}

function map_task_title(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'dbId' => (int) $row['id'],
    'title' => (string) $row['title'],
    'program' => (string) ($row['program'] ?? 'All Programs'),
    'description' => $row['description'] !== null ? (string) $row['description'] : '',
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'isActive' => (bool) ($row['is_active'] ?? 1),
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

ensure_task_titles_table($pdo, $DEFAULT_TASK_TITLES);

// ------------------- GET -------------------
if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Task title not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_task_title($row)]);
  }

  $programFilter = trim((string) ($_GET['program'] ?? ''));
  $activeOnly = isset($_GET['active']) && (string) $_GET['active'] === '1';
  $search = trim((string) ($_GET['search'] ?? ''));

  $sql = 'SELECT * FROM task_titles WHERE 1=1';
  $params = [];

  if ($activeOnly) {
    $sql .= ' AND is_active = 1';
  }

  if ($programFilter !== '' && strcasecmp($programFilter, 'all') !== 0) {
    $sql .= ' AND (program = ? OR program = "All Programs" OR program = "General")';
    $params[] = $programFilter;
  }

  if ($search !== '') {
    $sql .= ' AND (title LIKE ? OR program LIKE ? OR description LIKE ?)';
    $searchTerm = "%{$search}%";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
  }

  $sql .= ' ORDER BY program ASC, sort_order ASC, title ASC';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  json_response(['ok' => true, 'data' => array_map('map_task_title', $rows)]);
}

// ------------------- POST (Create) -------------------
if ($method === 'POST') {
  require_auth(['SuperAdmin', 'Admin']);
  $body = read_json_body();

  $title = trim((string) ($body['title'] ?? ''));
  $program = trim((string) ($body['program'] ?? 'All Programs'));
  $description = trim((string) ($body['description'] ?? ''));
  $isActive = isset($body['isActive']) ? (bool) $body['isActive'] : (isset($body['is_active']) ? (bool) $body['is_active'] : true);
  $sortOrder = (int) ($body['sortOrder'] ?? ($body['sort_order'] ?? 0));

  if ($title === '') {
    json_response(['ok' => false, 'error' => 'Task title is required.'], 400);
  }
  if ($program === '') {
    $program = 'All Programs';
  }

  // Check duplicate title in same program
  $chk = $pdo->prepare('SELECT id FROM task_titles WHERE LOWER(title) = LOWER(?) AND LOWER(program) = LOWER(?) LIMIT 1');
  $chk->execute([$title, $program]);
  if ($chk->fetch()) {
    json_response(['ok' => false, 'error' => 'A task title with this name already exists for the selected program.'], 409);
  }

  $ins = $pdo->prepare('INSERT INTO task_titles (title, program, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)');
  $ins->execute([
    $title,
    $program,
    $description !== '' ? $description : null,
    $sortOrder,
    $isActive ? 1 : 0,
  ]);
  $newId = (int) $pdo->lastInsertId();

  audit_log($pdo, 'create', 'task_titles', (string) $newId, "Created task title: '{$title}' for program: '{$program}'");

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$newId]);
  json_response(['ok' => true, 'data' => map_task_title($stmt->fetch())], 201);
}

// ------------------- PUT (Update) -------------------
if ($method === 'PUT') {
  require_auth(['SuperAdmin', 'Admin']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Task title ID is required.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Task title not found.'], 404);
  }

  $body = read_json_body();
  $title = array_key_exists('title', $body) ? trim((string) $body['title']) : $existing['title'];
  $program = array_key_exists('program', $body) ? trim((string) $body['program']) : $existing['program'];
  $description = array_key_exists('description', $body) ? trim((string) $body['description']) : ($existing['description'] ?? '');
  $isActive = array_key_exists('isActive', $body)
    ? (bool) $body['isActive']
    : (array_key_exists('is_active', $body) ? (bool) $body['is_active'] : (bool) $existing['is_active']);
  $sortOrder = array_key_exists('sortOrder', $body)
    ? (int) $body['sortOrder']
    : (array_key_exists('sort_order', $body) ? (int) $body['sort_order'] : (int) $existing['sort_order']);

  if ($title === '') {
    json_response(['ok' => false, 'error' => 'Task title cannot be empty.'], 400);
  }
  if ($program === '') {
    $program = 'All Programs';
  }

  // Duplicate check excluding self
  $chk = $pdo->prepare('SELECT id FROM task_titles WHERE LOWER(title) = LOWER(?) AND LOWER(program) = LOWER(?) AND id <> ? LIMIT 1');
  $chk->execute([$title, $program, $id]);
  if ($chk->fetch()) {
    json_response(['ok' => false, 'error' => 'Another task title with this name already exists for this program.'], 409);
  }

  $upd = $pdo->prepare('UPDATE task_titles SET title = ?, program = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?');
  $upd->execute([
    $title,
    $program,
    $description !== '' ? $description : null,
    $sortOrder,
    $isActive ? 1 : 0,
    $id,
  ]);

  audit_log($pdo, 'update', 'task_titles', (string) $id, "Updated task title: '{$title}' for program: '{$program}'");

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_task_title($stmt->fetch())]);
}

// ------------------- PATCH (Quick Toggle / Partial Update) -------------------
if ($method === 'PATCH') {
  require_auth(['SuperAdmin', 'Admin']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Task title ID is required.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Task title not found.'], 404);
  }

  $body = read_json_body();
  $isActive = isset($body['isActive']) ? (bool) $body['isActive'] : (isset($body['is_active']) ? (bool) $body['is_active'] : !$existing['is_active']);

  $pdo->prepare('UPDATE task_titles SET is_active = ? WHERE id = ?')->execute([$isActive ? 1 : 0, $id]);

  $actionLabel = $isActive ? 'activated' : 'deactivated';
  audit_log($pdo, 'patch', 'task_titles', (string) $id, "Task title '{$existing['title']}' was {$actionLabel}");

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  json_response(['ok' => true, 'data' => map_task_title($stmt->fetch())]);
}

// ------------------- DELETE -------------------
if ($method === 'DELETE') {
  require_auth(['SuperAdmin', 'Admin']);
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Task title ID is required.'], 400);
  }

  $stmt = $pdo->prepare('SELECT * FROM task_titles WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Task title not found.'], 404);
  }

  $pdo->prepare('DELETE FROM task_titles WHERE id = ?')->execute([$id]);
  audit_log($pdo, 'delete', 'task_titles', (string) $id, "Deleted task title: '{$existing['title']}'");

  json_response(['ok' => true, 'message' => "Task title '{$existing['title']}' deleted successfully."]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
