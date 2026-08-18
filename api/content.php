<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

$ALLOWED_TYPES = ['programs', 'stories', 'partners', 'announcements', 'faqs', 'hero', 'impact'];
$ALLOWED_STATUSES = ['draft', 'published', 'archived'];

function ensure_cms_tables(PDO $pdo): void
{
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS cms_pages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      body LONGTEXT NULL,
      meta_json JSON NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      updated_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS cms_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      summary TEXT NULL,
      body LONGTEXT NULL,
      image_url VARCHAR(500) NULL,
      link_url VARCHAR(500) NULL,
      meta_json JSON NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      published_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cms_items_type_status (type, status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
}

function decode_meta(?string $json): array
{
  if (!$json) {
    return [];
  }
  $data = json_decode($json, true);
  return is_array($data) ? $data : [];
}

function map_cms_item(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'type' => $row['type'],
    'title' => $row['title'],
    'summary' => $row['summary'] ?? '',
    'body' => $row['body'] ?? '',
    'imageUrl' => $row['image_url'] ?? '',
    'linkUrl' => $row['link_url'] ?? '',
    'meta' => decode_meta($row['meta_json'] ?? null),
    'status' => $row['status'],
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'publishedAt' => $row['published_at'] ?? null,
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

function map_cms_page(array $row): array
{
  return [
    'id' => (int) $row['id'],
    'slug' => $row['slug'],
    'title' => $row['title'],
    'body' => $row['body'] ?? '',
    'meta' => decode_meta($row['meta_json'] ?? null),
    'status' => $row['status'],
    'sortOrder' => (int) ($row['sort_order'] ?? 0),
    'updatedBy' => $row['updated_by'] ?? null,
    'createdAt' => $row['created_at'] ?? null,
    'updatedAt' => $row['updated_at'] ?? null,
  ];
}

require_once __DIR__ . '/content_catalog.php';

function seed_cms_if_empty(PDO $pdo): void
{
  $count = (int) $pdo->query('SELECT COUNT(*) FROM cms_items')->fetchColumn();
  if ($count > 0) {
    sync_cms_catalog($pdo);
    return;
  }

  $announcements = [
    ['Where Kindness Meets Purpose | Accounts All Sorted', 'Accounts All Sorted visited Rise Above Foundation Cebu as part of their team-building activity.', 'Education', '2026-07-01'],
    ['A Testament to Resilience, Family & Purpose', 'A story of perseverance and the life-changing impact of educational assistance.', 'Purpose', '2026-06-15'],
    ['Serving Smiles: Free Dental Clinic at Barangay Tejero', 'Free Dental Clinic at Barangay Tejero Sports Complex, serving 494 patients.', 'Education', '2026-02-10'],
  ];
  $stories = [
    ['From Dreamer to Cum Laude: A Journey of Perseverance', 'A Rise Above scholar’s story of resilience and educational assistance.', 'Educational Sponsorship', '2026-06-15', '"Education gave me a chance my family alone could not provide."'],
    ['Serving Smiles at Barangay Tejero', 'A free dental clinic served 494 patients with restorations, extractions teeth, and prophylaxis.', 'Dental Mission', '2026-02-10', '"I never thought I could afford dental care. The mission changed that for my whole family."'],
    ['Where Kindness Meets Purpose', 'Accounts All Sorted visited RAFC for outreach and a donation drive.', 'Volunteer Program', '2026-07-01', '"Giving our time in Cebu reminded us why kindness and purpose belong together."'],
  ];
  $faqs = [
    ['Donations', 'How can I donate?', 'You can donate online through our Donate page, via bank transfer, or in person at our Guadalupe office (Mon–Fri, 9am–5pm).'],
    ['Donations', 'Will I receive a receipt for my donation?', 'Registered donors can download a Certificate of Donation once your contribution is verified.'],
    ['Volunteering', 'How do I become a volunteer?', 'Fill out the volunteer registration form on our Volunteer page. We welcome individuals and groups from around the world.'],
    ['Volunteering', 'Can I get a volunteer certificate?', 'Yes. Certificates of Participation and Volunteer Service are generated upon completion of assigned activities.'],
    ['Beneficiary Assistance', 'Who can request assistance?', 'Families and individuals in Cebu facing hardship may apply through our Assistance Request form.'],
    ['Programs and Activities', 'What programs does the foundation run?', 'We run education, health & hygiene, livelihood, food sharing, volunteer programs, dental and medical missions, construction, disaster relief, and more.'],
  ];
  $impact = [
    ['Dental Patients Served', '45,000+'],
    ['Children Sponsored', '120+'],
    ['University Interns / Year', '80'],
    ['Houses Built (Yolanda)', '105'],
    ['Years of Service', '25+'],
    ['Partner Organizations', '6+'],
  ];

  $ins = $pdo->prepare('
    INSERT INTO cms_items (type, title, summary, body, image_url, link_url, meta_json, status, sort_order, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');

  $order = 0;
  foreach (cms_programs_catalog() as [$title, $summary, $slug, $image, $body]) {
    $ins->execute([
      'programs', $title, $summary, $body, $image, '',
      json_encode(['slug' => $slug, 'active' => true], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }
  $order = 0;
  foreach ($announcements as [$title, $summary, $category, $date]) {
    $ins->execute([
      'announcements', $title, $summary, '', '', '',
      json_encode(['category' => $category, 'date' => $date], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }
  $order = 0;
  foreach (cms_partners_catalog() as [$title, $location, $summary, $image, $body]) {
    $ins->execute([
      'partners', $title, $summary, $body, $image, '',
      json_encode(['location' => $location], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }
  $order = 0;
  foreach ($stories as [$title, $summary, $category, $date, $testimonial]) {
    $ins->execute([
      'stories', $title, $summary, $summary, '', '',
      json_encode(['category' => $category, 'date' => $date, 'testimonial' => $testimonial], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }
  $order = 0;
  foreach ($faqs as [$category, $q, $a]) {
    $ins->execute([
      'faqs', $q, '', $a, '', '',
      json_encode(['category' => $category], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }
  $order = 0;
  foreach ($impact as [$label, $value]) {
    $ins->execute([
      'impact', $label, $value, '', '', '',
      json_encode(['value' => $value], JSON_UNESCAPED_UNICODE),
      'published', $order++, date('Y-m-d H:i:s'),
    ]);
  }

  // Seed about page if missing
  $pageCount = (int) $pdo->query("SELECT COUNT(*) FROM cms_pages WHERE slug = 'about'")->fetchColumn();
  if ($pageCount === 0) {
    $pdo->prepare('
      INSERT INTO cms_pages (slug, title, body, meta_json, status, sort_order, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
      'about',
      'About Rise Above Foundation Cebu',
      "Since November 2000, we have been working as volunteers in Cebu City, Philippines. Our team is striving to help improve the quality of life for the underprivileged by means of providing educational opportunities, livelihood training, and health and hygiene programs.\n\nWe connect and cooperate with volunteers from all over the world and help facilitate their work and accommodations in Cebu.",
      json_encode([
        'mission' => 'An improved quality of life for those struggling with poverty in Cebu',
        'vision' => 'Enabling the next generation of Cebuanos to rise above the challenges of the future through access to education, livelihood and healthcare',
        'goal' => 'To improve the poor condition of the people in Cebu Province through provision of programs and services on education and training, health & hygiene, and creative livelihood opportunities in a community-based setting',
      ], JSON_UNESCAPED_UNICODE),
      'published',
      0,
      'System',
    ]);
  }
}

ensure_cms_tables($pdo);
seed_cms_if_empty($pdo);

// ---------- Public endpoints (no auth) ----------
if ($method === 'GET' && isset($_GET['public']) && $_GET['public'] === '1') {
  if (!empty($_GET['page']) || !empty($_GET['slug'])) {
    $slug = trim((string) ($_GET['page'] ?? $_GET['slug'] ?? ''));
    $stmt = $pdo->prepare("SELECT * FROM cms_pages WHERE slug = ? AND status = 'published' LIMIT 1");
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    json_response(['ok' => true, 'data' => $row ? map_cms_page($row) : null]);
  }

  $type = trim((string) ($_GET['type'] ?? ''));
  if ($type === '' || !in_array($type, $ALLOWED_TYPES, true)) {
    json_response(['ok' => false, 'error' => 'Valid type is required'], 400);
  }
  $stmt = $pdo->prepare("
    SELECT * FROM cms_items
    WHERE type = ? AND status = 'published'
    ORDER BY sort_order ASC, id ASC
  ");
  $stmt->execute([$type]);
  $rows = $stmt->fetchAll();
  json_response(['ok' => true, 'data' => array_map('map_cms_item', $rows)]);
}

// ---------- Authenticated admin/staff ----------
$user = require_auth(['Admin', 'Staff']);

if ($method === 'GET') {
  if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM cms_items WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
      json_response(['ok' => false, 'error' => 'Content item not found'], 404);
    }
    json_response(['ok' => true, 'data' => map_cms_item($row)]);
  }

  if (!empty($_GET['pages'])) {
    $stmt = $pdo->query('SELECT * FROM cms_pages ORDER BY sort_order ASC, id ASC');
    json_response(['ok' => true, 'data' => array_map('map_cms_page', $stmt->fetchAll())]);
  }

  $where = ['1=1'];
  $params = [];
  $type = trim((string) ($_GET['type'] ?? ''));
  $status = trim((string) ($_GET['status'] ?? ''));
  $search = trim((string) ($_GET['search'] ?? ''));

  if ($type !== '' && in_array($type, $ALLOWED_TYPES, true)) {
    $where[] = 'type = ?';
    $params[] = $type;
  }
  if ($status !== '' && in_array($status, $ALLOWED_STATUSES, true)) {
    $where[] = 'status = ?';
    $params[] = $status;
  }
  if ($search !== '') {
    $where[] = '(title LIKE ? OR summary LIKE ? OR body LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
  }

  $sql = 'SELECT * FROM cms_items WHERE ' . implode(' AND ', $where) . ' ORDER BY type ASC, sort_order ASC, id ASC';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  json_response(['ok' => true, 'data' => array_map('map_cms_item', $stmt->fetchAll())]);
}

// Staff is read-only beyond GET
if ($user['role'] !== 'Admin') {
  json_response(['ok' => false, 'error' => 'Only Admin can modify website content'], 403);
}

if ($method === 'POST') {
  $body = read_json_body();
  $type = trim((string) ($body['type'] ?? ''));
  $title = trim((string) ($body['title'] ?? ''));
  if (!in_array($type, $ALLOWED_TYPES, true)) {
    json_response(['ok' => false, 'error' => 'Invalid content type'], 400);
  }
  if ($title === '') {
    json_response(['ok' => false, 'error' => 'Title is required'], 400);
  }

  $status = trim((string) ($body['status'] ?? 'draft'));
  if (!in_array($status, $ALLOWED_STATUSES, true)) {
    $status = 'draft';
  }
  $sortOrder = isset($body['sortOrder']) ? (int) $body['sortOrder'] : 0;
  $meta = $body['meta'] ?? [];
  if (!is_array($meta)) {
    $meta = [];
  }
  $publishedAt = $status === 'published' ? date('Y-m-d H:i:s') : null;

  $stmt = $pdo->prepare('
    INSERT INTO cms_items (type, title, summary, body, image_url, link_url, meta_json, status, sort_order, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $stmt->execute([
    $type,
    $title,
    trim((string) ($body['summary'] ?? '')) ?: null,
    trim((string) ($body['body'] ?? '')) ?: null,
    trim((string) ($body['imageUrl'] ?? '')) ?: null,
    trim((string) ($body['linkUrl'] ?? '')) ?: null,
    json_encode($meta, JSON_UNESCAPED_UNICODE),
    $status,
    $sortOrder,
    $publishedAt,
  ]);
  $newId = (int) $pdo->lastInsertId();
  $row = $pdo->prepare('SELECT * FROM cms_items WHERE id = ?');
  $row->execute([$newId]);
  json_response(['ok' => true, 'data' => map_cms_item($row->fetch())], 201);
}

if ($method === 'PUT') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Item id is required'], 400);
  }
  $body = read_json_body();

  $stmt = $pdo->prepare('SELECT * FROM cms_items WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $existing = $stmt->fetch();
  if (!$existing) {
    json_response(['ok' => false, 'error' => 'Content item not found'], 404);
  }

  $action = trim((string) ($body['action'] ?? ''));
  if ($action !== '') {
    if ($action === 'publish') {
      $pdo->prepare("UPDATE cms_items SET status = 'published', published_at = COALESCE(published_at, NOW()) WHERE id = ?")->execute([$id]);
    } elseif ($action === 'unpublish') {
      $pdo->prepare("UPDATE cms_items SET status = 'draft' WHERE id = ?")->execute([$id]);
    } elseif ($action === 'archive') {
      $pdo->prepare("UPDATE cms_items SET status = 'archived' WHERE id = ?")->execute([$id]);
    } elseif ($action === 'restore') {
      $pdo->prepare("UPDATE cms_items SET status = 'draft' WHERE id = ?")->execute([$id]);
    } elseif ($action === 'reorder') {
      $direction = strtolower(trim((string) ($body['direction'] ?? '')));
      $currentOrder = (int) $existing['sort_order'];
      $type = $existing['type'];
      if ($direction === 'up') {
        $neighbor = $pdo->prepare('
          SELECT id, sort_order FROM cms_items
          WHERE type = ? AND (sort_order < ? OR (sort_order = ? AND id < ?))
          ORDER BY sort_order DESC, id DESC LIMIT 1
        ');
        $neighbor->execute([$type, $currentOrder, $currentOrder, $id]);
      } elseif ($direction === 'down') {
        $neighbor = $pdo->prepare('
          SELECT id, sort_order FROM cms_items
          WHERE type = ? AND (sort_order > ? OR (sort_order = ? AND id > ?))
          ORDER BY sort_order ASC, id ASC LIMIT 1
        ');
        $neighbor->execute([$type, $currentOrder, $currentOrder, $id]);
      } else {
        // Absolute sortOrder
        if (isset($body['sortOrder'])) {
          $pdo->prepare('UPDATE cms_items SET sort_order = ? WHERE id = ?')
            ->execute([(int) $body['sortOrder'], $id]);
        } else {
          json_response(['ok' => false, 'error' => 'direction up/down or sortOrder required'], 400);
        }
        $neighbor = null;
      }
      if ($neighbor) {
        $nb = $neighbor->fetch();
        if ($nb) {
          $pdo->prepare('UPDATE cms_items SET sort_order = ? WHERE id = ?')->execute([(int) $nb['sort_order'], $id]);
          $pdo->prepare('UPDATE cms_items SET sort_order = ? WHERE id = ?')->execute([$currentOrder, (int) $nb['id']]);
        }
      }
    } else {
      json_response(['ok' => false, 'error' => 'Unknown action'], 400);
    }

    $row = $pdo->prepare('SELECT * FROM cms_items WHERE id = ?');
    $row->execute([$id]);
    json_response(['ok' => true, 'data' => map_cms_item($row->fetch())]);
  }

  // Full update
  $title = trim((string) ($body['title'] ?? $existing['title']));
  if ($title === '') {
    json_response(['ok' => false, 'error' => 'Title is required'], 400);
  }
  $type = trim((string) ($body['type'] ?? $existing['type']));
  if (!in_array($type, $ALLOWED_TYPES, true)) {
    json_response(['ok' => false, 'error' => 'Invalid content type'], 400);
  }
  $status = trim((string) ($body['status'] ?? $existing['status']));
  if (!in_array($status, $ALLOWED_STATUSES, true)) {
    $status = $existing['status'];
  }
  $meta = array_key_exists('meta', $body) ? $body['meta'] : decode_meta($existing['meta_json'] ?? null);
  if (!is_array($meta)) {
    $meta = [];
  }
  $publishedAt = $existing['published_at'];
  if ($status === 'published' && !$publishedAt) {
    $publishedAt = date('Y-m-d H:i:s');
  }

  $pdo->prepare('
    UPDATE cms_items
    SET type = ?, title = ?, summary = ?, body = ?, image_url = ?, link_url = ?,
        meta_json = ?, status = ?, sort_order = ?, published_at = ?
    WHERE id = ?
  ')->execute([
    $type,
    $title,
    trim((string) ($body['summary'] ?? $existing['summary'] ?? '')) ?: null,
    trim((string) ($body['body'] ?? $existing['body'] ?? '')) ?: null,
    trim((string) ($body['imageUrl'] ?? $existing['image_url'] ?? '')) ?: null,
    trim((string) ($body['linkUrl'] ?? $existing['link_url'] ?? '')) ?: null,
    json_encode($meta, JSON_UNESCAPED_UNICODE),
    $status,
    isset($body['sortOrder']) ? (int) $body['sortOrder'] : (int) $existing['sort_order'],
    $publishedAt,
    $id,
  ]);

  $row = $pdo->prepare('SELECT * FROM cms_items WHERE id = ?');
  $row->execute([$id]);
  json_response(['ok' => true, 'data' => map_cms_item($row->fetch())]);
}

if ($method === 'DELETE') {
  if (!$id) {
    json_response(['ok' => false, 'error' => 'Item id is required'], 400);
  }
  $stmt = $pdo->prepare('DELETE FROM cms_items WHERE id = ?');
  $stmt->execute([$id]);
  if ($stmt->rowCount() === 0) {
    json_response(['ok' => false, 'error' => 'Content item not found'], 404);
  }
  json_response(['ok' => true, 'data' => ['id' => $id]]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
