-- Migration v2: barangay beneficiaries, proofs, notifications, enhanced modules
-- Run via: php api/migrate.php

USE donation_system;

-- Beneficiaries as barangays
ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS municipality VARCHAR(80) NULL AFTER barangay,
  ADD COLUMN IF NOT EXISTS affected_families INT UNSIGNED NOT NULL DEFAULT 0 AFTER municipality,
  ADD COLUMN IF NOT EXISTS representative_name VARCHAR(120) NULL AFTER affected_families,
  ADD COLUMN IF NOT EXISTS representative_phone VARCHAR(40) NULL AFTER representative_name,
  ADD COLUMN IF NOT EXISTS representative_email VARCHAR(190) NULL AFTER representative_phone,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER representative_email;

-- Allocations: priority + link to barangay
ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium' AFTER status,
  ADD COLUMN IF NOT EXISTS beneficiary_id BIGINT UNSIGNED NULL AFTER beneficiary_target,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER beneficiary_id;

-- Distributions: detailed workflow
ALTER TABLE distributions
  ADD COLUMN IF NOT EXISTS beneficiary_id BIGINT UNSIGNED NULL AFTER location,
  ADD COLUMN IF NOT EXISTS items_summary TEXT NULL AFTER beneficiary_id,
  ADD COLUMN IF NOT EXISTS coordinator VARCHAR(120) NULL AFTER items_summary,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER coordinator,
  ADD COLUMN IF NOT EXISTS proof_status ENUM('Not Required','Awaiting Proof','Proof Submitted','Proof Verified') NOT NULL DEFAULT 'Not Required' AFTER notes;

-- Inventory: moderate threshold
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS moderate_stock_threshold INT UNSIGNED NULL AFTER low_stock_threshold;

CREATE TABLE IF NOT EXISTS distribution_proofs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribution_id BIGINT UNSIGNED NOT NULL,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  submitted_by_user_id BIGINT UNSIGNED NULL,
  file_path VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80) NULL,
  notes TEXT NULL,
  status ENUM('Pending Review','Verified','Rejected') NOT NULL DEFAULT 'Pending Review',
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  CONSTRAINT fk_proof_distribution FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
  CONSTRAINT fk_proof_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT fk_proof_user FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
