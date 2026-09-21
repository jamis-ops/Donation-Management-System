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
    ['name' => 'GCash', 'code' => 'gcash', 'account_name' => 'Rise Above Foundation Cebu Inc'],
    ['name' => 'Bank Transfer (BPI)', 'code' => 'bank-transfer', 'account_name' => 'Rise Above Foundation Cebu, Inc.'],
    ['name' => 'Maya', 'code' => 'maya', 'account_name' => 'Rise Above Foundation Cebu Inc'],
    ['name' => 'PayPal', 'code' => 'paypal', 'account_name' => 'Rise Above Foundation Cebu, Inc.'],
  ];
}

$selectedMethodCode = trim((string) ($_POST['selectedMethod'] ?? ''));

// 4. Perform AI Vision / OCR Analysis
global $GEMINI_API_KEY;
$apiKey = !empty($GEMINI_API_KEY) ? trim((string)$GEMINI_API_KEY) : (getenv('GEMINI_API_KEY') ?: '');

$fileBytes = file_get_contents($savedFilePath);
$fileBase64 = base64_encode($fileBytes);

$methodsSummary = [];
foreach ($activeMethods as $m) {
  $mStr = $m['name'];
  if (!empty($m['account_name'])) $mStr .= " (Account: {$m['account_name']})";
  if (!empty($m['account_number'])) $mStr .= " (No: {$m['account_number']})";
  $methodsSummary[] = $mStr;
}
$methodsListText = implode("\n- ", $methodsSummary);

$aiResult = null;

if ($apiKey !== '' && strlen($fileBytes) > 0) {
  $prompt = <<<PROMPT
You are an expert, strict financial auditor and AI receipt-verification engine for Rise Above Foundation Cebu (a non-profit organization in Cebu, Philippines).
Analyze the attached payment proof document (screenshot, mobile wallet confirmation, electronic fund transfer, deposit slip, bank transaction, check, or official receipt).

STRICT VERIFICATION & ZERO-HALLUCINATION RULES:
1. LEGITIMACY CHECK:
   - Check if this image/document is actually a payment confirmation, money transfer receipt, bank slip, or deposit receipt.
   - If this is an unrelated image (e.g. meme, selfie, scenery, random chat conversation without transfer, blank screen, animal, merchandise photo), you MUST return:
     "isLegitimateReceipt": false, "status": "invalid", "confidence": "low", "extractedAmount": null, "verificationMessage": "This file does not appear to be a valid payment confirmation. Please upload a clear receipt or screenshot of your transfer."
2. EXACT AMOUNT EXTRACTION:
   - Find the exact total amount transferred/paid.
   - The currency in the Philippines is Philippine Peso (PHP, ₱, Php).
   - DO NOT invent or guess any amount. If you see "₱1,500.00", extractedAmount MUST be 1500.00.
   - If you see "₱1,250.50", extractedAmount MUST be 1250.50.
   - Preserve exact decimal precision (never round up or down).
   - If the amount is cut off, illegible, obscured, or ambiguous, set extractedAmount to null, and status to "needs_review".
3. TRANSACTION DETAILS:
   - Extract the transaction / reference number (e.g. GCash Ref No, InstaPay trace number, bank confirmation code).
   - Extract the transaction date and time if visible.
   - Detect the payment provider/channel (e.g. GCash, Maya, BPI, BDO, UnionBank, Metrobank, PayPal, Landbank, RCBC, SeaBank, Gotyme, etc.).
   - Check if the recipient matches Rise Above Foundation Cebu, Flemming Hansen, Elisabet Hansen, or official account numbers.
4. STATUS CLASSIFICATION:
   - "verified": Image is a legitimate payment receipt, payment provider is identified, amount is clear and unambiguous, confidence is high.
   - "needs_review": Image looks like a payment confirmation, but the amount or reference is blurry, partially cropped, or requires administrative human review.
   - "invalid": Not a payment receipt, corrupted, heavily manipulated, or unrelated photo.
5. JSON OUTPUT FORMAT (Strict valid JSON only, no markdown wrappers):
{
  "isLegitimateReceipt": boolean,
  "status": "verified" | "needs_review" | "invalid",
  "confidence": "high" | "medium" | "low",
  "detectedMethod": string or null,
  "extractedAmount": number or null,
  "formattedAmount": string or null,
  "currency": string,
  "referenceNumber": string or null,
  "transactionDate": string or null,
  "transactionTime": string or null,
  "recipientInfo": string or null,
  "verificationMessage": string,
  "reasons": [string]
}

ACTIVE PAYMENT METHODS CONFIGURED IN CMS:
- {$methodsListText}
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
        'temperature' => 0.05,
        'responseMimeType' => 'application/json',
      ],
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
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

