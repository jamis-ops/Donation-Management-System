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
      'profilePhoto' => null,
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
