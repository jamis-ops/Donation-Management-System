<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/mailer.php';

$pdo = db();

// Ensure password_resets table exists
try {
  $pdo->exec("
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
} catch (Throwable $e) {
  // Table creation failed or already exists
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$action = trim((string) ($body['action'] ?? 'send_code'));
$email = strtolower(trim((string) ($body['email'] ?? '')));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'Please provide a valid registered email address.'], 400);
}

// ─────────────────────────────────────────────────────────────
// ACTION: SEND CODE / REQUEST CODE
// ─────────────────────────────────────────────────────────────
if ($action === 'send_code' || $action === 'request') {
  // Check if user exists in database
  $userStmt = $pdo->prepare('SELECT id, full_name, email, status FROM users WHERE email = ? LIMIT 1');
  $userStmt->execute([$email]);
  $user = $userStmt->fetch();

  if (!$user) {
    json_response([
      'ok' => false,
      'error' => 'No account found with this email address. Please check your spelling or contact administration.',
    ], 404);
  }

  if ($user['status'] === 'DISABLED') {
    json_response([
      'ok' => false,
      'error' => 'This account has been deactivated. Please contact the administrator.',
    ], 403);
  }

  // Check rate limit: if requested in the last 30 seconds
  $rateStmt = $pdo->prepare('SELECT created_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1');
  $rateStmt->execute([$email]);
  $lastReset = $rateStmt->fetch();

  if ($lastReset && !empty($lastReset['created_at'])) {
    $elapsed = time() - strtotime((string) $lastReset['created_at']);
    if ($elapsed < 30) {
      $waitSec = 30 - $elapsed;
      json_response([
        'ok' => false,
        'error' => "Please wait {$waitSec} seconds before requesting another verification code.",
        'rateLimited' => true,
        'retryAfter' => $waitSec,
      ], 429);
    }
  }

  // Generate 6-digit code
  $code = (string) random_int(100000, 999999);
  $codeHash = password_hash($code, PASSWORD_DEFAULT);
  $expiresAt = (new DateTime('+15 minutes'))->format('Y-m-d H:i:s');

  // Delete previous reset attempts for this email
  $delStmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
  $delStmt->execute([$email]);

  // Insert new reset code
  $insStmt = $pdo->prepare('INSERT INTO password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)');
  $insStmt->execute([$email, $codeHash, $expiresAt]);

  // Build branded HTML email
  $recipientName = $user['full_name'] ?: 'Valued User';
  $safeName = htmlspecialchars($recipientName, ENT_QUOTES, 'UTF-8');
  $subject = "Your Password Reset Verification Code: {$code} — Rise Above Foundation";

  $htmlBody = "
    <div style=\"font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;\">
      <div style=\"text-align:center;margin-bottom:24px;\">
        <h2 style=\"color:#AF101A;margin:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.02em;\">Rise Above Foundation Cebu</h2>
        <p style=\"color:#64748b;font-size:0.875rem;margin:4px 0 0;\">Password Recovery Verification</p>
      </div>

      <div style=\"padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #edf2f7;margin-bottom:20px;\">
        <p style=\"margin:0 0 12px;font-size:1rem;color:#1e293b;\">Hello <strong>{$safeName}</strong>,</p>
        <p style=\"margin:0 0 16px;color:#475569;font-size:0.925rem;line-height:1.5;\">
          We received a request to reset the password for your Rise Above Foundation account. Use the 6-digit verification code below to proceed:
        </p>

        <div style=\"text-align:center;margin:24px 0;\">
          <div style=\"display:inline-block;background:#AF101A;color:#ffffff;font-size:2rem;font-weight:800;letter-spacing:8px;padding:12px 28px;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;\">
            {$code}
          </div>
        </div>

        <p style=\"margin:0;color:#dc2626;font-size:0.825rem;text-align:center;font-weight:600;\">
          ⏱ This verification code will expire in 15 minutes.
        </p>
      </div>

      <div style=\"border-top:1px solid #e2e8f0;padding-top:16px;\">
        <p style=\"margin:0 0 8px;color:#64748b;font-size:0.825rem;line-height:1.4;\">
          <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email or notify your system administrator immediately. Your password will remain unchanged.
        </p>
        <p style=\"margin:0;color:#94a3b8;font-size:0.75rem;text-align:center;\">
          Rise Above Foundation Cebu · 252 B. Rodriguez St., Cebu City, Philippines
        </p>
      </div>
    </div>
  ";

  $sent = send_mail($email, $recipientName, $subject, $htmlBody);
  $mailRes = mail_last_result();

  json_response([
    'ok' => true,
    'message' => 'A 6-digit verification code has been sent to your registered email.',
    'expiresInMinutes' => 15,
    'delivery' => [
      'sent' => $sent,
      'transport' => $mailRes['transport'] ?? '',
    ],
  ]);
}

