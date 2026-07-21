<?php
declare(strict_types=1);

/**
 * Mailer — NodeMailer (preferred) / PHP SMTP / PHP mail() / local outbox.
 *
 * Configure:
 *   - mail-service/.env          → SMTP credentials for NodeMailer
 *   - api/mail_config.php        → which transport PHP uses + Node service URL
 *
 * Copy api/mail_config.sample.php → api/mail_config.php
 * Copy mail-service/.env.example → mail-service/.env
 * Run: npm run mail
 */

if (!defined('MAIL_FROM_EMAIL')) {
  $cfg = __DIR__ . '/mail_config.php';
  if (is_file($cfg)) {
    require $cfg;
  }
}

if (!defined('MAIL_FROM_EMAIL')) {
  define('MAIL_FROM_EMAIL', 'no-reply@riseabovefoundation.org');
}
if (!defined('MAIL_FROM_NAME')) {
  define('MAIL_FROM_NAME', 'Rise Above Foundation');
}
if (!defined('MAIL_ENABLED')) {
  define('MAIL_ENABLED', true);
}
if (!defined('MAIL_TRANSPORT')) {
  // nodemailer | smtp | mail | outbox
  define('MAIL_TRANSPORT', 'nodemailer');
}
if (!defined('MAIL_NODE_URL')) {
  define('MAIL_NODE_URL', 'http://127.0.0.1:8025');
}
if (!defined('MAIL_NODE_API_KEY')) {
  define('MAIL_NODE_API_KEY', '');
}
if (!defined('RECOVERY_URL')) {
  define('RECOVERY_URL', '');
}
if (!defined('MAIL_OUTBOX_DIR')) {
  define('MAIL_OUTBOX_DIR', __DIR__ . '/logs/mail_outbox');
}
if (!defined('SMTP_HOST')) {
  define('SMTP_HOST', '');
}
if (!defined('SMTP_PORT')) {
  define('SMTP_PORT', 587);
}
if (!defined('SMTP_USER')) {
  define('SMTP_USER', '');
}
if (!defined('SMTP_PASS')) {
  define('SMTP_PASS', '');
}
if (!defined('SMTP_SECURE')) {
  define('SMTP_SECURE', 'tls');
}
if (!defined('FRONTEND_URL')) {
  define('FRONTEND_URL', 'http://localhost:5173');
}
if (!defined('API_PUBLIC_URL')) {
  define('API_PUBLIC_URL', '');
}

$GLOBALS['MAIL_LAST_RESULT'] = [
  'ok' => false,
  'transport' => '',
  'error' => '',
];

if (!function_exists('mail_last_result')) {
  function mail_last_result(): array
  {
    return $GLOBALS['MAIL_LAST_RESULT'] ?? ['ok' => false, 'transport' => '', 'error' => ''];
  }
}

if (!function_exists('mail_set_result')) {
  function mail_set_result(bool $ok, string $transport, string $error = ''): void
  {
    $GLOBALS['MAIL_LAST_RESULT'] = [
      'ok' => $ok,
      'transport' => $transport,
      'error' => $error,
    ];
  }
}

if (!function_exists('mail_resolved_transport')) {
  function mail_resolved_transport(): string
  {
    $transport = strtolower(trim((string) MAIL_TRANSPORT));
    if ($transport === '' || $transport === 'auto') {
      return 'nodemailer';
    }
    return $transport;
  }
}

if (!function_exists('mail_from_address')) {
  function mail_from_address(): string
  {
    $user = trim((string) SMTP_USER);
    if ($user !== '' && filter_var($user, FILTER_VALIDATE_EMAIL)) {
      return $user;
    }
    return (string) MAIL_FROM_EMAIL;
  }
}

if (!function_exists('mail_wrap_html')) {
  function mail_wrap_html(string $subject, string $bodyHtml): string
  {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'
      . '<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">'
      . '<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">'
      . '<div style="background:#AF101A;padding:18px 24px;color:#fff;font-size:1.05rem;font-weight:700">Rise Above Foundation</div>'
      . '<div style="padding:28px 24px;line-height:1.55;font-size:0.95rem">' . $bodyHtml . '</div>'
      . '<div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:0.75rem;border-top:1px solid #e2e8f0">'
      . 'This is an automated message from the Rise Above Foundation Donation Management System. If you did not request this, you can ignore this email.</div>'
      . '</div></body></html>';
  }
}

