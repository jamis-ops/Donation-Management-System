export const foundation = {
  name: 'Rise Above Foundation',
  tagline: 'Lifting communities through compassion, action, and hope.',
  mission:
    'To provide timely relief, sustainable development, and educational opportunities to underserved communities across the Philippines.',
  vision:
    'A nation where every family has access to basic needs, education, and the support to rise above adversity.',
  address: '123 Compassion Street, Cebu City, Philippines 6000',
  phone: '+63 32 123 4567',
  email: 'info@riseabovefoundation.org',
  social: {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    twitter: 'https://twitter.com',
  },
}

export const programs = [
  {
    id: 'disaster-relief',
    name: 'Disaster Relief',
    description:
      'Rapid response operations delivering food, water, shelter materials, and medical supplies to disaster-affected areas.',
    active: true,
  },
  {
    id: 'educational-sponsorship',
    name: 'Educational Sponsorship',
    description:
      'Scholarships, school supplies, and mentorship for students from low-income families pursuing their academic goals.',
    active: true,
  },
  {
    id: 'feeding-programs',
    name: 'Feeding Programs',
    description:
      'Community kitchens and meal distributions serving nutritious food to children, seniors, and vulnerable families.',
    active: true,
  },
  {
    id: 'community-outreach',
    name: 'Community Outreach',
    description:
      'Livelihood training, skills development, and neighborhood programs that empower communities toward self-sufficiency.',
    active: true,
  },
  {
    id: 'medical-missions',
    name: 'Medical Missions',
    description:
      'Free health checkups, medicines, dental care, and wellness education in remote and underserved barangays.',
    active: true,
  },
]

export const announcements = [
  {
    id: 1,
    title: 'Typhoon Response: Relief Operations in Cebu South',
    date: '2026-06-28',
    category: 'Disaster Response',
    excerpt:
      'Our teams are actively distributing relief packs in Talisay and Minglanilla. Volunteers needed for repacking shifts.',
  },
  {
    id: 2,
    title: 'Volunteer Orientation — July 5, 2026',
    date: '2026-07-01',
    category: 'Volunteer Opportunities',
    excerpt:
      'New volunteers are invited to attend orientation at our Cebu City headquarters. Register online to reserve your slot.',
  },
  {
    id: 3,
    title: 'Back-to-School Drive Now Open',
    date: '2026-06-15',
    category: 'Foundation News',
    excerpt:
      'Help us equip 500 students with school supplies for the upcoming academic year. Monetary and in-kind donations accepted.',
  },
]

export const impactStats = [
  { label: 'Total Donations Received', value: '₱12.4M' },
  { label: 'Beneficiaries Assisted', value: '18,750' },
  { label: 'Relief Packs Distributed', value: '42,300' },
  { label: 'Active Volunteers', value: '1,240' },
  { label: 'Active Programs', value: '5' },
  { label: 'Partner Organizations', value: '36' },
  { label: 'Communities Served', value: '89' },
]

export const mapLocations = [
  {
    id: 'cebu-city',
    name: 'Cebu City',
    lat: 10.3157,
    lng: 123.8854,
    programs: ['Feeding Programs', 'Educational Sponsorship'],
    stats: { beneficiaries: 3200, reliefPacks: 8500 },
  },
  {
    id: 'talisay',
    name: 'Talisay',
    lat: 10.2447,
    lng: 123.8494,
    programs: ['Disaster Relief', 'Community Outreach'],
    stats: { beneficiaries: 1850, reliefPacks: 4200 },
  },
  {
    id: 'minglanilla',
    name: 'Minglanilla',
    lat: 10.2449,
    lng: 123.7964,
    programs: ['Disaster Relief', 'Feeding Programs'],
    stats: { beneficiaries: 1420, reliefPacks: 3800 },
  },
  {
    id: 'toledo',
    name: 'Toledo',
    lat: 10.386,
    lng: 123.648,
    programs: ['Medical Missions', 'Community Outreach'],
    stats: { beneficiaries: 980, reliefPacks: 2100 },
  },
  {
    id: 'bohol',
    name: 'Bohol',
    lat: 9.6729,
    lng: 123.873,
    programs: ['Educational Sponsorship', 'Medical Missions'],
    stats: { beneficiaries: 2100, reliefPacks: 5600 },
  },
]

export const partners = [
  {
    id: 1,
    name: 'Cebu Business Council',
    category: 'Corporate Partners',
    description: 'Providing corporate sponsorship for disaster relief operations and employee volunteer programs.',
    website: 'https://example.com',
    initials: 'CBC',
  },
  {
    id: 2,
    name: 'University of San Carlos',
    category: 'Educational Partners',
    description: 'Partnering on scholarship programs and student volunteer initiatives.',
    website: 'https://example.com',
    initials: 'USC',
  },
  {
    id: 3,
    name: 'Philippine Red Cross — Cebu Chapter',
    category: 'NGO Partners',
    description: 'Collaborating on medical missions and emergency response logistics.',
    website: 'https://example.com',
    initials: 'PRC',
  },
  {
    id: 4,
    name: 'DSWD Region VII',
    category: 'Government Partners',
    description: 'Coordinating beneficiary verification and large-scale distribution efforts.',
    website: 'https://example.com',
    initials: 'DSWD',
  },
  {
    id: 5,
    name: 'Barangay Lahug Council',
    category: 'Community Partners',
    description: 'Local community coordination for feeding programs and outreach activities.',
    website: 'https://example.com',
    initials: 'BLC',
  },
  {
    id: 6,
    name: 'SM Foundation',
    category: 'Corporate Partners',
    description: 'Supporting school supply drives and community development projects.',
    website: 'https://example.com',
    initials: 'SMF',
  },
]

