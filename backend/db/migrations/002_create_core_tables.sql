-- 002_create_core_tables.sql
-- catalog.products, reviews.reviews, reviews.review_images

CREATE TABLE IF NOT EXISTS catalog.products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_name_id TEXT NOT NULL,
    product_url TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews.reviews (
    product_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    rating SMALLINT NOT NULL,
    review_title TEXT NOT NULL DEFAULT '',
    review_text TEXT NOT NULL DEFAULT '',
    review_date TIMESTAMPTZ,
    reviewer_name_or_id TEXT NOT NULL DEFAULT '',
    verified_buyer BOOLEAN NOT NULL DEFAULT FALSE,
    size_purchased TEXT NOT NULL DEFAULT '',
    usual_size TEXT NOT NULL DEFAULT '',
    fit_feedback TEXT NOT NULL DEFAULT '',
    helpful_votes INTEGER NOT NULL DEFAULT 0,
    has_photo BOOLEAN NOT NULL DEFAULT FALSE,
    photo_count INTEGER NOT NULL DEFAULT 0,
    photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    lulu_response_text TEXT NOT NULL DEFAULT '',
    lulu_response_date TIMESTAMPTZ,
    complaint_theme TEXT NOT NULL DEFAULT 'Other',
    business_insight TEXT NOT NULL DEFAULT '',
    scraped_at TIMESTAMPTZ,
    content_hash TEXT,
    source_payload_hash TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, review_id),
    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id) REFERENCES catalog.products (product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviews_helpful_votes CHECK (helpful_votes >= 0),
    CONSTRAINT chk_reviews_photo_count CHECK (photo_count >= 0)
);

CREATE TABLE IF NOT EXISTS reviews.review_images (
    product_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    photo_id TEXT NOT NULL DEFAULT '',
    rating SMALLINT NOT NULL,
    review_date TIMESTAMPTZ,
    review_title TEXT NOT NULL DEFAULT '',
    review_text TEXT NOT NULL DEFAULT '',
    complaint_theme TEXT NOT NULL DEFAULT 'Other',
    business_insight TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT NOT NULL DEFAULT '',
    local_image_path TEXT NOT NULL DEFAULT '',
    photo_caption TEXT NOT NULL DEFAULT '',
    image_exists BOOLEAN NOT NULL DEFAULT TRUE,
    content_hash TEXT,
    download_status TEXT NOT NULL DEFAULT 'downloaded',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ,
    downloaded_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, review_id, photo_id),
    CONSTRAINT fk_review_images_review
        FOREIGN KEY (product_id, review_id) REFERENCES reviews.reviews (product_id, review_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