// ─────────────────────────────────────────────────────────────
// ACTION: RESEND CODE
// ─────────────────────────────────────────────────────────────
if ($action === 'resend_code') {
  // Check rate limit: must wait at least 30 seconds
  $rateStmt = $pdo->prepare('SELECT created_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1');
  $rateStmt->execute([$email]);
  $lastReset = $rateStmt->fetch();

  if ($lastReset && !empty($lastReset['created_at'])) {
    $elapsed = time() - strtotime((string) $lastReset['created_at']);
    if ($elapsed < 30) {
      $waitSec = 30 - $elapsed;
      json_response([
        'ok' => false,
        'error' => "Please wait {$waitSec} seconds before requesting a new code.",
        'rateLimited' => true,
        'retryAfter' => $waitSec,
      ], 429);
    }
  }

  $userStmt = $pdo->prepare('SELECT id, full_name, email, status FROM users WHERE email = ? LIMIT 1');
  $userStmt->execute([$email]);
  $user = $userStmt->fetch();

  if (!$user) {
    json_response(['ok' => false, 'error' => 'No account found with this email address.'], 404);
  }

  $code = (string) random_int(100000, 999999);
  $codeHash = password_hash($code, PASSWORD_DEFAULT);
  $expiresAt = (new DateTime('+15 minutes'))->format('Y-m-d H:i:s');

  $delStmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
  $delStmt->execute([$email]);

  $insStmt = $pdo->prepare('INSERT INTO password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)');
  $insStmt->execute([$email, $codeHash, $expiresAt]);

  $recipientName = $user['full_name'] ?: 'Valued User';
  $safeName = htmlspecialchars($recipientName, ENT_QUOTES, 'UTF-8');
  $subject = "Your New Verification Code: {$code} — Rise Above Foundation";

  $htmlBody = "
    <div style=\"font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;\">
      <div style=\"text-align:center;margin-bottom:24px;\">
        <h2 style=\"color:#AF101A;margin:0;font-size:1.5rem;font-weight:800;\">Rise Above Foundation Cebu</h2>
        <p style=\"color:#64748b;font-size:0.875rem;margin:4px 0 0;\">New Password Recovery Code</p>
      </div>

      <div style=\"padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #edf2f7;margin-bottom:20px;\">
        <p style=\"margin:0 0 12px;font-size:1rem;color:#1e293b;\">Hello <strong>{$safeName}</strong>,</p>
        <p style=\"margin:0 0 16px;color:#475569;font-size:0.925rem;line-height:1.5;\">
          Here is your new 6-digit verification code:
        </p>

        <div style=\"text-align:center;margin:24px 0;\">
          <div style=\"display:inline-block;background:#AF101A;color:#ffffff;font-size:2rem;font-weight:800;letter-spacing:8px;padding:12px 28px;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;\">
            {$code}
          </div>
        </div>

        <p style=\"margin:0;color:#dc2626;font-size:0.825rem;text-align:center;font-weight:600;\">
          ⏱ This verification code will expire in 15 minutes.
        </p>
      </div>
    </div>
  ";

  $sent = send_mail($email, $recipientName, $subject, $htmlBody);

  json_response([
    'ok' => true,
    'message' => 'A new 6-digit verification code has been sent to your email.',
    'expiresInMinutes' => 15,
  ]);
}

// ─────────────────────────────────────────────────────────────
// ACTION: VERIFY CODE
// ─────────────────────────────────────────────────────────────
if ($action === 'verify_code') {
  $code = trim((string) ($body['code'] ?? ''));

  if ($code === '' || strlen($code) !== 6 || !ctype_digit($code)) {
    json_response(['ok' => false, 'error' => 'Please enter the complete 6-digit verification code.'], 400);
  }

  $stmt = $pdo->prepare('SELECT id, code_hash, attempts, expires_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1');
  $stmt->execute([$email]);
  $reset = $stmt->fetch();

  if (!$reset) {
    json_response([
      'ok' => false,
      'error' => 'No active verification code found for this email. Please request a new code.',
      'expired' => true,
    ], 400);
  }

  // Check expiration
  if (strtotime((string) $reset['expires_at']) < time()) {
    json_response([
      'ok' => false,
      'error' => 'Verification code has expired. Please request a new code.',
      'expired' => true,
    ], 400);
  }

  // Check maximum attempts (5 max)
  if ((int) $reset['attempts'] >= 5) {
    json_response([
      'ok' => false,
      'error' => 'Too many failed verification attempts. Please request a new code for your security.',
      'maxAttempts' => true,
    ], 429);
  }

  // Verify code hash
  if (!password_verify($code, $reset['code_hash'])) {
    // Increment attempts
    $upd = $pdo->prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?');
    $upd->execute([$reset['id']]);

    $remaining = max(0, 5 - ((int) $reset['attempts'] + 1));
    json_response([
      'ok' => false,
      'error' => "Invalid verification code. Please check your email and try again ({$remaining} attempt" . ($remaining === 1 ? '' : 's') . ' remaining).',
    ], 400);
  }

  // Code is valid! Generate a secure temporary reset token (valid for 15 minutes)
  $tempToken = bin2hex(random_bytes(32));
  $newExpires = (new DateTime('+15 minutes'))->format('Y-m-d H:i:s');

  $tokenStmt = $pdo->prepare('UPDATE password_resets SET temp_token = ?, expires_at = ? WHERE id = ?');
  $tokenStmt->execute([$tempToken, $newExpires, $reset['id']]);

  json_response([
    'ok' => true,
    'resetToken' => $tempToken,
    'message' => 'Verification code confirmed successfully.',
  ]);
}

