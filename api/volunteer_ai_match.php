<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = require_auth(['Admin', 'Staff']);
$pdo = db();

$volunteerId = isset($_GET['volunteerId']) ? (int) $_GET['volunteerId'] : (isset($_GET['id']) ? (int) $_GET['id'] : 0);
if ($volunteerId <= 0) {
  json_response(['ok' => false, 'error' => 'Volunteer / Intern ID is required'], 400);
}

$stmt = $pdo->prepare('SELECT * FROM volunteers WHERE id = ? LIMIT 1');
$stmt->execute([$volunteerId]);
$vol = $stmt->fetch();
if (!$vol) {
  json_response(['ok' => false, 'error' => 'Volunteer / Intern record not found'], 404);
}

// 1. Fetch available active programs from database
$programsStmt = $pdo->query("SELECT id, name, description FROM programs WHERE active = 1 ORDER BY id ASC");
$programRows = $programsStmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($programRows)) {
  $programRows = [
    ['name' => 'Medical and Dental Missions', 'description' => 'Medical checkups, dental triage, medication distribution.'],
    ['name' => 'Community Feeding & Nutrition Program', 'description' => 'Supplemental hot meal preparation, dietary education.'],
    ['name' => 'Educational Sponsorship & Youth Development', 'description' => 'Tutoring, student mentoring, academic literacy.'],
    ['name' => 'Disaster Relief and House Building Project', 'description' => 'Emergency packing, house reconstruction, logistics.'],
    ['name' => 'Family Hygiene & Preventive Health', 'description' => 'WASH training, hygiene kit distribution, health advocacy.'],
    ['name' => 'Livelihood & Skills Training', 'description' => 'Vocational training, business skills, handicraft workshops.'],
  ];
}

// Helper: Decode PDF ASCII85 Stream
function decode_pdf_ascii85_stream(string $in): string
{
  $out = '';
  $state = 0;
  $tuple = 0;
  $d = preg_replace('/<~|~>|\s+/', '', $in);
  $l = strlen($d);

  for ($i = 0; $i < $l; $i++) {
    $c = ord($d[$i]);
    if ($c === 122 && $state === 0) {
      $out .= "\0\0\0\0";
      continue;
    }
    if ($c < 33 || $c > 117) {
      continue;
    }
    $tuple = $tuple * 85 + ($c - 33);
    $state++;
    if ($state === 5) {
      $out .= pack('N', $tuple);
      $tuple = 0;
      $state = 0;
    }
  }
  if ($state > 0) {
    $tuple += 84;
    for ($i = 0; $i < 5 - $state - 1; $i++) {
      $tuple = $tuple * 85 + 84;
    }
    $bytes = pack('N', $tuple);
    $out .= substr($bytes, 0, $state - 1);
  }
  return $out;
}

// Helper: Parse ToUnicode CMap in PDF
function parse_pdf_cmap_stream(string $cmapData): array
{
  $map = [];
  if (preg_match_all('/(\d+)\s+beginbfrange(.*?)endbfrange/s', $cmapData, $bfranges)) {
    foreach ($bfranges[2] as $rangeBlock) {
      preg_match_all('/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+(?:<([0-9a-fA-F]+)>|\[(.*?)\])/s', $rangeBlock, $items, PREG_SET_ORDER);
      foreach ($items as $item) {
        $start = hexdec($item[1]);
        $end = hexdec($item[2]);
        if (isset($item[3]) && $item[3] !== '') {
          $destStart = hexdec($item[3]);
          for ($c = $start; $c <= $end; $c++) {
            $map[$c] = mb_chr($destStart + ($c - $start), 'UTF-8');
          }
        } elseif (isset($item[4]) && $item[4] !== '') {
          preg_match_all('/<([0-9a-fA-F]+)>/', $item[4], $destCodes);
          foreach ($destCodes[1] as $idx => $hex) {
            $map[$start + $idx] = mb_chr(hexdec($hex), 'UTF-8');
          }
        }
      }
    }
  }
  if (preg_match_all('/(\d+)\s+beginbfchar(.*?)endbfchar/s', $cmapData, $bfchars)) {
    foreach ($bfchars[2] as $charBlock) {
      preg_match_all('/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/', $charBlock, $items, PREG_SET_ORDER);
      foreach ($items as $item) {
        $map[hexdec($item[1])] = mb_chr(hexdec($item[2]), 'UTF-8');
      }
    }
  }
  return $map;
}