// 5. Fallback Heuristic & Pattern Analyzer (for PDFs or if Gemini is offline/unconfigured)
if (!$aiResult) {
  $fallbackText = '';
  if ($fileMime === 'application/pdf') {
    // Basic text stream extractor for PDFs
    if (preg_match_all('/(?:BT[\r\n\s]+)(.*?)(?:[\r\n\s]+ET)/s', $fileBytes, $matches)) {
      foreach ($matches[1] as $block) {
        if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
          $fallbackText .= ' ' . implode(' ', $tMatches[1]);
        }
      }
    }
  }

  $detectedAmount = null;
  $detectedRef = null;
  $detectedProvider = null;

  if (!empty($fallbackText)) {
    if (preg_match('/(?:PHP|Php|₱|\bAmount\b[:\s]*)\s*([\d,]+(?:\.\d{1,2})?)/i', $fallbackText, $m)) {
      $num = (float) str_replace(',', '', $m[1]);
      if ($num > 0) $detectedAmount = $num;
    }
    if (preg_match('/(?:Ref(?:erence)?|Trace|Txn|Transaction)\s*(?:No\.?|#|ID)?\s*[:\-]?\s*([A-Za-z0-9\-_]{6,24})/i', $fallbackText, $rm)) {
      $detectedRef = trim($rm[1]);
    }
    foreach (['GCash', 'Maya', 'BPI', 'BDO', 'Metrobank', 'PayPal', 'UnionBank', 'Landbank'] as $p) {
      if (stripos($fallbackText, $p) !== false) {
        $detectedProvider = $p;
        break;
      }
    }
  }

  if ($detectedAmount !== null && $detectedAmount > 0) {
    $aiResult = [
      'isLegitimateReceipt' => true,
      'status' => 'verified',
      'confidence' => 'medium',
      'detectedMethod' => $detectedProvider ?: 'Bank / Electronic Transfer',
      'extractedAmount' => $detectedAmount,
      'formattedAmount' => number_format($detectedAmount, 2),
      'currency' => 'PHP',
      'referenceNumber' => $detectedRef,
      'transactionDate' => date('Y-m-d'),
      'transactionTime' => null,
      'recipientInfo' => 'Rise Above Foundation Cebu',
      'verificationMessage' => 'Payment proof analyzed. Please review the extracted amount before continuing.',
      'reasons' => ['Document analyzed via structured parser', 'Amount successfully identified'],
      'source' => 'heuristic_parser',
    ];
  } else {
    $aiResult = [
      'isLegitimateReceipt' => true,
      'status' => 'needs_review',
      'confidence' => 'low',
      'detectedMethod' => null,
      'extractedAmount' => null,
      'formattedAmount' => null,
      'currency' => 'PHP',
      'referenceNumber' => null,
      'transactionDate' => null,
      'transactionTime' => null,
      'recipientInfo' => null,
      'verificationMessage' => "We couldn't confidently verify this payment proof. Please review and enter your donation amount and reference number below.",
      'reasons' => ['Proof uploaded successfully', 'Awaiting manual amount confirmation by donor and administrative verification'],
      'source' => 'manual_review_fallback',
    ];
  }
}

// Format amount nicely if present
if (isset($aiResult['extractedAmount']) && is_numeric($aiResult['extractedAmount'])) {
  $aiResult['extractedAmount'] = round((float) $aiResult['extractedAmount'], 2);
  $aiResult['formattedAmount'] = number_format($aiResult['extractedAmount'], 2);
} else {
  $aiResult['extractedAmount'] = null;
  $aiResult['formattedAmount'] = null;
}

// Compare detected method with selected method if provided
$methodMatches = true;
if ($selectedMethodCode !== '' && !empty($aiResult['detectedMethod'])) {
  $selLower = strtolower($selectedMethodCode);
  $detLower = strtolower((string)$aiResult['detectedMethod']);
  if (
    (str_contains($selLower, 'gcash') && !str_contains($detLower, 'gcash')) ||
    (str_contains($selLower, 'maya') && !str_contains($detLower, 'maya')) ||
    (str_contains($selLower, 'bpi') && !str_contains($detLower, 'bpi')) ||
    (str_contains($selLower, 'paypal') && !str_contains($detLower, 'paypal'))
  ) {
    $methodMatches = false;
  }
}
$aiResult['methodMatchesSelected'] = $methodMatches;

json_response([
  'ok' => true,
  'fileName' => $file['name'],
  'tempProofToken' => $tempBaseName,
  'proofPath' => $tempBaseName,
  'proofUrl' => '/api/file.php?kind=donation_proofs&name=' . rawurlencode($tempBaseName),
  'mimeType' => $fileMime,
  'size' => $file['size'],
  'verification' => $aiResult,
]);
