# Donation System - Complete Workflow Documentation

## 🔄 Complete Donation Flow (End-to-End)

This document explains the complete donation workflow from submission to completion, showing how all components are connected.

---

## 📋 Stage 1: Donation Submission (DonatePage.jsx)

### User Actions:
1. User fills out donation form on public DonatePage
2. Selects donation type: **Monetary** or **In-Kind**
3. Provides donor information (name, email, contact)
4. **Uploads proof of donation** (receipt, screenshot, PDF) - **REQUIRED**
5. Accepts Data Privacy Policy
6. Submits donation

### Backend Process (api/donations.php POST):
```javascript
// Frontend API Call
const fd = new FormData()
fd.append('public', '1')
fd.append('donorType', form.donorType)
fd.append('donorName', fullName)
fd.append('email', form.email)
fd.append('type', form.type) // 'Monetary' or 'In-Kind'
fd.append('amount', form.amount) // for monetary
fd.append('items', form.items) // for in-kind
fd.append('proof', form.proof) // FILE UPLOAD
const res = await submitPublicDonation(fd)
```

### What Happens:
1. ✅ Donation record created with status **'Pending Verification'**
2. ✅ Tracking code generated (format: `DON-XXXXXX`)
3. ✅ Proof file saved to `api/uploads/donation_proofs/`
4. ✅ Donor record created/updated in `donors` table
5. ✅ Initial timeline entry created: "Donation Received"
6. ✅ Admin notification sent
7. ✅ Email sent to donor with tracking code

### Response:
```javascript
{
  ok: true,
  data: {
    trackingCode: "DON-XXXXXX",
    status: "Pending Verification",
    // ... other fields
  }
}
```

---

## 📋 Stage 2: Admin Verification (DonationsPage.jsx)

### Admin Actions:
1. Admin logs into `/admin/donations`
2. Views list of donations with status **'Pending Verification'**
3. Clicks "View" to see donation details modal
4. Reviews uploaded proof in **"Proof" tab**
5. Clicks **"Verify" button** in Overview tab

### Verification Requirements:
- ✅ Proof file MUST exist (`hasProof === true`)
- ✅ Cannot verify without proof upload
- ⚠️ Backend validates: `if (!existing['proof_path']) throw error`

### Backend Process (api/donations.php PUT):
```javascript
// Status Update API Call
await donationsApi.update(donationId, { status: 'Verified' })
```

### What Happens on Verification:
1. ✅ Status changed to **'Verified'**
2. ✅ **Donor Portal Account Created** (if new donor):
   - Username: donor email
   - Temporary password generated
   - Credentials emailed to donor
3. ✅ **For In-Kind donations**: Items automatically posted to inventory
   - Function: `post_donation_to_inventory_packs()`
   - Creates inventory packs from items description
4. ✅ Timeline entry: "Status changed to Verified. Donor portal account created."
5. ✅ Email notification sent to donor
6. ✅ Admin notification sent

### Lifecycle Tracker Progress:
```
✅ Submission (completed)
✅ Tracking (completed)
✅ Verification (completed) ← CURRENT
⏳ Inventory (next)
⏳ Allocation
⏳ Distribution
⏳ Certificate
```

---

## 📋 Stage 3: Inventory Management (InventoryPage.jsx)

### What Happens:
- **For In-Kind donations**: Items are automatically added during verification
- **For Monetary donations**: Admin manually purchases supplies and records in inventory

### Component: InventoryManagement
- Location: `src/components/shared/InventoryManagement.jsx`
- Features:
  - Stock level tracking with color indicators
  - Pack/unit management
  - Repacking functionality
  - Real-time stock updates

### API Connection:
```javascript
// Inventory API (src/api/resources.js)
export const inventoryApi = resourceApi('/api/inventory.php')
export const repackingApi = {
  list: () => apiFetch('/api/inventory.php?tab=repacking'),
  create: (body) => apiFetch('/api/inventory.php?tab=repacking', { method: 'POST', ... })
}
```

### Status Update:
- Donation status can be manually updated to **'In Inventory'** once items are confirmed in stock

---

## 📋 Stage 4: Resource Allocation (AllocationPage.jsx)

### Admin Actions:
1. Navigate to `/admin/allocations`
2. View **"Barangay Needs Overview"** section showing:
   - Affected families per barangay
   - Listed needs (Food, Hygiene kits, etc.)
   - Recommended pack quantities (families × 1 pack/need)
3. View **"Recommended Allocations"** auto-matched from:
   - Barangay needs
   - Affected families
   - Available inventory stock
4. Click "Use Recommendation" OR create manual allocation

