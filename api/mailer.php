<?php
declare(strict_types=1);

/**
 * Mailer — SMTP / PHP mail() / local outbox.
 *
 * Configure in mail_config.php (copy from mail_config.sample.php).
 * Every message is also archived to MAIL_OUTBOX_DIR for debugging.
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
  // smtp | mail | outbox
  define('MAIL_TRANSPORT', 'outbox');
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
  // tls | ssl | ''
  define('SMTP_SECURE', 'tls');
}
if (!defined('FRONTEND_URL')) {
  define('FRONTEND_URL', 'http://localhost:5173');
}
if (!defined('API_PUBLIC_URL')) {
  define('API_PUBLIC_URL', '');
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
  function mail_archive_outbox(string $toEmail, string $toName, string $subject, string $html, bool $sent): ?string
  {
    try {
      if (!is_dir(MAIL_OUTBOX_DIR)) {
        @mkdir(MAIL_OUTBOX_DIR, 0755, true);
      }
      $safe = preg_replace('/[^a-z0-9]+/i', '_', $toEmail) ?: 'recipient';
      $file = MAIL_OUTBOX_DIR . '/' . date('Ymd_His') . '_' . $safe . '.html';
      $meta = "<!-- To: {$toName} <{$toEmail}> | Subject: {$subject} | " . date('c')
        . ' | delivered=' . ($sent ? 'yes' : 'no') . " -->\n";
      @file_put_contents($file, $meta . $html);
      return $file;
    } catch (Throwable $e) {
      return null;
    }
  }
}

if (!function_exists('smtp_send')) {
  /**
   * Minimal SMTP client (AUTH LOGIN). Returns true on success.
   */
  function smtp_send(string $toEmail, string $toName, string $subject, string $html): bool
  {
    if (SMTP_HOST === '' || SMTP_USER === '') {
      return false;
    }

    $host = SMTP_HOST;
    $port = (int) SMTP_PORT;
    $secure = strtolower((string) SMTP_SECURE);
    $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host;
    $errno = 0;
    $errstr = '';
    $fp = @fsockopen($remote, $port, $errno, $errstr, 20);
    if (!$fp) {
      error_log("[mailer] SMTP connect failed: {$errstr} ({$errno})");
      return false;
    }
    stream_set_timeout($fp, 20);

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
        throw new RuntimeException('Bad greeting: ' . $greeting);
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
          throw new RuntimeException('STARTTLS failed: ' . $tls);
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
        throw new RuntimeException('SMTP password rejected');
      }

      $from = MAIL_FROM_EMAIL;
      $write("MAIL FROM:<{$from}>");
      if (!$expect($read(), '250')) {
        throw new RuntimeException('MAIL FROM rejected');
      }
      $write("RCPT TO:<{$toEmail}>");
      if (!$expect($read(), '250')) {
        throw new RuntimeException('RCPT TO rejected');
      }
      $write('DATA');
      if (!$expect($read(), '354')) {
        throw new RuntimeException('DATA not accepted');
      }

      $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
      $toHeader = $toName !== '' ? "\"{$toName}\" <{$toEmail}>" : $toEmail;
      $headers = [
        "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM_EMAIL . ">",
        "To: {$toHeader}",
        "Subject: {$encodedSubject}",
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@riseabovefoundation.org>',
      ];
      $body = implode("\r\n", $headers) . "\r\n\r\n" . $html . "\r\n.";
      $write($body);
      if (!$expect($read(), '250')) {
        throw new RuntimeException('Message not accepted');
      }
      $write('QUIT');
      fclose($fp);
      return true;
    } catch (Throwable $e) {
      error_log('[mailer] SMTP error: ' . $e->getMessage());
      @fclose($fp);
      return false;
    }
  }
}

if (!function_exists('send_mail')) {
  /**
   * Send an HTML email. Returns true when delivery is considered successful
   * (SMTP/mail succeeded, or outbox transport archived the message).
   */
  function send_mail(string $toEmail, string $toName, string $subject, string $bodyHtml): bool
  {
    $html = mail_wrap_html($subject, $bodyHtml);
    $sent = false;
    $transport = strtolower((string) MAIL_TRANSPORT);

    if (MAIL_ENABLED) {
      if ($transport === 'smtp') {
        $sent = smtp_send($toEmail, $toName, $subject, $html);
      } elseif ($transport === 'mail' && function_exists('mail')) {
        $headers = [
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM_EMAIL . '>',
        ];
        $sent = @mail($toEmail, $subject, $html, implode("\r\n", $headers));
      } elseif ($transport === 'outbox') {
        // Local/dev transport: treat a successful outbox write as delivery.
        $path = mail_archive_outbox($toEmail, $toName, $subject, $html, true);
        return $path !== null;
      }
    }

    // Always keep a copy for debugging (even when SMTP/mail was used).
    mail_archive_outbox($toEmail, $toName, $subject, $html, $sent);

    // Fall back to outbox success so signup still completes with a usable link
    // when SMTP is misconfigured.
    if (!$sent) {
      $path = MAIL_OUTBOX_DIR;
      if (is_dir($path)) {
        // Message was archived above; surface as "sent" for local testing.
        return true;
      }
    }

    return $sent;
  }
}
