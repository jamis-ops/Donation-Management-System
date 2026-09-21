<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/payment_methods.php';

$pdo = db();
$method = request_method();

if ($method !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed. Use POST.'], 405);
}

// 1. Validate File Upload
if (!isset($_FILES['proof']) || $_FILES['proof']['error'] === UPLOAD_ERR_NO_FILE) {
  json_response(['ok' => false, 'error' => 'No payment proof file was uploaded.'], 400);
}

if ($_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
  json_response(['ok' => false, 'error' => 'Payment proof upload failed with error code: ' . $_FILES['proof']['error']], 400);
}

$file = $_FILES['proof'];
$allowedMimes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

$fileMime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
if (!in_array($fileMime, $allowedMimes, true)) {
  json_response([
    'ok' => false,
    'error' => 'Unsupported file format. Please upload JPG, PNG, WEBP, GIF, or PDF.',
  ], 400);
}

// 5MB limit
if ($file['size'] > 5 * 1024 * 1024) {
  json_response(['ok' => false, 'error' => 'Payment proof file must be 5MB or smaller.'], 400);
}

// 2. Save securely to uploads/donation_proofs
$uploadDir = __DIR__ . '/uploads/donation_proofs';
if (!is_dir($uploadDir)) {
  @mkdir($uploadDir, 0755, true);
}

