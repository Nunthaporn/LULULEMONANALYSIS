-- 004_create_pipeline_tables.sql
-- pipeline.ingestion_runs, pipeline.ingestion_errors, pipeline.product_checkpoints
-- Created for forward compatibility with the Python pipeline's state tracking. Not populated
-- by this migration pass (the pipeline's canonical state store remains SQLite for now).

CREATE TABLE IF NOT EXISTS pipeline.ingestion_runs (
    run_id UUID PRIMARY KEY,
    mode TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    products_attempted INTEGER NOT NULL DEFAULT 0,
    products_succeeded INTEGER NOT NULL DEFAULT 0,
    products_failed INTEGER NOT NULL DEFAULT 0,
    pages_requested INTEGER NOT NULL DEFAULT 0,
    reviews_seen INTEGER NOT NULL DEFAULT 0,
    new_reviews INTEGER NOT NULL DEFAULT 0,
    updated_reviews INTEGER NOT NULL DEFAULT 0,
    duplicate_reviews INTEGER NOT NULL DEFAULT 0,
    http_403_count INTEGER NOT NULL DEFAULT 0,
    http_429_count INTEGER NOT NULL DEFAULT 0,
    server_error_count INTEGER NOT NULL DEFAULT 0,
    timeout_count INTEGER NOT NULL DEFAULT 0,
    schema_error_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline.ingestion_errors (
    error_id BIGSERIAL PRIMARY KEY,
    run_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    product_id TEXT,
    stage TEXT NOT NULL,
    error_type TEXT NOT NULL,
    status_code INTEGER,
    page_offset_or_cursor TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    CONSTRAINT fk_ingestion_errors_run
        FOREIGN KEY (run_id) REFERENCES pipeline.ingestion_runs (run_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pipeline.product_checkpoints (
    product_id TEXT PRIMARY KEY,
    source_product_key TEXT,
    last_success_at TIMESTAMPTZ,
    newest_seen_at TIMESTAMPTZ,
    total_results_seen INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    cooldown_until TIMESTAMPTZ,
    last_run_id UUID,
    schema_version TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_checkpoints_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (product_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_product_checkpoints_run
        FOREIGN KEY (last_run_id) REFERENCES pipeline.ingestion_runs (run_id)
        ON DELETE SET NULL
);
