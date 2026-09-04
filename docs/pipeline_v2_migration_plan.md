# Pipeline V2 Migration Plan

## 1. Current architecture

The current pipeline is a sequential file-based workflow kicked off by [run_full_pipeline.py](/D:/lululemonvog/run_full_pipeline.py) and implemented in [pipeline/run_full_pipeline.py](/D:/lululemonvog/pipeline/run_full_pipeline.py). It runs these stages in order:

1. `multi_product_reviews_scraper`
2. `low_star_processor`
3. `complaint_classifier`
4. `semantic_defect_matcher`
5. `multi_product_image_mapper`
6. `summary_generator`
7. `dashboard_exporter`

The React app reads JSON from `public/data/dashboard_data/`. The backend imports the same processed outputs into MongoDB and already treats reviews as unique by `(productId, reviewId)`.

## 2. Current data flow

### Stage 1: review scraping

File: [pipeline/multi_product_reviews_scraper.py](/D:/lululemonvog/pipeline/multi_product_reviews_scraper.py)

Reads:

- `data/input/products.csv`

Writes and overwrites:

- `data/raw/product_raw_json/{product_id}.json`
- `data/processed/all_reviews.csv`
- `data/processed/all_reviews.json`
- `data/processed/scrape_failures.csv`

Behavior:

- Calls the public lululemon GraphQL endpoint `https://shop.lululemon.com/cne/graphql`
- Identifies source products with `product_id`, `productNameId`, `product_url`, `category`, `product_name`
- Fetches every review page for every configured product on every run
- Flattens nested review payloads into a denormalized CSV/JSON row schema

### Stage 2: low-star filtering

File: [pipeline/low_star_processor.py](/D:/lululemonvog/pipeline/low_star_processor.py)

Reads:

- `data/processed/all_reviews.csv`

Writes and overwrites:

- `data/processed/low_star_reviews.csv`
- `data/processed/product_rating_distribution.csv`

Behavior:

- Keeps only ratings 1, 2, and 3
- Rebuilds the full per-product rating distribution on each run

### Stage 3: complaint theme classification

File: [pipeline/complaint_classifier.py](/D:/lululemonvog/pipeline/complaint_classifier.py)

Reads:

- `data/processed/low_star_reviews.csv`

Writes and overwrites:

- `data/processed/low_star_reviews.csv`

Behavior:

- Reclassifies every low-star row using keyword rules from `pipeline_common.py`

### Stage 4: semantic defect matching

File: [pipeline/semantic_defect_matcher.py](/D:/lululemonvog/pipeline/semantic_defect_matcher.py)

Reads:

- `data/processed/low_star_reviews.csv`
- `data/master_defect.csv`

Writes and overwrites:

- `data/processed/low_star_reviews.csv`

Behavior:

- Loads model `sentence-transformers/all-MiniLM-L6-v2`
- Uses threshold `0.22`
- Builds six grouped category documents from `master_defect.csv` via `GRP_DESC_ENG`
- Re-embeds every low-star review on every run
- Recomputes category embeddings each process run, though they are cached in-memory during the process lifetime only

### Stage 5: image download and mapping

File: [pipeline/multi_product_image_mapper.py](/D:/lululemonvog/pipeline/multi_product_image_mapper.py)

Reads:

- `data/processed/low_star_reviews.csv`

Writes and overwrites:

- `data/processed/review_images_mapping.csv`
- `data/images/{product_id}/{rating}_star/*`

Behavior:

- Only processes low-star reviews
- Skips download if a target file already exists
- Rebuilds the mapping CSV from scratch on every run

### Stage 6: summaries

File: [pipeline/summary_generator.py](/D:/lululemonvog/pipeline/summary_generator.py)

Reads:

- `data/processed/all_reviews.csv`
- `data/processed/low_star_reviews.csv`
- `data/processed/review_images_mapping.csv`

Writes and overwrites:

- `data/processed/product_summary.csv`
- `data/processed/category_summary.csv`

### Stage 7: dashboard export

File: [pipeline/dashboard_exporter.py](/D:/lululemonvog/pipeline/dashboard_exporter.py)

Reads:

- `data/input/products.csv`
- `data/processed/low_star_reviews.csv`
- `data/processed/review_images_mapping.csv`
- `data/processed/category_summary.csv`
- `data/processed/product_summary.csv`

Writes and overwrites:

- `data/processed/dashboard_data/products.json`
- `data/processed/dashboard_data/reviews.json`
- `data/processed/dashboard_data/images.json`
- `data/processed/dashboard_data/category.json`
- `data/processed/dashboard_data/productSummary.json`
- `public/data/dashboard_data/products.json`
- `public/data/dashboard_data/reviews.json`
- `public/data/dashboard_data/images.json`
- `public/data/dashboard_data/category.json`
- `public/data/dashboard_data/productSummary.json`

