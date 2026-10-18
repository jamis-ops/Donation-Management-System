import CEBU_LOCATIONS from './cebuLocations'

/**
 * Locations dataset:
 * 1. Comprehensive Countries & State/Province/Region maps for donors & partners.
 * 2. Cebu Municipalities & Barangays for local beneficiary assistance & distributions.
 */

export const COUNTRIES = [
  { code: 'AU', name: 'Australia' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PH', name: 'Philippines' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'OTHER', name: 'Other Country' },
]

export const PHILIPPINES_PROVINCES_AND_REGIONS = [
  'Metro Manila (NCR)',
  'Cebu',
  'Davao del Sur',
  'Iloilo',
  'Pampanga',
  'Cavite',
  'Laguna',
  'Batangas',
  'Rizal',
  'Bulacan',
  'Pangasinan',
  'Benguet',
  'Negros Occidental',
  'Negros Oriental',
  'Bohol',
  'Leyte',
  'Misamis Oriental',
  'Zamboanga del Sur',
  'South Cotabato',
  'Albay',
  'Palawan',
  'Abra',
  'Agusan del Norte',
  'Agusan del Sur',
  'Aklan',
  'Antique',
  'Apayao',
  'Aurora',
  'Basilan',
  'Bataan',
  'Batanes',
  'Biliran',
  'Bukidnon',
  'Cagayan',
  'Camarines Norte',
  'Camarines Sur',
  'Camiguin',
  'Capiz',
  'Catanduanes',
  'Cotabato (North Cotabato)',
  'Davao de Oro (Compostela Valley)',
  'Davao del Norte',
  'Davao Occidental',
  'Davao Oriental',
  'Dinagat Islands',
  'Eastern Samar',
  'Guimaras',
  'Ifugao',
  'Ilocos Norte',
  'Ilocos Sur',
  'Isabela',
  'Kalinga',
  'La Union',
  'Lanao del Norte',
  'Lanao del Sur',
  'Maguindanao del Norte',
  'Maguindanao del Sur',
  'Marinduque',
  'Masbate',
  'Misamis Occidental',
  'Mountain Province',
  'Northern Samar',
  'Nueva Ecija',
  'Nueva Vizcaya',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Quezon',
  'Quirino',
  'Romblon',
  'Samar (Western Samar)',
  'Sarangani',
  'Siquijor',
  'Sorsogon',
  'Southern Leyte',
  'Sultan Kudarat',
  'Sulu',
  'Surigao del Norte',
  'Surigao del Sur',
  'Tarlac',
  'Tawi-Tawi',
  'Zambales',
  'Zamboanga del Norte',
  'Zamboanga Sibugay',
]

export const COUNTRY_REGIONS_MAP = {
  Philippines: PHILIPPINES_PROVINCES_AND_REGIONS,
  'United States': [
    'California', 'New York', 'Texas', 'Florida', 'Washington', 'Illinois',
    'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey',
    'Virginia', 'Massachusetts', 'Arizona', 'Colorado', 'Oregon', 'Maryland',
    'Nevada', 'Hawaii', 'Minnesota', 'Indiana', 'Tennessee', 'Missouri', 'Wisconsin',
    'Utah', 'Connecticut', 'Kentucky', 'Louisiana', 'Alabama', 'South Carolina',
  ],
  Canada: [
    'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba',
    'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador',
    'Prince Edward Island', 'Northwest Territories', 'Nunavut', 'Yukon',
  ],
  Australia: [
    'New South Wales', 'Victoria', 'Queensland', 'Western Australia',
    'South Australia', 'Tasmania', 'Australian Capital Territory', 'Northern Territory',
  ],
  'United Kingdom': [
    'Greater London', 'South East England', 'North West England', 'East of England',
    'West Midlands', 'South West England', 'Yorkshire and the Humber', 'East Midlands',
    'North East England', 'Scotland', 'Wales', 'Northern Ireland',
  ],
  Japan: [
    'Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Kyoto', 'Fukuoka', 'Hokkaido',
    'Hyogo', 'Saitama', 'Chiba', 'Hiroshima', 'Miyagi', 'Shizuoka', 'Okinawa',
  ],
  Singapore: [
    'Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region',
  ],
  'United Arab Emirates': [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain',
  ],
  'Saudi Arabia': [
    'Riyadh', 'Makkah', 'Eastern Province', 'Madinah', 'Asir', 'Tabuk', 'Al-Qassim', 'Jazan',
  ],
  Germany: [
    'Bavaria', 'Berlin', 'North Rhine-Westphalia', 'Baden-Württemberg', 'Hesse',
    'Saxony', 'Lower Saxony', 'Hamburg', 'Rhineland-Palatinate', 'Schleswig-Holstein',
  ],
  Denmark: [
    'Capital Region (Hovedstaden)', 'Central Denmark (Midtjylland)',
    'North Denmark (Nordjylland)', 'Zealand (Sjælland)', 'Region of Southern Denmark (Syddanmark)',
  ],
  'South Korea': [
    'Seoul', 'Busan', 'Incheon', 'Gyeonggi', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Jeju',
  ],
  'Hong Kong': [
    'Hong Kong Island', 'Kowloon', 'New Territories',
  ],
  'New Zealand': [
    'Auckland', 'Canterbury', 'Wellington', 'Waikato', 'Bay of Plenty', 'Otago', 'Manawatu-Wanganui',
  ],
}

/**
 * Returns available states/provinces/regions for a given country name.
 * @param {string} countryName
 * @returns {string[]}
 */
export function getRegionsForCountry(countryName) {
  if (!countryName) return []
  return COUNTRY_REGIONS_MAP[countryName] || []
}

/**
 * Cebu local municipal and barangay data for relief assistance and beneficiary management.
 */
export { CEBU_LOCATIONS }

export const MUNICIPALITIES = Object.keys(CEBU_LOCATIONS).sort()

export function barangaysForMunicipality(municipality) {
  if (!municipality) return []
  return CEBU_LOCATIONS[municipality] || []
}
