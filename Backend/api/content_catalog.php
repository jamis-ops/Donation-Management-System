<?php
declare(strict_types=1);

/** Full catalog of programs & partners with public media URLs (public/media/…). */
function cms_programs_catalog(): array
{
  return [
    ['Community Center', 'A neighborhood hub with clinic, kitchen, playground, and Children’s Library.', 'community-center', '/media/programs/community-center.jpg', 'Located in a neighborhood where low-to-no income families reside, the Rise Above Community Center was built to reach these families and children from this community. It is equipped with a dental clinic, a kitchen, playground and a Children’s Library.'],
    ['Volunteer Program', 'Individuals and groups from around the world give time, talent, and treasure.', 'volunteer-program', '/media/programs/volunteer-program.jpg', 'Volunteers from all over the world work together with us at the Rise Above Community Center, the Family Care Center, and the Rise Above Office.'],
    ['Livelihood Program', 'Rise Up Crafts trains mothers to weave sustainable products from upcycled materials.', 'livelihood-program', '/media/programs/livelihood-program.jpg', 'Rise Up Crafts is a livelihood program designed to help poverty-stricken families by helping mothers gain a steady income to provide food and education for their children.'],
    ['Toothbrushing & Handwashing Program', 'Daily hygiene education in elementary schools for about $1 per child per year.', 'toothbrushing-handwashing', '/media/programs/toothbrushing-handwashing.jpg', 'Rise Above runs an ongoing Toothbrushing and Handwashing Program in several elementary schools.'],
    ['Educational Sponsorship', 'Sponsored children receive materials, uniforms, bags, and daily meals.', 'educational-sponsorship', '/media/programs/educational-sponsorship.jpg', 'For a monthly pledge, sponsored children receive educational materials, uniforms, school bags, as well as daily lunch and snacks.'],
    ['Food Program', 'Sponsor a meal for 500 children — or cook and serve with your team.', 'food-program', '/media/programs/food-program.jpg', 'For only 210 US$, you can sponsor the Food Sharing Program and provide a simple meal to feed 500 children.'],
    ['Child-Minding Program', 'Free care and pre-school education for children ages 3–5 at the Family Care Center.', 'child-minding', '/media/programs/child-minding.jpg', 'Children ages 3-5 years old receive free care and pre-school education at the Family Care Center.'],
    ['Christmas Gift-Giving', 'Help families in the slums celebrate Christmas with joy and dignity.', 'christmas-gift-giving', '/media/programs/christmas-gift-giving.jpg', 'We want to give families a chance to celebrate and make Christmas a joyous family event.'],
    ["Children's Library", 'A welcoming space to read, learn, and play for children in the neighborhood.', 'childrens-library', '/media/programs/childrens-library.jpg', 'The Children’s Library building was inaugurated in April 2015. Children read, learn, and play with books and toys donated especially for them.'],
    ['Construction and Renovation', 'Volunteer teams build and renovate where communities need it most.', 'construction-renovation', '/media/programs/construction-renovation.jpg', 'Since 2010, we have arranged construction projects for foreign volunteers in schools, communities, and areas with families in need.'],
    ['Disaster Relief and House Building', 'Ready to facilitate aid when disaster strikes across Cebu.', 'disaster-relief', '/media/programs/disaster-relief.jpg', 'When disaster strikes, we are ready and able to facilitate aid in Cebu — including house building and school construction after Typhoon Haiyan.'],
    ['Hope and Encouragement', 'Parties, puppet shows, hospital visits — spreading hope and joy.', 'hope-encouragement', '/media/programs/hope-encouragement.jpg', 'Over the years, Rise Above has found many ways to spread hope and joy — parties, puppet shows, food sharing, and hospital visits.'],
    ['Internship Program', 'Around 80 university interns placed yearly in partner institutions.', 'internship-program', '/media/programs/internship-program.jpeg', 'Annually, Rise Above receives around 80 university/college student interns in Cebu as part of their education.'],
    ['Dental Mission', 'Free dental care for over 45,000 patients to date.', 'dental-mission', '/media/programs/dental-mission.jpg', 'Foreign and local dentists and support personnel volunteer for Dental Missions held in depressed areas around Cebu.'],
    ['Medical Mission', 'Monthly free medical missions at the Community Center.', 'medical-missions', '/media/programs/medical-missions.jpg', 'Once a month, when medical personnel volunteer, we hold a free medical mission at the Rise Above Community Center.'],
    ['Persons With Disability Assistance', 'Supporting students with disabilities when aids are out of reach.', 'pwd-assistance', '/media/programs/pwd-assistance.jpg', 'Rise Above provides direct support to students in Cebu who have disabilities, including aids such as crutches, wheelchairs and prosthetics.'],
  ];
}