## 3. Problems found

1. The scraper is full refresh only. Every run re-fetches every review page for every product.
2. Expensive downstream work is also full refresh:
   `low_star_reviews.csv`, theme classification, semantic matching, image mapping CSV, summaries, and dashboard JSON are all rebuilt every run.
3. There is no canonical state store for reviews, checkpoints, runs, or errors.
4. `scrape_failures.csv` is overwritten each run, so historical failure data is lost.
5. Review history is stored only in point-in-time exports, not in a durable upsertable store.
6. `dashboard_exporter.py` writes files directly and not atomically.
7. Retry behavior currently exists at two layers:
   `requests` session retries in `build_session()` and manual retry/backoff in `fetch_reviews_page()`.
8. There is no persisted checkpoint by product, offset, or newest seen timestamp.
9. `semantic_defect_matcher.py` recalculates review embeddings for every low-star review on every run.
10. Images are not redownloaded unnecessarily, but the mapping CSV is still rebuilt from scratch.
11. Some historical `local_image_path` values in `review_images_mapping.csv` point to a different workstation path and should not be treated as canonical.
12. `backend/.env` is git-tracked, which is a security risk even though its contents were not inspected during this audit.

## 4. Recommended V2 architecture

Phase toward this layout while preserving compatibility wrappers:

```text
pipeline/
├── config.py
├── ingestion/
│   ├── source_client.py
│   ├── incremental_collector.py
│   ├── retry_policy.py
│   ├── checkpoint_store.py
│   └── run_logger.py
├── storage/
│   ├── review_repository.py
│   ├── raw_store.py
│   └── atomic_exporter.py
├── processing/
│   ├── complaint_classifier.py
│   ├── semantic_defect_matcher.py
│   ├── analysis_cache.py
│   └── image_processor.py
├── aggregation/
│   ├── summary_generator.py
│   └── dashboard_exporter.py
└── run_pipeline.py
```

Compatibility guidance:

- Keep current modules callable during migration.
- Add adapters first, then move stage internals gradually.
- Do not change dashboard JSON contracts until all readers are verified.

## 5. Database and schema changes

Introduce `data/state/pipeline_state.db` with at least:

- `ingestion_runs`
- `product_checkpoints`
- `reviews`
- `ingestion_errors`

Review identity:

- Historical audit result: `review_id` is globally unique across the current 6,983-row dataset.
- Safe canonical key: `(product_id, review_id)`.
- Reason: this is already how the backend upserts reviews, and it protects against future source ID reuse.

Suggested review payload strategy:

- Store normalized review columns for downstream reuse.
- Store `content_hash` for analysis invalidation.
- Store `source_payload_hash` for source-level change detection.
- Store `raw_payload_json` for traceability without depending on raw export files alone.

## 6. Incremental ingestion strategy

1. Bootstrap the current `all_reviews.csv` dataset into SQLite as the baseline.
2. Introduce a source adapter around the current GraphQL request path.
3. Track per-product checkpoints:
   `last_success_at`, `newest_seen_at`, `total_results_seen`, `consecutive_failures`, `cooldown_until`.
4. On collection runs:
   fetch recent pages first, compare against stored review keys and hashes, and stop early when a stable duplicate window is reached.
5. Keep old reviews unless explicitly marked inactive after repeated absence across stable refreshes.
6. Preserve raw product snapshots separately from the canonical review table.

## 7. Review deduplication strategy

- Canonical review key: `(product_id, review_id)`
- Duplicate handling:
  repeated rows in a single batch should be counted and ignored
- Source change detection:
  compare `source_payload_hash`
- Analytical change detection:
  compare `content_hash`
- Preserve `first_seen_at` on insert and update `last_seen_at` on every successful sighting

## 8. ML incremental-processing strategy

- Run complaint theme classification only for rows with new or changed `content_hash`.
- Run semantic defect matching only for rows with new or changed `content_hash`.
- Cache review-level analysis results keyed by `(product_id, review_id, content_hash, model_name, threshold, taxonomy_version)`.
- Cache taxonomy embeddings by defect taxonomy hash rather than recomputing every run.

Current matcher details:

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Threshold: `0.22`
- Taxonomy source: `data/master_defect.csv`
- Grouping key: `GRP_DESC_ENG`
- Current inefficiency: review embeddings are recomputed for all low-star reviews every run

## 9. Image-processing strategy

- Image download should remain lazy and idempotent.
- Store photo-level identity with `(product_id, review_id, photo_id)`.
- Only enqueue image download when a new image reference appears or the file is missing.
- Keep the mapping CSV compatible, but derive it from canonical state instead of full rescan once migration reaches that phase.

## 10. Retry and failure strategy

Current behavior:

