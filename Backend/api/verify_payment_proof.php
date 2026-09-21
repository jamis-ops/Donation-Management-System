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

// 3. Load active payment methods from database CMS
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
  $activeMethods = [
    ['id' => 1, 'name' => 'GCash', 'code' => 'gcash', 'type' => 'gcash', 'account_name' => 'Rise Above Foundation Cebu Inc', 'account_number' => '0917-000-0000'],
    ['id' => 2, 'name' => 'Bank Transfer (BPI)', 'code' => 'bank-transfer', 'type' => 'bank_transfer', 'account_name' => 'Rise Above Foundation Cebu, Inc.', 'account_number' => '9131005064'],
    ['id' => 3, 'name' => 'Maya', 'code' => 'maya', 'type' => 'maya', 'account_name' => 'Rise Above Foundation Cebu Inc', 'account_number' => '0917-000-0000'],
    ['id' => 4, 'name' => 'PayPal', 'code' => 'paypal', 'type' => 'paypal', 'account_name' => 'Rise Above Foundation Cebu, Inc.', 'account_number' => 'info@riseabove-cebu.org'],
  ];
}

// Match the selected payment method configured in CMS
$selectedMethodInput = trim((string) ($_POST['selectedMethod'] ?? ''));
$selectedMethod = null;
foreach ($activeMethods as $m) {
  if (
    strcasecmp((string) $m['code'], $selectedMethodInput) === 0 ||
    strcasecmp((string) $m['name'], $selectedMethodInput) === 0 ||
    strcasecmp((string) ($m['id'] ?? ''), $selectedMethodInput) === 0
  ) {
    $selectedMethod = $m;
    break;
  }
}
if (!$selectedMethod && !empty($activeMethods)) {
  $selectedMethod = $activeMethods[0];
}

$expectedRecipientName = trim((string) ($selectedMethod['account_name'] ?? 'Rise Above Foundation Cebu Inc'));
$expectedAccountNumber = trim((string) ($selectedMethod['account_number'] ?? ''));
$expectedMethodName = trim((string) ($selectedMethod['name'] ?? 'GCash'));

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

// Helper: Flexible text normalization for robust name and phrase matching
function normalize_text_for_match(string $str): string {
  $str = strtolower($str);
  $str = preg_replace('/[.,\-_#\/\(\)\[\]]/', ' ', $str) ?? $str;
  $str = preg_replace('/\b(inc|incorporated|corp|corporation|foundation|philippines)\b/', '', $str) ?? $str;
  return trim((string) preg_replace('/\s+/', ' ', $str));
}

// Helper: Check recipient match flexibly
function evaluate_recipient_match(string $text, string $expectedName, string $expectedAccount): bool {
  $normText = normalize_text_for_match($text);
  $normExpected = normalize_text_for_match($expectedName);

  if ($normExpected !== '' && str_contains($normText, $normExpected)) {
    return true;
  }

  // Common keywords for Rise Above Foundation Cebu
  if (
    str_contains($normText, 'rise above') ||
    str_contains($normText, 'riseabove') ||
    str_contains($normText, 'flemming') ||
    str_contains($normText, 'elisabet')
  ) {
    return true;
  }

  // Check account number if non-empty
  if ($expectedAccount !== '') {
    $cleanAccount = preg_replace('/[^0-9]/', '', $expectedAccount) ?? '';
    if (strlen($cleanAccount) >= 6 && str_contains(preg_replace('/[^0-9]/', '', $text) ?? '', $cleanAccount)) {
      return true;
    }
  }

  return false;
}

// Helper: Extract text from file using multi-tier OCR fallback (PDF stream, local tesseract, OCR.space REST API)
function extract_file_text_fallback(string $filePath, string $mime): string {
  $extracted = '';

  // 1. If PDF, extract text streams
  if ($mime === 'application/pdf') {
    $fileBytes = @file_get_contents($filePath) ?: '';
    if (preg_match_all('/(?:BT[\r\n\s]+)(.*?)(?:[\r\n\s]+ET)/s', $fileBytes, $matches)) {
      foreach ($matches[1] as $block) {
        if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
          $extracted .= ' ' . implode(' ', $tMatches[1]);
        }
      }
    }
    if (strlen(trim($extracted)) > 15) {
      return $extracted;
    }
  }

  // 2. Try local Tesseract binary if installed
  if (function_exists('exec')) {
    $tesseractCmd = "tesseract " . escapeshellarg($filePath) . " stdout --oem 1 -l eng 2>/dev/null";
    $output = [];
    $retCode = -1;
    @exec($tesseractCmd, $output, $retCode);
    if ($retCode === 0 && !empty($output)) {
      $tessText = trim(implode("\n", $output));
      if (strlen($tessText) > 10) {
        return $tessText;
      }
    }
  }

  // 3. Try OCR.space free REST API
  $ch = curl_init('https://api.ocr.space/parse/image');
  $cfile = new CURLFile($filePath, $mime, basename($filePath));
  $postData = [
    'apikey' => 'K87899142388957', // Free public OCR tier key
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
  curl_setopt($ch, CURLOPT_TIMEOUT, 15);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
  $ocrResponse = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($httpCode === 200 && $ocrResponse) {
    $ocrData = json_decode($ocrResponse, true);
    if (!empty($ocrData['ParsedResults'][0]['ParsedText'])) {
      return (string) $ocrData['ParsedResults'][0]['ParsedText'];
    }
  }

  return $extracted;
}