if (!function_exists('mail_archive_outbox')) {
  function mail_archive_outbox(string $toEmail, string $toName, string $subject, string $html, bool $sent, string $note = ''): ?string
  {
    try {
      if (!is_dir(MAIL_OUTBOX_DIR)) {
        @mkdir(MAIL_OUTBOX_DIR, 0755, true);
      }
      $safe = preg_replace('/[^a-z0-9]+/i', '_', $toEmail) ?: 'recipient';
      $file = MAIL_OUTBOX_DIR . '/' . date('Ymd_His') . '_' . $safe . '.html';
      $meta = "<!-- To: {$toName} <{$toEmail}> | Subject: {$subject} | " . date('c')
        . ' | delivered=' . ($sent ? 'yes' : 'no')
        . ($note !== '' ? ' | ' . $note : '')
        . " -->\n";
      @file_put_contents($file, $meta . $html);
      return $file;
    } catch (Throwable $e) {
      return null;
    }
  }
}

if (!function_exists('mail_node_request')) {
  /**
   * POST JSON to the NodeMailer mail-service. Returns decoded response array.
   */
  function mail_node_request(string $path, array $payload): array
  {
    $base = rtrim((string) MAIL_NODE_URL, '/');
    if ($base === '') {
      return ['ok' => false, 'error' => 'MAIL_NODE_URL is empty. Start the mail-service and set MAIL_NODE_URL in api/mail_config.php.'];
    }

    $url = $base . '/' . ltrim($path, '/');
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
      return ['ok' => false, 'error' => 'Failed to encode mail payload'];
    }

    $headers = [
      'Content-Type: application/json',
      'Accept: application/json',
      'Content-Length: ' . strlen($json),
    ];
    $apiKey = trim((string) MAIL_NODE_API_KEY);
    if ($apiKey !== '') {
      $headers[] = 'X-Mail-Api-Key: ' . $apiKey;
    }

    if (function_exists('curl_init')) {
      $ch = curl_init($url);
      curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 30,
      ]);
      $raw = curl_exec($ch);
      $errno = curl_errno($ch);
      $err = curl_error($ch);
      $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);

      if ($errno !== 0) {
        return [
          'ok' => false,
          'error' => "Cannot reach NodeMailer at {$url}: {$err}. Run `npm run mail` in the project root.",
        ];
      }
      $decoded = json_decode((string) $raw, true);
      if (!is_array($decoded)) {
        if ($status === 404) {
          return [
            'ok' => false,
            'error' => "NodeMailer route not found (HTTP 404). Restart the mail service with: npm run mail",
          ];
        }
        return ['ok' => false, 'error' => "NodeMailer returned HTTP {$status} with invalid JSON"];
      }
      if ($status >= 400 && empty($decoded['error'])) {
        $decoded['ok'] = false;
        $decoded['error'] = "NodeMailer HTTP {$status}";
      }
      return $decoded;
    }

    $context = stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $json,
        'timeout' => 30,
        'ignore_errors' => true,
      ],
    ]);
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
      return [
        'ok' => false,
        'error' => "Cannot reach NodeMailer at {$url}. Run `npm run mail` and check mail-service/.env SMTP settings.",
      ];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : ['ok' => false, 'error' => 'Invalid JSON from NodeMailer'];
  }
}

if (!function_exists('nodemailer_send')) {
  function nodemailer_send(string $toEmail, string $toName, string $subject, string $html): bool
  {
    $resp = mail_node_request('/send', [
      'toEmail' => $toEmail,
      'toName' => $toName,
      'subject' => $subject,
      'html' => $html,
    ]);
    $ok = !empty($resp['ok']);
    mail_set_result($ok, 'nodemailer', $ok ? '' : (string) ($resp['error'] ?? 'NodeMailer send failed'));
    return $ok;
  }
}

if (!function_exists('nodemailer_send_credentials')) {
  function nodemailer_send_credentials(
    string $toEmail,
    string $toName,
    string $loginEmail,
    string $temporaryPassword,
    string $role
  ): bool {
    $loginBase = defined('FRONTEND_URL') ? rtrim((string) FRONTEND_URL, '/') : 'http://localhost:5173';
    $loginUrl = function_exists('frontend_url') ? frontend_url('/login') : ($loginBase . '/login');
    $recovery = defined('RECOVERY_URL') && RECOVERY_URL !== ''
      ? (string) RECOVERY_URL
      : $loginUrl;

    $resp = mail_node_request('/send-credentials', [
      'toEmail' => $toEmail,
      'toName' => $toName,
      'loginEmail' => $loginEmail,
      'temporaryPassword' => $temporaryPassword,
      'role' => $role,
      'loginUrl' => $loginUrl,
      'recoveryUrl' => $recovery,
    ]);
    $ok = !empty($resp['ok']);
    mail_set_result($ok, 'nodemailer', $ok ? '' : (string) ($resp['error'] ?? 'NodeMailer credentials send failed'));
    return $ok;
  }
}

