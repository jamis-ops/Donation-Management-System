// Fallback option lists when Settings catalogs are unavailable.
// Live values are managed in Admin → Settings (need_types, barangay_types, task_types).

/** Canonical distribution workflow (Admin / Staff / Volunteer / Barangay). */
export const DISTRIBUTION_STATUSES = [
  'Planning',
  'Preparing',
  'In Transit',
  'Delivered',
  'Awaiting Proof',
  'Completed',
]

/** Canonical donation lifecycle shown to donors + admin. */
export const DONATION_STATUSES = [
  'Pending Verification',
  'Verified',
  'In Inventory',
  'Allocated',
  'Distributed',
  'Completed',
  'Rejected',
  'Cancelled',
]

/** Certificate statuses shared by Admin + portals. */
export const CERTIFICATE_STATUSES = [
  'Requested',
  'Pending',
  'Generated',
  'Released',
]

export const NEEDS = [
  'Clothing',
  'Educational Support',
  'Financial Assistance',
  'Food',
  'Hygiene Kits',
  'Medicine',
  'Shelter',
  'Water',
]

export const BARANGAY_TYPES = [
  'Coastal',
  'Island',
  'Lowland',
  'Rural',
  'Upland',
  'Urban',
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
  'Administrative',
  'Distribution',
  'Fieldwork',
  'Logistics',
  'Outreach',
  'Repacking',
  'Verification',
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

/** Controlled program options for volunteer matching & registration. */
export const VOLUNTEER_PROGRAMS = [
  'Disaster Relief and House Building Project',
  'Community Feeding & Nutrition Program',
  'Educational Sponsorship & Youth Development',
  'Medical and Dental Missions',
  'Family Hygiene & Preventive Health',
  'Livelihood & Skills Training',
]

/** Controlled skill tags for RAF Cebu volunteer matching. */
export const VOLUNTEER_SKILLS = [
  'Community Engagement',
  'Cooking & Food Prep',
  'Documentation & Photos',
  'Driving & Logistics',
  'First Aid & Medical',
  'Heavy Lifting & Loading',
  'Relief Goods Packing',
  'Teaching & Tutoring',
  'Warehouse Sorting',
]
