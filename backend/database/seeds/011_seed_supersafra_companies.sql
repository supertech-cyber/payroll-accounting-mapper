-- Seed: Super Safra companies
-- CNPJ 18.455.602/0001-07 → 18455602000107 (14 digits)
-- CNPJ 18.455.602/0003-60 → 18455602000360 (14 digits)
-- CNPJ base (first 8 digits): 18455602

INSERT INTO companies (code, name, cnpj, cnpj_base, output_template)
VALUES
    ('2023', 'Super Safra Comercial Agricola Ltda.',    '18455602000107', '18455602', 'fpa-elevor'),
    ('2502', 'SUPER SAFRA COMERCIAL AGRICOLA LTDA.', '18455602000360', '18455602', 'fpa-elevor')
ON CONFLICT (code) DO UPDATE
    SET name            = EXCLUDED.name,
        cnpj            = EXCLUDED.cnpj,
        cnpj_base       = EXCLUDED.cnpj_base,
        output_template = EXCLUDED.output_template;
