<?php
declare(strict_types=1);

/**
 * Application / frontend URL resolution for emails, invites, and redirects.
 *
 * Priority:
 *   1. APP_URL / FRONTEND_URL / PUBLIC_URL environment variables
 *   2. FRONTEND_URL from mail_config.php (skipped if localhost while request is non-local)
 *   3. HTTP Origin / Referer from the current request
 *   4. X-Forwarded-* / Host (same-origin deployments)
 *   5. http://localhost:5173 (local Vite default)
 */

if (!function_exists('app_url_is_local_host')) {
  function app_url_is_local_host(string $host): bool
  {
    $host = strtolower(trim(explode(':', $host)[0] ?? ''));
    return $host === ''
      || $host === 'localhost'
      || $host === '127.0.0.1'
      || $host === '::1'
      || str_ends_with($host, '.local');
  }
}

if (!function_exists('app_url_is_local_url')) {
  function app_url_is_local_url(string $url): bool
  {
    $parts = parse_url($url);
    $host = (string) ($parts['host'] ?? '');
    return app_url_is_local_host($host);
  }
}

if (!function_exists('app_request_is_local')) {
  function app_request_is_local(): bool
  {
    $host = (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '');
    $host = trim(explode(',', $host)[0]);
    return app_url_is_local_host($host);
  }
}

if (!function_exists('app_normalize_base_url')) {
  function app_normalize_base_url(string $url): string
  {
    $url = trim($url);
    if ($url === '') {
      return '';
    }
    if (!preg_match('#^https?://#i', $url)) {
      $url = 'https://' . ltrim($url, '/');
    }
    return rtrim($url, '/');
  }
}

if (!function_exists('app_base_url')) {
  function app_base_url(): string
  {
    static $cached = null;
    if ($cached !== null) {
      return $cached;
    }

    $configured = [];
    foreach (['APP_URL', 'FRONTEND_URL', 'PUBLIC_URL', 'VITE_APP_URL'] as $key) {
      $val = getenv($key);
      if (is_string($val) && trim($val) !== '') {
        $configured[] = app_normalize_base_url($val);
      }
    }
    if (defined('FRONTEND_URL') && is_string(FRONTEND_URL) && trim((string) FRONTEND_URL) !== '') {
      $configured[] = app_normalize_base_url((string) FRONTEND_URL);
    }

    $configured = array_values(array_unique(array_filter($configured)));
    $localRequest = app_request_is_local();

    // Prefer non-localhost configured URLs for production-looking requests.
    foreach ($configured as $base) {
      if ($localRequest || !app_url_is_local_url($base)) {
        return $cached = $base;
      }
    }
    // If every configured URL is localhost and we are local, use it.
    foreach ($configured as $base) {
      return $cached = $base;
    }

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && preg_match('#^https?://#i', $origin)) {
      return $cached = app_normalize_base_url($origin);
    }

    $referer = trim((string) ($_SERVER['HTTP_REFERER'] ?? ''));
    if ($referer !== '' && preg_match('#^(https?://[^/]+)#i', $referer, $m)) {
      return $cached = app_normalize_base_url($m[1]);
    }

    $proto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    if ($proto === '' || !in_array($proto, ['http', 'https'], true)) {
      $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    }
    $host = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? ''))[0]);
    if ($host !== '') {
      // PHP built-in server (often :8000) is the API, not the SPA — prefer Vite default.
      $hostOnly = strtolower(explode(':', $host)[0] ?? $host);
      $port = null;
      if (str_contains($host, ':')) {
        $port = (int) substr($host, strrpos($host, ':') + 1);
      }
      if (app_url_is_local_host($hostOnly) && in_array($port, [8000, 8080, 80, null], true) && $port !== 5173) {
        return $cached = 'http://localhost:5173';
      }
      // When the browser hits Vite (localhost:5173) and proxies /api, Host is useful.
      // When API is on a separate subdomain, set APP_URL / FRONTEND_URL explicitly.
      return $cached = app_normalize_base_url("{$proto}://{$host}");
    }

    return $cached = 'http://localhost:5173';
  }
}

if (!function_exists('frontend_url')) {
  /**
   * Absolute frontend URL for emails, invites, and redirects.
   */
  function frontend_url(string $path = ''): string
  {
    $base = app_base_url();
    if ($path === '' || $path === '/') {
      return $base;
    }
    return $base . '/' . ltrim($path, '/');
  }
}

if (!function_exists('recovery_url')) {
  function recovery_url(): string
  {
    if (defined('RECOVERY_URL') && is_string(RECOVERY_URL) && trim((string) RECOVERY_URL) !== '') {
      $raw = trim((string) RECOVERY_URL);
      if (preg_match('#^https?://#i', $raw)) {
        // Avoid shipping localhost recovery links in production emails.
        if (app_request_is_local() || !app_url_is_local_url($raw)) {
          return rtrim($raw, '/');
        }
      } else {
        // Relative path such as /login or /account/recovery
        return frontend_url($raw);
      }
    }
    return frontend_url('/login');
  }
}

if (!function_exists('notification_path')) {
  /**
   * In-app notification links stay path-only so React Router works in every environment.
   */
  function notification_path(string $path): string
  {
    $path = trim($path);
    if ($path === '') {
      return '/';
    }
    if (preg_match('#^https?://#i', $path)) {
      $parts = parse_url($path);
      $out = (string) ($parts['path'] ?? '/');
      if (!empty($parts['query'])) {
        $out .= '?' . $parts['query'];
      }
      if (!empty($parts['fragment'])) {
        $out .= '#' . $parts['fragment'];
      }
      return $out !== '' ? $out : '/';
    }
    return '/' . ltrim($path, '/');
  }
}

if (!function_exists('email_link_html')) {
  /** Simple CTA paragraph with absolute app URL. */
  function email_link_html(string $path, string $label = 'Open in portal'): string
  {
    $url = htmlspecialchars(frontend_url($path), ENT_QUOTES, 'UTF-8');
    $safeLabel = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
    return '<p style="margin:20px 0;text-align:center">'
      . '<a href="' . $url . '" style="display:inline-block;background:#AF101A;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">'
      . $safeLabel
      . '</a></p>'
      . '<p style="margin:0;color:#64748b;font-size:0.85rem;word-break:break-all;text-align:center">Or open: <a href="' . $url . '">' . $url . '</a></p>';
  }
}