// Extract genuine CV text across PDF, DOCX, and TXT formats
function extract_cv_text_unified(?string $resumePath): array
{
  if (empty($resumePath)) {
    return [
      'ok' => false,
      'status' => 'no_resume',
      'error' => 'No CV / Resume document attached to this intern record.',
      'text' => '',
    ];
  }

  $uploadDir = __DIR__ . '/uploads/volunteer_resumes/';
  $filePath = $uploadDir . basename($resumePath);
  if (!file_exists($filePath)) {
    return [
      'ok' => false,
      'status' => 'missing_file',
      'error' => 'The uploaded CV file could not be found on the server.',
      'text' => '',
    ];
  }

  $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

  if ($ext === 'docx') {
    $zip = new ZipArchive();
    if ($zip->open($filePath) === true) {
      $xml = $zip->getFromName('word/document.xml');
      $zip->close();
      if ($xml !== false) {
        $clean = trim(preg_replace('/\s+/', ' ', strip_tags($xml)));
        if (strlen($clean) >= 25) {
          return ['ok' => true, 'status' => 'success', 'error' => null, 'text' => $clean];
        }
      }
    }
  }

  if ($ext === 'txt') {
    $raw = @file_get_contents($filePath);
    $clean = trim(preg_replace('/\s+/', ' ', preg_replace('/[^\x20-\x7E\r\n\t]/', ' ', (string)$raw)));
    if (strlen($clean) >= 25) {
      return ['ok' => true, 'status' => 'success', 'error' => null, 'text' => $clean];
    }
  }

  if ($ext === 'pdf') {
    $raw = @file_get_contents($filePath);
    if ($raw === false || strlen($raw) < 10) {
      return [
        'ok' => false,
        'status' => 'failed',
        'error' => 'CV could not be analyzed (File is empty or corrupted)',
        'text' => '',
      ];
    }

    $globalCmap = [];
    if (preg_match_all('/(\d+\s+\d+\s+obj\b.*?endobj)/s', $raw, $objs)) {
      foreach ($objs[0] as $obj) {
        if (preg_match('/\/ToUnicode\s+(\d+\s+\d+\s+R)/i', $obj, $tm)) {
          $ref = $tm[1];
          if (preg_match('/' . preg_quote($ref, '/') . '\b.*?stream[\r\n]+(.*?)endstream/s', $raw, $sm)) {
            $cData = @gzuncompress(trim($sm[1])) ?: trim($sm[1]);
            $globalCmap = $globalCmap + parse_pdf_cmap_stream($cData);
          }
        }
      }
    }

    $allText = [];

    // Extract all streams
    if (preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $raw, $streams)) {
      foreach ($streams[1] as $st) {
        $streamData = trim($st);
        // 1. Try ASCII85 + Flate
        $a85 = decode_pdf_ascii85_stream($streamData);
        $decomp = @gzuncompress($a85);
        if ($decomp === false) $decomp = @gzuncompress($streamData);
        if ($decomp === false) $decomp = $streamData;

        // Hex strings with CMap
        if (preg_match_all('/<([0-9a-fA-F]{4,})>\s*(?:Tj|\'|\")/s', $decomp, $m)) {
          foreach ($m[1] as $hexStr) {
            $line = '';
            for ($i = 0; $i < strlen($hexStr); $i += 4) {
              $code = hexdec(substr($hexStr, $i, 4));
              $line .= $globalCmap[$code] ?? (($code >= 32 && $code <= 126) ? chr($code) : ' ');
            }
            if (trim($line) !== '') $allText[] = trim($line);
          }
        }

        // TJ array with hex or text
        if (preg_match_all('/\[(.*?)\]\s*TJ/s', $decomp, $m)) {
          foreach ($m[1] as $tjBlock) {
            $line = '';
            preg_match_all('/<([0-9a-fA-F]+)>|\(([^\)\\\\]*(?:\\\\.[^\)\\\\]*)*)\)|(-?\d+(?:\.\d+)?)/s', $tjBlock, $parts, PREG_SET_ORDER);
            foreach ($parts as $p) {
              if (!empty($p[1])) {
                $hex = $p[1];
                for ($i = 0; $i < strlen($hex); $i += 4) {
                  $code = hexdec(substr($hex, $i, 4));
                  $line .= $globalCmap[$code] ?? (($code >= 32 && $code <= 126) ? chr($code) : ' ');
                }
              } elseif (isset($p[2]) && $p[2] !== '') {
                $s = stripcslashes($p[2]);
                $s = preg_replace_callback('/\\\\([0-7]{1,3})/', fn($mc) => chr(octdec($mc[1])), $s);
                $line .= $s;
              } elseif (isset($p[3]) && is_numeric($p[3])) {
                if ((float)$p[3] < -180) {
                  $line .= ' ';
                }
              }
            }
            if (trim($line) !== '') $allText[] = trim($line);
          }
        }

        // (text) Tj
        if (preg_match_all('/\((.*?)\)\s*(?:Tj|\'|\")/s', $decomp, $m)) {
          foreach ($m[1] as $s) {
            $dec = stripcslashes($s);
            $dec = preg_replace_callback('/\\\\([0-7]{1,3})/', fn($mc) => chr(octdec($mc[1])), $dec);
            $dec = trim(preg_replace('/[^\x20-\x7E\r\n\t]/', ' ', $dec));
            if ($dec !== '') $allText[] = $dec;
          }
        }
      }
    }

    $clean = preg_replace('/[^a-zA-Z0-9\s,.\-@\(\)\/\':;#\+&]/', ' ', implode(' ', $allText));
    $clean = trim(preg_replace('/\s+/', ' ', $clean));

    // Fallback for simple direct string dumps
    if (strlen($clean) < 25) {
      if (preg_match_all('/\(([^\)\\\\]*(?:\\\\.[^\)\\\\]*)*)\)/s', $raw, $m)) {
        $rawStrings = [];
        foreach ($m[1] as $str) {
          $dec = stripcslashes($str);
          $dec = trim(preg_replace('/[^\x20-\x7E\r\n\t]/', ' ', $dec));
          if (strlen($dec) >= 3) $rawStrings[] = $dec;
        }
        $rawClean = trim(preg_replace('/\s+/', ' ', implode(' ', $rawStrings)));
        if (strlen($rawClean) >= 25) {
          $clean = $rawClean;
        }
      }
    }

    if (strlen($clean) < 20) {
      return [
        'ok' => false,
        'status' => 'failed',
        'error' => 'CV could not be analyzed (Document contains no readable text, is an image-only scan, or is encrypted)',
        'text' => '',
      ];
    }

    return ['ok' => true, 'status' => 'success', 'error' => null, 'text' => $clean];
  }

  return [
    'ok' => false,
    'status' => 'failed',
    'error' => 'Unsupported document format',
    'text' => '',
  ];
}

