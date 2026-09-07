/**
 * Locations dataset:
 * 1. Comprehensive Countries & State/Province/Region maps for donors & partners.
 * 2. Cebu Municipalities & Barangays for local beneficiary assistance & distributions.
 */

export const COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'KR', name: 'South Korea' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'CN', name: 'China' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'IN', name: 'India' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'IL', name: 'Israel' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
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
export const CEBU_LOCATIONS = {
  'Cebu City': [
    'Apas', 'Banilad', 'Basak Pardo', 'Basak San Nicolas', 'Bonbon',
    'Budlaan', 'Busay', 'Calamba', 'Camputhaw', 'Capitol Site', 'Carreta',
    'Cogon Pardo', 'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita',
    'Guadalupe', 'Guba', 'Hipodromo', 'Inayawan', 'Kalubihan', 'Kamagayan',
    'Kamputhaw', 'Kasambagan', 'Kinasang-an Pardo', 'Labangon', 'Lahug',
    'Lorega San Miguel', 'Lusaran', 'Luz', 'Mabini', 'Mabolo', 'Malubog',
    'Mambaling', 'Pahina Central', 'Pahina San Nicolas', 'Pardo',
    'Pari-an', 'Paril', 'Pasil', 'Pit-os', 'Poblacion Pardo',
    'Pulangbato', 'Pung-ol Sibugay', 'Punta Princesa', 'Quiot Pardo',
    'Sambag I', 'Sambag II', 'San Antonio', 'San Jose', 'San Nicolas Proper',
    'San Roque', 'Santa Cruz', 'Santo Niño', 'Sapangdaku', 'Sawang Calero',
    'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II', 'T. Padilla',
    'Tabunan', 'Tagbao', 'Talamban', 'Taptap', 'Tejero', 'Tinago',
    'Tisa', 'Toong', 'Zapatera',
  ],
  'Mandaue City': [
    'Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro',
    'Canduman', 'Casili', 'Casuntingan', 'Centro', 'Cubacub', 'Guizo',
    'Ibabao-Estancia', 'Jagobiao', 'Labogon', 'Looc', 'Maguikay',
    'Mantuyong', 'Opao', 'Pagsabungan', 'Paknaan', 'Subangdaku',
    'Tabok', 'Tawason', 'Tingub', 'Tipolo', 'Umapad',
  ],
  'Lapu-Lapu City': [
    'Agus', 'Babag', 'Bankal', 'Baring', 'Basak', 'Buaya', 'Calawisan',
    'Canjulao', 'Caubian', 'Cawhagan', 'Cawoy', 'Gun-ob', 'Ibo',
    'Looc', 'Mactan', 'Maribago', 'Marigondon', 'Pajac', 'Pajac Proper',
    'Poblacion', 'Punta Engaño', 'Pusok', 'Sabang', 'Santa Rosa',
    'Subabasbas', 'Talima', 'Tingo', 'Tungasan',
  ],
  'Talisay City': [
    'Bulacao', 'Cadulawan', 'Camp IV', 'Cansojong', 'Dumlog', 'Jaclupan',
    'Lawaan I', 'Lawaan II', 'Lawaan III', 'Linao', 'Maghaway', 'Manipis',
    'Mohon', 'Poblacion', 'Pooc', 'San Isidro', 'San Roque', 'Tabunok',
    'Tangke', 'Tapul', 'Biasong',
  ],
  'Toledo City': [
    'Awihao', 'Bagoon', 'Bato', 'Biga', 'Bulongan', 'Bunga', 'Cabitoonan',
    'Calongcalong', 'Cambang-ug', 'Canlumampao', 'Cantabaco', 'Capitan Claudio',
    'Carmen', 'Daanglungsod', 'Don Andres Soriano', 'Dumlog', 'Gen. Climaco',
    'Ibo', 'Ilihan', 'Juan Climaco, Sr.', 'Luray II', 'Matab-ang',
    'Media Once', 'Pangamihan', 'Poblacion', 'Poog', 'Putingbato',
    'Sagay', 'Sam-ang', 'Sangi', 'Santo Niño', 'Subayon', 'Talavera',
    'Tungkay', 'Tubod',
  ],
  'Minglanilla': [
    'Cadulawan', 'Calajo-an', 'Camp 7', 'Camp 8', 'Cuanos', 'Guindaruhan',
    'Linao', 'Lipata', 'Lungsod-Daan', 'Pakigne', 'Poblacion', 'Tubod',
    'Tulay', 'Tunghaan', 'Tungkop', 'Vito',
  ],
  'Naga City': [
    'Alpaco', 'Bairan', 'Balirong', 'Cabungahan', 'Cantao-an', 'Central Poblacion',
    'Cogon', 'Colon', 'East Poblacion', 'Inayagan', 'Inayagan Norte',
    'Jaguimit', 'Lanao', 'Langtad', 'Lutac', 'Mainit', 'Mayana',
    'Naalad', 'North Poblacion', 'Pangdan', 'Patag', 'South Poblacion',
    'Tagjaguimit', 'Tangke', 'Tinaan', 'Tuyan', 'Uling', 'West Poblacion',
  ],
  'Carcar City': [
    'Bolinawan', 'Buenavista', 'Calidngan', 'Can-asujan', 'Guadalupe',
    'Liburon', 'Napo', 'Ocana', 'Perrelos', 'Poblacion I', 'Poblacion II',
    'Poblacion III', 'Rizal', 'Tuyom', 'Valencia', 'Valladolid',
  ],
  'Consolacion': [
    'Cabangahan', 'Cansaga', 'Casili', 'Danglag', 'Garing', 'Jugan',
    'Lamac', 'Lanipga', 'Nangka', 'Panas', 'Panoypoy', 'Pitogo',
    'Poblacion Occidental', 'Poblacion Oriental', 'Polog', 'Pulpogan',
    'Sacsac', 'Tayud', 'Tilhaong', 'Tolotolo', 'Tugbongan',
  ],
  'Liloan': [
    'Cabadiangan', 'Calero', 'Catarman', 'Cotcot', 'Jubay', 'Lataban',
    'Mulao', 'Poblacion', 'San Roque', 'San Vicente', 'Santa Cruz',
    'Tabla', 'Tayud', 'Yati',
  ],
}

export const MUNICIPALITIES = Object.keys(CEBU_LOCATIONS).sort()

export function barangaysForMunicipality(municipality) {
  if (!municipality) return []
  return CEBU_LOCATIONS[municipality] || []
}
