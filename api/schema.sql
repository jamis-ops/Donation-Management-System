-- Run this in phpMyAdmin (SQL tab) after creating DB: donation_system

CREATE TABLE roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
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

INSERT INTO roles (name) VALUES
  ('Admin'),
  ('Staff'),
  ('Donor'),
  ('Volunteer'),
  ('Beneficiary');

-- IMPORTANT:
-- This password hash is for the password: admin123
-- If you want, we can generate hashes using a small PHP script too.
INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Maria Dela Cruz', 'admin@riseabovefoundation.org',
  '$2y$10$97eoVuiv1WzIBHM/XKpVeexw5htQJoBX3WHO3yqzmlIsKGQJfDuZ6',
  'ACTIVE'
FROM roles r WHERE r.name = 'Admin';

