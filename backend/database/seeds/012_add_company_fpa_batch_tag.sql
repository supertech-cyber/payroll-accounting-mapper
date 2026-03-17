-- Migration: Add fpa_batch (FPA company code) and tag (grouping label) columns to companies
-- Also removes the placeholder 'supersafra' company that should not exist

ALTER TABLE companies ADD COLUMN IF NOT EXISTS fpa_batch INT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tag VARCHAR(50);

-- Set FPA de-para codes and grouping tag for the two Supersafra companies
UPDATE companies SET fpa_batch = 1, tag = 'supersafra' WHERE code = '2023';
UPDATE companies SET fpa_batch = 3, tag = 'supersafra' WHERE code = '2502';

-- Remove the placeholder company that should not exist
DELETE FROM companies WHERE code = 'supersafra';
