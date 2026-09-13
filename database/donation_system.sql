-- ============================================================
-- Rise Above Foundation Cebu — COMPLETE PRODUCTION DATABASE SCHEMA
-- Database: donation_system (MySQL 8.0 / TiDB Cloud Compatible)
-- ============================================================

CREATE DATABASE IF NOT EXISTS donation_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE donation_system;

-- ------------------------------------------------------------
-- 1. AUTH & ROLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (id, name) VALUES 
  (1, 'Admin'), 
  (2, 'Staff'), 
  (3, 'Donor'), 
  (4, 'Volunteer'), 
  (5, 'Beneficiary');

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  first_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NULL,
  middle_initial VARCHAR(5) NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE','PENDING','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  email_verified_at TIMESTAMP NULL,
  verification_token VARCHAR(64) NULL,
  verification_sent_at TIMESTAMP NULL,
  terms_accepted_at TIMESTAMP NULL,
  privacy_accepted_at TIMESTAMP NULL,
  recovery_phone VARCHAR(40) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  profile_photo MEDIUMTEXT NULL,
  phone VARCHAR(40) NULL,
  birth_date DATE NULL,
  address VARCHAR(255) NULL,
  emergency_contact_phone VARCHAR(40) NULL,
  emergency_contact_relation VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default initial Admin user: admin@riseabovefoundation.org / admin123
