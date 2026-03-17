-- Migration: add output_template column to companies
-- Run this against existing databases (Docker dev + production pgAdmin)

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS output_template VARCHAR(50);
