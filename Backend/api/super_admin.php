<?php
declare(strict_types=1);

/**
 * Super Admin helpers — credentials live in config / environment, never MySQL.
 * Role name is always "SuperAdmin" (separate from database "Admin").
 */

if (!function_exists('super_admin_load_config')) {
  function super_admin_load_config(): void
  {
    static $loaded = false;
    if ($loaded) {
      return;
    }
    $loaded = true;

    $cfg = __DIR__ . '/super_admin_config.php';
    if (is_file($cfg)) {
      require_once $cfg;
    } else {
      $sample = __DIR__ . '/super_admin_config.sample.php';
      if (is_file($sample)) {
        require_once $sample;
      }
    }

    $envEmail = getenv('SUPER_ADMIN_EMAIL');
    if (is_string($envEmail) && trim($envEmail) !== '') {
      if (!defined('SUPER_ADMIN_EMAIL')) {
        define('SUPER_ADMIN_EMAIL', strtolower(trim($envEmail)));
      }
    }

    $envName = getenv('SUPER_ADMIN_NAME');
    if (is_string($envName) && trim($envName) !== '') {
      if (!defined('SUPER_ADMIN_NAME')) {
        define('SUPER_ADMIN_NAME', trim($envName));
      }
    }

    $envHash = getenv('SUPER_ADMIN_PASSWORD_HASH');
    if (is_string($envHash) && trim($envHash) !== '') {
      if (!defined('SUPER_ADMIN_PASSWORD_HASH')) {
        define('SUPER_ADMIN_PASSWORD_HASH', trim($envHash));
      }
    }

    if (!defined('SUPER_ADMIN_EMAIL')) {
      define('SUPER_ADMIN_EMAIL', 'superadmin@riseabovefoundation.org');
    }
    if (!defined('SUPER_ADMIN_NAME')) {
      define('SUPER_ADMIN_NAME', 'Super Administrator');
    }
    if (!defined('SUPER_ADMIN_PASSWORD_HASH')) {
      // Default password: SuperAdmin@RAFC2026!
      define('SUPER_ADMIN_PASSWORD_HASH', '$2y$10$75mlf/wd8TufurCn3Yve8uzOv05VHen6h/lR1aSmkqE9RT5TzWrY6');
    }
  }
}

if (!function_exists('super_admin_email')) {
  function super_admin_email(): string
  {
    super_admin_load_config();
    return strtolower(trim((string) SUPER_ADMIN_EMAIL));
  }
}

if (!function_exists('is_super_admin_email')) {
  function is_super_admin_email(string $email): bool
  {
    $email = strtolower(trim($email));
    if ($email === '') {
      return false;
    }
    return hash_equals(super_admin_email(), $email);
  }
}

if (!function_exists('is_super_admin_user')) {
  /** True only for the hardcoded Super Admin session (never a DB Admin). */
  function is_super_admin_user(?array $user): bool
  {
    if (!$user) {
      return false;
    }
    if (strcasecmp((string) ($user['role'] ?? ''), 'SuperAdmin') === 0) {
      return true;
    }
    return !empty($user['isSuperAdmin']);
  }
}

if (!function_exists('verify_super_admin_password')) {
  function verify_super_admin_password(string $password): bool
  {
    super_admin_load_config();

    if ($password === '') {
      return false;
    }

    $hash = defined('SUPER_ADMIN_PASSWORD_HASH') ? (string) SUPER_ADMIN_PASSWORD_HASH : '';
    if ($hash !== '' && str_starts_with($hash, '$2')) {
      return password_verify($password, $hash);
    }

    $plain = getenv('SUPER_ADMIN_PASSWORD');
    if (is_string($plain) && $plain !== '') {
      return hash_equals($plain, $password);
    }

    return false;
  }
}

if (!function_exists('get_super_admin_profile_photo')) {
  function get_super_admin_profile_photo(): ?string
  {
    // 1. Check session first if available
    if (!empty($_SESSION['user']['isSuperAdmin']) && !empty($_SESSION['user']['profilePhoto'])) {
      $sessPhoto = (string) $_SESSION['user']['profilePhoto'];
      if (trim($sessPhoto) !== '') {
        return function_exists('format_profile_photo_url') ? format_profile_photo_url($sessPhoto) : $sessPhoto;
      }
    }

    // 2. Check system_settings in DB
    try {
      if (function_exists('db')) {
        $pdo = db();
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'super_admin_profile_photo' LIMIT 1");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        if ($val && is_string($val) && trim($val) !== '') {
          return function_exists('format_profile_photo_url') ? format_profile_photo_url(trim($val)) : trim($val);
        }
      }
    } catch (Throwable) {}

    // 3. Check local file
    $file = __DIR__ . '/uploads/profiles/super_admin_photo.dat';
    if (is_file($file)) {
      $val = @file_get_contents($file);
      if ($val && is_string($val) && trim($val) !== '') {
        return function_exists('format_profile_photo_url') ? format_profile_photo_url(trim($val)) : trim($val);
      }
    }

    return null;
  }
}

if (!function_exists('set_super_admin_profile_photo')) {
  function set_super_admin_profile_photo(string $photo): void
  {
    $photo = trim($photo);
    if ($photo === '') {
      return;
    }

    // 1. Save to database
    try {
      if (function_exists('db')) {
        $pdo = db();
        $pdo->exec("
          CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value MEDIUMTEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $stmt = $pdo->prepare("
          INSERT INTO system_settings (setting_key, setting_value)
          VALUES ('super_admin_profile_photo', ?)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute([$photo]);
      }
    } catch (Throwable) {}

    // 2. Save to local file
    $dir = __DIR__ . '/uploads/profiles';
    if (!is_dir($dir)) {
      @mkdir($dir, 0755, true);
    }
    @file_put_contents($dir . '/super_admin_photo.dat', $photo);

    // 3. Update session
    if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
      $_SESSION['user']['profilePhoto'] = $photo;
    }
  }
}

if (!function_exists('make_super_admin_session_user')) {
  /**
   * Synthetic session user — not backed by a users table row.
   * Role is SuperAdmin (distinct from database Admin).
   */
  function make_super_admin_session_user(): array
  {
    super_admin_load_config();
    return [
      'id' => 0,
      'name' => (string) SUPER_ADMIN_NAME,
      'email' => super_admin_email(),
      'role' => 'SuperAdmin',
      'isSuperAdmin' => true,
      'mustChangePassword' => false,
      'profilePhoto' => get_super_admin_profile_photo(),
      'phone' => '',
      'recoveryPhone' => '',
    ];
  }
}

if (!function_exists('require_super_admin')) {
  /** Only the hardcoded Super Admin may proceed. */
  function require_super_admin(): array
  {
    $user = require_auth(['SuperAdmin']);
    if (!is_super_admin_user($user)) {
      json_response(['ok' => false, 'error' => 'Only the Super Admin can perform this action.'], 403);
    }
    return $user;
  }
}
