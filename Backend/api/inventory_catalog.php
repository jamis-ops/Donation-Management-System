<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$pdo = db();
$method = request_method();
$id = get_id_param();

function ensure_inventory_catalog_tables(PDO $pdo): void
{
  static $ensured = false;
  if ($ensured) return;

  // 1. Categories
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_categories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL UNIQUE,
      icon VARCHAR(40) NULL,
      description VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_cat_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  // 2. Item Types (e.g. Bottled Water, Canned Goods, Rice, T-Shirts, First Aid Kits)
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_item_types (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(60) NOT NULL,
      name VARCHAR(100) NOT NULL,
      default_unit VARCHAR(30) NOT NULL DEFAULT 'units',
      default_low_threshold INT UNSIGNED NOT NULL DEFAULT 100,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cat_type (category_name, name),
      INDEX idx_inv_type_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  // 3. Brands / Products (e.g. Wilkins, Nature's Spring, Century Tuna, 555, Lucky Me)
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_brands (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(60) NOT NULL,
      item_type_name VARCHAR(100) NULL,
      name VARCHAR(100) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cat_brand (category_name, name),
      INDEX idx_inv_brand_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  // 4. Variants / Sizes (e.g. 500ml, 1L, 155g, 25kg, Small, Medium, Large)
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_variants (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(60) NULL,
      item_type_name VARCHAR(100) NULL,
      name VARCHAR(100) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_var_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  // 5. Units
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS inventory_units (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      abbreviation VARCHAR(20) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_unit_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  // Seed default Categories (INSERT IGNORE ensures all standard categories exist)
  $categories = [
    ['Water', 'Droplets', 'Drinking water, mineral, distilled and clean water storage supplies', 1],
    ['Food', 'Utensils', 'Canned goods, rice, noodles, ready-to-eat meals, and cooking essentials', 2],
    ['Clothing', 'Shirt', 'Apparel, jackets, footwear, blankets, linens and wearable relief goods', 3],
    ['Medical Supplies', 'HeartPulse', 'First aid kits, fever & pain medicines, antiseptics, and PPE', 4],
    ['Hygiene Kits', 'Sparkles', 'Soap, toothpaste, toothbrushes, sanitizers, sanitary pads, diapers', 5],
    ['Shelter & Bedding', 'Home', 'Tarpaulins, tents, sleeping mats, ropes, and structural repair supplies', 6],
    ['Logistics & Equipment', 'Box', 'Flashlights, batteries, storage boxes, containers, tools and packing kits', 7],
  ];
  $stmt = $pdo->prepare("INSERT IGNORE INTO inventory_categories (name, icon, description, sort_order) VALUES (?, ?, ?, ?)");
  foreach ($categories as $c) {
    $stmt->execute($c);
  }

  // Seed default Item Types (INSERT IGNORE ensures all standard item types exist)
  $types = [
    // Water
    ['Water', 'Bottled Water', 'Bottles', 100, 1],
    ['Water', 'Mineral Water Gallons', 'Gallons', 20, 2],
    ['Water', 'Distilled Water', 'Bottles', 50, 3],
    ['Water', 'Water Purification Tablets', 'Packs', 50, 4],

    // Food
    ['Food', 'Canned Goods', 'Cans', 150, 1],
    ['Food', 'Rice', 'Sacks', 25, 2],
    ['Food', 'Instant Noodles', 'Packs', 200, 3],
    ['Food', 'Biscuits & Snacks', 'Packs', 100, 4],
    ['Food', 'Cooking Oil', 'Bottles', 40, 5],
    ['Food', 'Powdered Milk & Dairy', 'Pouches', 60, 6],
    ['Food', 'Baby Food & Formula', 'Cans', 30, 7],

    // Clothing
    ['Clothing', 'T-Shirts & Tops', 'Pieces', 100, 1],
    ['Clothing', 'Pants & Shorts', 'Pieces', 80, 2],
    ['Clothing', 'Blankets & Linens', 'Pieces', 50, 3],
    ['Clothing', 'Footwear & Slippers', 'Pairs', 50, 4],
    ['Clothing', 'Jackets & Raincoats', 'Pieces', 30, 5],
    ['Clothing', 'Undergarments', 'Packs', 60, 6],

    // Medical
    ['Medical Supplies', 'First Aid Kits', 'Kits', 30, 1],
    ['Medical Supplies', 'Pain Relievers & Fever', 'Boxes', 50, 2],
    ['Medical Supplies', 'Antiseptics & Bandages', 'Bottles', 40, 3],
    ['Medical Supplies', 'Antibiotics & Prescription', 'Boxes', 30, 4],
    ['Medical Supplies', 'PPE & Face Masks', 'Boxes', 50, 5],
    ['Medical Supplies', 'Medical Devices', 'Units', 15, 6],

    // Hygiene
    ['Hygiene Kits', 'Standard Hygiene Kit', 'Kits', 50, 1],
    ['Hygiene Kits', 'Bath Soap & Body Wash', 'Bars', 120, 2],
    ['Hygiene Kits', 'Toothpaste & Brushes', 'Packs', 100, 3],
    ['Hygiene Kits', 'Sanitary Pads', 'Packs', 80, 4],
    ['Hygiene Kits', 'Baby Diapers', 'Packs', 50, 5],
    ['Hygiene Kits', 'Hand Sanitizers & Alcohol', 'Bottles', 60, 6],

    // Shelter
    ['Shelter & Bedding', 'Tarpaulins & Plastic Sheets', 'Pieces', 40, 1],
    ['Shelter & Bedding', 'Sleeping Mats (Banig)', 'Pieces', 50, 2],
    ['Shelter & Bedding', 'Emergency Tents', 'Units', 15, 3],
    ['Shelter & Bedding', 'Mosquito Nets', 'Pieces', 40, 4],

    // Equipment
    ['Logistics & Equipment', 'Flashlights & Torches', 'Units', 30, 1],
    ['Logistics & Equipment', 'Batteries', 'Packs', 60, 2],
    ['Logistics & Equipment', 'Ropes & Tie-Downs', 'Rolls', 25, 3],
    ['Logistics & Equipment', 'Storage Boxes & Crates', 'Boxes', 30, 4],
  ];
  $stmt = $pdo->prepare("INSERT IGNORE INTO inventory_item_types (category_name, name, default_unit, default_low_threshold, sort_order) VALUES (?, ?, ?, ?, ?)");
  foreach ($types as $t) {
    $stmt->execute($t);
  }

  // Seed default Brands if empty
  $count = (int) $pdo->query("SELECT COUNT(*) FROM inventory_brands")->fetchColumn();
  if ($count === 0) {
    $brands = [
      // Water
      ['Water', 'Bottled Water', 'Wilkins'],
      ['Water', 'Bottled Water', "Nature's Spring"],
      ['Water', 'Bottled Water', 'Absolute'],
      ['Water', 'Bottled Water', 'Le Minerale'],
      ['Water', 'Bottled Water', 'Summit'],
      ['Water', 'Bottled Water', 'Premier'],

      // Food
      ['Food', 'Canned Goods', 'Century Tuna'],
      ['Food', 'Canned Goods', '555 Sardines'],
      ['Food', 'Canned Goods', 'Mega Sardines'],
      ['Food', 'Canned Goods', 'Argentina Corned Beef'],
      ['Food', 'Canned Goods', 'Purefoods'],
      ['Food', 'Canned Goods', 'San Marino Corned Tuna'],
      ['Food', 'Rice', 'Sinandomeng'],
      ['Food', 'Rice', 'Dinorado Premium'],
      ['Food', 'Rice', 'Jasmine Rice'],
      ['Food', 'Rice', 'Well-Milled Local'],
      ['Food', 'Instant Noodles', 'Lucky Me!'],
      ['Food', 'Instant Noodles', 'Payless'],
      ['Food', 'Instant Noodles', 'Nissin'],
      ['Food', 'Biscuits & Snacks', 'Rebisco'],
      ['Food', 'Biscuits & Snacks', 'Monde'],
      ['Food', 'Biscuits & Snacks', 'SkyFlakes'],

      // Medical
      ['Medical Supplies', 'Pain Relievers & Fever', 'Biogesic'],
      ['Medical Supplies', 'Pain Relievers & Fever', 'Tempra'],
      ['Medical Supplies', 'Antiseptics & Bandages', 'Betadine'],
      ['Medical Supplies', 'Antiseptics & Bandages', 'Band-Aid'],
      ['Medical Supplies', 'Antiseptics & Bandages', 'Green Cross'],

      // Hygiene
      ['Hygiene Kits', 'Bath Soap & Body Wash', 'Safeguard'],
      ['Hygiene Kits', 'Bath Soap & Body Wash', 'Palmolive'],
      ['Hygiene Kits', 'Toothpaste & Brushes', 'Colgate'],
      ['Hygiene Kits', 'Toothpaste & Brushes', 'Close Up'],
      ['Hygiene Kits', 'Sanitary Pads', 'Modess'],
      ['Hygiene Kits', 'Sanitary Pads', 'Whisper'],
      ['Hygiene Kits', 'Baby Diapers', 'EQ Diapers'],
      ['Hygiene Kits', 'Baby Diapers', 'Pampers'],
    ];
    $stmt = $pdo->prepare("INSERT INTO inventory_brands (category_name, item_type_name, name) VALUES (?, ?, ?)");
    foreach ($brands as $b) {
      $stmt->execute($b);
    }
  }

  // Seed default Variants if empty
  $count = (int) $pdo->query("SELECT COUNT(*) FROM inventory_variants")->fetchColumn();
  if ($count === 0) {
    $variants = [
      // Volumes
      ['Water', 'Bottled Water', '330ml', 1],
      ['Water', 'Bottled Water', '350ml', 2],
      ['Water', 'Bottled Water', '500ml', 3],
      ['Water', 'Bottled Water', '1 Liter', 4],
      ['Water', 'Bottled Water', '1.5 Liters', 5],
      ['Water', 'Bottled Water', '6 Liters', 6],
      ['Water', 'Mineral Water Gallons', '5 Gallons (Round)', 7],
      ['Water', 'Mineral Water Gallons', '5 Gallons (Slim)', 8],

      // Food sizes
      ['Food', 'Canned Goods', '155g', 1],
      ['Food', 'Canned Goods', '100g', 2],
      ['Food', 'Canned Goods', '175g', 3],
      ['Food', 'Canned Goods', '260g', 4],
      ['Food', 'Rice', '5kg pack', 5],
      ['Food', 'Rice', '10kg sack', 6],
      ['Food', 'Rice', '25kg sack', 7],
      ['Food', 'Rice', '50kg sack', 8],
      ['Food', 'Instant Noodles', '55g pack', 9],
      ['Food', 'Instant Noodles', '80g pack', 10],

      // Apparel sizes
      ['Clothing', null, 'Kids / Toddler', 1],
      ['Clothing', null, 'Small (S)', 2],
      ['Clothing', null, 'Medium (M)', 3],
      ['Clothing', null, 'Large (L)', 4],
      ['Clothing', null, 'Extra Large (XL)', 5],
      ['Clothing', null, 'Free Size', 6],
      ['Clothing', 'Blankets & Linens', 'Single (36×75 in)', 7],
      ['Clothing', 'Blankets & Linens', 'Double (54×75 in)', 8],

      // Diapers & hygiene
      ['Hygiene Kits', 'Baby Diapers', 'Small (S)', 1],
      ['Hygiene Kits', 'Baby Diapers', 'Medium (M)', 2],
      ['Hygiene Kits', 'Baby Diapers', 'Large (L)', 3],
      ['Hygiene Kits', 'Baby Diapers', 'XL', 4],
    ];
    $stmt = $pdo->prepare("INSERT INTO inventory_variants (category_name, item_type_name, name, sort_order) VALUES (?, ?, ?, ?)");
    foreach ($variants as $v) {
      $stmt->execute($v);
    }
  }

  // Seed default Units if empty
  $count = (int) $pdo->query("SELECT COUNT(*) FROM inventory_units")->fetchColumn();
  if ($count === 0) {
    $units = [
      ['Bottles', 'btl', 1],
      ['Cans', 'can', 2],
      ['Sacks', 'sck', 3],
      ['Packs', 'pck', 4],
      ['Pieces', 'pcs', 5],
      ['Boxes', 'box', 6],
      ['Kits', 'kit', 7],
      ['Pairs', 'pr', 8],
      ['Bundles', 'bdl', 9],
      ['Gallons', 'gal', 10],
      ['Liters', 'L', 11],
      ['Kilograms', 'kg', 12],
      ['Rolls', 'rol', 13],
      ['Bars', 'bar', 14],
      ['Pouches', 'pch', 15],
    ];
    $stmt = $pdo->prepare("INSERT INTO inventory_units (name, abbreviation, sort_order) VALUES (?, ?, ?)");
    foreach ($units as $u) {
      $stmt->execute($u);
    }
  }

  $ensured = true;
}

ensure_inventory_catalog_tables($pdo);

// GET: List catalog options
if ($method === 'GET') {
  $showAll = !empty($_GET['all']); // if all=1, include inactive for CMS

  $catFilter = $showAll ? '' : 'WHERE is_active = 1';

  $categories = $pdo->query("SELECT * FROM inventory_categories {$catFilter} ORDER BY sort_order ASC, name ASC")->fetchAll();
  $itemTypes = $pdo->query("SELECT * FROM inventory_item_types {$catFilter} ORDER BY category_name ASC, sort_order ASC, name ASC")->fetchAll();
  $brands = $pdo->query("SELECT * FROM inventory_brands {$catFilter} ORDER BY category_name ASC, sort_order ASC, name ASC")->fetchAll();
  $variants = $pdo->query("SELECT * FROM inventory_variants {$catFilter} ORDER BY sort_order ASC, name ASC")->fetchAll();
  $units = $pdo->query("SELECT * FROM inventory_units {$catFilter} ORDER BY sort_order ASC, name ASC")->fetchAll();

  $typeParam = strtolower(trim((string) ($_GET['type'] ?? '')));

  $mappedCategories = array_map(function($c) {
    return [
      'id' => (int) $c['id'],
      'name' => $c['name'],
      'icon' => $c['icon'] ?? 'Package',
      'description' => $c['description'] ?? '',
      'sortOrder' => (int) $c['sort_order'],
      'isActive' => (bool) $c['is_active'],
    ];
  }, $categories);

  $mappedItemTypes = array_map(function($t) {
    return [
      'id' => (int) $t['id'],
      'categoryName' => $t['category_name'],
      'name' => $t['name'],
      'defaultUnit' => $t['default_unit'] ?? 'units',
      'defaultLowThreshold' => (int) ($t['default_low_threshold'] ?? 100),
      'sortOrder' => (int) $t['sort_order'],
      'isActive' => (bool) $t['is_active'],
    ];
  }, $itemTypes);

  $mappedBrands = array_map(function($b) {
    return [
      'id' => (int) $b['id'],
      'categoryName' => $b['category_name'],
      'itemTypeName' => $b['item_type_name'] ?? null,
      'name' => $b['name'],
      'sortOrder' => (int) $b['sort_order'],
      'isActive' => (bool) $b['is_active'],
    ];
  }, $brands);

  $mappedVariants = array_map(function($v) {
    return [
      'id' => (int) $v['id'],
      'categoryName' => $v['category_name'] ?? null,
      'itemTypeName' => $v['item_type_name'] ?? null,
      'name' => $v['name'],
      'sortOrder' => (int) $v['sort_order'],
      'isActive' => (bool) $v['is_active'],
    ];
  }, $variants);

  $mappedUnits = array_map(function($u) {
    return [
      'id' => (int) $u['id'],
      'name' => $u['name'],
      'abbreviation' => $u['abbreviation'] ?? '',
      'sortOrder' => (int) $u['sort_order'],
      'isActive' => (bool) $u['is_active'],
    ];
  }, $units);

  if ($typeParam === 'categories' || $typeParam === 'category') {
    json_response(['ok' => true, 'data' => $mappedCategories]);
  }
  if ($typeParam === 'item_types' || $typeParam === 'item_type') {
    json_response(['ok' => true, 'data' => $mappedItemTypes]);
  }
  if ($typeParam === 'brands' || $typeParam === 'brand') {
    json_response(['ok' => true, 'data' => $mappedBrands]);
  }
  if ($typeParam === 'variants' || $typeParam === 'variant') {
    json_response(['ok' => true, 'data' => $mappedVariants]);
  }
  if ($typeParam === 'units' || $typeParam === 'unit') {
    json_response(['ok' => true, 'data' => $mappedUnits]);
  }

  // Return grouped structured catalog by default
  json_response([
    'ok' => true,
    'data' => [
      'categories' => $mappedCategories,
      'itemTypes' => $mappedItemTypes,
      'brands' => $mappedBrands,
      'variants' => $mappedVariants,
      'units' => $mappedUnits,
    ],
  ]);
}

// POST: Create catalog entry
if ($method === 'POST') {
  require_auth();
  $body = read_json_body();
  $catalog = strtolower(trim((string) ($body['catalog'] ?? '')));

  switch ($catalog) {
    case 'category':
    case 'categories':
      $name = trim((string) ($body['name'] ?? ''));
      if ($name === '') {
        json_response(['ok' => false, 'error' => 'Category name is required'], 400);
      }
      $stmt = $pdo->prepare("INSERT INTO inventory_categories (name, icon, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)");
      $stmt->execute([
        $name,
        trim((string) ($body['icon'] ?? 'Package')) ?: 'Package',
        trim((string) ($body['description'] ?? '')) ?: null,
        (int) ($body['sortOrder'] ?? 0),
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
      ]);
      json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);

    case 'item_type':
    case 'item_types':
      $categoryName = trim((string) ($body['categoryName'] ?? $body['category_name'] ?? ''));
      $name = trim((string) ($body['name'] ?? ''));
      if ($categoryName === '' || $name === '') {
        json_response(['ok' => false, 'error' => 'Category and Item Type name are required'], 400);
      }
      $stmt = $pdo->prepare("INSERT INTO inventory_item_types (category_name, name, default_unit, default_low_threshold, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)");
      $stmt->execute([
        $categoryName,
        $name,
        trim((string) ($body['defaultUnit'] ?? 'units')) ?: 'units',
        (int) ($body['defaultLowThreshold'] ?? 100),
        (int) ($body['sortOrder'] ?? 0),
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
      ]);
      json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);

    case 'brand':
    case 'brands':
      $categoryName = trim((string) ($body['categoryName'] ?? $body['category_name'] ?? ''));
      $name = trim((string) ($body['name'] ?? ''));
      if ($categoryName === '' || $name === '') {
        json_response(['ok' => false, 'error' => 'Category and Brand name are required'], 400);
      }
      $stmt = $pdo->prepare("INSERT INTO inventory_brands (category_name, item_type_name, name, sort_order, is_active) VALUES (?, ?, ?, ?, ?)");
      $stmt->execute([
        $categoryName,
        trim((string) ($body['itemTypeName'] ?? '')) ?: null,
        $name,
        (int) ($body['sortOrder'] ?? 0),
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
      ]);
      json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);

    case 'variant':
    case 'variants':
      $name = trim((string) ($body['name'] ?? ''));
      if ($name === '') {
        json_response(['ok' => false, 'error' => 'Variant name/size is required'], 400);
      }
      $stmt = $pdo->prepare("INSERT INTO inventory_variants (category_name, item_type_name, name, sort_order, is_active) VALUES (?, ?, ?, ?, ?)");
      $stmt->execute([
        trim((string) ($body['categoryName'] ?? '')) ?: null,
        trim((string) ($body['itemTypeName'] ?? '')) ?: null,
        $name,
        (int) ($body['sortOrder'] ?? 0),
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
      ]);
      json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);

    case 'unit':
    case 'units':
      $name = trim((string) ($body['name'] ?? ''));
      if ($name === '') {
        json_response(['ok' => false, 'error' => 'Unit name is required'], 400);
      }
      $stmt = $pdo->prepare("INSERT INTO inventory_units (name, abbreviation, sort_order, is_active) VALUES (?, ?, ?, ?)");
      $stmt->execute([
        $name,
        trim((string) ($body['abbreviation'] ?? '')) ?: strtolower(substr($name, 0, 4)),
        (int) ($body['sortOrder'] ?? 0),
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
      ]);
      json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);

    default:
      json_response(['ok' => false, 'error' => 'Unknown catalog type'], 400);
  }
}

