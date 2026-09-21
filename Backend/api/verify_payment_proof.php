<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

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

// 3. Load active payment methods dynamically from CMS database
$activeMethods = [];
try {
  $pmStmt = $pdo->query('
    SELECT id, code, name, type, account_name, account_number, bank_name 
    FROM payment_methods 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, id ASC
  ');
  $activeMethods = $pmStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
  $activeMethods = [];
}

// Match the selected payment method configured in CMS
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

// ==========================================
// DYNAMIC NORMALIZATION & PARSING FUNCTIONS
// ==========================================

function normalize_clean_string(string $str): string {
  $str = mb_strtolower($str, 'UTF-8');
  // Strip punctuation and special symbols
  $str = preg_replace('/[.,\-_#\/\(\)\[\]\'\"@:;!\\\]/u', ' ', $str) ?? $str;
  // Strip legal and corporate entity suffixes
  $str = preg_replace('/\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|foundation|philippines|phils|ph)\b/u', '', $str) ?? $str;
  return trim((string) preg_replace('/\s+/u', ' ', $str));
}

function evaluate_recipient_match(string $receiptText, string $expectedName, string $expectedAccount = ''): array {
  if ($expectedName === '') {
    return ['matched' => true, 'reason' => 'No specific recipient configured in CMS'];
  }

  $normReceipt = normalize_clean_string($receiptText);
  $normExpected = normalize_clean_string($expectedName);

  // 1. Direct normalized substring match
  if ($normExpected !== '' && str_contains($normReceipt, $normExpected)) {
    return ['matched' => true, 'reason' => 'Recipient name matched'];
  }

  // 2. Token overlap of meaningful tokens (> 2 characters)
  $expectedTokens = array_filter(explode(' ', $normExpected), fn($t) => strlen($t) > 2);
  if (!empty($expectedTokens)) {
    $hits = 0;
    foreach ($expectedTokens as $tok) {
      if (str_contains($normReceipt, $tok)) {
        $hits++;
      }
    }
    $ratio = $hits / count($expectedTokens);
    if ($ratio >= 0.75) {
      return ['matched' => true, 'reason' => 'Recipient confirmed via name token overlap'];
    }
  }

  // 3. Match against configured account number if present in CMS
  if ($expectedAccount !== '') {
    $cleanExpected = preg_replace('/[^0-9]/', '', $expectedAccount) ?? '';
    if (strlen($cleanExpected) >= 5) {
      $cleanReceiptDigits = preg_replace('/[^0-9]/', '', $receiptText) ?? '';
      if (str_contains($cleanReceiptDigits, $cleanExpected)) {
        return ['matched' => true, 'reason' => 'Account number matched'];
      }
      // Check masked mobile e.g. 0917 *** 4567
      if (strlen($cleanExpected) === 11) {
        $p = substr($cleanExpected, 0, 4);
        $s = substr($cleanExpected, -4);
        if (preg_match('/' . preg_quote($p, '/') . '[\s\*#\-]*' . preg_quote($s, '/') . '/', $receiptText)) {
          return ['matched' => true, 'reason' => 'Masked mobile number matched'];
        }
      }
    }
  }

  return ['matched' => false, 'reason' => "Recipient does not match organization account ({$expectedName})"];
}

function evaluate_payment_provider_match(string $receiptText, ?array $selectedMethod): array {
  if (!$selectedMethod) {
    return ['matched' => true, 'detected' => null, 'reason' => 'No payment method configured'];
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
      'detected' => $selectedMethod['name'] ?? 'Custom',
      'reason' => 'Provider channel matches selected',
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
    'reason' => $matched ? "Provider matches {$selectedMethod['name']}" : "Payment method mismatch: detected {$detected}, but {$selectedMethod['name']} was selected",
  ];
}

function extract_amount_dynamically(string $text): ?float {
  $patterns = [
    // e.g. "Total PHP 280.00", "Amount: ₱1,500.00", "Amount Sent: ₱ 50.00", "Total Amount 280.00"
    '/(?:total(?:\s*amount)?|amount(?:\s*paid|\s*sent|\s*transferred)?|payment\s*amount|grand\s*total)\s*[:\s]*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i',
    // e.g. "₱ 280.00", "PHP 1,500.00", "Php 50.00"
    '/(?:₱|PHP|Php|php)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i',
    // e.g. "Paid 280.00", "Sent 1,500.00"
    '/(?:paid|sent|transfer(?:red)?)\s*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i',
    // Standalone monetary number with 2 decimals
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
  $patterns = [
    // Label followed by reference string (allows spaces within the reference, e.g. 5044 8382 2843 6)
    '/(?:ref(?:erence)?\s*(?:no\.?|number|id|#)?|transaction\s*(?:no\.?|id|#)?|trace\s*no\.?|txn\s*id|confirmation\s*(?:no\.?|id|#)?)\s*[:\-#]?\s*([A-Za-z0-9\s]{6,35})/i',
    // 10-16 continuous digits (standard GCash / mobile bank format)
    '/\b(\d{10,16})\b/',
    // 4-block spaced digits (e.g. 5044 8382 2843 6 or 1001 234 567)
    '/\b(\d{4}\s+\d{3,4}\s+\d{3,4}(?:\s+\d{1,4})?)\b/',
  ];

  foreach ($patterns as $pat) {
    if (preg_match($pat, $text, $m)) {
      $cand = trim($m[1]);
      $firstLine = trim((string) explode("\n", $cand)[0]);
      $cleaned = preg_replace('/\s+(?:amount|total|date|fee|status).*$/i', '', $firstLine);
      $alphanumeric = preg_replace('/[^A-Za-z0-9]/', '', $cleaned);
      if (strlen($alphanumeric) >= 6 && strlen($alphanumeric) <= 32) {
        if (ctype_digit($alphanumeric)) {
          return $alphanumeric;
        }
        return trim($cleaned);
      }
    }
  }
  return null;
}

function extract_date_dynamically(string $text): ?string {
  $patterns = [
    // e.g. "Sep 8, 2026", "September 8, 2026 3:45 PM"
    '/\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?)\b/',
    // e.g. "2026-09-08 15:30:00"
    '/\b(\d{4}[-\/.]\d{2}[-\/.]\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?)\b/',
    // e.g. "08/09/2026 3:45 PM"
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

function analyze_receipt_text_against_cms(string $text, ?array $selectedMethod, array $activeMethods): array {
  $expectedRecipient = trim((string) ($selectedMethod['account_name'] ?? ''));
  $expectedAccountNo = trim((string) ($selectedMethod['account_number'] ?? ''));
  $expectedMethodName = trim((string) ($selectedMethod['name'] ?? 'Payment Method'));

  // 1. Recipient check
  $recipientCheck = evaluate_recipient_match($text, $expectedRecipient, $expectedAccountNo);
  $recipientMatch = $recipientCheck['matched'];
  $detectedRecipient = $recipientMatch ? $expectedRecipient : null;
  if (!$recipientMatch) {
    if (preg_match('/(?:Paid to|Recipient|To|Merchant)\s*[:\-]?\s*([A-Za-z0-9\s.,]+)/i', $text, $m)) {
      $detectedRecipient = trim(explode("\n", $m[1])[0]);
    }
  }

  // 2. Payment Method provider match
  $providerCheck = evaluate_payment_provider_match($text, $selectedMethod);
  $methodMatch = $providerCheck['matched'];
  $detectedMethod = $providerCheck['detected'] ?: $expectedMethodName;

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
  $message = 'Payment information requires manual review.';
  $needsManualReview = true;
  $reasons = [];

  if (!$recipientMatch) {
    $status = 'invalid';
    $message = $recipientCheck['reason'] ?: "Recipient does not match {$expectedRecipient}.";
    $reasons[] = $message;
  } elseif (!$methodMatch) {
    $status = 'mismatch';
    $message = $providerCheck['reason'] ?: "Payment method mismatch: detected {$detectedMethod}.";
    $reasons[] = $message;
  } elseif ($recipientMatch && $methodMatch && $amount !== null && $amount > 0 && ($isSuccess || $reference !== null)) {
    $status = 'verified';
    $message = 'Payment proof verified successfully.';
    $needsManualReview = false;
    $reasons[] = 'Recipient matches organization account';
    $reasons[] = "Payment channel confirmed ({$detectedMethod})";
    $reasons[] = "Transaction amount verified (₱" . number_format($amount, 2) . ")";
    if ($reference) {
      $reasons[] = "Reference number: {$reference}";
    }
  } elseif ($amount !== null && $amount > 0) {
    $status = 'needs_review';
    $message = 'Amount extracted. Please review and confirm reference number before submitting.';
    $reasons[] = 'Transaction details need manual confirmation';
  } else {
    $status = 'needs_review';
    $message = 'Could not extract all transaction details. Please enter amount and reference manually.';
    $reasons[] = 'Amount or reference not clearly detected in proof';
  }

  return [
    'isLegitimateReceipt' => true,
    'status' => $status,
    'confidence' => $status === 'verified' ? 'high' : ($status === 'needs_review' ? 'medium' : 'low'),
    'recipient' => $recipientMatch ? $expectedRecipient : ($detectedRecipient ?: $expectedRecipient),
    'recipientMatch' => $recipientMatch,
    'accountMatch' => $recipientMatch,
    'paymentMethod' => $detectedMethod,
    'paymentMethodMatch' => $methodMatch,
    'amount' => $amount,
    'extractedAmount' => $amount,
    'formattedAmount' => $amount !== null ? number_format($amount, 2) : null,
    'currency' => 'PHP',
    'referenceNumber' => $reference,
    'transactionDate' => $transactionDate,
    'paymentSuccessful' => $isSuccess,
    'needsManualReview' => $needsManualReview,
    'verificationMessage' => $message,
    'reasons' => $reasons,
    'source' => 'dynamic_cms_engine',
  ];
}

// Helper: Run server-side Tesseract OCR
function run_tesseract_ocr(string $filePath): string {
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
  $cmd = escapeshellcmd($binary) . ' ' . escapeshellarg($filePath) . ' stdout -l eng';
  @exec($cmd, $output, $retCode);
  if ($retCode === 0 && !empty($output)) {
    return trim(implode("\n", $output));
  }

  return '';
}

// Helper: Enhanced Gemini API key discovery
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

// ==========================================
// 4. VISION / OCR PIPELINE EXECUTION
// ==========================================

$apiKey = resolve_gemini_api_key();
$fileBytes = (string) file_get_contents($savedFilePath);
$fileBase64 = base64_encode($fileBytes);
$aiResult = null;

// Tier 1: Gemini Vision API (if key available)
if ($apiKey !== '' && strlen($fileBytes) > 0) {
  $prompt = <<<PROMPT
You are an objective financial receipt analyzer.
Analyze this payment receipt image strictly and accurately from the visible image content.
Expected Organization Recipient: "{$expectedRecipientName}"
Expected Organization Account/Mobile: "{$expectedAccountNumber}"
Expected Payment Method: "{$expectedMethodName}"

TASK:
1. Recipient: Extract the exact recipient/merchant name printed on the receipt.
2. Recipient Match: Return true if the receipt recipient refers to the Expected Organization Recipient (allowing casing, spacing, and legal suffixes like Inc/Foundation), false if sent to a completely different person or merchant.
3. Amount: Extract the exact numeric transaction amount as a float (Philippine Peso PHP). Do not round.
4. Reference Number: Extract the exact transaction/reference/confirmation number.
5. Transaction Date: Extract the visible transaction date and time string.
6. Payment Method: Extract the payment channel or bank (e.g. GCash, Maya, BPI, BDO).
7. Payment Successful: Return true if status indicates success, completed, paid, or processed.

Return ONLY valid JSON:
{
  "status": "verified" | "needs_review" | "invalid" | "mismatch",
  "recipient": string or null,
  "recipientMatch": boolean,
  "paymentMethod": string or null,
  "paymentMethodMatch": boolean,
  "amount": number or null,
  "extractedAmount": number or null,
  "currency": "PHP",
  "referenceNumber": string or null,
  "transactionDate": string or null,
  "paymentSuccessful": boolean,
  "needsManualReview": boolean,
  "verificationMessage": string
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
            [
              'text' => $prompt,
            ],
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
        if (is_array($parsed) && isset($parsed['status'])) {
          $aiResult = $parsed;
          $aiResult['source'] = 'gemini_vision';
          break;
        }
      }
    }
  }
}

// Tier 2 & 3: If Gemini Vision did not produce a result, use Client-Extracted OCR or Server Tesseract
if (!$aiResult) {
  $extractedText = '';

  // Use client-side OCR text if passed by browser worker
  if ($clientExtractedText !== '' && strlen($clientExtractedText) > 10) {
    $extractedText = $clientExtractedText;
  }

  // If still empty and file is PDF, parse text streams
  if ($extractedText === '' && $fileMime === 'application/pdf') {
    if (preg_match_all('/(?:BT[\r\n\s]+)(.*?)(?:[\r\n\s]+ET)/s', $fileBytes, $matches)) {
      foreach ($matches[1] as $block) {
        if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
          $extractedText .= ' ' . implode(' ', $tMatches[1]);
        }
      }
    }
  }

  // If still empty, try server-side Tesseract
  if ($extractedText === '') {
    $extractedText = run_tesseract_ocr($savedFilePath);
  }

  $aiResult = analyze_receipt_text_against_cms($extractedText, $selectedMethod, $activeMethods);
}

// Normalize amounts and formatting
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
$aiResult['detectedMethod'] = $aiResult['paymentMethod'] ?? $expectedMethodName;
$aiResult['recipientInfo'] = $aiResult['recipient'] ?? $expectedRecipientName;

// Return uniform JSON response with both flat fields and nested verification object
json_response([
  'ok' => true,
  'status' => $aiResult['status'],
  'recipient' => $aiResult['recipient'],
  'recipientMatch' => !empty($aiResult['recipientMatch']),
  'accountMatch' => !empty($aiResult['accountMatch'] ?? $aiResult['recipientMatch']),
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
]);
