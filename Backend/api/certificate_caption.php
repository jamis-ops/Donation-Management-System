<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$user = require_auth(['Admin', 'Staff']);
$method = request_method();

if ($method !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$body = read_json_body();

$recipient = trim((string) ($body['recipient'] ?? 'Valued Supporter'));
$recipientType = trim((string) ($body['recipientType'] ?? 'Donor'));
$contributionType = trim((string) ($body['contributionType'] ?? 'Monetary Donation'));
$amount = trim((string) ($body['amount'] ?? ''));
$items = trim((string) ($body['items'] ?? ''));
$hours = trim((string) ($body['hours'] ?? ''));
$program = trim((string) ($body['program'] ?? 'community empowerment and outreach programs'));
$reference = trim((string) ($body['reference'] ?? ''));
$date = trim((string) ($body['date'] ?? date('F j, Y')));
$tone = trim((string) ($body['tone'] ?? 'Professional'));
$instruction = trim((string) ($body['instruction'] ?? ''));
$hasPhoto = !empty($body['hasPhoto']);

function build_smart_caption(
  string $recipient,
  string $recipientType,
  string $contributionType,
  string $amount,
  string $items,
  string $hours,
  string $program,
  string $reference,
  string $date,
  string $tone,
  string $instruction,
  bool $hasPhoto
): array {
  $normType = strtolower($contributionType);
  $normTone = strtolower($tone);
  $instLower = strtolower($instruction);

  // Determine contribution phrase
  $contribPhrase = '';
  if (str_contains($normType, 'money') || str_contains($normType, 'monetary') || $amount !== '') {
    $contribPhrase = $amount !== '' 
      ? "your generous monetary donation of {$amount}" . ($reference ? " (Ref: {$reference})" : "")
      : "your benevolent financial contribution";
  } elseif (str_contains($normType, 'kind') || $items !== '') {
    $contribPhrase = $items !== ''
      ? "your compassionate in-kind contribution of {$items}" . ($reference ? " (Ref: {$reference})" : "")
      : "your essential in-kind contribution";
  } elseif (str_contains($normType, 'volunteer') || str_contains($normType, 'service') || $hours !== '') {
    $hourText = ($hours !== '' && $hours !== '0') ? " involving {$hours}" : "";
    $contribPhrase = "your selfless and dedicated volunteer service{$hourText}";
  } elseif (str_contains($normType, 'medical') || str_contains($normType, 'dental')) {
    $contribPhrase = "your invaluable professional medical and dental service to underserved families";
  } elseif (str_contains($normType, 'disaster') || str_contains($normType, 'relief')) {
    $contribPhrase = "your vital assistance and compassionate disaster relief support";
  } else {
    $contribPhrase = "your remarkable generosity and continuous support";
  }

  // Adjust for tone
  $lead = "In grateful recognition of {$contribPhrase} to the {$program} of Rise Above Foundation Cebu, Inc.";
  $bodyText = "Your unwavering commitment provides hope, sustenance, and tangible resources to underprivileged children and families across Cebu.";
  $closing = "With our highest esteem and heartfelt appreciation, we commend your dedication to humanitarian service and community building.";

  if (str_contains($normTone, 'heartfelt') || str_contains($instLower, 'heartfelt')) {
    $lead = "With deepest gratitude and warmth, we honor {$contribPhrase} to the {$program} of Rise Above Foundation Cebu.";
    $bodyText = "Through your kindness and empathy, you bring comfort, nourishment, and a brighter tomorrow to vulnerable families during their times of greatest need.";
    $closing = "May your generosity inspire countless others. We thank you from the bottom of our hearts for making an indelible difference in the lives of our brothers and sisters.";
  } elseif (str_contains($normTone, 'formal') || str_contains($instLower, 'formal')) {
    $lead = "In official acknowledgment and highest commendation of {$contribPhrase}, rendered in support of the {$program}.";
    $bodyText = "This citation bears witness to your commendable civic virtue and indispensable partnership with Rise Above Foundation Cebu, Inc.";
    $closing = "In witness whereof, this certificate is formally conferred as an enduring symbol of our profound gratitude and distinction.";
  } elseif (str_contains($normTone, 'short') || str_contains($normTone, 'simple') || str_contains($instLower, 'short') || $hasPhoto) {
    $lead = "Presented in sincere appreciation of {$contribPhrase} in support of the {$program}.";
    $bodyText = "Your meaningful support directly empowers vulnerable communities and restores hope to Cebu families.";
    $closing = "Thank you for your partnership in uplifting lives.";
  } elseif (str_contains($normType, 'disaster') || str_contains($instLower, 'disaster')) {
    $lead = "In grateful acknowledgment of {$contribPhrase} following emergency disaster relief operations.";
    $bodyText = "Your swift generosity enabled the rapid delivery of vital aid, food provisions, and shelter support to displaced families in evacuation zones.";
    $closing = "We honor your profound solidarity and compassion in helping our community rebuild and recover.";
  } elseif (str_contains($normType, 'volunteer') || str_contains($normTone, 'volunteer')) {
    $lead = "Presented to {$recipient} in honoring {$contribPhrase} dedicated to the {$program}.";
    $bodyText = "Your hands-on compassion and tireless efforts have directly touched the lives of beneficiaries and energized our foundation's mission.";
    $closing = "We commend your noble spirit of volunteerism and lasting impact on the Cebu community.";
  }

  // Check if custom instruction requests specific mention
  if (!empty($instruction)) {
    if (str_contains($instLower, 'medical') && !str_contains($lead, 'medical')) {
      $bodyText .= " Your vital provision of medical supplies brings critical care to those who need it most.";
    } elseif (str_contains($instLower, 'disaster') && !str_contains($lead, 'disaster')) {
      $bodyText .= " Your rapid response has provided urgent relief and stability to communities affected by calamity.";
    } elseif (str_contains($instLower, 'education') || str_contains($instLower, 'scholar')) {
      $bodyText .= " Your contribution opens doors of opportunity and educational advancement for deserving youth.";
    }
  }

  $caption = "{$lead} {$bodyText} {$closing}";
  $shortCaption = "{$lead} {$closing}";

  return [
    'caption' => $caption,
    'shortCaption' => $shortCaption,
  ];
}

// Attempt Gemini AI if key exists
global $GEMINI_API_KEY;
$apiKey = !empty($GEMINI_API_KEY) ? trim((string)$GEMINI_API_KEY) : (getenv('GEMINI_API_KEY') ?: '');
$aiSuccess = false;
$resultCaption = '';
$resultShortCaption = '';
$source = 'smart_template';

if (!empty($apiKey)) {
  $models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  $prompt = <<<EOT
You are an expert certificate copywriter for Rise Above Foundation Cebu, Inc. (an established humanitarian NGO in Cebu, Philippines).
Generate a polished, professional certificate caption based on the following details:
- Recipient Name: {$recipient} ({$recipientType})
- Contribution Type: {$contributionType}
- Amount: {$amount}
- Items Donated: {$items}
- Volunteer Hours: {$hours}
- Program / Purpose: {$program}
- Reference Code: {$reference}
- Date: {$date}
- Desired Tone: {$tone}
- Admin Special Instruction: "{$instruction}"
- Has Photo Layout: {$hasPhoto}

Guidelines:
1. Caption must be inspiring, respectful, and well-balanced (around 2 to 4 sentences).
2. It must explicitly recognize their exact contribution (amount/items/volunteer hours/program).
3. Do not include markdown or quotes around the output.
4. Output in valid JSON format ONLY with two keys:
{
  "caption": "The full balanced certificate recognition paragraph (50-80 words)",
  "shortCaption": "A concise version (30-45 words) that works cleanly in certificate photo layouts without crowding"
}
EOT;

  foreach ($models as $model) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
    $payload = json_encode([
      'contents' => [
        [
          'parts' => [
            ['text' => $prompt]
          ]
        ]
      ],
      'generationConfig' => [
        'temperature' => 0.4,
        'responseMimeType' => 'application/json',
      ],
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => $payload,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => 6,
      CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && is_string($rawResponse)) {
      $json = json_decode($rawResponse, true);
      $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
      if (!empty($text)) {
        $parsed = json_decode($text, true);
        if (!empty($parsed['caption'])) {
          $resultCaption = trim((string)$parsed['caption']);
          $resultShortCaption = trim((string)($parsed['shortCaption'] ?? $resultCaption));
          $source = 'gemini_ai';
          $aiSuccess = true;
          break;
        }
      }
    }
  }
}

if (!$aiSuccess) {
  $smart = build_smart_caption(
    $recipient,
    $recipientType,
    $contributionType,
    $amount,
    $items,
    $hours,
    $program,
    $reference,
    $date,
    $tone,
    $instruction,
    $hasPhoto
  );
  $resultCaption = $smart['caption'];
  $resultShortCaption = $smart['shortCaption'];
}

json_response([
  'ok' => true,
  'data' => [
    'caption' => $resultCaption,
    'shortCaption' => $resultShortCaption,
    'tone' => $tone,
    'source' => $source,
  ],
]);
