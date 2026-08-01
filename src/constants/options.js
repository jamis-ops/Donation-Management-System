// Fallback option lists when Settings catalogs are unavailable.
// Live values are managed in Admin → Settings (need_types, barangay_types, task_types).

export const NEEDS = [
  'Food',
  'Water',
  'Clothing',
  'Medicine',
  'Hygiene Kits',
  'Shelter',
  'Financial Assistance',
  'Educational Support',
]

export const BARANGAY_TYPES = [
  'Urban',
  'Rural',
  'Coastal',
  'Upland',
  'Island',
  'Lowland',
]

export const DONATION_CATEGORIES = [
  'Food',
  'Water',
  'Clothing',
  'Medicine',
  'Hygiene Kits',
  'Cash',
  'Educational',
  'Shelter Materials',
]

export const TASK_TYPES = [
  'Distribution',
  'Repacking',
  'Verification',
  'Fieldwork',
  'Administrative',
  'Logistics',
  'Outreach',
]

export const DONOR_TYPES = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Company', label: 'Company / Organization' },
]

export const REPRESENTATIVE_POSITIONS = [
  'Barangay Captain',
  'Kagawad',
  'Barangay Secretary',
  'DRRM Officer',
  'Representative',
]

/** Controlled skill tags for RAF Cebu volunteer matching. */
export const VOLUNTEER_SKILLS = [
  'Packing / Repacking',
  'Logistics / Driving',
  'First Aid',
  'Teaching / Tutoring',
  'Medical / Dental support',
  'Construction',
  'Cooking / Food prep',
  'Translation (Cebuano/English)',
  'Documentation / Photo',
  'Community outreach',
]