- Session-level retry via `urllib3.Retry` in `build_session()`
- Additional manual retry loop in `fetch_reviews_page()`
- HTTP 403 becomes a raised runtime error
- HTTP 429 and 5xx are retried by both layers
- Timeouts fall through `requests` exceptions and are retried
- Malformed JSON falls through `ValueError` and is retried
- GraphQL schema or response-shape changes become runtime errors

Recommendation:

- Consolidate to one explicit retry policy object
- Log every terminal error into `ingestion_errors`
- Keep per-run and per-product counters for 403, 429, server errors, timeouts, and schema errors
- Preserve failure history instead of overwriting `scrape_failures.csv`

## 11. Monitoring strategy

Minimum monitoring for local production scale:

- `ingestion_runs` table with lifecycle metrics
- `ingestion_errors` table with stage and product context
- structured run summary logs without secrets
- optional command to print recent run health

Suggested key metrics:

- products attempted, succeeded, failed
- pages requested
- reviews seen, inserted, updated, unchanged, duplicate
- 403, 429, 5xx, timeout, schema error counts

## 12. Testing strategy

Add pytest coverage for:

1. review upsert
2. duplicate review handling
3. changed review detection through hashes
4. checkpoint creation and update
5. ingestion run lifecycle
6. error logging
7. atomic file replacement
8. bootstrap idempotency
9. content hash stability

Later phases should add:

- source adapter contract tests
- incremental collector stop-window tests
- dashboard export snapshot tests

## 13. Security findings

1. `backend/.env` is git-tracked.
2. `.gitignore` did not previously exclude `.env` files.
3. Current pipeline code can send cookies through `LULULEMON_COOKIE`, which is acceptable, but logs must never include cookie values.
4. This pass must not print or inspect existing secret contents.

Immediate remediation in this pass:

- add `.env` ignores while preserving `.env.example`
- avoid logging environment variable contents

Follow-up remediation:

- remove `backend/.env` from version control and rotate any exposed secrets

## 14. Exact files to create

- `docs/pipeline_v2_migration_plan.md`
- `pipeline/config.py`
- `pipeline/ingestion/__init__.py`
- `pipeline/ingestion/checkpoint_store.py`
- `pipeline/ingestion/run_logger.py`
- `pipeline/storage/__init__.py`
- `pipeline/storage/atomic_exporter.py`
- `pipeline/storage/review_repository.py`
- `pipeline/bootstrap_existing_data.py`
- `tests/test_pipeline_foundation.py`
- `.env.example`

## 15. Exact files to modify

- `.gitignore`
- `pipeline/requirements.txt`

Future migration will likely modify:

- `pipeline/multi_product_reviews_scraper.py`
- `pipeline/dashboard_exporter.py`
- `pipeline/summary_generator.py`
- `pipeline/semantic_defect_matcher.py`
- `pipeline/multi_product_image_mapper.py`
- `pipeline/run_full_pipeline.py`

## 16. Migration order

1. Add config, SQLite state store, run logging, checkpoints, atomic exporter.
2. Bootstrap historical reviews into SQLite.
3. Add analysis-cache and incremental image metadata state.
4. Build source adapter around current GraphQL client.
5. Introduce incremental collector with compatibility outputs.
6. Switch downstream processors to read canonical state selectively.
7. Move dashboard exports to canonical state plus atomic writes.
8. Retire full-refresh collector once parity is proven.

## 17. Rollback strategy

- The foundation in this pass is additive and does not replace the current pipeline path.
- If any new state component fails, continue using the current file-based pipeline unchanged.
- Keep the SQLite state DB isolated under `data/state/`.
- Before bootstrap or future migrations, create timestamped SQLite backups.
- Do not rewrite or delete historical CSV, JSON, raw payload, or image assets during rollout.

## Audit appendix

### Product identity in `products.csv`

Products are identified by:

- `product_name`
- `product_id`
- `productNameId`
- `product_url`
- `category`

`productNameId` is the source GraphQL product key. `product_id` is the local stable slug and should remain the dashboard-facing product key.

### Review schema highlights

Current flattened review schema in `all_reviews.csv` and `all_reviews.json` includes:

- identity: `product_id`, `review_id`, `productNameId`
- timestamps: `submission_time`, `lulu_response_time`, `scraped_at`
- images: `photo_count`, `photo_ids`, `photo_urls`, `photo_thumbnails`, `photo_captions`
- ML outputs: `complaint_theme`, `business_insight`, `matched_defect_group_code`, `matched_defect_group`, `similarity_score`, `semantic_match_method`, `operation_related`, `confidence_score`

### Dashboard contracts

Frontend loaders and normalizers expect the current JSON families:

- `products.json`
- `reviews.json`
- `images.json`
- `category.json`
- `productSummary.json`

The React app already tolerates both snake_case and camelCase fields in many places, but preserving the current exported shape remains the safest path.
