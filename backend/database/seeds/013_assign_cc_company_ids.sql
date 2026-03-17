-- Assign company_id to cost centers that currently have NULL
-- EMPRESA_3 belongs to company 2502 (id=3); all others to 2023 (id=2)

UPDATE cost_centers
SET company_id = 3
WHERE code = 'EMPRESA_3'
  AND company_id IS NULL;

UPDATE cost_centers
SET company_id = 2
WHERE company_id IS NULL;
