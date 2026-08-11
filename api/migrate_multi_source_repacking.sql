-- ============================================================
-- Multi-Source Repacking Migration
-- Adds support for combining multiple inventory items into packs
-- and linking repacking to barangay needs analysis
-- ============================================================

USE donation_system;

-- Add columns to repacking_jobs table
-- source_items_json: Array of {item_id, item_name, quantity, unit}
ALTER TABLE repacking_jobs 
ADD COLUMN IF NOT EXISTS source_items_json JSON NULL COMMENT 'Array of source inventory items' AFTER source_quantity;

-- target_barangay_id: Link repacking batch to specific barangay
ALTER TABLE repacking_jobs 
ADD COLUMN IF NOT EXISTS target_barangay_id BIGINT UNSIGNED NULL COMMENT 'Target beneficiary/barangay for this batch' AFTER output_unit;

-- Add foreign key for target_barangay_id
ALTER TABLE repacking_jobs 
ADD CONSTRAINT IF NOT EXISTS fk_repacking_target_barangay 
FOREIGN KEY (target_barangay_id) REFERENCES beneficiaries(id) ON DELETE SET NULL;

-- recommended_contents_json: Smart suggestions for pack contents
ALTER TABLE repacking_jobs 
ADD COLUMN IF NOT EXISTS recommended_contents_json JSON NULL COMMENT 'AI-suggested pack contents based on needs' AFTER target_barangay_id;

-- families_targeted: Number of families this batch is intended for
ALTER TABLE repacking_jobs 
ADD COLUMN IF NOT EXISTS families_targeted INT UNSIGNED NULL COMMENT 'Number of families this batch serves' AFTER recommended_contents_json;

-- sufficiency_status: Whether available stock meets target needs
ALTER TABLE repacking_jobs 
ADD COLUMN IF NOT EXISTS sufficiency_status ENUM('Insufficient','Partial','Sufficient','Excess') NULL COMMENT 'Stock sufficiency vs needs' AFTER families_targeted;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_repacking_target_barangay ON repacking_jobs(target_barangay_id);
CREATE INDEX IF NOT EXISTS idx_repacking_status ON repacking_jobs(status);

-- Add moderate_stock_threshold to inventory_items if not exists (for better stock level calculations)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS moderate_stock_threshold INT UNSIGNED NULL COMMENT 'Moderate stock level threshold' AFTER low_stock_threshold;

-- Update existing repacking_jobs to have proper JSON structure for backward compatibility
-- Convert single source_item_id to source_items_json format
UPDATE repacking_jobs 
SET source_items_json = JSON_ARRAY(
  JSON_OBJECT(
    'item_id', source_item_id,
    'item_name', SUBSTRING_INDEX(source_items, ' (', 1),
    'quantity', source_quantity,
    'unit', SUBSTRING_INDEX(SUBSTRING_INDEX(source_items, ' (', -1), ')', 1)
  )
)
WHERE source_item_id IS NOT NULL 
  AND source_items_json IS NULL;

-- Add comment to original columns for clarity
ALTER TABLE repacking_jobs 
MODIFY COLUMN source_item_id BIGINT UNSIGNED NULL COMMENT 'Legacy: single source (use source_items_json for multi-source)';

ALTER TABLE repacking_jobs 
MODIFY COLUMN source_items VARCHAR(120) NOT NULL COMMENT 'Human-readable source summary';

-- Create view for easier querying of multi-source repacking batches
CREATE OR REPLACE VIEW v_repacking_with_barangay AS
SELECT 
  rj.*,
  b.full_name AS target_barangay_name,
  b.barangay AS target_barangay_location,
  b.municipality AS target_municipality,
  b.affected_families AS target_affected_families,
  b.needs AS target_needs,
  b.representative_name AS target_representative,
  b.representative_phone AS target_representative_phone,
  (
    SELECT COUNT(*) 
    FROM assistance_requests ar 
    WHERE ar.beneficiary_id = rj.target_barangay_id 
      AND ar.status IN ('Pending Review', 'Under Review', 'Approved', 'Allocated')
  ) AS open_requests_count
FROM repacking_jobs rj
LEFT JOIN beneficiaries b ON b.id = rj.target_barangay_id;

-- Success message
SELECT 'Multi-source repacking schema migration completed successfully!' AS status;
