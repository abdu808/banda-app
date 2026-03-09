-- 1. Create backup
CREATE TABLE beneficiaries_backup_20240309 AS SELECT * FROM beneficiaries;

-- 2. Add new column
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS file_number TEXT;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_beneficiaries_file_number ON beneficiaries(file_number);