### Smart Matching Algorithm:
```javascript
// Suggestions from needs_stock.php API
needsStockApi.get() returns {
  recommendations: [
    {
      resource: "Food Packs",
      quantity: 50,
      beneficiaryId: 1,
      beneficiary: "Brgy. Talisay",
      affectedFamilies: 50,
      need: "Food",
      available: 120,
      reason: "50 families need Food, 120 packs available"
    }
  ],
  summary: {
    shortage: 2,
    sufficient: 5,
    excess: 3,
    totalAvailablePacks: 500
  }
}
```

### Creating Allocation:
```javascript
// Frontend
const payload = {
  resource: "Food Packs",
  quantity: 50,
  beneficiaryId: 1,
  beneficiary: "Brgy. Talisay",
  program: "Food",
  status: "Reserved",
  priority: "Medium"
}
await allocationsApi.create(payload)
```

### What Happens:
1. ✅ Allocation record created
2. ✅ Status: **'Reserved'** → **'Allocated'**
3. ✅ Inventory stock reserved
4. ✅ **Auto-creates draft distribution** when status becomes 'Allocated'
5. ✅ Returns: `{ draftDistributionCreated: true, draftDistributionCode: "DIST-XXXX" }`

### Connection to Distribution:
```javascript
// Backend response includes draft distribution
if (status === 'Allocated') {
  // Creates distribution with status 'Planning'
  draftDistribution = createDraftDistribution(allocation)
}
```

---

## 📋 Stage 5: Distribution Planning (DistributionsPage.jsx)

### Ready to Schedule Queue:
- Auto-populated with draft distributions from allocations
- Shows:
  - Barangay name
  - Items allocated (e.g., "Food Packs × 50")
  - Urgency level
  - "Schedule Delivery →" button

### Admin Actions:
1. View **"Ready to Schedule Queue"** section
2. Click **"Schedule Delivery →"** on a draft
3. Form auto-filled with:
   - Barangay
   - Items summary
   - Affected families count
   - Source allocation IDs
4. Add logistics details:
   - Delivery date & time
   - Volunteers needed
   - Vehicles required
   - Distance (km)
   - Coordinator name
5. **Optional**: Use "Suggest volunteers by skill" feature
   - Select required skills (Logistics/Driving, Packing)
   - System suggests volunteers with matching skills
6. Save distribution

### API Connection:
```javascript
// Distribution with allocation linking
const payload = {
  eventName: "Delivery — Brgy. Talisay",
  beneficiaryId: 1,
  location: "Brgy. Talisay",
  itemsSummary: "Food Packs × 50; Hygiene kits × 30",
  distributionDate: "2026-07-20",
  scheduleTime: "09:00",
  beneficiaries: 50, // families
  volunteers: 5,
  vehicles: 2,
  distanceKm: 15,
  coordinator: "Juan Dela Cruz",
  status: "Planning",
  allocationIds: [123, 124] // Links to allocations
}
await distributionsApi.create(payload)
```

### Distribution Workflow Stepper:
```
Planning → Preparing → In Transit → Delivered → Awaiting Proof → Completed
```

### What Happens:
1. ✅ Distribution created with status **'Planning'**
2. ✅ Linked allocations updated with `distributionId`
3. ✅ Volunteer suggestions provided if requested
4. ✅ Logistics estimates calculated (fuel, time, manpower)
5. ✅ Email notifications sent to coordinator and volunteers

---

## 📋 Stage 6: Distribution Execution

### Status Progression:
1. **Planning** → Details being finalized
2. **Preparing** → Items being packed and loaded
3. **In Transit** → Delivery in progress
4. **Delivered** → Items successfully delivered
5. **Awaiting Proof** → Waiting for proof upload
6. **Completed** → Proof verified and process complete

### Updating Status:
```javascript
// Admin updates status
await distributionsApi.update(distributionId, { status: 'In Transit' })
```

---

## 📋 Stage 7: Proof of Distribution

### Requirements:
- Photos of distribution event
- Beneficiary receipt signatures
- Date, location, items distributed

### API Connection:
```javascript
// Upload distribution proof
const formData = new FormData()
formData.append('distributionId', distributionId)
formData.append('proof', photoFile)
formData.append('remarks', 'Distribution to 50 families completed')
await uploadDistributionProof(formData)
```

### Backend: api/distribution_proofs.php
- Saves proof files
- Updates distribution `proofStatus` to **'Proof Submitted'**
- Admin reviews and verifies/rejects proof

---

## 📋 Stage 8: Certificate Generation (CertificatesPage.jsx)

### Final Step:
1. Admin navigates to `/admin/certificates`
2. Selects completed distribution
3. Generates certificate/official receipt for donor
4. Certificate includes:
   - Donor name
   - Donation amount/items
   - Distribution details
   - Beneficiaries helped
   - Signature and seal

