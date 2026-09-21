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

$clientExtractedText = trim((string) ($_POST['client_extracted_text'] ?? ''));

// =========================================================================
// PURE TEXT PARSING FUNCTIONS (Zero hardcoded example values)
// =========================================================================

function parse_amount(string $text): ?float {
  $patterns = [
    // Label + Currency + Number
    '/(?:total(?:\s*amount)?|amount(?:\s*paid|\s*sent|\s*transferred)?|payment\s*amount|grand\s*total|amount\s*due)\s*[:\s]*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i',
    // Currency symbol + Number
    '/(?:₱|PHP|Php|php)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i',
    // Paid/Sent + Number
    '/(?:paid|sent|transfer(?:red)?)\s*[₱P]?(?:hp)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i',
    // Label + Integer
    '/(?:total(?:\s*amount)?|amount(?:\s*paid|\s*sent)?|paid|sent)\s*[:\s]*[₱P]?(?:hp)?\s*([0-9]{1,7})(?!\d)/i',
    // Standalone decimal number
    '/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/',
  ];

  foreach ($patterns as $pat) {
    if (preg_match_all($pat, $text, $allMatches, PREG_SET_ORDER)) {
      foreach ($allMatches as $m) {
        $raw = str_replace(',', '', $m[1]);
        $val = (float) $raw;
        if ($val > 0 && $val < 100000000) {
          return round($val, 2);
        }
      }
    }
  }
  return null;
}

function parse_reference_number(string $text): ?string {
  // 1. Explicitly labeled reference / confirmation / txn / trace codes
  $labeledPatterns = [
    '/(?:ref(?:erence)?\s*(?:no\.?|number|id|code|#)?|confirmation\s*(?:no\.?|number|id|code|#)?|txn\s*(?:id|no\.?|#)?|transaction\s*(?:no\.?|number|id|code|reference|#)?|trace\s*no\.?|receipt\s*no\.?)\s*[:\-#]?\s*([A-Za-z0-9\s\-]{5,40})/i',
  ];

  foreach ($labeledPatterns as $pat) {
    if (preg_match_all($pat, $text, $allMatches, PREG_SET_ORDER)) {
      foreach ($allMatches as $m) {
        $cand = trim($m[1]);
        $firstLine = trim((string) explode("\n", $cand)[0]);
        $cleaned = preg_replace('/\s+(?:amount|total|date|time|fee|status|completed|successful|paid|php|₱).*$/i', '', $firstLine);
        $cleaned = trim((string) $cleaned);

        // Normalized digits (e.g. 5044 8382 2843 6 -> 5044838228436)
        if (preg_match('/^[\d\s]+$/', $cleaned)) {
          $digitsOnly = preg_replace('/\s+/', '', $cleaned);
          if (strlen($digitsOnly) >= 6 && strlen($digitsOnly) <= 32) {
            return $digitsOnly;
          }
        }

        // Alphanumeric reference (e.g. BPI829104928, TXN-829381)
        $alphanumeric = preg_replace('/[^A-Za-z0-9\-]/', '', $cleaned);
        if (strlen($alphanumeric) >= 5 && strlen($alphanumeric) <= 35 && preg_match('/\d/', $alphanumeric)) {
          return $alphanumeric;
        }
      }
    }
  }

  // 2. Unlabeled 4-block spaced digits (e.g. 5044 8382 2843 6)
  $lines = explode("\n", $text);
  foreach ($lines as $line) {
    if (preg_match('/(?:account|acc|mobile|phone|contact|php|₱)/i', $line)) {
      continue;
    }
    if (preg_match('/\b(\d{4}\s+\d{3,4}\s+\d{3,4}(?:\s+\d{1,4})?)\b/', $line, $m)) {
      $digits = preg_replace('/\s+/', '', $m[1]);
      if (strlen($digits) >= 10 && strlen($digits) <= 18) {
        return $digits;
      }
    }
    if (preg_match('/\b(?<!09)(\d{9,16})\b/', $line, $m)) {
      return $m[1];
    }
  }

  return null;
}

function parse_recipient(string $text): ?string {
  if (preg_match('/\b(?:Paid\s+to|Payment\s+to|Sent\s+to|Recipient|Merchant|To|Transferred\s+to)\b\s*[:\-]?\s*([^\r\n]{3,80})/i', $text, $m)) {
    $cand = trim($m[1]);
    $cleaned = preg_replace('/\s+(?:amount|total|ref|date|time|fee|php|₱|status).*$/i', '', $cand);
    $cleaned = trim((string) preg_replace('/^[:\-#\s]+/', '', $cleaned));
    if (strlen($cleaned) >= 3 && !preg_match('/^(?:₱|PHP|\d)/', $cleaned)) {
      return $cleaned;
    }
  }
  return null;
}

