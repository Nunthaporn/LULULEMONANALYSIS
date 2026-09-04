-- 005_create_indexes.sql
-- Indexes for all application tables, plus the shared updated_at trigger function.

-- catalog.products
CREATE INDEX IF NOT EXISTS idx_products_category ON catalog.products (category);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON catalog.products (product_name);

-- reviews.reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews.reviews (rating);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews.reviews (review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_complaint_theme ON reviews.reviews (complaint_theme);
CREATE INDEX IF NOT EXISTS idx_reviews_verified_buyer ON reviews.reviews (verified_buyer);
CREATE INDEX IF NOT EXISTS idx_reviews_has_photo ON reviews.reviews (has_photo);
CREATE INDEX IF NOT EXISTS idx_reviews_product_rating ON reviews.reviews (product_id, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_product_theme ON reviews.reviews (product_id, complaint_theme);
CREATE INDEX IF NOT EXISTS idx_reviews_product_date ON reviews.reviews (product_id, review_date DESC);

-- Full text search over title + body, replaces Mongo $regex search.
CREATE INDEX IF NOT EXISTS idx_reviews_fts ON reviews.reviews
    USING GIN (to_tsvector('english', coalesce(review_title, '') || ' ' || coalesce(review_text, '')));

-- reviews.review_images
CREATE INDEX IF NOT EXISTS idx_review_images_product_id ON reviews.review_images (product_id);
CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON reviews.review_images (review_id);
CREATE INDEX IF NOT EXISTS idx_review_images_rating ON reviews.review_images (rating);
CREATE INDEX IF NOT EXISTS idx_review_images_complaint_theme ON reviews.review_images (complaint_theme);
CREATE INDEX IF NOT EXISTS idx_review_images_review_date ON reviews.review_images (review_date DESC);
CREATE INDEX IF NOT EXISTS idx_review_images_product_rating_theme
    ON reviews.review_images (product_id, rating, complaint_theme);

-- analytics.category_summaries
CREATE INDEX IF NOT EXISTS idx_category_summaries_product_id ON analytics.category_summaries (product_id);
CREATE INDEX IF NOT EXISTS idx_category_summaries_complaint_theme ON analytics.category_summaries (complaint_theme);
CREATE INDEX IF NOT EXISTS idx_category_summaries_total_reviews ON analytics.category_summaries (total_reviews DESC);

-- analytics.review_analysis
CREATE INDEX IF NOT EXISTS idx_review_analysis_status ON analytics.review_analysis (analysis_status);
CREATE INDEX IF NOT EXISTS idx_review_analysis_complaint_theme ON analytics.review_analysis (complaint_theme);
CREATE INDEX IF NOT EXISTS idx_review_analysis_defect_group ON analytics.review_analysis (matched_defect_group);
CREATE INDEX IF NOT EXISTS idx_review_analysis_taxonomy_hash ON analytics.review_analysis (taxonomy_hash);
CREATE INDEX IF NOT EXISTS idx_review_analysis_embedding_version
    ON analytics.review_analysis (embedding_model_version);

-- pipeline.ingestion_runs
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started_at ON pipeline.ingestion_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON pipeline.ingestion_runs (status);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_mode ON pipeline.ingestion_runs (mode);

-- pipeline.ingestion_errors
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_run_id ON pipeline.ingestion_errors (run_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_occurred_at ON pipeline.ingestion_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_product_id ON pipeline.ingestion_errors (product_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_error_type ON pipeline.ingestion_errors (error_type);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_status_code ON pipeline.ingestion_errors (status_code);

-- Shared updated_at trigger function (Phase 9).
CREATE OR REPLACE FUNCTION pipeline.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON catalog.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON catalog.products
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews.reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews.reviews
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_review_images_updated_at ON reviews.review_images;
CREATE TRIGGER trg_review_images_updated_at
    BEFORE UPDATE ON reviews.review_images
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_summaries_updated_at ON analytics.product_summaries;
CREATE TRIGGER trg_product_summaries_updated_at
    BEFORE UPDATE ON analytics.product_summaries
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_category_summaries_updated_at ON analytics.category_summaries;
CREATE TRIGGER trg_category_summaries_updated_at
    BEFORE UPDATE ON analytics.category_summaries
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_review_analysis_updated_at ON analytics.review_analysis;
CREATE TRIGGER trg_review_analysis_updated_at
    BEFORE UPDATE ON analytics.review_analysis
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_checkpoints_updated_at ON pipeline.product_checkpoints;
CREATE TRIGGER trg_product_checkpoints_updated_at
    BEFORE UPDATE ON pipeline.product_checkpoints
    FOR EACH ROW EXECUTE FUNCTION pipeline.set_updated_at();