INSERT IGNORE INTO users (id, role_id, full_name, first_name, last_name, email, password_hash, status, email_verified_at, terms_accepted_at, privacy_accepted_at)
VALUES (
  1,
  1,
  'Admin',
  'Rise Above',
  'Administrator',
  'admin@riseabovefoundation.org',
  '$2y$10$kqp/8MzBZuQdjHoCun2t4uba/0lky0uafBhVOhKVbu9cfiIb/qdZe',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  temp_token VARCHAR(64) NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_resets_email (email),
  INDEX idx_password_resets_temp_token (temp_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. DONORS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  first_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NULL,
  middle_initial VARCHAR(5) NULL,
  donor_type VARCHAR(40) NOT NULL DEFAULT 'Individual',
  organization VARCHAR(160) NULL,
  contact_person VARCHAR(120) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  country VARCHAR(80) NULL,
  address VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_donors_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. DONATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tracking_code VARCHAR(20) NOT NULL UNIQUE,
  donor_id BIGINT UNSIGNED NULL,
  donor_name VARCHAR(120) NOT NULL,
  donor_email VARCHAR(190) NULL,
  type ENUM('Monetary','In-Kind') NOT NULL DEFAULT 'Monetary',
  category VARCHAR(60) NULL,
  amount DECIMAL(12,2) NULL,
  items_description VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Verification',
  donation_date DATE NOT NULL,
  notes TEXT NULL,
  payment_method VARCHAR(40) NULL,
  proof_path VARCHAR(255) NULL,
  proof_file_name VARCHAR(255) NULL,
  proof_file_type VARCHAR(80) NULL,
  inventory_posted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_donations_donor_id FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS donation_updates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  donation_id BIGINT UNSIGNED NOT NULL,
  stage VARCHAR(80) NOT NULL,
  note TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_by_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_donation_updates_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
  CONSTRAINT fk_donation_updates_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_donation_updates_donation (donation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS donation_procurements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  donation_id BIGINT UNSIGNED NOT NULL,
  mode VARCHAR(50) NOT NULL DEFAULT 'Pack Sponsorship',
  beneficiary_id BIGINT UNSIGNED NULL,
  assistance_request_id BIGINT UNSIGNED NULL,
  allocation_id BIGINT UNSIGNED NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  items_json TEXT NOT NULL,
  receipt_number VARCHAR(100) NULL,
  supplier_name VARCHAR(150) NULL,
  families_supported INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_procurements_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
  CONSTRAINT fk_procurements_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE SET NULL,
  INDEX idx_proc_donation (donation_id),
  INDEX idx_proc_ben (beneficiary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. BENEFICIARIES (PARTNER BARANGAYS)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beneficiaries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NULL,
  barangay_type VARCHAR(60) NULL,
  barangay VARCHAR(80) NULL,
  municipality VARCHAR(80) NULL,
  address VARCHAR(255) NULL,
  affected_families INT UNSIGNED NOT NULL DEFAULT 0,
  representative_name VARCHAR(120) NULL,
  representative_first_name VARCHAR(80) NULL,
  representative_last_name VARCHAR(80) NULL,
  representative_middle_initial VARCHAR(5) NULL,
  representative_position VARCHAR(80) NULL,
  representative_phone VARCHAR(40) NULL,
  representative_email VARCHAR(190) NULL,
  needs TEXT NULL,
  notes TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
  invitation_token VARCHAR(64) NULL,
  invitation_expires DATETIME NULL,
  invitation_status VARCHAR(20) NOT NULL DEFAULT 'none',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_beneficiaries_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 5. SETTINGS CATALOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS need_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_need_types_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO need_types (label, sort_order) VALUES
  ('Food Packs', 1),
  ('Clean Drinking Water', 2),
  ('Hygiene Kits', 3),
  ('Medical Supplies / First Aid', 4),
  ('Emergency Shelter Kits', 5),
  ('Blankets & Clothing', 6);

CREATE TABLE IF NOT EXISTS barangay_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_barangay_types_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO barangay_types (label, sort_order) VALUES
  ('Urban Barangay', 1),
  ('Rural Barangay', 2),
  ('Coastal Community', 3),
  ('Upland / Mountain Community', 4);

CREATE TABLE IF NOT EXISTS task_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_types_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO task_types (label, sort_order) VALUES
  ('Relief Repacking', 1),
  ('Logistics & Loading', 2),
  ('Field Distribution', 3),
  ('Medical Assistance', 4),
  ('Administrative & Intake', 5);

-- ------------------------------------------------------------
-- 6. ASSISTANCE REQUESTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistance_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference_code VARCHAR(20) NOT NULL UNIQUE,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  assistance_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Review',
  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  request_date DATE NOT NULL,
  notes TEXT NULL,
  needs_json TEXT NULL,
  calamity_tags TEXT NULL,
  sla_deadline DATETIME NULL,
  is_emergency TINYINT(1) NOT NULL DEFAULT 0,
  assigned_to VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assistance_beneficiary_id FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 7. INVENTORY & MULTI-SOURCE REPACKING
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  item_name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'units',
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 100,
  moderate_stock_threshold INT UNSIGNED NULL,
  allocated INT UNSIGNED NOT NULL DEFAULT 0,
  distributed INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS repacking_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  source_item_id BIGINT UNSIGNED NULL COMMENT 'Legacy single source',
  source_items VARCHAR(120) NOT NULL COMMENT 'Human-readable source summary',
  source_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  source_items_json JSON NULL COMMENT 'Array of {item_id, item_name, quantity, unit}',
  output_item VARCHAR(120) NOT NULL,
  output_unit VARCHAR(30) NULL,
  target_barangay_id BIGINT UNSIGNED NULL,
  recommended_contents_json JSON NULL,
  families_targeted INT UNSIGNED NULL,
  sufficiency_status ENUM('Insufficient','Partial','Sufficient','Excess') NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  assigned_to VARCHAR(120) NULL,
  due_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_repacking_target_barangay FOREIGN KEY (target_barangay_id) REFERENCES beneficiaries(id) ON DELETE SET NULL,
  INDEX idx_repacking_target_barangay (target_barangay_id),
  INDEX idx_repacking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE OR REPLACE VIEW v_repacking_with_barangay AS
SELECT 
  rj.*,
  b.full_name AS target_barangay_name,
  b.barangay AS target_barangay_location,
  b.municipality AS target_municipality,
  b.affected_families AS target_affected_families,
  b.needs AS target_needs,
  b.representative_name AS target_representative,
  b.representative_phone AS target_representative_phone,
  (
    SELECT COUNT(*) 
    FROM assistance_requests ar 
    WHERE ar.beneficiary_id = rj.target_barangay_id 
      AND ar.status IN ('Pending Review', 'Under Review', 'Approved', 'Allocated')
  ) AS open_requests_count
FROM repacking_jobs rj
LEFT JOIN beneficiaries b ON b.id = rj.target_barangay_id;

-- ------------------------------------------------------------
-- 8. DISTRIBUTIONS & ALLOCATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distributions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  event_name VARCHAR(160) NULL,
  location VARCHAR(120) NOT NULL,
  beneficiary_id BIGINT UNSIGNED NULL,
  items_summary TEXT NULL,
  coordinator VARCHAR(120) NULL,
  notes TEXT NULL,
  program VARCHAR(80) NULL,
  distribution_date DATE NULL,
  schedule_time VARCHAR(20) NULL,
  beneficiaries_count INT UNSIGNED NOT NULL DEFAULT 0,
  volunteers_count INT UNSIGNED NOT NULL DEFAULT 0,
  vehicles_count INT UNSIGNED NOT NULL DEFAULT 0,
  distance_km DECIMAL(7,1) NULL,
  fuel_liters DECIMAL(8,2) NULL,
  fuel_cost DECIMAL(10,2) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Planning',
  distribution_type VARCHAR(50) NOT NULL DEFAULT 'Delivery',
  proof_status ENUM('Not Required','Awaiting Proof','Proof Submitted','Proof Verified','Proof Rejected') NOT NULL DEFAULT 'Not Required',
  receipt_status VARCHAR(40) NOT NULL DEFAULT 'Awaiting Confirmation',
  received_quantity INT UNSIGNED NULL,
  received_at TIMESTAMP NULL,
  receipt_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributions_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  resource_name VARCHAR(120) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  program VARCHAR(80) NULL,
  beneficiary_target VARCHAR(120) NULL,
  beneficiary_id BIGINT UNSIGNED NULL,
  assistance_request_id BIGINT UNSIGNED NULL,
  distribution_id BIGINT UNSIGNED NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  notes TEXT NULL,
  allocation_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_allocations_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE SET NULL,
  CONSTRAINT fk_allocations_request FOREIGN KEY (assistance_request_id) REFERENCES assistance_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_allocations_distribution FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 9. VOLUNTEERS, SCHEDULE & TASKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  first_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NULL,
  middle_initial VARCHAR(5) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  applicant_type VARCHAR(40) NOT NULL DEFAULT 'Volunteer',
  institution VARCHAR(160) NULL,
  programs_json TEXT NULL,
  skills_json JSON NULL,
  skills_other VARCHAR(255) NULL,
  availability VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Review',
  hours INT UNSIGNED NOT NULL DEFAULT 0,
  required_hours INT UNSIGNED NOT NULL DEFAULT 0,
  resume_path VARCHAR(255) NULL,
  resume_file_name VARCHAR(255) NULL,
  resume_file_type VARCHAR(80) NULL,
  resume_file_size INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_volunteers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS volunteer_schedule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  volunteer_id BIGINT UNSIGNED NOT NULL,
  event_date DATE NOT NULL,
  event_title VARCHAR(200) NOT NULL,
  event_time VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_volunteer_id FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  assignee VARCHAR(120) NULL,
  assignee_user_id BIGINT UNSIGNED NULL,
  distribution_id BIGINT UNSIGNED NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  due_date DATE NULL,
  duty_start VARCHAR(10) NULL,
  duty_end VARCHAR(10) NULL,
  duty_hours DECIMAL(5,2) NULL,
  module VARCHAR(50) NULL,
  required_skills_json JSON NULL,
  board_column ENUM('todo','inProgress','review','done') NOT NULL DEFAULT 'todo',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_assignee_user_id FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_distribution_id FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE SET NULL,
  INDEX idx_tasks_distribution (distribution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 10. CERTIFICATES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  cert_type VARCHAR(80) NOT NULL,
  recipient_type VARCHAR(30) NOT NULL DEFAULT 'Donor',
  recipient_name VARCHAR(120) NOT NULL,
  reference_code VARCHAR(30) NULL,
  details TEXT NULL,
  signatory_name VARCHAR(120) NULL,
  signatory_title VARCHAR(120) NULL,
  cert_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 11. CMS & PUBLIC CONTENT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NULL,
  excerpt TEXT NULL,
  published_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS partners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NULL,
  description TEXT NULL,
  website VARCHAR(255) NULL,
  initials VARCHAR(10) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS success_stories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NULL,
  excerpt TEXT NULL,
  content TEXT NULL,
  testimonial TEXT NULL,
  story_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 12. NOTIFICATIONS, PROOFS & ADMIN TRACKING
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  role_target VARCHAR(50) NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, is_read),
  INDEX idx_notifications_role (role_target, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS distribution_proofs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribution_id BIGINT UNSIGNED NOT NULL,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  submitted_by_user_id BIGINT UNSIGNED NULL,
  file_path VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80) NULL,
  notes TEXT NULL,
  proof_category VARCHAR(40) NOT NULL DEFAULT 'other',
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  review_remarks TEXT NULL,
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  CONSTRAINT fk_proof_distribution FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
  CONSTRAINT fk_proof_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT fk_proof_user FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_section_views (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  section_key VARCHAR(80) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_section (user_id, section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Schema initialization complete!
-- ============================================================