$cvExtractionResult = extract_cv_text_unified($vol['resume_path'] ?? null);
$cvText = $cvExtractionResult['text'];
$cvStatus = $cvExtractionResult['status'];
$cvError = $cvExtractionResult['error'];

// Strict, Evidence-Based Deterministic Matching Engine
function run_strict_evidence_matching(array $programRows, string $cvText, array $vol): array
{
  if (empty(trim($cvText))) {
    return [];
  }

  $cvLower = strtolower($cvText);

  // Exact specifications & keyword lexicons per program
  $programSpecs = [
    'Medical and Dental Missions' => [
      'eduKeywords' => ['nursing', 'bsn', 'dentistry', 'dentist', 'medicine', 'doctor', 'physician', 'pharmacy', 'medical technology', 'midwifery', 'health sciences', 'clinical'],
      'certKeywords' => ['first aid', 'bls', 'basic life support', 'acls', 'cpr', 'prc license', 'rn', 'licensed nurse', 'paramedic', 'emt'],
      'skillKeywords' => ['patient care', 'triage', 'vital signs', 'clinic', 'hospital', 'health assessment', 'medication', 'blood pressure', 'wound care'],
      'coreEduReq' => 'Nursing, Medicine, Dentistry, or Health Sciences Degree',
      'coreCertReq' => 'BLS (Basic Life Support) or First Aid Certification',
      'coreSkillReq' => 'Patient Care, Triage, and Health Assessment',
    ],
    'Medical Missions' => [
      'eduKeywords' => ['nursing', 'bsn', 'dentistry', 'medicine', 'doctor', 'physician', 'pharmacy', 'health sciences', 'clinical'],
      'certKeywords' => ['first aid', 'bls', 'basic life support', 'acls', 'cpr', 'prc license', 'rn'],
      'skillKeywords' => ['patient care', 'triage', 'vital signs', 'clinic', 'hospital', 'medication', 'blood pressure'],
      'coreEduReq' => 'Nursing, Medicine, Dentistry, or Allied Health Degree',
      'coreCertReq' => 'BLS or First Aid Certification',
      'coreSkillReq' => 'Patient Care and Triage Support',
    ],
    'Community Feeding & Nutrition Program' => [
      'eduKeywords' => ['nutrition', 'dietetics', 'bsnd', 'culinary', 'hospitality', 'hrm', 'food technology', 'hotel and restaurant'],
      'certKeywords' => ['food safety', 'sanitation', 'nc ii cookery', 'servsafe', 'haccp', 'food handler'],
      'skillKeywords' => ['cooking', 'food prep', 'meal planning', 'kitchen', 'baking', 'catering', 'dietary', 'food handling', 'portioning', 'feeding'],
      'coreEduReq' => 'Nutrition & Dietetics, Culinary Arts, or Hospitality Degree',
      'coreCertReq' => 'Food Safety & Sanitation Certification or NC II Cookery',
      'coreSkillReq' => 'Food Preparation, Cooking, and Nutrition Planning',
    ],
    'Feeding Programs' => [
      'eduKeywords' => ['nutrition', 'dietetics', 'culinary', 'hospitality', 'hrm', 'food prep'],
      'certKeywords' => ['food safety', 'sanitation', 'nc ii cookery', 'food handler'],
      'skillKeywords' => ['cooking', 'food prep', 'meal packaging', 'kitchen', 'feeding', 'food distribution'],
      'coreEduReq' => 'Nutrition, Culinary, or Food Handling Background',
      'coreCertReq' => 'Food Safety or Hygiene Certification',
      'coreSkillReq' => 'Meal Packaging and Food Preparation Support',
    ],
    'Educational Sponsorship & Youth Development' => [
      'eduKeywords' => ['education', 'beed', 'bsed', 'teaching', 'teacher', 'pedagogy', 'special education', 'sped', 'psychology', 'social work', 'early childhood'],
      'certKeywords' => ['let', 'licensure exam for teachers', 'teaching certificate', 'tesol', 'tefl', 'child development training'],
      'skillKeywords' => ['tutoring', 'teaching', 'lesson planning', 'youth mentoring', 'literacy', 'child development', 'curriculum', 'classroom management', 'academic support'],
      'coreEduReq' => 'Education, Special Education, Psychology, or Social Work Degree',
      'coreCertReq' => 'LET (Licensure Exam for Teachers) or Teaching Orientation',
      'coreSkillReq' => 'Academic Tutoring, Mentorship, and Youth Facilitation',
    ],
    'Disaster Relief and House Building Project' => [
      'eduKeywords' => ['civil engineering', 'bsce', 'architecture', 'bsa', 'construction management', 'industrial technology', 'structural'],
      'certKeywords' => ['drrm', 'disaster risk reduction', 'first aid', 'safety officer', 'cosh', 'bosh', 'driver license', 'nc ii carpentry', 'nc ii masonry'],
      'skillKeywords' => ['construction', 'carpentry', 'masonry', 'building', 'disaster response', 'relief operations', 'packing', 'warehouse', 'logistics', 'heavy lifting', 'tools handling'],
      'coreEduReq' => 'Civil Engineering, Architecture, or Technical Vocational Degree',
      'coreCertReq' => 'DRRM Training, Safety Training, or Technical NC II Certification',
      'coreSkillReq' => 'Construction, Relief Operations Logistics, and Field Support',
    ],
    'Family Hygiene & Preventive Health' => [
      'eduKeywords' => ['public health', 'bsph', 'community health', 'nursing', 'midwifery', 'sanitation', 'health education'],
      'certKeywords' => ['wash', 'water and sanitation', 'first aid', 'barangay health worker', 'bhw', 'hygiene advocacy'],
      'skillKeywords' => ['hygiene education', 'sanitation advocacy', 'wash training', 'health promotion', 'kit distribution', 'preventive care', 'handwashing'],
      'coreEduReq' => 'Public Health, Community Development, Nursing, or Midwifery Degree',
      'coreCertReq' => 'WASH Advocacy or Community Health Certification',
      'coreSkillReq' => 'Health & Hygiene Advocacy and Community Outreach',
    ],
    'Livelihood & Skills Training' => [
      'eduKeywords' => ['business administration', 'bsba', 'entrepreneurship', 'vocational education', 'economics', 'marketing', 'cooperative management'],
      'certKeywords' => ['tesda tm1', 'trainer methodology', 'nc ii', 'financial literacy trainer', 'craft certification'],
      'skillKeywords' => ['livelihood training', 'vocational workshop', 'sewing', 'tailoring', 'baking', 'handicrafts', 'financial literacy', 'small business', 'bookkeeping'],
      'coreEduReq' => 'Business, Entrepreneurship, or Technical Vocational Degree',
      'coreCertReq' => 'TESDA Trainer Methodology or Relevant NC II Certification',
      'coreSkillReq' => 'Vocational Workshop Facilitation and Skills Instruction',
    ],
    'Community Outreach' => [
      'eduKeywords' => ['community development', 'social work', 'sociology', 'public administration', 'mass communication', 'development communication', 'undergraduate', 'bachelor'],
      'certKeywords' => ['volunteer orientation', 'leadership training', 'community leadership', 'first aid'],
      'skillKeywords' => ['community outreach', 'event coordination', 'teamwork', 'communication', 'resource mobilization', 'participant support', 'organizing'],
      'coreEduReq' => 'Social Sciences, Communications, or College Undergraduate Background',
      'coreCertReq' => 'Volunteer Orientation or Leadership Training',
      'coreSkillReq' => 'Community Outreach Coordination and Team Facilitation',
    ],
  ];

  $results = [];

  foreach ($programRows as $prog) {
    $progName = is_array($prog) ? ($prog['name'] ?? '') : (string)$prog;
    if (empty($progName)) continue;

    $spec = $programSpecs[$progName] ?? [
      'eduKeywords' => ['community', 'development', 'social', 'degree', 'undergraduate'],
      'certKeywords' => ['training', 'certification', 'orientation'],
      'skillKeywords' => ['coordination', 'communication', 'teamwork', 'support'],
      'coreEduReq' => 'Relevant College Coursework',
      'coreCertReq' => 'Relevant Foundational Training',
      'coreSkillReq' => 'Program Coordination & Volunteer Support',
    ];

    $matchedEvidence = [];
    $missingRequirements = [];

    // 1. Strict Education matching (word-boundary)
    $eduFound = false;
    $matchedEduKw = [];
    foreach ($spec['eduKeywords'] as $kw) {
      if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $cvLower)) {
        $eduFound = true;
        $matchedEduKw[] = ucwords($kw);
      }
    }
    if ($eduFound) {
      $matchedEvidence[] = "Education verified in CV (" . implode(', ', array_slice(array_unique($matchedEduKw), 0, 2)) . ")";
    } else {
      $missingRequirements[] = "{$spec['coreEduReq']} (Not Found in CV)";
    }

    // 2. Strict Certifications matching (word-boundary)
    $certFound = false;
    $matchedCertKw = [];
    foreach ($spec['certKeywords'] as $kw) {
      if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $cvLower)) {
        $certFound = true;
        $matchedCertKw[] = ucwords($kw);
      }
    }
    if ($certFound) {
      $matchedEvidence[] = "Training / Certification verified in CV (" . implode(', ', array_slice(array_unique($matchedCertKw), 0, 2)) . ")";
    } else {
      $missingRequirements[] = "{$spec['coreCertReq']} (Not Found in CV)";
    }

    // 3. Strict Skills & Experience matching (word-boundary)
    $skillsFound = [];
    foreach ($spec['skillKeywords'] as $kw) {
      if (preg_match('/\b' . preg_quote($kw, '/') . '\b/i', $cvLower)) {
        $skillsFound[] = ucwords($kw);
      }
    }
    if (!empty($skillsFound)) {
      $matchedEvidence[] = "Demonstrated Competencies in " . implode(', ', array_slice(array_unique($skillsFound), 0, 3));
    } else {
      $missingRequirements[] = "{$spec['coreSkillReq']} (Not Found in CV)";
    }

    $skillCount = count($skillsFound);

    // Strict scoring formula based exclusively on verified evidence
    if ($eduFound && $certFound && $skillCount >= 2) {
      $score = min(95, 80 + ($skillCount * 4));
      $status = 'Strong Match';
      $isRec = true;
      $reason = "The CV contains relevant education and certification required for {$progName}.";
    } elseif (($eduFound || $certFound) && $skillCount >= 1) {
      $score = min(78, 55 + ($skillCount * 5));
      $status = 'Moderate Match';
      $isRec = true;
      $reason = "The CV demonstrates verified foundational skills and credentials applicable to {$progName}.";
    } elseif ($skillCount >= 2) {
      $score = 45;
      $status = 'No Match';
      $isRec = false;
      $reason = "CV mentions general skills, but lacks the formal education and mandatory certifications required for {$progName}.";
    } else {
      $score = max(0, min(20, $skillCount * 10));
      $status = 'No Match';
      $isRec = false;
      $reason = "CV contains no relevant education, certifications, or verified experience required for {$progName}.";
    }

    if (empty($missingRequirements)) {
      $missingRequirements = ['None'];
    }

    $results[] = [
      'program' => $progName,
      'matchPercentage' => $score,
      'matchStatus' => $status,
      'isRecommended' => $isRec,
      'matchedEvidence' => empty($matchedEvidence) ? ['None found in CV'] : $matchedEvidence,
      'missingRequirements' => $missingRequirements,
      'reason' => $reason,
    ];
  }

  usort($results, fn($a, $b) => ($b['matchPercentage'] ?? 0) <=> ($a['matchPercentage'] ?? 0));
  return $results;
}

