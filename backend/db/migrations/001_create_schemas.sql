-- 001_create_schemas.sql
-- Creates the four application schemas. Application tables never live in `public`.

CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS reviews;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS pipeline;

-- Migration tracking table lives in pipeline schema per spec.
CREATE TABLE IF NOT EXISTS pipeline.schema_migrations (
    migration_name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