if (!function_exists('nodemailer_send_verification')) {
  /**
   * Send verification email via dedicated Node route, with /send fallback.
   */
  function nodemailer_send_verification(string $toEmail, string $toName, string $verifyUrl): bool
  {
    $resp = mail_node_request('/send-verification', [
      'toEmail' => $toEmail,
      'toName' => $toName,
      'verifyUrl' => $verifyUrl,
    ]);
    if (!empty($resp['ok'])) {
      mail_set_result(true, 'nodemailer', '');
      return true;
    }

    // Fallback when mail-service is an older build without /send-verification
    $safeName = htmlspecialchars($toName, ENT_QUOTES, 'UTF-8');
    $safeUrl = htmlspecialchars($verifyUrl, ENT_QUOTES, 'UTF-8');
    $bodyHtml = "<p style=\"margin:0 0 12px;font-size:1.15rem;font-weight:700;color:#0f172a\">Verify it's you</p>"
      . "<p style=\"margin:0 0 14px\">Hi {$safeName},</p>"
      . '<p style="margin:0 0 14px">Click the button below to verify your email and activate your Rise Above Foundation account. This link expires in 24 hours.</p>'
      . '<p style="margin:24px 0;text-align:center">'
      . '<a href="' . $safeUrl . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">Verify it\'s you</a>'
      . '</p>'
      . '<p style="margin:0;color:#64748b;font-size:0.88rem;word-break:break-all">Or open: <a href="' . $safeUrl . '">' . $safeUrl . '</a></p>';

    $fallback = nodemailer_send($toEmail, $toName, "Verify it's you — Rise Above Foundation", $bodyHtml);
    if ($fallback) {
      return true;
    }

    $err = (string) ($resp['error'] ?? 'NodeMailer verification send failed');
    $last = mail_last_result();
    if (!empty($last['error'])) {
      $err .= ' | fallback: ' . $last['error'];
    }
    mail_set_result(false, 'nodemailer', $err);
    return false;
  }
}