function cms_partners_catalog(): array
{
  return [
    ['Roskilde Rotary Club', 'Denmark', 'Long-time education and prosthetic sponsorship partner.', '/media/partners/roskilde-rotary-club.png', 'Roskilde Rotary Club sponsored college education for Junevieve Pales after Rise Above arranged her prosthetic leg.'],
    ['Sponsorship Network International', 'Switzerland', 'Sponsored vehicles, dental materials, and Community Center renovations.', '/media/partners/sponsorship-network-international.gif', 'SNI has sponsored vehicles, dental mission materials, and Community Center renovations.'],
    ['Medarbejdernes Honorarfond I Novo Gruppen', 'Denmark', 'Major supporter of dental units, Community Center, and Yolanda relief.', '/media/partners/novo-gruppen.jpg', 'This Fond has supported mobile dental units, medicines, a new van, the Community Center, typhoon relief, and Children’s Library equipment.'],
    ['Developing World Connections', 'Canada', 'Volunteer teams building houses, schools, and dorm facilities.', '/media/partners/developing-world-connections.gif', 'They have partnered with us for 10 years, sending volunteers who built houses, school buildings, and the dorm at our Community Center.'],
    ['Ramon Aboitiz Foundation Inc.', 'Cebu', 'Major supporter of Community Center construction and Children’s Library.', '/media/partners/ramon-aboitiz-foundation.gif', 'RAFI donated major funding for Community Center buildings and sponsored books and equipment for the Children’s Library.'],
    ['Giving on Purpose', 'USA', 'Ongoing support for health, environment, and guidance services.', '/media/partners/giving-on-purpose.gif', 'Giving on Purpose continuously supports projects that enhance quality of life through health, environment, and guidance services.'],
  ];
}

/**
 * Insert missing programs/partners and backfill empty image_url / body on existing rows.
 * Safe to call repeatedly (idempotent). Does not overwrite non-empty image_url set by Admin.
 */
function sync_cms_catalog(PDO $pdo): void
{
  $find = $pdo->prepare('SELECT id, image_url, body, summary, meta_json FROM cms_items WHERE type = ? AND title = ? LIMIT 1');
  $ins = $pdo->prepare('
    INSERT INTO cms_items (type, title, summary, body, image_url, link_url, meta_json, status, sort_order, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ');
  $upd = $pdo->prepare('
    UPDATE cms_items
    SET image_url = COALESCE(NULLIF(TRIM(image_url), \'\'), ?),
        body = CASE WHEN body IS NULL OR TRIM(body) = \'\' THEN ? ELSE body END,
        summary = CASE WHEN summary IS NULL OR TRIM(summary) = \'\' THEN ? ELSE summary END,
        meta_json = CASE WHEN meta_json IS NULL OR meta_json = \'\' OR meta_json = \'{}\' THEN ? ELSE meta_json END,
        sort_order = ?
    WHERE id = ?
  ');

  $order = 0;
  foreach (cms_programs_catalog() as [$title, $summary, $slug, $image, $body]) {
    $meta = json_encode(['slug' => $slug, 'active' => true], JSON_UNESCAPED_UNICODE);
    $find->execute(['programs', $title]);
    $row = $find->fetch();
    if ($row) {
      $upd->execute([$image, $body, $summary, $meta, $order, (int) $row['id']]);
    } else {
      $ins->execute([
        'programs', $title, $summary, $body, $image, '',
        $meta, 'published', $order, date('Y-m-d H:i:s'),
      ]);
    }
    $order++;
  }

  $order = 0;
  foreach (cms_partners_catalog() as [$title, $location, $summary, $image, $body]) {
    $meta = json_encode(['location' => $location], JSON_UNESCAPED_UNICODE);
    $find->execute(['partners', $title]);
    $row = $find->fetch();
    if ($row) {
      $upd->execute([$image, $body, $summary, $meta, $order, (int) $row['id']]);
    } else {
      $ins->execute([
        'partners', $title, $summary, $body, $image, '',
        $meta, 'published', $order, date('Y-m-d H:i:s'),
      ]);
    }
    $order++;
  }
}
