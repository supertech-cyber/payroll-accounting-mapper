-- 015 — Tags catalog
CREATE TABLE IF NOT EXISTS tags (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(64)  NOT NULL UNIQUE,
    label       VARCHAR(128) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed any tags already in use by companies
INSERT INTO tags (slug, label)
SELECT DISTINCT tag, UPPER(tag)
FROM companies
WHERE tag IS NOT NULL
ON CONFLICT (slug) DO NOTHING;
