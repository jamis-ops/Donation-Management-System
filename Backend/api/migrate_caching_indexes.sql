-- ====================================================================
-- Performance & Caching Query Optimization Indexes
-- Rise Above Foundation Cebu - Donation & Operations Management System
-- ====================================================================

-- 1. Donations: filtering by status and ordering by donation_date / created_at
CREATE INDEX IF NOT EXISTS idx_donations_status_date ON donations (status, donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_created_status ON donations (created_at, status);

-- 2. Distributions: filtering by status and date
CREATE INDEX IF NOT EXISTS idx_distributions_status_date ON distributions (status, distribution_date);
CREATE INDEX IF NOT EXISTS idx_distributions_updated_status ON distributions (updated_at, status);

-- 3. Allocations: filtering by status and creation time
CREATE INDEX IF NOT EXISTS idx_allocations_status_created ON allocations (status, created_at);

-- 4. Assistance Requests: filtering by status and request_date / created_at
CREATE INDEX IF NOT EXISTS idx_requests_status_date ON assistance_requests (status, request_date);
CREATE INDEX IF NOT EXISTS idx_requests_created_status ON assistance_requests (created_at, status);

-- 5. Inventory Items: catalog lookups by category and item_type
CREATE INDEX IF NOT EXISTS idx_inventory_category_type ON inventory_items (category, item_type);

-- 6. Beneficiaries: status and creation filtering
CREATE INDEX IF NOT EXISTS idx_beneficiaries_status_created ON beneficiaries (status, created_at);

-- 7. Volunteers: status, applicant_type and creation filtering
CREATE INDEX IF NOT EXISTS idx_volunteers_status_type ON volunteers (status, applicant_type);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_status ON volunteers (created_at, status);
