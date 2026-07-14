<?php
declare(strict_types=1);
/**
 * One-time setup helper.
 * Run:
 *   C:\xampp\php\php.exe api/setup.php
 */

require __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

$demoUsers = [
  ['role' => 'Admin', 'name' => 'Maria Dela Cruz', 'email' => 'admin@riseabovefoundation.org', 'password' => 'admin123'],
  ['role' => 'Staff', 'name' => 'Carlos Mendoza', 'email' => 'staff@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Donor', 'name' => 'Juan Reyes', 'email' => 'donor@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Volunteer', 'name' => 'Ana Lim', 'email' => 'volunteer@riseabovefoundation.org', 'password' => 'demo123'],
  ['role' => 'Beneficiary', 'name' => 'Roberto Dela Cruz', 'email' => 'beneficiary@riseabovefoundation.org', 'password' => 'demo123'],
];

try {
  $pdo = db();

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS roles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $pdo->exec("
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");

  $roles = ['Admin', 'Staff', 'Donor', 'Volunteer', 'Beneficiary'];
  $roleStmt = $pdo->prepare('INSERT IGNORE INTO roles (name) VALUES (?)');
  foreach ($roles as $role) {
    $roleStmt->execute([$role]);
  }

  $findRole = $pdo->prepare('SELECT id FROM roles WHERE name = ? LIMIT 1');
  $findUser = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $insertUser = $pdo->prepare('INSERT INTO users (role_id, full_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)');
  $updateUser = $pdo->prepare('UPDATE users SET role_id = ?, full_name = ?, password_hash = ?, status = ? WHERE id = ?');

  echo "Setup demo users...\n\n";

  foreach ($demoUsers as $demo) {
    $findRole->execute([$demo['role']]);
    $roleId = $findRole->fetchColumn();
    if (!$roleId) {
      throw new RuntimeException("Role not found: {$demo['role']}");
    }

    $hash = password_hash($demo['password'], PASSWORD_DEFAULT);
    $findUser->execute([$demo['email']]);
    $userId = $findUser->fetchColumn();

    if ($userId) {
      $updateUser->execute([$roleId, $demo['name'], $hash, 'ACTIVE', $userId]);
      echo "Updated: {$demo['role']} ({$demo['email']})\n";
    } else {
      $insertUser->execute([$roleId, $demo['name'], $demo['email'], $hash, 'ACTIVE']);
      echo "Created: {$demo['role']} ({$demo['email']})\n";
    }
  }

  echo "\nSetup OK!\n\nLogin accounts:\n";
  foreach ($demoUsers as $demo) {
    echo "- {$demo['role']}: {$demo['email']} / {$demo['password']}\n";
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo "Setup failed:\n" . $e->getMessage() . "\n\n";
  echo "Check api/config.php and make sure MySQL is running in XAMPP.\n";
}