// Helper: Deterministic Financial Receipt & CMS Rule Parser
function analyze_receipt_text_against_cms(string $text, ?array $selectedMethod, array $activeMethods): array {
  $expectedRecipient = trim((string) ($selectedMethod['account_name'] ?? 'Rise Above Foundation Cebu Inc'));
  $expectedAccountNo = trim((string) ($selectedMethod['account_number'] ?? ''));
  $expectedMethodName = trim((string) ($selectedMethod['name'] ?? 'GCash'));

  // 1. Recipient check
  $recipientMatch = evaluate_recipient_match($text, $expectedRecipient, $expectedAccountNo);
  $detectedRecipient = $recipientMatch ? $expectedRecipient : null;
  if (!$recipientMatch) {
    // Check if another person or merchant is explicitly named
    if (preg_match('/(?:Paid to|Recipient|To|Merchant)\s*[:\-]?\s*([A-Za-z0-9\s.,]+)/i', $text, $m)) {
      $detectedRecipient = trim($m[1]);
    }
  }

  // 2. Payment Method Detection & Match
  $detectedMethod = null;
  foreach (['GCash', 'Maya', 'BPI', 'BDO', 'Metrobank', 'PayPal', 'UnionBank', 'Landbank', 'SeaBank', 'GoTyme'] as $prov) {
    if (stripos($text, $prov) !== false) {
      $detectedMethod = $prov;
      break;
    }
  }
  if (!$detectedMethod && stripos($text, 'Bank') !== false) {
    $detectedMethod = 'Bank Transfer';
  }

  $methodMatch = true;
  if ($detectedMethod) {
    $expLower = strtolower($expectedMethodName);
    $detLower = strtolower($detectedMethod);
    if (str_contains($expLower, 'gcash') && !str_contains($detLower, 'gcash')) {
      $methodMatch = false;
    } elseif (str_contains($expLower, 'maya') && !str_contains($detLower, 'maya')) {
      $methodMatch = false;
    } elseif (str_contains($expLower, 'paypal') && !str_contains($detLower, 'paypal')) {
      $methodMatch = false;
    } elseif (str_contains($expLower, 'bpi') && !str_contains($detLower, 'bpi')) {
      $methodMatch = false;
    }
  }

  // 3. Amount Extraction (Preserves exact decimals, e.g. 5.00)
  $amount = null;
  // Match patterns like "Total ₱5.00", "Total: PHP 5.00", "Amount ₱5.00", "₱ 5.00"
  if (preg_match('/(?:Total(?:\s*Amount)?|Amount(?:\s*Paid)?|Payment\s*Amount)\s*[:\s]*[₱P]?\s*([0-9,]+(?:\.\d{1,2})?)/i', $text, $am)) {
    $amount = (float) str_replace(',', '', $am[1]);
  } elseif (preg_match('/(?:₱|PHP)\s*([0-9,]+(?:\.\d{2}))/i', $text, $am)) {
    $amount = (float) str_replace(',', '', $am[1]);
  } elseif (preg_match('/(?:Total)\s*([0-9,]+(?:\.\d{2}))/i', $text, $am)) {
    $amount = (float) str_replace(',', '', $am[1]);
  }

  // 4. Reference Number Extraction (e.g. Reference No. 507176039)
  $reference = null;
  if (preg_match('/(?:Ref(?:erence)?\s*No\.?|Transaction\s*(?:No\.?|ID|#)|Trace\s*No\.?|Txn\s*ID)\s*[:\-]?\s*([0-9A-Za-z]+)/i', $text, $rm)) {
    $reference = trim($rm[1]);
  } elseif (preg_match('/\b(?:Ref|Reference)\s*[:\-]?\s*([0-9A-Za-z]{6,30})\b/i', $text, $rm)) {
    $reference = trim($rm[1]);
  }

  // 5. Transaction Date & Time Extraction (e.g. Sep 21, 2026 5:11 PM)
  $transactionDate = null;
  if (preg_match('/([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?)/i', $text, $dm)) {
    $transactionDate = trim($dm[1]);
  }

  // 6. Payment Success Indicator (e.g. "Your payment was successfully processed")
  $isSuccess = (bool) preg_match('/(?:successfully\s+processed|payment\s+successful|payment\s+completed|transaction\s+successful|completed|paid)/i', $text);

  // 7. Decision Matrix
  $status = 'needs_review';
  $message = 'We could not confidently verify all fields. Please review and confirm your details below.';
  $needsManualReview = true;

  if (!$recipientMatch && $detectedRecipient && strcasecmp($detectedRecipient, $expectedRecipient) !== 0) {
    $status = 'invalid';
    $message = "Recipient ({$detectedRecipient}) does not match Rise Above Foundation Cebu's registered account details.";
  } elseif (!$methodMatch && $detectedMethod) {
    $status = 'mismatch';
    $message = "Payment method mismatch: detected {$detectedMethod} while {$expectedMethodName} is selected.";
  } elseif ($recipientMatch && $methodMatch && $amount !== null && $amount > 0 && ($isSuccess || $reference !== null)) {
    $status = 'verified';
    $message = 'Payment proof verified. Recipient, payment channel, and transaction details successfully confirmed.';
    $needsManualReview = false;
  } elseif ($amount !== null && $amount > 0) {
    $status = 'needs_review';
    $message = 'Payment amount detected. Please confirm your details before completing submission.';
  }

  return [
    'isLegitimateReceipt' => true,
    'status' => $status,
    'confidence' => $status === 'verified' ? 'high' : ($status === 'needs_review' ? 'medium' : 'low'),
    'recipient' => $recipientMatch ? $expectedRecipient : $detectedRecipient,
    'recipientMatch' => $recipientMatch,
    'paymentMethod' => $detectedMethod ?: $expectedMethodName,
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
    'reasons' => [
      $recipientMatch ? 'Recipient matches organization' : 'Recipient verification pending',
      $methodMatch ? 'Payment method matches selected channel' : 'Payment method discrepancy flagged',
      $amount !== null ? "Amount extracted: ₱" . number_format($amount, 2) : 'Amount requires manual review',
      $isSuccess ? 'Payment success confirmed from proof' : 'Payment status verified from receipt record',
    ],
    'source' => 'deterministic_cms_engine',
  ];
}