// PUT: Update catalog entry
if ($method === 'PUT') {
  require_auth();
  if (!$id) {
    json_response(['ok' => false, 'error' => 'ID is required'], 400);
  }
  $body = read_json_body();
  $catalog = strtolower(trim((string) ($body['catalog'] ?? '')));

  switch ($catalog) {
    case 'category':
    case 'categories':
      $stmt = $pdo->prepare("
        UPDATE inventory_categories SET 
          name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      ");
      $stmt->execute([
        isset($body['name']) ? trim((string) $body['name']) : null,
        isset($body['icon']) ? trim((string) $body['icon']) : null,
        array_key_exists('description', $body) ? trim((string) $body['description']) : null,
        isset($body['sortOrder']) ? (int) $body['sortOrder'] : null,
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : null,
        $id,
      ]);
      json_response(['ok' => true]);

    case 'item_type':
    case 'item_types':
      $stmt = $pdo->prepare("
        UPDATE inventory_item_types SET 
          category_name = COALESCE(?, category_name),
          name = COALESCE(?, name),
          default_unit = COALESCE(?, default_unit),
          default_low_threshold = COALESCE(?, default_low_threshold),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      ");
      $stmt->execute([
        isset($body['categoryName']) ? trim((string) $body['categoryName']) : null,
        isset($body['name']) ? trim((string) $body['name']) : null,
        isset($body['defaultUnit']) ? trim((string) $body['defaultUnit']) : null,
        isset($body['defaultLowThreshold']) ? (int) $body['defaultLowThreshold'] : null,
        isset($body['sortOrder']) ? (int) $body['sortOrder'] : null,
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : null,
        $id,
      ]);
      json_response(['ok' => true]);

    case 'brand':
    case 'brands':
      $stmt = $pdo->prepare("
        UPDATE inventory_brands SET 
          category_name = COALESCE(?, category_name),
          item_type_name = COALESCE(?, item_type_name),
          name = COALESCE(?, name),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      ");
      $stmt->execute([
        isset($body['categoryName']) ? trim((string) $body['categoryName']) : null,
        array_key_exists('itemTypeName', $body) ? trim((string) $body['itemTypeName']) : null,
        isset($body['name']) ? trim((string) $body['name']) : null,
        isset($body['sortOrder']) ? (int) $body['sortOrder'] : null,
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : null,
        $id,
      ]);
      json_response(['ok' => true]);

    case 'variant':
    case 'variants':
      $stmt = $pdo->prepare("
        UPDATE inventory_variants SET 
          category_name = COALESCE(?, category_name),
          item_type_name = COALESCE(?, item_type_name),
          name = COALESCE(?, name),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      ");
      $stmt->execute([
        array_key_exists('categoryName', $body) ? trim((string) $body['categoryName']) : null,
        array_key_exists('itemTypeName', $body) ? trim((string) $body['itemTypeName']) : null,
        isset($body['name']) ? trim((string) $body['name']) : null,
        isset($body['sortOrder']) ? (int) $body['sortOrder'] : null,
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : null,
        $id,
      ]);
      json_response(['ok' => true]);

    case 'unit':
    case 'units':
      $stmt = $pdo->prepare("
        UPDATE inventory_units SET 
          name = COALESCE(?, name),
          abbreviation = COALESCE(?, abbreviation),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      ");
      $stmt->execute([
        isset($body['name']) ? trim((string) $body['name']) : null,
        isset($body['abbreviation']) ? trim((string) $body['abbreviation']) : null,
        isset($body['sortOrder']) ? (int) $body['sortOrder'] : null,
        isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : null,
        $id,
      ]);
      json_response(['ok' => true]);

    default:
      json_response(['ok' => false, 'error' => 'Unknown catalog type'], 400);
  }
}

// DELETE: Delete catalog entry
if ($method === 'DELETE') {
  require_auth();
  if (!$id) {
    json_response(['ok' => false, 'error' => 'ID is required'], 400);
  }
  $catalog = strtolower(trim((string) ($_GET['catalog'] ?? '')));

  $tableMap = [
    'category' => 'inventory_categories',
    'categories' => 'inventory_categories',
    'item_type' => 'inventory_item_types',
    'item_types' => 'inventory_item_types',
    'brand' => 'inventory_brands',
    'brands' => 'inventory_brands',
    'variant' => 'inventory_variants',
    'variants' => 'inventory_variants',
    'unit' => 'inventory_units',
    'units' => 'inventory_units',
  ];

  if (!isset($tableMap[$catalog])) {
    json_response(['ok' => false, 'error' => 'Unknown catalog type'], 400);
  }

  $table = $tableMap[$catalog];
  $pdo->prepare("DELETE FROM {$table} WHERE id = ?")->execute([$id]);
  json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
