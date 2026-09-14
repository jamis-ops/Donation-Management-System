# Database Metadata & Data Dictionary
**System:** Optimizing Resource Allocation in Disaster Relief Operations Through Web-Based Donation System  
**Organization:** Rise Above Foundation Cebu  
**Institution:** Southwestern University PHINMA — College of Information Technology  
**Course Code:** SWU 003 (Capstone Project)  
**Database Name:** `donation_system`  
**Database Management System:** MySQL 8.0 / TiDB Cloud Serverless Engine  
**Character Set & Collation:** `utf8mb4` / `utf8mb4_general_ci`  
**Storage Engine:** `InnoDB`  
**Total Tables:** 27  

---

## 1. Schema Architecture & Module Classification

The database is structured into seven (7) core functional modules supporting disaster relief workflows, volunteer deployment, inventory logistics, and public donor tracking:

| Module | Core Tables | Purpose |
| :--- | :--- | :--- |
| **Authentication & RBAC** | `roles`, `users`, `password_resets` | Multi-role authentication (Admin, Staff, Donor, Volunteer, Beneficiary), token sessions, and password recovery. |
| **Donor & Contributions** | `donors`, `donations`, `donation_updates`, `donation_procurements` | Public donor profiles, monetary & in-kind donation logs, live tracking codes, and aid procurement allocations. |
| **Beneficiary & Relief Requests**| `beneficiaries`, `need_types`, `barangay_types`, `assistance_requests` | Community profiles, barangay classifications, calamity relief requests, priority urgency scoring. |
| **Inventory & Kit Repacking** | `inventory_items`, `repacking_jobs` | Disaster relief warehouse stock, batch expiration dates, item packaging into pre-assembled family food packs. |
| **Relief Allocation & Distribution**| `distributions`, `allocations`, `distribution_proofs` | Calamity distribution events, dispatch logistics (*Assigned* → *In Transit* → *Delivered*), and photo verification. |
| **Volunteers & Task Operations** | `volunteers`, `volunteer_schedule`, `tasks`, `task_types` | Volunteer duty management, skills tracking, AI CV matching, shift schedules, and operational work tasks. |
| **System Engagement & Records** | `certificates`, `programs`, `announcements`, `partners`, `success_stories`, `notifications`, `admin_section_views` | Verifiable QR-coded digital certificates, public outreach content, audit views, and transactional user alerts. |

---

## 2. Comprehensive Entity Data Dictionary

### 2.1 Authentication & RBAC

#### Table: `roles`
*Defines access tiers and permission boundaries within the platform.*
- `id`: INT UNSIGNED, Primary Key, Auto Increment.
- `name`: VARCHAR(50), Unique, Not Null. (`Admin`, `Staff`, `Donor`, `Volunteer`, `Beneficiary`).

#### Table: `users`
*Central identity repository for all system operators and external portal accounts.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `role_id`: INT UNSIGNED, Foreign Key -> `roles(id)`.
- `full_name`: VARCHAR(120), Not Null. User's complete display name.
- `first_name`, `last_name`: VARCHAR(80), Nullable.
- `middle_initial`: VARCHAR(5), Nullable.
- `email`: VARCHAR(190), Unique, Not Null. Primary login identifier.
- `password_hash`: VARCHAR(255), Not Null. Bcrypt-hashed password.
- `status`: ENUM('ACTIVE', 'PENDING', 'DISABLED'), Default 'ACTIVE'.
- `email_verified_at`: TIMESTAMP, Nullable. Email verification timestamp.
- `verification_token`: VARCHAR(64), Nullable. Verification hash.
- `verification_sent_at`: TIMESTAMP, Nullable.
- `terms_accepted_at`, `privacy_accepted_at`: TIMESTAMP, Nullable. Compliance timestamps.
- `recovery_phone`, `phone`: VARCHAR(40), Nullable. Contact numbers.
- `birth_date`: DATE, Nullable.
- `address`: VARCHAR(255), Nullable. Physical home/barangay address.
- `emergency_contact_phone`, `emergency_contact_relation`: Contact details.
- `profile_photo`: MEDIUMTEXT, Nullable. Base64 or cloud storage photo URL.
- `created_at`, `updated_at`: Standard audit timestamps.

#### Table: `password_resets`
*Manages secure time-limited password recovery tokens.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `email`: VARCHAR(190), Indexed, Not Null. Target account email.
- `code_hash`: VARCHAR(255), Not Null. Hashed 6-digit one-time code.
- `temp_token`: VARCHAR(64), Indexed, Nullable. Ephemeral session token.
- `attempts`: INT UNSIGNED, Default 0. Brute-force throttling counter.
- `expires_at`: DATETIME, Not Null. Expiration threshold (15 minutes).
- `created_at`: TIMESTAMP, Default CURRENT_TIMESTAMP.

---

### 2.2 Donors & Contributions

