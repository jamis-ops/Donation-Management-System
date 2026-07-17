export const adminUser = {
  id: 'admin-1',
  name: 'Maria Dela Cruz',
  email: 'admin@riseabovefoundation.org',
  role: 'Admin',
}

export const dashboardStats = [
  { label: 'Total Donations', value: '12,428', change: '+12.5%', trend: 'up', icon: 'donations' },
  { label: 'Active Beneficiaries', value: '3,241', change: '+8.2%', trend: 'up', icon: 'beneficiaries' },
  { label: 'Items in Inventory', value: '8,528', change: '-5.4%', trend: 'down', icon: 'inventory' },
  { label: 'Active Deliveries', value: '24', change: '+3', trend: 'up', icon: 'deliveries' },
]

export const dashboardLineChart = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  series: [
    { key: 'donations', label: 'Donations', color: '#AF101A', values: [3200, 4100, 3800, 4500] },
    { key: 'distributed', label: 'Distributed', color: '#D64545', values: [2800, 3500, 3200, 3900] },
    { key: 'beneficiaries', label: 'Beneficiaries', color: '#7A0B12', values: [2100, 2600, 2400, 3100] },
  ],
}

export const dashboardCategoryChart = [
  { label: 'Medical', value: 3200 },
  { label: 'Food', value: 5800 },
  { label: 'Both', value: 4100 },
  { label: 'Education', value: 2400 },
  { label: 'Relief', value: 3600 },
]

export const pendingTasks = [
  { id: 1, title: 'Verify 15 pending donations', priority: 'High', icon: 'alert' },
  { id: 2, title: 'Review 8 volunteer applications', priority: 'Medium', icon: 'check' },
  { id: 3, title: 'Approve 3 beneficiary requests', priority: 'High', icon: 'alert' },
  { id: 4, title: 'Restock 18 low inventory items', priority: 'Medium', icon: 'check' },
]

export const recentActivity = [
  { id: 1, action: 'New donation received', detail: '₱25,000 from Juan dela Cruz', time: '5 min ago', type: 'donation' },
  { id: 2, action: 'Distribution completed', detail: 'Talisay relief packs — 150 beneficiaries', time: '1 hr ago', type: 'distribution' },
  { id: 3, action: 'Volunteer approved', detail: 'Ana Lim — Disaster Relief program', time: '2 hrs ago', type: 'volunteer' },
  { id: 4, action: 'Assistance request received', detail: 'AST-M3K1B — Medical assistance, Minglanilla', time: '3 hrs ago', type: 'beneficiary' },
  { id: 5, action: 'Low stock alert', detail: 'Rice sacks — 45 remaining (threshold: 100)', time: '4 hrs ago', type: 'inventory' },
]

export const donations = [
  { id: 'DON-K2F9A', donor: 'Juan Reyes', type: 'Monetary', amount: '₱5,000', status: 'Verified', date: '2026-06-30', trackingCode: 'DON-K2F9A' },
  { id: 'DON-P7M2C', donor: 'SM Foundation', type: 'In-Kind', amount: '200 rice sacks', status: 'Pending Verification', date: '2026-06-29', trackingCode: 'DON-P7M2C' },
  { id: 'DON-R4N8D', donor: 'Lisa Tan', type: 'Monetary', amount: '₱25,000', status: 'Pending Verification', date: '2026-06-29', trackingCode: 'DON-R4N8D' },
  { id: 'DON-T1Q5E', donor: 'Cebu Business Council', type: 'Monetary', amount: '₱100,000', status: 'Allocated', date: '2026-06-28', trackingCode: 'DON-T1Q5E' },
  { id: 'DON-W8S3F', donor: 'Anonymous', type: 'In-Kind', amount: '50 hygiene kits', status: 'In Inventory', date: '2026-06-27', trackingCode: 'DON-W8S3F' },
  { id: 'DON-X2U6G', donor: 'Pedro Santos', type: 'Monetary', amount: '₱2,500', status: 'Distributed', date: '2026-06-25', trackingCode: 'DON-X2U6G' },
]

