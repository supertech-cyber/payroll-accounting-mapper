-- ==========================================================
-- Payroll Accounting Mapper — Initial Schema
-- PostgreSQL 17
-- ==========================================================

-- -------------------------------------------------------
-- Companies
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id               SERIAL       PRIMARY KEY,
    code             VARCHAR(50)  NOT NULL UNIQUE,
    name             VARCHAR(255) NOT NULL,
    cnpj             CHAR(14),
    cnpj_base        CHAR(8),
    output_template  VARCHAR(50),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Cost Centers
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_centers (
    id          SERIAL       PRIMARY KEY,
    code        VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    company_id  INT          REFERENCES companies(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (code, company_id)
);

-- -------------------------------------------------------
-- Events (the registry)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id          SERIAL       PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,   -- '5', '20', 'PROV13', etc.
    description VARCHAR(255) NOT NULL,
    entry_type  VARCHAR(4)   NOT NULL CHECK (entry_type IN ('P', 'D', 'PROV')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Event Mappings  (the "de-para" / accounting mapping)
--
-- Each row: event × cost_center → credit_account + debit_account
-- cost_center_id = NULL  ⇒ default mapping when no specific CC is matched
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_mappings (
    id               SERIAL      PRIMARY KEY,
    event_id         INT         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    cost_center_id   INT         REFERENCES cost_centers(id) ON DELETE SET NULL,
    credit_account   VARCHAR(30),
    debit_account    VARCHAR(30),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, cost_center_id)
);

-- -------------------------------------------------------
-- Payroll Event Ignore Rules
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_event_ignore_rules (
    id          SERIAL       PRIMARY KEY,
    event_code  VARCHAR(50)  NOT NULL UNIQUE,
    reason      TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_event_mappings_event_id        ON event_mappings (event_id);
CREATE INDEX IF NOT EXISTS idx_event_mappings_cost_center_id  ON event_mappings (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_code              ON cost_centers   (code);
CREATE INDEX IF NOT EXISTS idx_events_code                    ON events         (code);