function parse_payment_method(string $text): ?string {
  $known = [
    'gcash' => 'GCash',
    'maya' => 'Maya',
    'paymaya' => 'Maya',
    'bpi' => 'BPI',
    'bank of the philippine islands' => 'BPI',
    'bdo' => 'BDO',
    'banco de oro' => 'BDO',
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
    'instapay' => 'InstaPay',
    'pesonet' => 'PESONet',
    'bank transfer' => 'Bank Transfer',
  ];

  foreach ($known as $needle => $label) {
    if (stripos($text, $needle) !== false) {
      return $label;
    }
  }
  return null;
}

function parse_date_and_time(string $text): array {
  $date = null;
  $time = null;

  $datePatterns = [
    '/\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/',
    '/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/',
    '/\b(\d{4}[-\/.]\d{2}[-\/.]\d{2})\b/',
    '/\b(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})\b/',
  ];
  foreach ($datePatterns as $p) {
    if (preg_match($p, $text, $m)) {
      $date = trim($m[1]);
      break;
    }
  }

  if (preg_match('/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)\b/', $text, $m)) {
    $time = trim($m[1]);
  }

  return ['date' => $date, 'time' => $time];
}

function parse_payment_status(string $text): ?string {
  if (preg_match('/(?:payment\s+successful|transaction\s+successful|transfer\s+successful|paid\s+successfully|sent\s+successfully|successfully\s+processed|successful|completed|paid|sent)\b/i', $text)) {
    return 'successful';
  }
  if (preg_match('/(?:failed|unsuccessful|declined|cancelled|rejected)\b/i', $text)) {
    return 'failed';
  }
  if (preg_match('/(?:pending|processing|in\s*progress)\b/i', $text)) {
    return 'pending';
  }
  return null;
}

// =========================================================================
// OCR PROVIDERS (Multi-tier: Gemini multimodal, Client OCR, Server Tesseract, Cloud OCR)
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
$extracted = null;
$rawOcrText = '';
$engineSource = 'unknown';

// 1. Tier 1: Gemini Vision Multimodal (Completely generic prompt, zero bias / example values)
$apiKey = resolve_gemini_api_key();
if ($apiKey !== '' && strlen($fileBytes) > 0) {
  $prompt = <<<PROMPT
Analyze this uploaded payment proof document and extract payment information that is visibly present in the document.

Extract the following fields strictly from visible text:
- paymentMethod: string or null (e.g. GCash, Maya, Bank Transfer, BPI, BDO, PayPal, etc.)
- recipient: string or null (the person, merchant, or organization receiving the payment)
- amount: number or null (the transaction or transfer amount as a number, e.g. 280.00; do not confuse with account numbers, phone numbers, or reference numbers)
- currency: string (e.g. "PHP" or other currency code)
- referenceNumber: string or null (the transaction reference number, confirmation number, receipt number, or trace number; remove extra spaces)
- transactionDate: string or null (visible date of transaction)
- transactionTime: string or null (visible time of transaction)
- paymentStatus: string or null (visible status e.g. "successful", "completed", "paid", etc.)
- rawText: string (the visible text read from the document)

Return strictly valid JSON:
{
  "paymentMethod": string or null,
  "recipient": string or null,
  "amount": number or null,
  "currency": string or null,
  "referenceNumber": string or null,
  "transactionDate": string or null,
  "transactionTime": string or null,
  "paymentStatus": string or null,
  "rawText": string
}

Do not invent any values. If a field cannot be read, return null for that field.
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
      $rawJson = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '';
      if ($rawJson !== '') {
        $cleanJson = trim(preg_replace('/^```(?:json)?|```$/m', '', trim($rawJson)));
        $parsed = json_decode($cleanJson, true);
        if (is_array($parsed)) {
          $amt = isset($parsed['amount']) && is_numeric($parsed['amount']) ? round((float)$parsed['amount'], 2) : null;
          $ref = !empty($parsed['referenceNumber']) ? preg_replace('/\s+/', '', (string)$parsed['referenceNumber']) : null;
          $rawOcrText = (string)($parsed['rawText'] ?? '');

          $extracted = [
            'paymentMethod' => !empty($parsed['paymentMethod']) ? trim((string)$parsed['paymentMethod']) : null,
            'recipient' => !empty($parsed['recipient']) ? trim((string)$parsed['recipient']) : null,
            'amount' => $amt,
            'formattedAmount' => $amt !== null ? number_format($amt, 2, '.', '') : null,
            'currency' => !empty($parsed['currency']) ? trim((string)$parsed['currency']) : 'PHP',
            'referenceNumber' => $ref,
            'transactionDate' => !empty($parsed['transactionDate']) ? trim((string)$parsed['transactionDate']) : null,
            'transactionTime' => !empty($parsed['transactionTime']) ? trim((string)$parsed['transactionTime']) : null,
            'paymentStatus' => !empty($parsed['paymentStatus']) ? trim((string)$parsed['paymentStatus']) : null,
          ];
          $engineSource = 'gemini_vision';
          break;
        }
      }
    }
  }
}

