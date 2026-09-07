<?php
declare(strict_types=1);

/**
 * Super Admin credentials — NOT stored in MySQL.
 * Role: SuperAdmin (completely separate from database Admin).
 *
 * Copy this file to: api/super_admin_config.php
 *
 * Generate a new password hash (XAMPP PHP):
 *   C:\xampp\php\php.exe -r "echo password_hash('YourStrongPasswordHere', PASSWORD_DEFAULT);"
 *
 * Environment overrides:
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PASSWORD_HASH
 *   SUPER_ADMIN_NAME
 *
 * Only Super Admin can create / manage / email credentials for database Admin accounts.
 */

define('SUPER_ADMIN_EMAIL', 'superadmin@riseabovefoundation.org');
define('SUPER_ADMIN_NAME', 'Super Administrator');

// bcrypt hash for default password: SuperAdmin@RAFC2026!
// Replace this hash after generating your own password.
define('SUPER_ADMIN_PASSWORD_HASH', '$2y$10$75mlf/wd8TufurCn3Yve8uzOv05VHen6h/lR1aSmkqE9RT5TzWrY6');