#### Table: `donors`
*Registered and anonymous donor profiles.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `user_id`: BIGINT UNSIGNED, Foreign Key -> `users(id)` ON DELETE SET NULL.
- `code`: VARCHAR(20), Unique, Not Null. Generated donor reference code.
- `full_name`: VARCHAR(120), Not Null.
- `donor_type`: VARCHAR(40), Default 'Individual'. (e.g., Corporate, NGO, Individual).
- `organization`: VARCHAR(160), Nullable. Affiliated corporate entity.
- `contact_person`, `email`, `phone`, `country`, `address`: Contact info.
- `notes`: TEXT, Nullable.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `donations`
*Monetary and material in-kind contributions.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `tracking_code`: VARCHAR(20), Unique, Not Null. Public tracking identifier (e.g., `DON-2026-XXXX`).
- `donor_id`: BIGINT UNSIGNED, Foreign Key -> `donors(id)`.
- `donor_name`: VARCHAR(120), Not Null.
- `donor_email`: VARCHAR(190), Nullable.
- `type`: ENUM('Monetary', 'In-Kind'), Not Null.
- `category`: VARCHAR(60), Nullable (Food, Medicine, Emergency Supplies, Cash).
- `amount`: DECIMAL(12,2), Nullable. Monetary donation amount in PHP.
- `items_description`: VARCHAR(255), Nullable. Description of in-kind items.
- `status`: VARCHAR(50), Default 'Pending Verification'. (Verified, Allocated, Distributed).
- `payment_method`: VARCHAR(50), Nullable (GCash, Bank Transfer, PayPal, Over-the-Counter).
- `reference_number`: VARCHAR(100), Nullable. Financial transaction or deposit reference.
- `proof_file`: VARCHAR(255), Nullable. Uploaded receipt or delivery receipt photo.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `donation_updates`
*Real-time audit log and timeline tracking for each donation.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `donation_id`: BIGINT UNSIGNED, Foreign Key -> `donations(id)` ON DELETE CASCADE.
- `stage`: VARCHAR(50), Not Null. (Received, Inspected, Allocated, Dispatched).
- `note`: TEXT, Nullable. Status description visible to donor.
- `created_at`: TIMESTAMP.

#### Table: `donation_procurements`
*Connects monetary donations directly to relief item purchases.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `donation_id`: BIGINT UNSIGNED, Foreign Key -> `donations(id)`.
- `mode`: VARCHAR(50), Not Null (Direct Distribution, Item Procurement).
- `beneficiary_id`: BIGINT UNSIGNED, Foreign Key -> `beneficiaries(id)`.
- `allocated_amount`: DECIMAL(12,2), Not Null. Amount used for procurement.
- `created_at`: TIMESTAMP.

---

### 2.3 Beneficiaries & Relief Assistance

#### Table: `beneficiaries`
*Community units, barangays, evacuation centers, and individual family representatives.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `user_id`: BIGINT UNSIGNED, Foreign Key -> `users(id)` ON DELETE SET NULL.
- `code`: VARCHAR(20), Unique, Not Null. (e.g., `BEN-CEB-001`).
- `full_name`: VARCHAR(120), Not Null.
- `barangay`: VARCHAR(100), Not Null.
- `city`: VARCHAR(100), Not Null (e.g., Cebu City, Mandaue City).
- `province`: VARCHAR(100), Default 'Cebu'.
- `contact_person`, `phone`, `email`: Contact details.
- `family_members_count`: INT UNSIGNED, Default 1.
- `urgency_level`: ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), Default 'MEDIUM'.
- `status`: VARCHAR(50), Default 'Verified'.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `assistance_requests`
*Formal requests for calamity relief packs, medical aid, or emergency evacuation supplies.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `reference_code`: VARCHAR(30), Unique, Not Null. (e.g., `REQ-2026-0089`).
- `beneficiary_id`: BIGINT UNSIGNED, Foreign Key -> `beneficiaries(id)`.
- `assistance_type`: VARCHAR(80), Not Null (Family Food Packs, Hygiene Kits, Shelter Kits).
- `quantity_requested`: INT UNSIGNED, Not Null.
- `urgency`: ENUM('NORMAL', 'URGENT', 'CRITICAL'), Default 'NORMAL'.
- `status`: VARCHAR(50), Default 'Pending Evaluation'. (Approved, In Repacking, Dispatched, Fulfilled).
- `calamity_type`: VARCHAR(80), Nullable (Typhoon, Flood, Fire, Earthquake).
- `created_at`, `updated_at`: Audit timestamps.

---

### 2.4 Inventory & Repacking Logistics

