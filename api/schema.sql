-- ============================================================
-- Full schema + demo accounts for donation_system
-- Run in phpMyAdmin → SQL tab (creates DB if needed)
-- ============================================================

CREATE DATABASE IF NOT EXISTS donation_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE donation_system;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE','PENDING','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO roles (name) VALUES
  ('Admin'),
  ('Staff'),
  ('Donor'),
  ('Volunteer'),
  ('Beneficiary');

-- Demo logins (Admin: admin123 | Others: demo123)
-- For existing databases, use api/seed.sql instead (supports ON DUPLICATE KEY UPDATE).

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Maria Dela Cruz', 'admin@riseabovefoundation.org',
  '$2y$10$DfPObTIQp./FQ.LMdFLwh.D2TdutH/AJcc3Axq2njPYWSg9HiHKVa', 'ACTIVE'
FROM roles r WHERE r.name = 'Admin'
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Carlos Mendoza', 'staff@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Staff'
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Juan Reyes', 'donor@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Donor'
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Ana Lim', 'volunteer@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Volunteer'
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Roberto Dela Cruz', 'beneficiary@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Beneficiary'
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE';
