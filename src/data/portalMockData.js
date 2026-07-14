export const donorPortal = {
  stats: [
    { label: 'Total Donated', value: '₱45,000' },
    { label: 'Donations Made', value: '8' },
    { label: 'Pending Verification', value: '1' },
    { label: 'Certificates Ready', value: '6' },
  ],
  donations: [
    { id: 'DON-K2F9A', type: 'Monetary', amount: '₱5,000', date: '2026-06-30', status: 'Verified' },
    { id: 'DON-P7M2C', type: 'In-Kind', amount: '20 rice sacks', date: '2026-06-15', status: 'Distributed' },
    { id: 'DON-R4N8D', type: 'Monetary', amount: '₱10,000', date: '2026-06-01', status: 'Pending Verification' },
  ],
}

export const volunteerPortal = {
  stats: [
    { label: 'Hours Rendered', value: '48' },
    { label: 'Assigned Tasks', value: '3' },
    { label: 'Upcoming Events', value: '2' },
    { label: 'Certificates', value: '1' },
  ],
  tasks: [
    { id: 'TSK-101', title: 'Repack relief packs', due: '2026-07-02', status: 'Assigned' },
    { id: 'TSK-102', title: 'Talisay distribution support', due: '2026-07-05', status: 'Scheduled' },
  ],
  schedule: [
    { date: '2026-07-02', event: 'Repacking shift — Cebu HQ', time: '8:00 AM' },
    { date: '2026-07-05', event: 'Talisay relief distribution', time: '6:00 AM' },
  ],
}

export const beneficiaryPortal = {
  stats: [
    { label: 'Active Requests', value: '1' },
    { label: 'Approved Assistance', value: '2' },
    { label: 'Scheduled Pickups', value: '1' },
    { label: 'Total Received', value: '3' },
  ],
  requests: [
    { id: 'AST-O2Q8D', type: 'Disaster Relief', date: '2026-06-28', status: 'Approved' },
    { id: 'AST-N7P4C', type: 'Feeding Programs', date: '2026-06-29', status: 'Under Review' },
  ],
  distributions: [
    { date: '2026-07-02', location: 'Talisay', type: 'Pickup', status: 'Scheduled' },
  ],
}

export const staffPortal = {
  stats: [
    { label: 'Donations to Verify', value: '4' },
    { label: 'Inventory Updates', value: '6' },
    { label: 'Assigned Tasks', value: '5' },
    { label: 'Distributions Today', value: '2' },
  ],
  tasks: [
    { id: 'TSK-004', title: 'Verify donation DON-P7M2C', priority: 'High', due: '2026-06-30' },
    { id: 'TSK-005', title: 'Update inventory after repacking', priority: 'Medium', due: '2026-07-01' },
  ],
}
