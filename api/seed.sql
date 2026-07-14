-- ============================================================
-- Rise Above Foundation — Login seed data for phpMyAdmin
-- Database: donation_system
--
-- You already have `roles` and `users` tables (from your screenshot).
-- You do NOT need to create new tables — only insert/update data below.
-- ============================================================

-- Step 1: Make sure all roles exist
INSERT IGNORE INTO roles (name) VALUES
  ('Admin'),
  ('Staff'),
  ('Donor'),
  ('Volunteer'),
  ('Beneficiary');

-- Step 2: Insert or update demo login accounts
-- Passwords:
--   Admin       → admin123
--   All others  → demo123

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Maria Dela Cruz', 'admin@riseabovefoundation.org',
  '$2y$10$DfPObTIQp./FQ.LMdFLwh.D2TdutH/AJcc3Axq2njPYWSg9HiHKVa', 'ACTIVE'
FROM roles r WHERE r.name = 'Admin'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Carlos Mendoza', 'staff@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Staff'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Juan Reyes', 'donor@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Donor'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Ana Lim', 'volunteer@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Volunteer'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = 'ACTIVE';

INSERT INTO users (role_id, full_name, email, password_hash, status)
SELECT r.id, 'Roberto Dela Cruz', 'beneficiary@riseabovefoundation.org',
  '$2y$10$veiekObD085uLCIcbC2kieTCYhE6J9Xk.QpMzp3EQ6NqfOO8IoSvm', 'ACTIVE'
FROM roles r WHERE r.name = 'Beneficiary'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = 'ACTIVE';

-- Step 3: Verify (run this SELECT after the inserts)
SELECT u.id, u.full_name, u.email, u.status, r.name AS role
FROM users u
JOIN roles r ON r.id = u.role_id
ORDER BY r.id;