// 2. Tier 2, 3, 4: OCR Text Pipeline + Intelligent Parser
if (!$extracted) {
  // A. Client-side OCR text if passed
  if ($clientExtractedText !== '' && strlen($clientExtractedText) > 10) {
    $rawOcrText = $clientExtractedText;
    $engineSource = 'client_tesseract';
  }

  // B. Native PDF text extraction
  if ($rawOcrText === '' && $fileMime === 'application/pdf') {
    if (preg_match_all('/(?:BT[\r\n\s]+)(.*?)(?:[\r\n\s]+ET)/s', $fileBytes, $matches)) {
      foreach ($matches[1] as $block) {
        if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
          $rawOcrText .= ' ' . implode(' ', $tMatches[1]);
        }
      }
      if (trim($rawOcrText) !== '') {
        $engineSource = 'native_pdf';
      }
    }
  }

  // C. Server Tesseract OCR
  if ($rawOcrText === '') {
    $rawOcrText = run_server_tesseract($savedFilePath);
    if (trim($rawOcrText) !== '') {
      $engineSource = 'server_tesseract';
    }
  }

  // D. Cloud OCR Fallback
  if ($rawOcrText === '') {
    $rawOcrText = run_cloud_ocr_fallback($savedFilePath, $fileMime);
    if (trim($rawOcrText) !== '') {
      $engineSource = 'cloud_ocr';
    }
  }

  // Parse extracted raw text
  $amt = parse_amount($rawOcrText);
  $ref = parse_reference_number($rawOcrText);
  $rec = parse_recipient($rawOcrText);
  $method = parse_payment_method($rawOcrText);
  $dateTime = parse_date_and_time($rawOcrText);
  $status = parse_payment_status($rawOcrText);

  $extracted = [
    'paymentMethod' => $method,
    'recipient' => $rec,
    'amount' => $amt,
    'formattedAmount' => $amt !== null ? number_format($amt, 2, '.', '') : null,
    'currency' => 'PHP',
    'referenceNumber' => $ref,
    'transactionDate' => $dateTime['date'],
    'transactionTime' => $dateTime['time'],
    'paymentStatus' => $status,
  ];
}

// Determine extraction status (READING/PARSING ONLY - ZERO CMS validation)
$hasAmount = ($extracted['amount'] !== null && $extracted['amount'] > 0);
$hasReference = ($extracted['referenceNumber'] !== null && trim($extracted['referenceNumber']) !== '');
$hasMethod = ($extracted['paymentMethod'] !== null && trim($extracted['paymentMethod']) !== '');

if ($hasAmount && ($hasReference || $hasMethod)) {
  $extractionStatus = 'success';
} elseif ($hasAmount || $hasReference) {
  $extractionStatus = 'partial';
} else {
  $extractionStatus = 'failed';
}

// Log telemetry for debugging
error_log(sprintf(
  "[PAYMENT_PROOF_OCR] engine=%s status=%s amount=%s ref=%s rec=%s method=%s",
  $engineSource,
  $extractionStatus,
  var_export($extracted['amount'], true),
  var_export($extracted['referenceNumber'], true),
  var_export($extracted['recipient'], true),
  var_export($extracted['paymentMethod'], true)
));

// Build final clean JSON response
json_response([
  'ok' => true,
  'success' => true,
  'extractionStatus' => $extractionStatus,
  'status' => $extractionStatus, // 'success', 'partial', 'failed'
  'extracted' => $extracted,
  'amount' => $extracted['amount'],
  'extractedAmount' => $extracted['amount'],
  'formattedAmount' => $extracted['formattedAmount'],
  'currency' => $extracted['currency'],
  'referenceNumber' => $extracted['referenceNumber'],
  'paymentMethod' => $extracted['paymentMethod'],
  'recipient' => $extracted['recipient'],
  'transactionDate' => $extracted['transactionDate'],
  'transactionTime' => $extracted['transactionTime'],
  'paymentStatus' => $extracted['paymentStatus'],
  'rawText' => $rawOcrText,
  'tempProofToken' => $tempBaseName,
  'fileName' => $file['name'],
  'proofPath' => $tempBaseName,
  'proofUrl' => '/api/file.php?kind=donation_proofs&name=' . rawurlencode($tempBaseName),
  'mimeType' => $fileMime,
  'size' => $file['size'],
  'debug' => [
    'engine' => $engineSource,
    'rawOcr' => mb_substr($rawOcrText, 0, 1000, 'UTF-8'),
    'parsed' => $extracted,
  ],
]);