// ─────────────────────────────────────────────────────────────
// ACTION: RESET PASSWORD
// ─────────────────────────────────────────────────────────────
if ($action === 'reset_password') {
  $resetToken = trim((string) ($body['resetToken'] ?? ''));
  $newPassword = (string) ($body['newPassword'] ?? ($body['password'] ?? ''));
  $confirmPassword = (string) ($body['confirmPassword'] ?? '');

  if ($resetToken === '') {
    json_response(['ok' => false, 'error' => 'Reset token is missing. Please verify your code again.'], 400);
  }

  if ($newPassword === '') {
    json_response(['ok' => false, 'error' => 'Please enter a new password.'], 400);
  }

  if (strlen($newPassword) < 8) {
    json_response(['ok' => false, 'error' => 'Password must be at least 8 characters long.'], 400);
  }

  if ($confirmPassword !== '' && $newPassword !== $confirmPassword) {
    json_response(['ok' => false, 'error' => 'New password and confirmation do not match.'], 400);
  }

  // Validate reset token in database
  $stmt = $pdo->prepare('SELECT id, email, expires_at FROM password_resets WHERE email = ? AND temp_token = ? LIMIT 1');
  $stmt->execute([$email, $resetToken]);
  $reset = $stmt->fetch();

  if (!$reset) {
    json_response([
      'ok' => false,
      'error' => 'Reset session is invalid or has already been used. Please start over.',
      'sessionExpired' => true,
    ], 400);
  }

  if (strtotime((string) $reset['expires_at']) < time()) {
    json_response([
      'ok' => false,
      'error' => 'Reset session has expired. Please start over with a new code.',
      'sessionExpired' => true,
    ], 400);
  }

  // Update user's password in database
  $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
  $userStmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE email = ?');
  $userStmt->execute([$passwordHash, $email]);

  // Clean up reset records for this user
  $delStmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
  $delStmt->execute([$email]);

  // Send confirmation notice email
  $uStmt = $pdo->prepare('SELECT full_name FROM users WHERE email = ? LIMIT 1');
  $uStmt->execute([$email]);
  $userName = $uStmt->fetchColumn() ?: 'Valued User';

  $safeName = htmlspecialchars((string) $userName, ENT_QUOTES, 'UTF-8');
  $subject = 'Password Changed Successfully — Rise Above Foundation';
  $htmlBody = "
    <div style=\"font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;\">
      <div style=\"text-align:center;margin-bottom:24px;\">
        <h2 style=\"color:#AF101A;margin:0;font-size:1.5rem;font-weight:800;\">Rise Above Foundation Cebu</h2>
        <p style=\"color:#16a34a;font-size:0.95rem;margin:6px 0 0;font-weight:600;\">✓ Password Reset Successful</p>
      </div>

      <div style=\"padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #edf2f7;margin-bottom:20px;\">
        <p style=\"margin:0 0 12px;font-size:1rem;color:#1e293b;\">Hello <strong>{$safeName}</strong>,</p>
        <p style=\"margin:0 0 14px;color:#475569;font-size:0.925rem;line-height:1.5;\">
          Your password for your Rise Above Foundation account was successfully updated. You can now sign in using your new password.
        </p>
        <p style=\"margin:0;color:#64748b;font-size:0.825rem;\">
          If you did not make this change, please contact system administration immediately to secure your account.
        </p>
      </div>
    </div>
  ";

  @send_mail($email, (string) $userName, $subject, $htmlBody);

  json_response([
    'ok' => true,
    'message' => 'Password has been successfully updated! You can now log in with your new password.',
  ]);
}

json_response(['ok' => false, 'error' => 'Invalid action requested'], 400);
