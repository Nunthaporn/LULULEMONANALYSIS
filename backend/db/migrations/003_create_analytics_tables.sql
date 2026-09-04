-- 003_create_analytics_tables.sql
-- analytics.product_summaries, analytics.category_summaries, analytics.review_analysis

CREATE TABLE IF NOT EXISTS analytics.product_summaries (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    low_star_reviews INTEGER NOT NULL DEFAULT 0,
    one_star_reviews INTEGER NOT NULL DEFAULT 0,
    two_star_reviews INTEGER NOT NULL DEFAULT 0,
    three_star_reviews INTEGER NOT NULL DEFAULT 0,
    reviews_with_images INTEGER NOT NULL DEFAULT 0,
    total_images INTEGER NOT NULL DEFAULT 0,
    top_complaint_theme TEXT NOT NULL DEFAULT 'Other',
    top_complaint_share NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_summaries_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (product_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics.category_summaries (
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    complaint_theme TEXT NOT NULL,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    one_star INTEGER NOT NULL DEFAULT 0,
    two_star INTEGER NOT NULL DEFAULT 0,
    three_star INTEGER NOT NULL DEFAULT 0,
    share_percentage NUMERIC(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, complaint_theme),
    CONSTRAINT fk_category_summaries_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (product_id)
        ON DELETE CASCADE
);

-- Future incremental-ML table. Created now, populated later.
CREATE TABLE IF NOT EXISTS analytics.review_analysis (
    product_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    review_content_hash TEXT NOT NULL,
    complaint_theme TEXT,
    business_insight TEXT,
    matched_defect_group TEXT,
    similarity_score DOUBLE PRECISION,
    confidence_score DOUBLE PRECISION,
    classifier_version TEXT,
    embedding_model_name TEXT,
    embedding_model_version TEXT,
    semantic_threshold DOUBLE PRECISION,
    taxonomy_version TEXT,
    taxonomy_hash TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analysis_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, review_id),
    CONSTRAINT fk_review_analysis_review
        FOREIGN KEY (product_id, review_id) REFERENCES reviews.reviews (product_id, review_id)
        ON DELETE CASCADE
);