export const successStories = [
  {
    id: 1,
    title: 'Rise Above Foundation Scholar Graduates from College',
    date: '2026-05-20',
    category: 'Educational Sponsorship',
    excerpt:
      'Maria Santos, a scholar since 2020, graduated cum laude with a degree in Social Work — now giving back to her community.',
    content:
      'Maria grew up in a family of five supported solely by her mother\'s income as a market vendor. Through the Rise Above Educational Sponsorship Program, she received tuition assistance, school supplies, and mentorship for four years. Today, Maria works with a local NGO helping other families navigate social services.',
    testimonial:
      '"The foundation didn\'t just pay for my education — they believed in me when I doubted myself. I am forever grateful." — Maria Santos',
    image: null,
  },
  {
    id: 2,
    title: '200 Families Receive Relief After Flooding in Talisay',
    date: '2026-03-12',
    category: 'Disaster Relief',
    excerpt:
      'Within 48 hours of severe flooding, our disaster response team delivered relief packs to 200 affected families.',
    content:
      'Heavy rains caused widespread flooding in low-lying barangays of Talisay. Rise Above Foundation mobilized volunteers, coordinated with local government, and distributed food packs, clean water, hygiene kits, and temporary shelter materials.',
    testimonial:
      '"We lost everything in the flood, but the foundation came quickly with help. My children had food and clean water the same day." — Roberto Dela Cruz',
    image: null,
  },
  {
    id: 3,
    title: 'Medical Mission Serves 450 Patients in Toledo',
    date: '2026-02-08',
    category: 'Medical Missions',
    excerpt:
      'A joint medical mission with partner NGOs provided free consultations, medicines, and dental care.',
    content:
      'Volunteer doctors, nurses, and dentists joined Rise Above Foundation for a two-day medical mission in Toledo, Cebu. Services included general checkups, pediatric care, dental extractions, and distribution of maintenance medicines.',
    testimonial:
      '"I hadn\'t seen a doctor in three years. This mission gave me the medicine I needed for my hypertension." — Elena Reyes',
    image: null,
  },
  {
    id: 4,
    title: 'Community Garden Project Transforms Barangay Lahug',
    date: '2025-11-30',
    category: 'Community Outreach',
    excerpt:
      'Residents now grow vegetables for their families and sell surplus produce at the local market.',
    content:
      'The Community Garden Project trained 35 families in sustainable urban farming. With seeds, tools, and ongoing mentorship from foundation staff, participants established a shared garden that now supplies fresh produce to the neighborhood.',
    testimonial:
      '"Our garden feeds my family and brings extra income. We learned skills we can pass to our children." — Josefa Mendoza',
    image: null,
  },
]

export const faqCategories = [
  {
    name: 'Donations',
    items: [
      {
        q: 'How can I donate?',
        a: 'You can donate online through our Donate page (monetary or in-kind), via bank transfer, or in person at our Cebu City office. Upload proof of payment for tracking.',
      },
      {
        q: 'Will I receive a receipt for my donation?',
        a: 'Yes. Registered donors can request an Official Receipt (OR) and download a Certificate of Donation once your contribution is verified.',
      },
      {
        q: 'What in-kind items do you accept?',
        a: 'We accept rice, canned goods, hygiene kits, clothing, school supplies, and medical supplies. Contact us before donating large quantities.',
      },
    ],
  },
  {
    name: 'Volunteering',
    items: [
      {
        q: 'How do I become a volunteer?',
        a: 'Fill out the volunteer registration form on our Volunteer page. Select your preferred programs, share your skills, and optionally upload your CV.',
      },
      {
        q: 'How long does approval take?',
        a: 'Applications are typically reviewed within 5–7 business days. You will receive email updates on your application status.',
      },
      {
        q: 'Can I get a volunteer certificate?',
        a: 'Yes. Certificates of Participation and Volunteer Service are generated upon completion of assigned activities.',
      },
    ],
  },
  {
    name: 'Beneficiary Assistance',
    items: [
      {
        q: 'Who can request assistance?',
        a: 'Individuals and families facing hardship due to disaster, medical needs, educational barriers, or food insecurity may apply through our Assistance Request form.',
      },
      {
        q: 'What documents are required?',
        a: 'Valid ID, barangay certificate, and supporting documents relevant to your request (e.g., medical records, photos of damage) help us process your application faster.',
      },
      {
        q: 'How do I track my request?',
        a: 'After submitting, you receive a tracking code. Log in to your beneficiary portal to view status updates and scheduled distributions.',
      },
    ],
  },
  {
    name: 'Certificates & Official Receipts',
    items: [
      {
        q: 'When can I download my donation certificate?',
        a: 'Certificates are available after your donation is verified and recorded in our system.',
      },
      {
        q: 'How do I request an Official Receipt?',
        a: 'Registered donors can request an OR from their donor dashboard after donation verification.',
      },
    ],
  },
  {
    name: 'Programs and Activities',
    items: [
      {
        q: 'What programs does the foundation run?',
        a: 'We operate Disaster Relief, Educational Sponsorship, Feeding Programs, Community Outreach, and Medical Missions across Cebu and neighboring provinces.',
      },
      {
        q: 'How can I stay updated on activities?',
        a: 'Check our Latest News section on the home page, follow us on social media, or subscribe to email notifications when you register.',
      },
    ],
  },
]

export const volunteerPrograms = programs.map((p) => ({
  id: p.id,
  name: p.name,
}))
