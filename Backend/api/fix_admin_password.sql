-- Run this ONLY if admin login says "Invalid email or password"
-- (Use when you already created tables before, and just need to fix the password)

UPDATE users
SET password_hash = '$2y$10$97eoVuiv1WzIBHM/XKpVeexw5htQJoBX3WHO3yqzmlIsKGQJfDuZ6'
WHERE email = 'admin@riseabovefoundation.org';