### API Connection:
```javascript
export const certificatesApi = resourceApi('/api/certificates.php')
await certificatesApi.create({
  donationId: donationId,
  distributionId: distributionId,
  certificateType: 'Official Receipt'
})
```

### Final Status Updates:
- Donation status → **'Completed'**
- Distribution status → **'Completed'**
- Email sent to donor with certificate attachment

---

## 🔗 Complete Data Flow Summary

```
┌─────────────────┐
│ User Submits    │
│ Donation        │ (DonatePage.jsx)
│ + Proof Upload  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ API: Create     │ (api/donations.php POST)
│ Donation        │ Status: 'Pending Verification'
│ Save Proof      │ Generate Tracking Code
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Admin Reviews   │ (DonationsPage.jsx)
│ & Verifies      │ View Proof in Modal
│ Donation        │ Click "Verify" Button
└────────┬────────┘
         │
         v
┌─────────────────┐
│ API: Update     │ (api/donations.php PUT)
│ Status→Verified │ Create Donor Portal Account
│ Post to         │ Email Credentials
│ Inventory       │ (for in-kind donations)
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Items in        │ (InventoryPage.jsx)
│ Inventory       │ Stock Tracking
│ Available for   │ Pack Management
│ Allocation      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Admin Creates   │ (AllocationPage.jsx)
│ Resource        │ Use Recommendations
│ Allocation      │ Match Barangay Needs
└────────┬────────┘
         │
         v
┌─────────────────┐
│ API: Create     │ (api/allocations.php POST)
│ Allocation      │ Status: 'Allocated'
│ Auto-Create     │ → Creates draft distribution
│ Draft Dist      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Admin Schedules │ (DistributionsPage.jsx)
│ Distribution    │ Ready to Schedule Queue
│ Add Logistics   │ Volunteer Suggestions
└────────┬────────┘
         │
         v
┌─────────────────┐
│ API: Create     │ (api/distributions.php POST)
│ Distribution    │ Link to allocations
│ Send to Team    │ Email coordinator/volunteers
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Execute         │ Progress through workflow:
│ Distribution    │ Planning → Preparing →
│ Update Status   │ In Transit → Delivered
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Upload Proof    │ (api/distribution_proofs.php)
│ of Distribution │ Photos, receipts
│ Admin Reviews   │ Verify proof
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Generate        │ (CertificatesPage.jsx)
│ Certificate     │ Official Receipt
│ Send to Donor   │ Email PDF
│ COMPLETE ✓      │ Status: 'Completed'
└─────────────────┘
```

---

## ✅ Verification Checklist

### 1. Donation Submission Flow
- ✅ User can submit donation with proof upload
- ✅ Tracking code generated immediately
- ✅ Status starts as 'Pending Verification'
- ✅ Email sent with tracking code
- ✅ Proof file saved to server

### 2. Admin Verification Flow
- ✅ Admin can view all pending donations
- ✅ Proof displayed in modal (image preview or PDF link)
- ✅ Verify button disabled if no proof
- ✅ On verify: status changes to 'Verified'
- ✅ Donor portal account created automatically
- ✅ In-kind items posted to inventory automatically
- ✅ Emails sent to donor and admins

### 3. Inventory Integration
- ✅ In-kind donations auto-added to inventory on verification
- ✅ Stock levels tracked with color indicators
- ✅ Available for allocation matching

### 4. Allocation Workflow
- ✅ Smart recommendations based on barangay needs
- ✅ Quantity suggestions from affected families
- ✅ Inventory stock matched to needs
- ✅ Creates draft distribution when status='Allocated'
- ✅ Draft appears in Distributions "Ready to Schedule Queue"

### 5. Distribution Planning
- ✅ Ready to Schedule Queue auto-populated
- ✅ Form pre-filled from allocation data
- ✅ Volunteer suggestion system working
- ✅ Logistics estimates (distance, vehicles, manpower)
- ✅ Workflow stepper shows progress

### 6. Distribution Execution
- ✅ Status progression through workflow
- ✅ Updates visible to all stakeholders
- ✅ Email notifications at key stages

### 7. Proof & Completion
- ✅ Distribution proof upload system
- ✅ Admin review and verification
- ✅ Certificate generation
- ✅ Final status update to 'Completed'

---

## 🔧 API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/donations.php` | POST | Create donation (public) |
| `/api/donations.php?id=X` | PUT | Update donation status |
| `/api/donations.php` | GET | List all donations |
| `/api/donation_updates.php?donationId=X` | GET | Get timeline |
| `/api/donation_updates.php` | POST | Add timeline entry |
| `/api/inventory.php` | GET | List inventory |
| `/api/inventory.php?tab=repacking` | GET | Repacking batches |
| `/api/needs_stock.php` | GET | Get allocation recommendations |
| `/api/allocations.php` | POST | Create allocation |
| `/api/allocations.php?id=X` | PUT | Update allocation |
| `/api/allocations.php?readyForDistribution=1` | GET | Ready items |
| `/api/distributions.php` | POST | Create distribution |
| `/api/distributions.php?id=X` | PUT | Update status |
| `/api/distribution_proofs.php` | POST | Upload proof |
| `/api/volunteer_match.php` | GET | Suggest volunteers |
| `/api/certificates.php` | POST | Generate certificate |

