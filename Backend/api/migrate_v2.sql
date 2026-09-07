-- ============================================================
-- Rise Above Foundation — v2 Migration
-- Adds: invite flow, Critical priority, auto-distribution,
--        calamity tags, SLA tracking, emergency pinning
-- ============================================================

-- 1. Beneficiaries: invitation flow columns
ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS invitation_expires DATETIME NULL,
  ADD COLUMN IF NOT EXISTS invitation_status ENUM('none','invited','accepted','expired') DEFAULT 'none';

-- 2. Users: track who sent the invite
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invited_by_user_id BIGINT NULL;

-- 3. Assistance Requests: Critical priority, calamity tags, SLA, emergency
ALTER TABLE assistance_requests
  MODIFY COLUMN priority ENUM('Low','Medium','High','Critical') DEFAULT 'Medium';

ALTER TABLE assistance_requests
  ADD COLUMN IF NOT EXISTS calamity_tags JSON NULL,
  ADD COLUMN IF NOT EXISTS is_emergency TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_deadline DATETIME NULL,
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(120) NULL;

-- 4. Allocations: Critical priority
ALTER TABLE allocations
  MODIFY COLUMN priority ENUM('Low','Medium','High','Critical') DEFAULT 'Medium';

-- 5. Distributions: link back to request, support grouped allocations
ALTER TABLE distributions
  ADD COLUMN IF NOT EXISTS request_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS source_allocation_ids JSON NULL;

-- 6. Performance indexes
CREATE INDEX IF NOT EXISTS idx_dist_status ON distributions(status);
CREATE INDEX IF NOT EXISTS idx_alloc_status_dist ON allocations(status, distribution_id);
CREATE INDEX IF NOT EXISTS idx_req_priority_status ON assistance_requests(priority, status);
CREATE INDEX IF NOT EXISTS idx_ben_invitation ON beneficiaries(invitation_status);
CREATE INDEX IF NOT EXISTS idx_dist_beneficiary ON distributions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_req_beneficiary ON assistance_requests(beneficiary_id);
