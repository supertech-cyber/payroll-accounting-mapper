-- ============================================================
-- 017 — Ampliar cost_centers.code de varchar(20) para varchar(255)
--       e corrigir códigos de CC que usam texto completo como chave.
--
-- Contexto: empresas sem CCs numéricos usam o texto completo do
-- relatório como código (ex: "Colaboradores sem centro de custo",
-- "(Empresa) Agefer Comercio e Cereais LTDA").
-- ============================================================

-- 1. Ampliar coluna
ALTER TABLE cost_centers ALTER COLUMN code TYPE VARCHAR(255);

-- 2. Camsul (128): SEM_CC → texto real
UPDATE cost_centers
SET code = 'Colaboradores sem centro de custo',
    name = 'Colaboradores sem centro de custo'
WHERE company_id = (SELECT id FROM companies WHERE code = '128')
  AND code = 'SEM_CC';

-- 3. Agefer (378): renomear CC '1' (sem CC numérico) → texto real
UPDATE cost_centers
SET code = 'Colaboradores sem centro de custo',
    name = 'Colaboradores sem centro de custo'
WHERE company_id = (SELECT id FROM companies WHERE code = '378')
  AND code = '1'
  AND name ILIKE '%sem centro%';

-- 4. Agefer (378): CC de empresa para provisões
INSERT INTO cost_centers (code, name, company_id)
VALUES ('(Empresa) Agefer Comercio e Cereais LTDA', 'Agefer Comercio e Cereais LTDA',
        (SELECT id FROM companies WHERE code = '378'))
ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name;

-- 5. Zamarchi (2591): SEM_CC → texto real
UPDATE cost_centers
SET code = 'Colaboradores sem centro de custo',
    name = 'Colaboradores sem centro de custo'
WHERE company_id = (SELECT id FROM companies WHERE code = '2591')
  AND code = 'SEM_CC';

-- 6. Zamarchi (2591): EMPRESA_1 → texto real
UPDATE cost_centers
SET code = '(Empresa) CEREALISTA ZAMARCHI LTDA',
    name = 'CEREALISTA ZAMARCHI LTDA'
WHERE company_id = (SELECT id FROM companies WHERE code = '2591')
  AND code = 'EMPRESA_1';

-- 7. SB Rubenich (1036): SEM_CC → texto real
UPDATE cost_centers
SET code = 'Colaboradores sem centro de custo',
    name = 'Colaboradores sem centro de custo'
WHERE company_id = (SELECT id FROM companies WHERE code = '1036')
  AND code = 'SEM_CC';

-- 8. SB Rubenich (1036): deletar EMPRESA_1/2/3 (CCs da Supersafra que vazaram)
DELETE FROM event_mappings
WHERE cost_center_id IN (
    SELECT cc.id FROM cost_centers cc
    JOIN companies c ON c.id = cc.company_id
    WHERE c.code = '1036' AND cc.code IN ('EMPRESA_1','EMPRESA_2','EMPRESA_3')
);
DELETE FROM cost_centers
WHERE company_id = (SELECT id FROM companies WHERE code = '1036')
  AND code IN ('EMPRESA_1','EMPRESA_2','EMPRESA_3');

-- 9. SB Rubenich: CCs de empresa para provisões
INSERT INTO cost_centers (code, name, company_id)
VALUES ('(Empresa) S B Rubenich e Cia Ltda', 'S B Rubenich e Cia Ltda',
        (SELECT id FROM companies WHERE code = '1036')),
       ('(Empresa) S B Rubenich & Cia Ltda', 'S B Rubenich & Cia Ltda',
        (SELECT id FROM companies WHERE code = '1041'))
ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name;

-- 10. Copiar event_mappings para novos CCs (Empresa) de Agefer e SB Rubenich
INSERT INTO event_mappings (event_id, cost_center_id, credit_account, debit_account)
SELECT em.event_id,
       (SELECT id FROM cost_centers WHERE company_id=(SELECT id FROM companies WHERE code='378')
        AND code='(Empresa) Agefer Comercio e Cereais LTDA'),
       em.credit_account, em.debit_account
FROM event_mappings em
WHERE em.cost_center_id = (
    SELECT id FROM cost_centers
    WHERE company_id=(SELECT id FROM companies WHERE code='378')
      AND code='Colaboradores sem centro de custo'
)
ON CONFLICT (event_id, cost_center_id) DO NOTHING;

INSERT INTO event_mappings (event_id, cost_center_id, credit_account, debit_account)
SELECT em.event_id,
       (SELECT id FROM cost_centers WHERE company_id=(SELECT id FROM companies WHERE code='1036')
        AND code='(Empresa) S B Rubenich e Cia Ltda'),
       em.credit_account, em.debit_account
FROM event_mappings em
WHERE em.cost_center_id = (
    SELECT id FROM cost_centers
    WHERE company_id=(SELECT id FROM companies WHERE code='1036')
      AND code='Colaboradores sem centro de custo'
)
ON CONFLICT (event_id, cost_center_id) DO NOTHING;

INSERT INTO event_mappings (event_id, cost_center_id, credit_account, debit_account)
SELECT em.event_id,
       (SELECT id FROM cost_centers WHERE company_id=(SELECT id FROM companies WHERE code='1041')
        AND code='(Empresa) S B Rubenich & Cia Ltda'),
       em.credit_account, em.debit_account
FROM event_mappings em
WHERE em.cost_center_id = (
    SELECT id FROM cost_centers
    WHERE company_id=(SELECT id FROM companies WHERE code='1036')
      AND code='Colaboradores sem centro de custo'
)
ON CONFLICT (event_id, cost_center_id) DO NOTHING;