export const donors = [
  { id: 'DNR-001', name: 'Juan Reyes', email: 'juan.reyes@email.com', phone: '+63 917 123 4567', totalDonated: '₱45,000', donations: 8, lastDonation: '2026-06-30' },
  { id: 'DNR-002', name: 'SM Foundation', email: 'partnerships@smfoundation.org', phone: '+63 2 8888 888', totalDonated: '₱850,000', donations: 12, lastDonation: '2026-06-15' },
  { id: 'DNR-003', name: 'Lisa Tan', email: 'lisa.tan@email.com', phone: '+63 918 234 5678', totalDonated: '₱125,000', donations: 15, lastDonation: '2026-06-29' },
  { id: 'DNR-004', name: 'Cebu Business Council', email: 'info@cebu-business.org', phone: '+63 32 234 5678', totalDonated: '₱500,000', donations: 6, lastDonation: '2026-06-28' },
  { id: 'DNR-005', name: 'Pedro Santos', email: 'pedro.s@email.com', phone: '+63 919 345 6789', totalDonated: '₱18,500', donations: 5, lastDonation: '2026-06-25' },
]

export const beneficiaries = [
  { id: 'BEN-101', name: 'Roberto Dela Cruz', category: 'Disaster Relief', barangay: 'Talisay', status: 'Approved', requests: 2, lastAssistance: '2026-06-28' },
  { id: 'BEN-102', name: 'Elena Reyes', category: 'Medical Missions', barangay: 'Toledo', status: 'Pending Approval', requests: 1, lastAssistance: '—' },
  { id: 'BEN-103', name: 'Maria Santos', category: 'Educational Sponsorship', barangay: 'Cebu City', status: 'Approved', requests: 1, lastAssistance: '2026-06-20' },
  { id: 'BEN-104', name: 'Josefa Mendoza', category: 'Community Outreach', barangay: 'Lahug', status: 'Approved', requests: 3, lastAssistance: '2026-05-30' },
  { id: 'BEN-105', name: 'Carlos Villanueva', category: 'Feeding Programs', barangay: 'Minglanilla', status: 'Pending Approval', requests: 1, lastAssistance: '—' },
]

export const assistanceRequests = [
  { id: 'AST-M3K1B', beneficiary: 'Elena Reyes', type: 'Medical Missions', status: 'Under Review', date: '2026-06-30', priority: 'High' },
  { id: 'AST-N7P4C', beneficiary: 'Carlos Villanueva', type: 'Feeding Programs', status: 'Pending Review', date: '2026-06-29', priority: 'Medium' },
  { id: 'AST-O2Q8D', beneficiary: 'Roberto Dela Cruz', type: 'Disaster Relief', status: 'Approved', date: '2026-06-28', priority: 'High' },
  { id: 'AST-P5R1E', beneficiary: 'Ana Gutierrez', type: 'Educational Sponsorship', status: 'Allocated', date: '2026-06-27', priority: 'Low' },
]

export const inventory = [
  { id: 'INV-001', item: 'Rice (50kg sacks)', quantity: 45, unit: 'sacks', status: 'Low Stock', allocated: 120, distributed: 835 },
  { id: 'INV-002', item: 'Canned goods', quantity: 1200, unit: 'cans', status: 'Available', allocated: 300, distributed: 4500 },
  { id: 'INV-003', item: 'Hygiene kits', quantity: 280, unit: 'kits', status: 'Available', allocated: 50, distributed: 670 },
  { id: 'INV-004', item: 'Relief packs (assembled)', quantity: 350, unit: 'packs', status: 'Available', allocated: 150, distributed: 4200 },
  { id: 'INV-005', item: 'School supply kits', quantity: 18, unit: 'kits', status: 'Low Stock', allocated: 30, distributed: 452 },
  { id: 'INV-006', item: 'Bottled water (cases)', quantity: 500, unit: 'cases', status: 'Available', allocated: 100, distributed: 1200 },
]

export const repackingJobs = [
  { id: 'RPK-001', source: 'Rice (50kg sacks)', output: 'Relief packs', quantity: 200, status: 'In Progress', assignedTo: 'Staff Team A', dueDate: '2026-07-01' },
  { id: 'RPK-002', source: 'Canned goods + Hygiene kits', output: 'Family relief packs', quantity: 150, status: 'Scheduled', assignedTo: 'Volunteer Group B', dueDate: '2026-07-03' },
  { id: 'RPK-003', source: 'School supplies', output: 'School kits', quantity: 50, status: 'Completed', assignedTo: 'Staff Team B', dueDate: '2026-06-28' },
]

