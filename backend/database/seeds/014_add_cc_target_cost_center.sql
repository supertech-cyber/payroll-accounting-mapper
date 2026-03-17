-- Adiciona campo target_cost_center_id em cost_centers
-- Permite que um CC seja "lançado em" outro CC (ex: empresa filial -> CC administrativo)
ALTER TABLE cost_centers
    ADD COLUMN IF NOT EXISTS target_cost_center_id INTEGER
        REFERENCES cost_centers(id) ON DELETE SET NULL;