if (!function_exists('smtp_send')) {
  function smtp_send(string $toEmail, string $toName, string $subject, string $html): bool
  {
    if (SMTP_HOST === '' || SMTP_USER === '' || SMTP_PASS === '') {
      mail_set_result(false, 'smtp', 'SMTP is not configured. Prefer NodeMailer (npm run mail) or set SMTP_* in api/mail_config.php.');
      return false;
    }

    $host = SMTP_HOST;
    $port = (int) SMTP_PORT;
    $secure = strtolower((string) SMTP_SECURE);
    $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host;
    $errno = 0;
    $errstr = '';
    $fp = @fsockopen($remote, $port, $errno, $errstr, 25);
    if (!$fp) {
      $msg = "SMTP connect failed: {$errstr} ({$errno})";
      error_log('[mailer] ' . $msg);
      mail_set_result(false, 'smtp', $msg);
      return false;
    }
    stream_set_timeout($fp, 25);

    $read = static function () use ($fp): string {
      $data = '';
      while ($line = fgets($fp, 512)) {
        $data .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
          break;
        }
      }
      return $data;
    };
    $write = static function (string $cmd) use ($fp): void {
      fwrite($fp, $cmd . "\r\n");
    };
    $expect = static function (string $resp, string $code): bool {
      return str_starts_with(trim($resp), $code);
    };

    try {
      $greeting = $read();
      if (!$expect($greeting, '220')) {
        throw new RuntimeException('Bad greeting: ' . trim($greeting));
      }

      $write('EHLO localhost');
      $ehlo = $read();
      if (!$expect($ehlo, '250')) {
        $write('HELO localhost');
        $ehlo = $read();
        if (!$expect($ehlo, '250')) {
          throw new RuntimeException('EHLO/HELO failed');
        }
      }

      if ($secure === 'tls') {
        $write('STARTTLS');
        $tls = $read();
        if (!$expect($tls, '220')) {
          throw new RuntimeException('STARTTLS failed: ' . trim($tls));
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
          throw new RuntimeException('TLS negotiation failed');
        }
        $write('EHLO localhost');
        $ehlo = $read();
        if (!$expect($ehlo, '250')) {
          throw new RuntimeException('EHLO after TLS failed');
        }
      }

      $write('AUTH LOGIN');
      if (!$expect($read(), '334')) {
        throw new RuntimeException('AUTH LOGIN not accepted');
      }
      $write(base64_encode(SMTP_USER));
      if (!$expect($read(), '334')) {
        throw new RuntimeException('SMTP username rejected');
      }
      $write(base64_encode(SMTP_PASS));
      if (!$expect($read(), '235')) {
        throw new RuntimeException('SMTP password rejected — use a Gmail App Password');
      }

      $from = mail_from_address();
      $write("MAIL FROM:<{$from}>");
      if (!$expect($read(), '250')) {
        throw new RuntimeException('MAIL FROM rejected');
      }
      $write("RCPT TO:<{$toEmail}>");
      $rcpt = $read();
      if (!$expect($rcpt, '250')) {
        throw new RuntimeException('RCPT TO rejected for ' . $toEmail . ': ' . trim($rcpt));
      }
      $write('DATA');
      if (!$expect($read(), '354')) {
        throw new RuntimeException('DATA not accepted');
      }

      $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
      $safeToName = str_replace(['"', "\r", "\n"], '', $toName);
      $toHeader = $safeToName !== '' ? "\"{$safeToName}\" <{$toEmail}>" : $toEmail;
      $fromName = str_replace(['"', "\r", "\n"], '', (string) MAIL_FROM_NAME);
      $headers = [
        "From: \"{$fromName}\" <{$from}>",
        "To: {$toHeader}",
        "Reply-To: {$from}",
        "Subject: {$encodedSubject}",
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (explode('@', $from)[1] ?? 'riseabove-cebu.org') . '>',
      ];
      $safeHtml = preg_replace('/^\./m', '..', $html) ?? $html;
      $body = implode("\r\n", $headers) . "\r\n\r\n" . $safeHtml . "\r\n.";
      $write($body);
      if (!$expect($read(), '250')) {
        throw new RuntimeException('Message not accepted by SMTP server');
      }
      $write('QUIT');
      fclose($fp);
      mail_set_result(true, 'smtp', '');
      return true;
    } catch (Throwable $e) {
      error_log('[mailer] SMTP error: ' . $e->getMessage());
      mail_set_result(false, 'smtp', $e->getMessage());
      @fclose($fp);
      return false;
    }
  }
}

if (!function_exists('send_mail')) {
  function send_mail(string $toEmail, string $toName, string $subject, string $bodyHtml): bool
  {
    $toEmail = trim($toEmail);
    if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
      mail_set_result(false, '', 'Invalid recipient email');
      return false;
    }

    $html = mail_wrap_html($subject, $bodyHtml);
    $transport = mail_resolved_transport();
    $sent = false;

    if (!MAIL_ENABLED) {
      mail_archive_outbox($toEmail, $toName, $subject, $html, false, 'MAIL_ENABLED=false');
      mail_set_result(false, $transport, 'Mail is disabled (MAIL_ENABLED=false)');
      return false;
    }

    if ($transport === 'nodemailer') {
      $sent = nodemailer_send($toEmail, $toName, $subject, $html);
      mail_archive_outbox($toEmail, $toName, $subject, $html, $sent, $sent ? 'nodemailer-ok' : 'nodemailer-failed');
      return $sent;
    }

    if ($transport === 'smtp') {
      $sent = smtp_send($toEmail, $toName, $subject, $html);
      mail_archive_outbox($toEmail, $toName, $subject, $html, $sent, $sent ? 'smtp-ok' : 'smtp-failed');
      return $sent;
    }

    if ($transport === 'mail' && function_exists('mail')) {
      $from = mail_from_address();
      $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . MAIL_FROM_NAME . ' <' . $from . '>',
      ];
      $sent = @mail($toEmail, $subject, $html, implode("\r\n", $headers));
      mail_archive_outbox($toEmail, $toName, $subject, $html, $sent, $sent ? 'mail-ok' : 'mail-failed');
      mail_set_result($sent, 'mail', $sent ? '' : 'PHP mail() returned false');
      return $sent;
    }

    $path = mail_archive_outbox($toEmail, $toName, $subject, $html, true, 'outbox');
    $ok = $path !== null;
    mail_set_result(
      $ok,
      'outbox',
      $ok
        ? 'Saved to outbox only — run `npm run mail` with SMTP in mail-service/.env for real Gmail delivery.'
        : 'Failed to write mail outbox file'
    );
    return $ok;
  }
}