export const allocations = [
  { id: 'ALC-001', resource: 'Relief packs', quantity: 150, program: 'Disaster Relief', beneficiary: 'Talisay flood victims', status: 'Reserved', date: '2026-06-30' },
  { id: 'ALC-002', resource: 'School supply kits', quantity: 30, program: 'Educational Sponsorship', beneficiary: 'Cebu City scholars', status: 'Allocated', date: '2026-06-29' },
  { id: 'ALC-003', resource: 'Hygiene kits', quantity: 100, program: 'Medical Missions', beneficiary: 'Toledo barangays', status: 'Pending', date: '2026-06-29' },
  { id: 'ALC-004', resource: 'Rice sacks', quantity: 50, program: 'Feeding Programs', beneficiary: 'Minglanilla community kitchen', status: 'Allocated', date: '2026-06-28' },
]

export const distributions = [
  { id: 'DST-001', location: 'Talisay', program: 'Disaster Relief', date: '2026-07-02', beneficiaries: 150, volunteers: 8, vehicles: 2, status: 'Scheduled', type: 'Delivery' },
  { id: 'DST-002', location: 'Cebu City', program: 'Educational Sponsorship', date: '2026-07-05', beneficiaries: 45, volunteers: 4, vehicles: 1, status: 'Scheduled', type: 'Pickup' },
  { id: 'DST-003', location: 'Toledo', program: 'Medical Missions', date: '2026-06-28', beneficiaries: 320, volunteers: 15, vehicles: 3, status: 'Completed', type: 'Delivery' },
  { id: 'DST-004', location: 'Minglanilla', program: 'Feeding Programs', date: '2026-07-08', beneficiaries: 200, volunteers: 6, vehicles: 1, status: 'Planning', type: 'Delivery' },
]

export const volunteers = [
  { id: 'VOL-201', name: 'Ana Lim', email: 'ana.lim@email.com', programs: ['Disaster Relief'], status: 'Approved', hours: 48, assignedTasks: 3 },
  { id: 'VOL-202', name: 'Mark Rivera', email: 'mark.r@email.com', programs: ['Medical Missions', 'Community Outreach'], status: 'Pending Review', hours: 0, assignedTasks: 0 },
  { id: 'VOL-203', name: 'Grace Ocampo', email: 'grace.o@email.com', programs: ['Feeding Programs'], status: 'Active', hours: 120, assignedTasks: 2 },
  { id: 'VOL-204', name: 'Ryan Cruz', email: 'ryan.cruz@email.com', programs: ['Educational Sponsorship'], status: 'Assigned', hours: 24, assignedTasks: 1 },
  { id: 'VOL-205', name: 'Jenny Morales', email: 'jenny.m@email.com', programs: ['Disaster Relief', 'Feeding Programs'], status: 'Pending Review', hours: 0, assignedTasks: 0 },
]

export const staff = [
  { id: 'STF-001', name: 'Carlos Mendoza', email: 'carlos.m@riseabovefoundation.org', role: 'Staff', department: 'Operations', status: 'Active' },
  { id: 'STF-002', name: 'Patricia Go', email: 'patricia.g@riseabovefoundation.org', role: 'Staff', department: 'Logistics', status: 'Active' },
  { id: 'STF-003', name: 'Ramon Villareal', email: 'ramon.v@riseabovefoundation.org', role: 'Staff', department: 'Beneficiary Services', status: 'Active' },
  { id: 'STF-004', name: 'Maria Dela Cruz', email: 'admin@riseabovefoundation.org', role: 'Admin', department: 'Management', status: 'Active' },
]