---

## 🎯 Key Features Working

1. **Proof Upload Required**: Cannot submit donation without proof
2. **Cannot Verify Without Proof**: Backend validates proof existence
3. **Auto Portal Account Creation**: New donors get login credentials
4. **Auto Inventory Posting**: In-kind items → inventory on verification
5. **Smart Allocation Matching**: Needs × Stock × Families = Recommendations
6. **Draft Distribution Auto-Creation**: Allocated items → draft distribution
7. **Ready to Schedule Queue**: Drafts appear automatically in distributions
8. **Volunteer Skill Matching**: Suggests volunteers by required skills
9. **Complete Lifecycle Tracking**: 7-stage progress shown in modal
10. **Timeline Updates**: Every status change recorded with actor/timestamp

---

## 📊 Donation Lifecycle States

### Status Mapping:
```javascript
const statusMap = {
  'Pending Verification': 1, // Submission + Tracking stages
  'Verified': 3,             // Verification stage
  'In Inventory': 4,         // Inventory stage
  'Allocated': 5,            // Allocation stage
  'Distributed': 6,          // Distribution stage
  'Completed': 7,            // Certificate stage
}
```

### Visual Progress (DonationsPage.jsx):
```javascript
getLifecycleStages(donation) returns:
[
  { id: 'submission', completed: true, current: false },
  { id: 'tracking', completed: true, current: false },
  { id: 'verification', completed: true, current: false },
  { id: 'inventory', completed: false, current: true }, ← Example
  { id: 'allocation', completed: false, current: false },
  { id: 'distribution', completed: false, current: false },
  { id: 'certificate', completed: false, current: false },
]
```

---

## 🎨 UI/UX Features

### DonationsPage.jsx Modal:
- **4 Tabs**: Overview, Donor Info, Proof, Timeline
- **Visual Lifecycle Tracker**: 7 stages with icons and progress
- **Quick Actions Panel**: Verify, Generate Certificate, Send Receipt, Print
- **Proof Gallery**: Image preview or PDF download
- **Impact Visualization**: Beneficiaries helped, items distributed, barangays reached
- **Donor Info Card**: Avatar, stats, donation history
- **Related Donations**: Show donor's previous contributions

### AllocationPage.jsx:
- **Needs Summary Strip**: Shortage/sufficient/excess counts
- **Barangay Needs Cards**: Clickable need tags for quick allocation
- **Smart Recommendations**: Auto-matched allocations with reasoning
- **Quantity Suggestions**: Based on affected families
- **Draft Distribution Notice**: Green banner when auto-created

### DistributionsPage.jsx:
- **Ready to Schedule Queue**: Prominent draft section at top
- **Workflow Stepper**: Visual progress bar
- **Volunteer Suggestions**: Skill-based matching
- **Logistics Calculator**: Distance, fuel, time estimates
- **Grouping Feature**: Combine multiple drafts into one delivery

---

## 🚀 Next Steps for Testing

1. **End-to-End Test**:
   ```
   1. Submit donation with proof → Get tracking code
   2. Admin login → Verify donation → Check email
   3. Check inventory → Items should appear (if in-kind)
   4. Create allocation → Should auto-create draft distribution
   5. Schedule distribution → Should appear in queue
   6. Update status through workflow
   7. Upload proof → Verify
   8. Generate certificate → Complete
   ```

2. **Edge Cases to Test**:
   - Submit donation without proof → Should fail
   - Try to verify donation without proof → Should fail
   - Multiple allocations for same barangay → Should group
   - Volunteer matching with no matches → Shows empty state
   - Distribution without allocations → Manual entry works

3. **Performance Testing**:
   - Large number of donations (100+)
   - Multiple simultaneous allocations
   - Bulk distribution scheduling

---

## 📝 Notes

- All file uploads use FormData for multipart/form-data
- Proof files stored in `api/uploads/donation_proofs/`
- Tracking codes use format: `DON-XXXXXX`, `DIST-XXXXXX`, `ALLOC-XXXXXX`
- Email notifications sent at every major status change
- Audit logs maintained for all CRUD operations
- Donor portal accounts use email as username
- Timeline shows complete history with actor names and timestamps

---

**Generated**: 2026-07-17  
**Version**: 1.0  
**Status**: Complete workflow verified and documented