$origExt = strtolower((string) pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'jpg';
if (!in_array($origExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'], true)) {
  $origExt = $fileMime === 'application/pdf' ? 'pdf' : 'png';
}

$tempBaseName = 'donation_proof_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $origExt;
$savedFilePath = $uploadDir . '/' . $tempBaseName;

if (!move_uploaded_file($file['tmp_name'], $savedFilePath)) {
  if (!copy($file['tmp_name'], $savedFilePath)) {
    json_response(['ok' => false, 'error' => 'Could not store payment proof on server.'], 500);
  }
}

// 3. Ensure CMS Payment Methods Table Exists and Load Configuration
try {
  ensure_payment_methods_table($pdo);
} catch (Throwable $e) {
  // Table creation error handled gracefully
}

$activeMethods = [];
try {
  $pmStmt = $pdo->query('
    SELECT id, code, name, type, account_name, account_number, bank_name, is_active 
    FROM payment_methods 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, id ASC
  ');
  $activeMethods = $pmStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  $activeMethods = [];
}

// Fallback defaults matching standard CMS configuration if database has no rows
if (empty($activeMethods)) {
  $activeMethods = [
    ['id' => 1, 'name' => 'GCash', 'code' => 'gcash', 'type' => 'gcash', 'account_name' => 'Rise Above Foundation Cebu Inc', 'account_number' => '0917-000-0000', 'bank_name' => 'GCash'],
    ['id' => 2, 'name' => 'Bank Transfer (BPI)', 'code' => 'bank_transfer_bpi', 'type' => 'bank_transfer', 'account_name' => 'Rise Above Foundation Cebu, Inc.', 'account_number' => '9131005064', 'bank_name' => 'Bank of The Philippine Islands'],
    ['id' => 3, 'name' => 'Maya', 'code' => 'maya', 'type' => 'maya', 'account_name' => 'Rise Above Foundation Cebu Inc', 'account_number' => '0917-000-0000', 'bank_name' => 'Maya'],
    ['id' => 4, 'name' => 'PayPal', 'code' => 'paypal', 'type' => 'paypal', 'account_name' => 'Rise Above Foundation Cebu, Inc.', 'account_number' => 'info@riseabove-cebu.org', 'bank_name' => 'PayPal'],
  ];
}

// Resolve selected payment method dynamically from donor input
$selectedMethodInput = trim((string) ($_POST['selectedMethod'] ?? ''));
$paymentMethodId = (int) ($_POST['payment_method_id'] ?? 0);
$clientExtractedText = trim((string) ($_POST['client_extracted_text'] ?? ''));

$selectedMethod = null;
if ($paymentMethodId > 0) {
  foreach ($activeMethods as $m) {
    if ((int)$m['id'] === $paymentMethodId) {
      $selectedMethod = $m;
      break;
    }
  }
}

if (!$selectedMethod && $selectedMethodInput !== '') {
  foreach ($activeMethods as $m) {
    if (
      strcasecmp((string) $m['code'], $selectedMethodInput) === 0 ||
      strcasecmp((string) $m['name'], $selectedMethodInput) === 0 ||
      strcasecmp((string) ($m['id'] ?? ''), $selectedMethodInput) === 0 ||
      strcasecmp((string) ($m['type'] ?? ''), $selectedMethodInput) === 0
    ) {
      $selectedMethod = $m;
      break;
    }
  }
}

if (!$selectedMethod && !empty($activeMethods)) {
  $selectedMethod = $activeMethods[0];
}

$expectedRecipientName = trim((string) ($selectedMethod['account_name'] ?? ''));
$expectedAccountNumber = trim((string) ($selectedMethod['account_number'] ?? ''));
$expectedMethodName = trim((string) ($selectedMethod['name'] ?? 'Payment Method'));
$expectedMethodType = trim((string) ($selectedMethod['type'] ?? ''));

// =========================================================================
// NORMALIZATION & PARSING FUNCTIONS (Zero hardcoded values or examples)
// =========================================================================

function normalize_clean_string(string $str): string {
  $str = mb_strtolower($str, 'UTF-8');
  // Strip punctuation and symbols
  $str = preg_replace('/[.,\-_#\/\(\)\[\]\'\"@:;!\\\]/u', ' ', $str) ?? $str;
  return trim((string) preg_replace('/\s+/u', ' ', $str));
}

function clean_account_digits(string $acc): string {
  return preg_replace('/\D/', '', $acc) ?? '';
}

/**
 * 3-State Recipient Evaluation:
 * - 'MATCH': Confirmed match with CMS account_name or account_number
 * - 'EXPLICIT_MISMATCH': Clearly addressed to another person or unrelated company
 * - 'UNREADABLE': Recipient line could not be confidently identified
 */
function evaluate_recipient_match_3state(string $receiptText, string $expectedName, string $expectedAccount = ''): array {
  if (trim($receiptText) === '') {
    return [
      'result' => 'UNREADABLE',
      'matched' => false,
      'isExplicitMismatch' => false,
      'detectedRecipient' => null,
      'reason' => 'Receipt text is empty or unreadable',
    ];
  }

  $normReceipt = normalize_clean_string($receiptText);
  $normExpected = normalize_clean_string($expectedName);

  // 1. Direct normalized phrase containment
  if ($normExpected !== '' && str_contains($normReceipt, $normExpected)) {
    return [
      'result' => 'MATCH',
      'matched' => true,
      'isExplicitMismatch' => false,
      'detectedRecipient' => $expectedName,
      'reason' => 'Exact recipient organization match',
    ];
  }

  // 2. Core phrase match (e.g. "Rise Above", "Rise Above Foundation")
  // Strip legal suffixes for stem matching
  $stemExpected = trim((string) preg_replace('/\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|philippines|phils|ph)\b/u', '', $normExpected));
  $stemExpected = trim((string) preg_replace('/\s+/u', ' ', $stemExpected));
  if (strlen($stemExpected) >= 6 && str_contains($normReceipt, $stemExpected)) {
    return [
      'result' => 'MATCH',
      'matched' => true,
      'isExplicitMismatch' => false,
      'detectedRecipient' => $expectedName,
      'reason' => 'Recipient organization stem match',
    ];
  }

  // 3. Significant Token Overlap (>= 50% of meaningful words > 2 chars)
  $expectedTokens = array_filter(explode(' ', $stemExpected), fn($t) => strlen($t) > 2);
  if (!empty($expectedTokens)) {
    $hits = 0;
    foreach ($expectedTokens as $tok) {
      if (str_contains($normReceipt, $tok)) {
        $hits++;
      }
    }
    $ratio = $hits / count($expectedTokens);
    if ($ratio >= 0.50) {
      return [
        'result' => 'MATCH',
        'matched' => true,
        'isExplicitMismatch' => false,
        'detectedRecipient' => $expectedName,
        'reason' => 'Recipient verified via organization token overlap',
      ];
    }
  }

  // 4. Account Number / Mobile Match from CMS
  if ($expectedAccount !== '') {
    $cleanExpected = clean_account_digits($expectedAccount);
    $cleanReceiptDigits = clean_account_digits($receiptText);

    if (strlen($cleanExpected) >= 5 && str_contains($cleanReceiptDigits, $cleanExpected)) {
      return [
        'result' => 'MATCH',
        'matched' => true,
        'isExplicitMismatch' => false,
        'detectedRecipient' => $expectedName,
        'reason' => 'Configured organization account number matched',
      ];
    }

    // Check masked mobile e.g. 0917 *** 4567 or ****4567
    if (strlen($cleanExpected) >= 10) {
      $prefix4 = substr($cleanExpected, 0, 4);
      $suffix4 = substr($cleanExpected, -4);
      if (preg_match('/' . preg_quote($prefix4, '/') . '[\s\*#\-]*' . preg_quote($suffix4, '/') . '/', $receiptText)) {
        return [
          'result' => 'MATCH',
          'matched' => true,
          'isExplicitMismatch' => false,
          'detectedRecipient' => $expectedName,
          'reason' => 'Masked organization mobile number matched',
        ];
      }
      if (preg_match('/[\*#]{2,4}\s*' . preg_quote($suffix4, '/') . '/', $receiptText)) {
        return [
          'result' => 'MATCH',
          'matched' => true,
          'isExplicitMismatch' => false,
          'detectedRecipient' => $expectedName,
          'reason' => 'Masked organization account suffix matched',
        ];
      }
    }
  }

  // 5. Detect if clearly paid to another counterparty
  $detectedCounterparty = null;
  if (preg_match('/(?:Paid\s+to|Payment\s+to|Sent\s+to|Recipient|Merchant|To)\s*[:\-]?\s*([^\r\n]{3,60})/i', $receiptText, $m)) {
    $rawCand = trim($m[1]);
    $cleanedCand = preg_replace('/\s+(?:amount|total|ref|date|fee).*$/i', '', $rawCand);
    if (strlen($cleanedCand) >= 3) {
      $detectedCounterparty = trim($cleanedCand);
    }
  }

  if ($detectedCounterparty !== null) {
    $normCounterparty = normalize_clean_string($detectedCounterparty);
    // Check if counterparty has any overlap with expected organization
    $hasOverlap = false;
    foreach ($expectedTokens as $tok) {
      if (str_contains($normCounterparty, $tok)) {
        $hasOverlap = true;
        break;
      }
    }
    if (!$hasOverlap) {
      return [
        'result' => 'EXPLICIT_MISMATCH',
        'matched' => false,
        'isExplicitMismatch' => true,
        'detectedRecipient' => $detectedCounterparty,
        'reason' => "Paid to unrelated recipient ({$detectedCounterparty}) instead of {$expectedName}",
      ];
    }
  }

  // 6. Recipient is unreadable / not found in OCR text
  return [
    'result' => 'UNREADABLE',
    'matched' => false,
    'isExplicitMismatch' => false,
    'detectedRecipient' => null,
    'reason' => 'Recipient information could not be clearly identified from receipt text',
  ];
}

function evaluate_payment_provider_match(string $receiptText, ?array $selectedMethod): array {
  if (!$selectedMethod) {
    return ['matched' => true, 'detected' => null, 'isExplicitMismatch' => false, 'reason' => 'No payment method specified'];
  }

  $expectedName = strtolower((string) ($selectedMethod['name'] ?? ''));
  $expectedCode = strtolower((string) ($selectedMethod['code'] ?? ''));
  $expectedType = strtolower((string) ($selectedMethod['type'] ?? ''));
  $expectedBank = strtolower((string) ($selectedMethod['bank_name'] ?? ''));

  $knownProviders = [
    'gcash' => 'GCash',
    'maya' => 'Maya',
    'paymaya' => 'Maya',
    'bpi' => 'BPI',
    'bdo' => 'BDO',
    'metrobank' => 'Metrobank',
    'unionbank' => 'UnionBank',
    'landbank' => 'Landbank',
    'security bank' => 'Security Bank',
    'rcbc' => 'RCBC',
    'pnb' => 'PNB',
    'chinabank' => 'China Bank',
    'seabank' => 'SeaBank',
    'gotyme' => 'GoTyme',
    'paypal' => 'PayPal',
    'bank transfer' => 'Bank Transfer',
    'instapay' => 'InstaPay',
    'pesonet' => 'PESONet',
  ];

  $detected = null;
  foreach ($knownProviders as $needle => $label) {
    if (stripos($receiptText, $needle) !== false) {
      $detected = $label;
      break;
    }
  }

  if (!$detected) {
    return [
      'matched' => true,
      'detected' => null,
      'isExplicitMismatch' => false,
      'reason' => 'Payment channel could not be identified from text',
    ];
  }

  $detLower = strtolower($detected);
  $matched = false;

  if (
    str_contains($expectedName, $detLower) ||
    str_contains($expectedCode, $detLower) ||
    str_contains($expectedType, $detLower) ||
    ($expectedBank !== '' && str_contains($expectedBank, $detLower))
  ) {
    $matched = true;
  } elseif (
    str_contains($expectedType, 'bank') &&
    in_array($detected, ['BPI', 'BDO', 'Metrobank', 'UnionBank', 'Landbank', 'Security Bank', 'RCBC', 'PNB', 'China Bank', 'SeaBank', 'GoTyme', 'Bank Transfer', 'InstaPay', 'PESONet'], true)
  ) {
    $matched = true;
  }

  return [
    'matched' => $matched,
    'detected' => $detected,
    'isExplicitMismatch' => !$matched,
    'reason' => $matched
      ? "Provider matches selected {$selectedMethod['name']}"
      : "Payment channel mismatch: receipt shows {$detected} while {$selectedMethod['name']} was selected",
  ];
}

function extract_amount_dynamically(string $text): ?float {
  $patterns = [
    // Label + Currency + Number
    '/(?:total(?:\s*amount)?|amount(?:\s*paid|\s*sent|\s*transferred)?|payment\s*amount|grand\s*total)\s*[:\s]*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i',
    // Currency symbol + Number
    '/(?:₱|PHP|Php|php)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i',
    // Paid/Sent + Number
    '/(?:paid|sent|transfer(?:red)?)\s*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i',
    // Standalone number with 2 decimals
    '/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/',
  ];

  foreach ($patterns as $pat) {
    if (preg_match($pat, $text, $m)) {
      $raw = str_replace(',', '', $m[1]);
      $val = (float) $raw;
      if ($val > 0 && $val < 100000000) {
        return round($val, 2);
      }
    }
  }
  return null;
}

function extract_reference_dynamically(string $text): ?string {
  // 1. High priority: Explicitly labeled reference / confirmation / txn / trace codes
  $labeledPatterns = [
    '/(?:ref(?:erence)?\s*(?:no\.?|number|id|code|#)?|trace\s*no\.?|txn\s*(?:id|no\.?|#)?)\s*[:\-#]?\s*([A-Za-z0-9\s]{6,35})/i',
    '/(?:confirmation|transaction)\s*(?:no\.?|number|id|code|#)?\s*[:\-#]?\s*([A-Za-z0-9\s]{6,35})/i',
  ];

  foreach ($labeledPatterns as $pat) {
    if (preg_match_all($pat, $text, $allMatches, PREG_SET_ORDER)) {
      foreach ($allMatches as $m) {
        $cand = trim($m[1]);
        $firstLine = trim((string) explode("\n", $cand)[0]);
        $cleaned = preg_replace('/\s+(?:amount|total|date|fee|status|completed|successful|paid).*$/i', '', $firstLine);
        $alphanumeric = preg_replace('/[^A-Za-z0-9]/', '', $cleaned);
        if (strlen($alphanumeric) >= 6 && strlen($alphanumeric) <= 32 && preg_match('/\d{3,}/', $alphanumeric)) {
          if (ctype_digit($alphanumeric)) {
            return $alphanumeric;
          }
          return trim($cleaned);
        }
      }
    }
  }

  // 2. Fallback: Unlabeled digit sequences, strictly ignoring Account / Phone / Mobile lines
  $lines = explode("\n", $text);
  foreach ($lines as $line) {
    if (preg_match('/(?:account|acc|mobile|phone|contact|amount|total|fee|php|₱)/i', $line)) {
      continue;
    }
    // 4-block spaced digits (e.g. 5044 8382 2843 6)
    if (preg_match('/\b(\d{4}\s+\d{3,4}\s+\d{3,4}(?:\s+\d{1,4})?)\b/', $line, $m)) {
      $digits = preg_replace('/\s+/', '', $m[1]);
      if (strlen($digits) >= 10 && strlen($digits) <= 16) {
        return $digits;
      }
    }
    // Standalone 10-16 continuous digits
    if (preg_match('/\b(\d{10,16})\b/', $line, $m)) {
      return $m[1];
    }
  }

  return null;
}

function extract_date_dynamically(string $text): ?string {
  $patterns = [
    '/\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?)\b/',
    '/\b(\d{4}[-\/.]\d{2}[-\/.]\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?)\b/',
    '/\b(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?)\b/',
  ];

  foreach ($patterns as $pat) {
    if (preg_match($pat, $text, $m)) {
      return trim($m[1]);
    }
  }
  return null;
}

function detect_payment_success(string $text): bool {
  return (bool) preg_match('/(?:successfully\s+processed|payment\s+successful|transaction\s+successful|transfer\s+successful|paid\s+successfully|sent\s+successfully|payment\s+completed|transaction\s+completed|completed|paid|sent)/i', $text);
}

/**
 * Robust Dynamic Verification Decision Engine
 */
function evaluate_proof_evidence(string $text, ?array $selectedMethod, array $activeMethods): array {
  $expectedRecipient = trim((string) ($selectedMethod['account_name'] ?? ''));
  $expectedAccountNo = trim((string) ($selectedMethod['account_number'] ?? ''));
  $expectedMethodName = trim((string) ($selectedMethod['name'] ?? 'Payment Method'));

  // 1. Recipient check (3-state)
  $recipientEval = evaluate_recipient_match_3state($text, $expectedRecipient, $expectedAccountNo);
  $recipientState = $recipientEval['result']; // 'MATCH', 'EXPLICIT_MISMATCH', 'UNREADABLE'
  $detectedRecipient = $recipientEval['detectedRecipient'];

  // 2. Payment Method provider match
  $providerEval = evaluate_payment_provider_match($text, $selectedMethod);
  $methodMatch = $providerEval['matched'];
  $detectedMethod = $providerEval['detected'];

  // 3. Amount extraction
  $amount = extract_amount_dynamically($text);

  // 4. Reference Number extraction
  $reference = extract_reference_dynamically($text);

  // 5. Transaction Date extraction
  $transactionDate = extract_date_dynamically($text);

  // 6. Payment Success check
  $isSuccess = detect_payment_success($text);

  // 7. Decision Matrix
  $status = 'needs_review';
  $message = 'Payment proof details require manual review.';
  $reasons = [];

  if ($recipientState === 'EXPLICIT_MISMATCH') {
    $status = 'invalid';
    $message = $recipientEval['reason'];
    $reasons[] = $recipientEval['reason'];
  } elseif (!$methodMatch && $providerEval['isExplicitMismatch']) {
    $status = 'invalid';
    $message = $providerEval['reason'];
    $reasons[] = $providerEval['reason'];
  } elseif ($recipientState === 'MATCH' && $methodMatch && $amount !== null && $amount > 0 && ($isSuccess || $reference !== null)) {
    $status = 'verified';
    $message = 'Payment proof verified successfully.';
    $reasons[] = 'Recipient organization confirmed';
    $reasons[] = "Payment channel confirmed ({$expectedMethodName})";
    $reasons[] = "Amount confirmed: ₱" . number_format($amount, 2);
    if ($reference) {
      $reasons[] = "Reference number: {$reference}";
    }
  } elseif ($amount !== null && $amount > 0) {
    $status = 'needs_review';
    $message = 'Payment amount detected. Please confirm details before completing submission.';
    $reasons[] = $recipientEval['reason'];
    $reasons[] = "Extracted amount: ₱" . number_format($amount, 2);
  } else {
    $status = 'needs_review';
    $message = 'Payment details could not be fully read from this proof. Please enter details manually.';
    $reasons[] = $recipientEval['reason'];
  }

  // Purely extracted values without fake fallbacks
  $extracted = [
    'paymentMethod' => $detectedMethod,
    'recipient' => $detectedRecipient,
    'accountNumber' => null,
    'amount' => $amount,
    'referenceNumber' => $reference,
    'transactionDate' => $transactionDate,
    'transactionStatus' => $isSuccess ? 'Successful' : ($status === 'invalid' ? 'Invalid' : 'Pending'),
  ];

  $cmsExpected = [
    'paymentMethodId' => (int) ($selectedMethod['id'] ?? 0),
    'paymentMethod' => $expectedMethodName,
    'accountName' => $expectedRecipient,
    'accountNumber' => $expectedAccountNo,
  ];

  $matching = [
    'recipientMatch' => ($recipientState === 'MATCH'),
    'recipientState' => $recipientState,
    'accountMatch' => ($recipientState === 'MATCH'),
    'paymentMethodMatch' => $methodMatch,
    'paymentSuccessful' => $isSuccess,
  ];

  return [
    'status' => $status,
    'confidence' => $status === 'verified' ? 'high' : ($status === 'needs_review' ? 'medium' : 'low'),
    'recipient' => $detectedRecipient,
    'recipientMatch' => ($recipientState === 'MATCH'),
    'accountMatch' => ($recipientState === 'MATCH'),
    'paymentMethod' => $detectedMethod ?: $expectedMethodName,
    'paymentMethodMatch' => $methodMatch,
    'amount' => $amount,
    'extractedAmount' => $amount,
    'formattedAmount' => $amount !== null ? number_format($amount, 2) : null,
    'currency' => 'PHP',
    'referenceNumber' => $reference,
    'transactionDate' => $transactionDate,
    'paymentSuccessful' => $isSuccess,
    'needsManualReview' => ($status !== 'verified'),
    'verificationMessage' => $message,
    'reasons' => $reasons,
    'debug' => [
      'extracted' => $extracted,
      'cmsExpected' => $cmsExpected,
      'matching' => $matching,
      'decision' => $status,
      'rawTextSnippet' => mb_substr($text, 0, 350, 'UTF-8'),
    ],
  ];
}

// =========================================================================
// MULTI-TIER OCR EXTRACTION (Tesseract, Gemini Vision, OCR.space rotating)
// =========================================================================

function run_server_tesseract(string $filePath): string {
  if (!function_exists('exec')) {
    return '';
  }

  $candidates = [
    '/usr/bin/tesseract',
    '/usr/local/bin/tesseract',
    'tesseract',
    'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  ];

  $binary = null;
  foreach ($candidates as $cand) {
    if (@is_executable($cand) || (str_contains($cand, '\\') && file_exists($cand))) {
      $binary = $cand;
      break;
    }
  }
  if (!$binary) {
    $binary = 'tesseract';
  }

  $output = [];
  $retCode = -1;
  $cmd = escapeshellcmd($binary) . ' ' . escapeshellarg($filePath) . ' stdout -l eng 2>&1';
  @exec($cmd, $output, $retCode);
  if ($retCode === 0 && !empty($output)) {
    return trim(implode("\n", $output));
  }

  return '';
}

function run_cloud_ocr_fallback(string $filePath, string $mime): string {
  $apiKeys = ['helloworld', 'K87899142388957'];
  foreach ($apiKeys as $key) {
    $ch = curl_init('https://api.ocr.space/parse/image');
    $cfile = new CURLFile($filePath, $mime, basename($filePath));
    $postData = [
      'apikey' => $key,
      'isOverlayRequired' => 'false',
      'file' => $cfile,
      'language' => 'eng',
      'detectOrientation' => 'true',
      'scale' => 'true',
      'isTable' => 'true',
    ];
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
      $ocrData = json_decode((string) $res, true);
      $text = $ocrData['ParsedResults'][0]['ParsedText'] ?? '';
      if (trim($text) !== '') {
        return trim((string) $text);
      }
    }
  }
  return '';
}

function resolve_gemini_api_key(): string {
  global $GEMINI_API_KEY;
  if (!empty($GEMINI_API_KEY)) return trim((string)$GEMINI_API_KEY);
  $val = getenv('GEMINI_API_KEY');
  if (!empty($val)) return trim((string)$val);
  if (!empty($_ENV['GEMINI_API_KEY'])) return trim((string)$_ENV['GEMINI_API_KEY']);
  if (!empty($_SERVER['GEMINI_API_KEY'])) return trim((string)$_SERVER['GEMINI_API_KEY']);
  if (is_readable('/proc/self/environ')) {
    $envContent = @file_get_contents('/proc/self/environ');
    if ($envContent && preg_match('/(?:^|\x00)GEMINI_API_KEY=([^\x00]+)/', $envContent, $m)) {
      return trim($m[1]);
    }
  }
  return '';
}

// =========================================================================
// PIPELINE EXECUTION
// =========================================================================

$fileBytes = (string) file_get_contents($savedFilePath);
$fileBase64 = base64_encode($fileBytes);
$aiResult = null;
$apiKey = resolve_gemini_api_key();

// Tier 1: Gemini Vision Multimodal (if API key configured)
if ($apiKey !== '' && strlen($fileBytes) > 0) {
  $prompt = <<<PROMPT
Analyze this payment confirmation receipt image strictly and objectively from the visible text.
Expected Organization Recipient: "{$expectedRecipientName}"
Expected Organization Account: "{$expectedAccountNumber}"
Expected Payment Method: "{$expectedMethodName}"

Extract:
1. recipient: exact recipient or merchant name printed on the receipt (or null if unreadable)
2. paymentMethod: payment provider or bank (e.g. GCash, Maya, BPI, BDO, etc., or null)
3. amount: numeric monetary amount as a float (Philippine Peso PHP, or null)
4. referenceNumber: exact confirmation/transaction/reference number (or null)
5. transactionDate: visible date/time string (or null)
6. paymentSuccessful: boolean (true if receipt indicates success, completed, or paid)

Return strictly valid JSON:
{
  "recipient": string or null,
  "paymentMethod": string or null,
  "amount": number or null,
  "referenceNumber": string or null,
  "transactionDate": string or null,
  "paymentSuccessful": boolean,
  "rawSummary": string
}
PROMPT;

  $modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
  foreach ($modelsToTry as $modelName) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key=" . urlencode($apiKey);
    $payload = [
      'contents' => [
        [
          'parts' => [
            [
              'inlineData' => [
                'mimeType' => $fileMime,
                'data' => $fileBase64,
              ],
            ],
            ['text' => $prompt],
          ],
        ],
      ],
      'generationConfig' => [
        'temperature' => 0.0,
        'responseMimeType' => 'application/json',
      ],
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
      $resData = json_decode($response, true);
      $rawText = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '';
      if ($rawText !== '') {
        $cleanJson = trim(preg_replace('/^```(?:json)?|```$/m', '', trim($rawText)));
        $parsed = json_decode($cleanJson, true);
        if (is_array($parsed)) {
          // Construct text representation to feed deterministic CMS decision engine
          $syntheticText = implode("\n", array_filter([
            $parsed['paymentMethod'] ?? '',
            $parsed['recipient'] ? "Payment to {$parsed['recipient']}" : '',
            $parsed['amount'] !== null ? "Total PHP " . number_format((float)$parsed['amount'], 2, '.', '') : '',
            $parsed['referenceNumber'] ? "Ref No. {$parsed['referenceNumber']}" : '',
            $parsed['transactionDate'] ?? '',
            !empty($parsed['paymentSuccessful']) ? 'Payment successful' : '',
            $parsed['rawSummary'] ?? '',
          ]));

          $aiResult = evaluate_proof_evidence($syntheticText, $selectedMethod, $activeMethods);
          $aiResult['source'] = 'gemini_vision';
          break;
        }
      }
    }
  }
}

// Tier 2, 3 & 4: OCR Extraction Pipeline
if (!$aiResult) {
  $extractedText = '';

  // 1. Client-extracted text from browser worker if passed
  if ($clientExtractedText !== '' && strlen($clientExtractedText) > 10) {
    $extractedText = $clientExtractedText;
  }

  // 2. PDF text extraction
  if ($extractedText === '' && $fileMime === 'application/pdf') {
    if (preg_match_all('/(?:BT[\r\n\s]+)(.*?)(?:[\r\n\s]+ET)/s', $fileBytes, $matches)) {
      foreach ($matches[1] as $block) {
        if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
          $extractedText .= ' ' . implode(' ', $tMatches[1]);
        }
      }
    }
  }

  // 3. Server-side Tesseract
  if ($extractedText === '') {
    $extractedText = run_server_tesseract($savedFilePath);
  }

  // 4. Cloud OCR fallback
  if ($extractedText === '') {
    $extractedText = run_cloud_ocr_fallback($savedFilePath, $fileMime);
  }

  $aiResult = evaluate_proof_evidence($extractedText, $selectedMethod, $activeMethods);
  $aiResult['source'] = 'ocr_evidence_engine';
}

// Ensure amount formatting preserves 2 decimal places
$finalAmount = null;
if (isset($aiResult['amount']) && is_numeric($aiResult['amount'])) {
  $finalAmount = round((float) $aiResult['amount'], 2);
} elseif (isset($aiResult['extractedAmount']) && is_numeric($aiResult['extractedAmount'])) {
  $finalAmount = round((float) $aiResult['extractedAmount'], 2);
}
$aiResult['amount'] = $finalAmount;
$aiResult['extractedAmount'] = $finalAmount;
$aiResult['formattedAmount'] = $finalAmount !== null ? number_format($finalAmount, 2) : null;
$aiResult['currency'] = 'PHP';
$aiResult['methodMatchesSelected'] = !empty($aiResult['paymentMethodMatch']);
$aiResult['detectedMethod'] = $aiResult['paymentMethod'] ?? null;
$aiResult['recipientInfo'] = $aiResult['recipient'] ?? null;

// Return uniform JSON response with debug telemetry
json_response([
  'ok' => true,
  'status' => $aiResult['status'],
  'recipient' => $aiResult['recipient'],
  'recipientMatch' => !empty($aiResult['recipientMatch']),
  'accountMatch' => !empty($aiResult['accountMatch']),
  'paymentMethod' => $aiResult['paymentMethod'],
  'paymentMethodMatch' => !empty($aiResult['paymentMethodMatch']),
  'amount' => $finalAmount,
  'extractedAmount' => $finalAmount,
  'formattedAmount' => $aiResult['formattedAmount'],
  'currency' => 'PHP',
  'referenceNumber' => $aiResult['referenceNumber'] ?? null,
  'transactionDate' => $aiResult['transactionDate'] ?? null,
  'paymentSuccessful' => !empty($aiResult['paymentSuccessful']),
  'needsManualReview' => !empty($aiResult['needsManualReview']),
  'verificationMessage' => $aiResult['verificationMessage'] ?? 'Payment proof verified successfully.',
  'reasons' => $aiResult['reasons'] ?? [],
  'fileName' => $file['name'],
  'tempProofToken' => $tempBaseName,
  'proofPath' => $tempBaseName,
  'proofUrl' => '/api/file.php?kind=donation_proofs&name=' . rawurlencode($tempBaseName),
  'mimeType' => $fileMime,
  'size' => $file['size'],
  'verification' => $aiResult,
  'debug' => $aiResult['debug'] ?? null,
]);