export const tasks = {
  todo: [
    { id: 'TSK-001', title: 'Verify donation DON-P7M2C', assignee: 'Carlos Mendoza', priority: 'High', due: '2026-06-30', module: 'Donations' },
    { id: 'TSK-002', title: 'Review volunteer application — Mark Rivera', assignee: 'Patricia Go', priority: 'Medium', due: '2026-07-01', module: 'Volunteers' },
    { id: 'TSK-003', title: 'Approve beneficiary — Carlos Villanueva', assignee: 'Ramon Villareal', priority: 'Medium', due: '2026-07-01', module: 'Beneficiaries' },
  ],
  inProgress: [
    { id: 'TSK-004', title: 'Repack 200 relief packs', assignee: 'Staff Team A', priority: 'High', due: '2026-07-01', module: 'Inventory' },
    { id: 'TSK-005', title: 'Plan Talisay distribution route', assignee: 'Patricia Go', priority: 'High', due: '2026-07-02', module: 'Distribution' },
  ],
  review: [
    { id: 'TSK-006', title: 'Generate OR for Lisa Tan donation', assignee: 'Carlos Mendoza', priority: 'Low', due: '2026-06-30', module: 'Donations' },
  ],
  done: [
    { id: 'TSK-007', title: 'Complete Toledo medical mission report', assignee: 'Ramon Villareal', priority: 'Medium', due: '2026-06-28', module: 'Reports' },
    { id: 'TSK-008', title: 'Update inventory after repacking job RPK-003', assignee: 'Carlos Mendoza', priority: 'Medium', due: '2026-06-28', module: 'Inventory' },
  ],
}

export const certificates = [
  { id: 'CERT-001', type: 'Certificate of Donation', recipient: 'Juan Reyes', reference: 'DON-K2F9A', date: '2026-06-30', status: 'Generated' },
  { id: 'CERT-002', type: 'Official Receipt', recipient: 'Lisa Tan', reference: 'DON-R4N8D', date: '—', status: 'Pending' },
  { id: 'CERT-003', type: 'Certificate of Volunteer Service', recipient: 'Grace Ocampo', reference: 'VOL-203', date: '2026-06-25', status: 'Generated' },
  { id: 'CERT-004', type: 'Certificate of Participation', recipient: 'Ana Lim', reference: 'DST-003', date: '2026-06-28', status: 'Generated' },
  { id: 'CERT-005', type: 'Official Receipt', recipient: 'Cebu Business Council', reference: 'DON-T1Q5E', date: '2026-06-29', status: 'Generated' },
]

export const reportSummary = {
  donationsThisMonth: '₱1.2M',
  donationsLastMonth: '₱980K',
  beneficiariesServed: 1240,
  distributionsCompleted: 12,
  volunteerHours: 1840,
  inventoryTurnover: '78%',
}

export const chartData = {
  donationsByMonth: [
    { month: 'Jan', amount: 450 },
    { month: 'Feb', amount: 520 },
    { month: 'Mar', amount: 680 },
    { month: 'Apr', amount: 590 },
    { month: 'May', amount: 820 },
    { month: 'Jun', amount: 1200 },
  ],
  demandVsSupply: [
    { program: 'Disaster Relief', demand: 85, supply: 72 },
    { program: 'Educational', demand: 60, supply: 55 },
    { program: 'Feeding', demand: 90, supply: 88 },
    { program: 'Medical', demand: 45, supply: 40 },
    { program: 'Outreach', demand: 55, supply: 50 },
  ],
  volunteerHoursByMonth: [
    { month: 'Jan', hours: 220 },
    { month: 'Feb', hours: 280 },
    { month: 'Mar', hours: 310 },
    { month: 'Apr', hours: 290 },
    { month: 'May', hours: 340 },
    { month: 'Jun', hours: 400 },
  ],
  beneficiariesByProgram: [
    { program: 'Disaster Relief', count: 420 },
    { program: 'Medical', count: 310 },
    { program: 'Feeding', count: 380 },
    { program: 'Education', count: 260 },
    { program: 'Outreach', count: 190 },
  ],
  distributionByLocation: [
    { location: 'Cebu City', count: 45 },
    { location: 'Talisay', count: 38 },
    { location: 'Minglanilla', count: 32 },
    { location: 'Toledo', count: 28 },
    { location: 'Lahug', count: 22 },
  ],
}

export const contentItems = {
  programs: 5,
  stories: 4,
  partners: 6,
  announcements: 3,
}