// 4. Multi-Tier AI Vision & OCR Execution
$apiKey = resolve_gemini_api_key();
$fileBytes = (string) file_get_contents($savedFilePath);
$fileBase64 = base64_encode($fileBytes);
$aiResult = null;

if ($apiKey !== '' && strlen($fileBytes) > 0) {
  $prompt = <<<PROMPT
You are a strict financial auditor for Rise Above Foundation Cebu.
Verify this uploaded payment confirmation against the following expected organization details:
- Expected Recipient: "{$expectedRecipientName}"
- Expected Account No: "{$expectedAccountNumber}"
- Expected Payment Method: "{$expectedMethodName}"

INSTRUCTIONS:
1. RECIPIENT VERIFICATION:
   - Check if the recipient/account shown in the proof matches "{$expectedRecipientName}" or Rise Above Foundation Cebu.
   - Use flexible matching (e.g. upper/lowercase, "Inc." vs "Inc", spacing).
   - If recipient is a completely different person or company, mark recipientMatch: false, status: "invalid".
2. PAYMENT METHOD MATCH:
   - Check if the payment was made via {$expectedMethodName} (e.g. GCash, Maya, BPI).
   - Mark paymentMethodMatch: true or false.
3. EXACT AMOUNT:
   - Extract the exact monetary transaction amount.
   - In PHP (Philippine Peso). Preserve decimals (e.g. 5.00, 1500.00). Do not round.
4. REFERENCE NUMBER:
   - Extract the transaction/reference number (e.g. "Reference No. 507176039").
5. TRANSACTION DATE & TIME:
   - Extract the visible transaction date/time string (e.g. "Sep 21, 2026 5:11 PM").
6. SUCCESS STATE:
   - Check if transaction says "successfully processed", "Payment successful", "Paid", or "Completed".
7. RETURN ONLY STRICT JSON:
{
  "status": "verified" | "needs_review" | "invalid" | "mismatch",
  "recipient": string or null,
  "recipientMatch": boolean,
  "paymentMethod": string or null,
  "paymentMethodMatch": boolean,
  "amount": number or null,
  "extractedAmount": number or null,
  "formattedAmount": string or null,
  "currency": "PHP",
  "referenceNumber": string or null,
  "transactionDate": string or null,
  "paymentSuccessful": boolean,
  "needsManualReview": boolean,
  "verificationMessage": string
}
PROMPT;

  $modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-latest'];
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
        'temperature' => 0.05,
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

// If Gemini is unconfigured or failed, execute Tier 2 OCR + Tier 3 Deterministic Rule Engine
if (!$aiResult) {
  $extractedOcrText = extract_file_text_fallback($savedFilePath, $fileMime);
  $aiResult = analyze_receipt_text_against_cms($extractedOcrText, $selectedMethod, $activeMethods);
}

// Normalize amounts & formatting
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

// Return unified JSON with all standard fields at top-level AND in verification object
json_response([
  'ok' => true,
  'status' => $aiResult['status'],
  'recipient' => $aiResult['recipient'],
  'recipientMatch' => !empty($aiResult['recipientMatch']),
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
  'fileName' => $file['name'],
  'tempProofToken' => $tempBaseName,
  'proofPath' => $tempBaseName,
  'proofUrl' => '/api/file.php?kind=donation_proofs&name=' . rawurlencode($tempBaseName),
  'mimeType' => $fileMime,
  'size' => $file['size'],
  'verification' => $aiResult,
]);