$recommendations = [];
$source = 'strict_evidence_ai';

if ($cvExtractionResult['ok'] && !empty($cvText)) {
  // Google Gemini API integration if configured
  global $GEMINI_API_KEY;
  $apiKey = !empty($GEMINI_API_KEY) ? trim((string)$GEMINI_API_KEY) : (getenv('GEMINI_API_KEY') ?: '');

  if ($apiKey !== '') {
    $programsJsonList = json_encode($programRows, JSON_UNESCAPED_SLASHES);
    $prompt = <<<PROMPT
You are a strict, evidence-based HR and Volunteer/Intern Coordinator for Rise Above Foundation Cebu.
Analyze the following authentic CV text extracted from an intern's uploaded document against the foundation's active programs.

STRICT EVIDENCE & ZERO-HALLUCINATION RULES:
1. ONLY USE REAL CV FACTS: Only evaluate qualifications, education, certifications, and skills explicitly stated in the CV text below.
2. DO NOT HALLUCINATE OR ASSUME: If a qualification is not explicitly mentioned in the CV, mark it under "missingRequirements" with suffix "(Not Found in CV)".
3. JOKE / IRRELEVANT RESUMES: If the CV has no relevant domain credentials (e.g. bouncer, dropped out, video games), score 0% and mark "No Match" with isRecommended: false for all programs.
4. STRICT MATCH STATUS:
   - "Strong Match" (80-100%): BOTH relevant academic background AND required certifications are explicitly found in CV.
   - "Moderate Match" (55-79%): Has verified related coursework or verified foundational training/experience in CV.
   - "No Match" (0-54%): Core qualifications are missing in CV. isRecommended must be false.
5. REQUIRED JSON OUTPUT FORMAT:
[
  {
    "program": "Exact Program Name",
    "matchPercentage": integer (0 to 100),
    "matchStatus": "Strong Match" | "Moderate Match" | "No Match",
    "isRecommended": boolean,
    "matchedEvidence": ["Exact skill / cert / degree verified from CV"],
    "missingRequirements": ["Missing requirement (Not Found in CV)"] or ["None"],
    "reason": "Clear 1-2 sentence evidence-based justification."
  }
]

ACTIVE FOUNDATION PROGRAMS:
{$programsJsonList}

EXTRACTED CV CONTENT:
{$cvText}

Return only valid JSON array.
PROMPT;

    $modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
    foreach ($modelsToTry as $modelName) {
      $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key=" . urlencode($apiKey);
      $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
          'temperature' => 0.05,
          'responseMimeType' => 'application/json',
        ]
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
          if (is_array($parsed) && !empty($parsed)) {
            $recommendations = $parsed;
            $source = 'gemini_strict_ai';
            usort($recommendations, fn($a, $b) => ($b['matchPercentage'] ?? 0) <=> ($a['matchPercentage'] ?? 0));
            break;
          }
        }
      }
    }
  }

  if (empty($recommendations)) {
    $recommendations = run_strict_evidence_matching($programRows, $cvText, $vol);
  }
}

// Calculate summary stats
$hasRecommended = false;
foreach ($recommendations as $rec) {
  if (!empty($rec['isRecommended'])) {
    $hasRecommended = true;
    break;
  }
}

json_response([
  'ok' => true,
  'source' => $source,
  'volunteerId' => (int) $vol['id'],
  'applicantType' => $vol['applicant_type'] ?? 'Volunteer',
  'name' => $vol['full_name'],
  'institution' => $vol['institution'] ?? null,
  'hasResume' => !empty($vol['resume_path']),
  'resumeFileName' => $vol['resume_file_name'] ?? null,
  'cvExtractionStatus' => $cvStatus,
  'cvExtractionError' => $cvError,
  'extractedCvPreview' => !empty($cvText) ? substr($cvText, 0, 400) . '...' : null,
  'hasRecommendedPrograms' => $hasRecommended,
  'data' => $recommendations,
]);
