-- ========================================
-- Add entity_id linking to hierarchical tables
-- ربط جداول الهيكل الهرمي بجدول entities
-- ========================================

-- Add entity_id column to headquarters table
ALTER TABLE headquarters 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE;

-- Add entity_id column to branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE;

-- Add entity_id column to incubators table
ALTER TABLE incubators 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE;

-- Add entity_id column to platforms table
ALTER TABLE platforms 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE;

-- Add entity_id column to offices table
ALTER TABLE offices 
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE;

-- Create indexes for entity_id lookups
CREATE INDEX IF NOT EXISTS idx_headquarters_entity_id ON headquarters(entity_id);
CREATE INDEX IF NOT EXISTS idx_branches_entity_id ON branches(entity_id);
CREATE INDEX IF NOT EXISTS idx_incubators_entity_id ON incubators(entity_id);
CREATE INDEX IF NOT EXISTS idx_platforms_entity_id ON platforms(entity_id);
CREATE INDEX IF NOT EXISTS idx_offices_entity_id ON offices(entity_id);

-- Update headquarters to link with HQ001
UPDATE headquarters SET entity_id = 'HQ001' WHERE entity_id IS NULL;

-- Update branches to link with entities
UPDATE branches b SET entity_id = e.id
FROM entities e
WHERE e.type = 'BRANCH'
  AND b.code LIKE '%BR%'
  AND b.entity_id IS NULL
  AND SUBSTRING(e.id, 3)::INT = b.id;

-- For test data: link branch 9 with BR015
UPDATE branches SET entity_id = 'BR015' WHERE id = 9 AND entity_id IS NULL;

-- For test data: link incubators with their entities
UPDATE incubators i SET entity_id = e.id
FROM entities e
WHERE e.type = 'INCUBATOR'
  AND i.entity_id IS NULL
  AND SUBSTRING(e.id, 4)::INT = i.id;

-- For test data: link platforms with their entities
UPDATE platforms p SET entity_id = e.id
FROM entities e
WHERE e.type = 'PLATFORM'
  AND p.entity_id IS NULL
  AND SUBSTRING(e.id, 4)::INT = p.id;

-- For test data: link offices with their entities
UPDATE offices o SET entity_id = e.id
FROM entities e
WHERE e.type = 'OFFICE'
  AND o.entity_id IS NULL
  AND SUBSTRING(e.id, 4)::INT = o.id;

-- Success message
SELECT 'تم إضافة ربط entities بنجاح ✅' AS message;