#### Table: `inventory_items`
*Warehouse stock items received from donations or institutional procurements.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `code`: VARCHAR(30), Unique, Not Null. SKU/Item code.
- `item_name`: VARCHAR(150), Not Null (e.g., Canned Sardines, Rice 25kg, Bottled Water).
- `category`: VARCHAR(60), Not Null (Food, Water, Medical, Clothing, Tools).
- `unit`: VARCHAR(30), Not Null (packs, sacks, boxes, pieces, liters).
- `quantity_on_hand`: DECIMAL(10,2), Not Null DEFAULT 0.00.
- `minimum_reorder_level`: DECIMAL(10,2), Default 50.00.
- `expiry_date`: DATE, Nullable.
- `warehouse_location`: VARCHAR(100), Nullable.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `repacking_jobs`
*Work orders for bundling individual raw inventory items into standardized relief packs.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `code`: VARCHAR(30), Unique, Not Null (e.g., `RPK-2026-042`).
- `target_kit_type`: VARCHAR(100), Not Null (Standard Family Relief Pack).
- `target_quantity`: INT UNSIGNED, Not Null.
- `completed_quantity`: INT UNSIGNED, Default 0.
- `source_items`: JSON, Not Null. JSON array of component items deducted from inventory.
- `status`: ENUM('Draft', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'), Default 'Scheduled'.
- `scheduled_date`: DATE, Nullable.
- `supervisor_id`: BIGINT UNSIGNED, Foreign Key -> `users(id)`.
- `created_at`, `updated_at`: Audit timestamps.

---

### 2.5 Distributions & Proof of Delivery

#### Table: `distributions`
*Scheduled aid distribution operations dispatched to target barangays.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `code`: VARCHAR(30), Unique, Not Null (e.g., `DIST-2026-015`).
- `event_name`: VARCHAR(150), Not Null.
- `location`: VARCHAR(255), Not Null. Barangay hall, gymnasium, or distribution center.
- `target_date`: DATE, Not Null.
- `status`: ENUM('Planning', 'Ready', 'In Transit', 'Completed', 'Verified'), Default 'Planning'.
- `total_kits_allocated`: INT UNSIGNED, Default 0.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `allocations`
*Linkage between inventory relief packs and specific distribution batches.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `distribution_id`: BIGINT UNSIGNED, Foreign Key -> `distributions(id)`.
- `resource_name`: VARCHAR(120), Not Null.
- `quantity`: INT UNSIGNED, Not Null.
- `created_at`: TIMESTAMP.

#### Table: `distribution_proofs`
*Field-captured photographic proof, signed distribution manifests, and GPS verification.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `distribution_id`: BIGINT UNSIGNED, Foreign Key -> `distributions(id)`.
- `beneficiary_id`: BIGINT UNSIGNED, Foreign Key -> `beneficiaries(id)`.
- `submitted_by_user_id`: BIGINT UNSIGNED, Foreign Key -> `users(id)`.
- `photo_url`: VARCHAR(255), Not Null.
- `notes`: TEXT, Nullable.
- `verified_by_admin`: TINYINT(1), Default 0.
- `created_at`: TIMESTAMP.

---

### 2.6 Volunteers, Tasks & Scheduling

#### Table: `volunteers`
*Volunteer roster, skillsets, availability, and AI CV parser records.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `user_id`: BIGINT UNSIGNED, Foreign Key -> `users(id)` ON DELETE SET NULL.
- `code`: VARCHAR(20), Unique, Not Null (e.g., `VOL-2026-004`).
- `full_name`: VARCHAR(120), Not Null.
- `skills`: TEXT, Nullable. Comma-separated or JSON list of capabilities.
- `resume_url`: VARCHAR(255), Nullable. Uploaded curriculum vitae file.
- `ai_skills_summary`: TEXT, Nullable. Generated skills summary via Google Gemini AI.
- `hours_logged`: DECIMAL(8,2), Default 0.00.
- `status`: ENUM('Active', 'Inactive', 'On Leave'), Default 'Active'.
- `created_at`, `updated_at`: Audit timestamps.

#### Table: `volunteer_schedule` & `tasks`
*Duty assignments and operational disaster response shifts.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `volunteer_id`: BIGINT UNSIGNED, Foreign Key -> `volunteers(id)`.
- `event_date`: DATE, Not Null.
- `title`, `description`, `status`, `hours`: Operational shift metrics.

---

### 2.7 System Governance & Engagement

#### Table: `certificates`
*Cryptographically verifiable digital certificates awarded to donors and volunteers.*
- `id`: BIGINT UNSIGNED, Primary Key, Auto Increment.
- `code`: VARCHAR(32), Unique, Not Null (e.g., `CERT-DON-2026-ABCD1234`).
- `recipient_name`: VARCHAR(120), Not Null.
- `recipient_email`: VARCHAR(190), Nullable.
- `cert_type`: ENUM('DONOR_APPRECIATION', 'VOLUNTEER_HOURS', 'PARTNER_RECOGNITION').
- `issue_date`: DATE, Not Null.
- `qr_code_url`: VARCHAR(255), Nullable. Public validation URL.

#### Tables: `programs`, `announcements`, `partners`, `success_stories`, `notifications`, `admin_section_views`
*Content management, public transparency reports, in-app notifications, and audit analytics.*

---

## 3. Database Metadata Link Reference

- **Direct GitHub Repository Schema File:**  
  `https://github.com/jamis-ops/Donation-Management-System/blob/main/database/donation_system.sql`
- **Data Dictionary Specification Document:**  
  `https://github.com/jamis-ops/Donation-Management-System/blob/main/database/DATABASE_METADATA.md`
