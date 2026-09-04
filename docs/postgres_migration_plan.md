# PostgreSQL Migration Plan

Status: implemented in this pass. This document is the audit + design record for the
MongoDB → PostgreSQL migration of `backend/`.

## 0. Important context discovered during audit

The React dashboard (`src/`, `public/data/dashboard_data/*.json`) does **not** call the
`backend/` API today. `src/data/loaders.js` fetches static JSON files that the Python pipeline
writes directly to `public/data/dashboard_data/`. The Express/Mongo (now Express/Postgres) API
in `backend/` is a separate, currently-unwired API layer.

Practical implication: this migration cannot break the live dashboard, because the live
dashboard doesn't talk to this backend. It's still done to the full letter of the spec — API
response shapes are preserved exactly — in case the frontend (or another consumer) is wired to
`backend/` later.

## 1. Existing MongoDB collections → PostgreSQL tables

| Mongoose model | Mongo collection (pluralized, lowercased by default) | PostgreSQL table |
|---|---|---|
| `Product` | `products` | `catalog.products` |
| `Review` | `reviews` | `reviews.reviews` |
| `ReviewImage` | `reviewimages` | `reviews.review_images` |
| `ProductSummary` | `productsummaries` | `analytics.product_summaries` |
| `CategorySummary` | `categorysummaries` | `analytics.category_summaries` |
| *(none yet — new)* | — | `analytics.review_analysis` |
| *(none yet — new)* | — | `pipeline.ingestion_runs` |
| *(none yet — new)* | — | `pipeline.ingestion_errors` |
| *(none yet — new)* | — | `pipeline.product_checkpoints` |
| *(none yet — new)* | — | `pipeline.schema_migrations` |

## 2. Field mapping

### catalog.products (from `Product` / `products.csv` / `all_reviews.*`)

| Source field (Mongoose / CSV) | PostgreSQL column | Notes |
|---|---|---|
| `productId` / `product_id` | `product_id` (PK) | |
| `productName` / `product_name` | `product_name` | |
| `productNameId` / `productNameId` | `product_name_id` | CSV header is camelCase even in the snake_case files |
| `productUrl` / `product_url` | `product_url` | |
| `category` | `category` | |
| *(mongoose `timestamps`)* | `created_at`, `updated_at` | |

### reviews.reviews (from `Review` / `all_reviews.csv` / `all_reviews.json`)

| Source field | PostgreSQL column | Notes |
|---|---|---|
| `productId` / `product_id` | `product_id` (PK part, FK) | |
| `reviewId` / `review_id` | `review_id` (PK part) | |
| `rating` | `rating` | CHECK 1–5 (source pipeline only ever emits 1–5; low-star exports are 1–3) |
| `reviewTitle` / `title` | `review_title` | |
| `reviewText` / `review_text` | `review_text` | |
| `reviewDate` / `submission_time` | `review_date` | parsed to `TIMESTAMPTZ`, `NULL` if unparseable |
| `reviewerNameOrId` / `author` | `reviewer_name_or_id` | |
| `verifiedBuyer` / `is_verified_buyer` | `verified_buyer` | |
| `sizePurchased` / `size_purchased` | `size_purchased` | |
| `usualSize` / `usual_size` | `usual_size` | |
| `fitFeedback` / `fit_feedback` | `fit_feedback` | |
| `helpfulVotes` / `likes` | `helpful_votes` | |
| *(derived)* | `has_photo` | `photo_count > 0 OR photo_urls not empty` |
| `photoCount` / `photo_count` | `photo_count` | |
| `photoUrls` / `photo_urls` (`;`-joined string or JSON-ish list) | `photo_urls` (`TEXT[]`) | split on `;`, JSON-array fallback, same parser as `importPipelineData.js` today |
| `luluResponseText` / `lulu_response_text` | `lulu_response_text` | |
| `luluResponseDate` / `lulu_response_time` | `lulu_response_date` | |
| `complaintTheme` / `complaint_theme` | `complaint_theme` | defaults `'Other'` |
| `businessInsight` / `business_insight` | `business_insight` | |
| `scrapedAt` / `scraped_at` | `scraped_at` | |
| *(not present in CSV/JSON export — only in `pipeline_state.db`)* | `content_hash`, `source_payload_hash` | `NULL` on CSV/JSON import; populated if/when the importer is pointed at the SQLite state DB directly (future work, not in this pass) |
| *(whole source row)* | `raw_payload` (`JSONB`) | full original row stored for forward compatibility / debugging |
| `product_name`, `productNameId`, `product_url`, `category` (present on every row in the source, and denormalized onto Mongo's `Review` docs) | **not stored** on `reviews.reviews` | normalized out — available via `JOIN catalog.products`. The API layer re-joins and flattens these back onto each review object so the JSON shape the frontend expects is unchanged. |

### reviews.review_images (from `ReviewImage` / `review_images_mapping.csv`)

| Source field | PostgreSQL column |
|---|---|
| `productId` / `product_id` | `product_id` |
| `reviewId` / `review_id` | `review_id` |
| `photoId` / `photo_id` | `photo_id` |
| `rating` | `rating` |
| `reviewDate` / `review_date` | `review_date` |
| `reviewTitle` / `review_title` | `review_title` |
| `reviewText` / `review_text` | `review_text` |
| `complaintTheme` / `complaint_theme` | `complaint_theme` |
| `businessInsight` / `business_insight` | `business_insight` |
| `imageUrl` / `image_url` | `image_url` |
| `thumbnailUrl` / `thumbnail_url` | `thumbnail_url` (not present in current CSV — defaults to `''`) |
| `localImagePath` / `local_image_path` | `local_image_path` |
| *(not in CSV today)* | `photo_caption` | defaults `''` |
| `imageExists` | `image_exists` | defaults `TRUE` |

### analytics.product_summaries (from `ProductSummary` / `product_summary.csv`)

Direct 1:1 snake_case mapping (`totalReviews`/`total_reviews` → `total_reviews`, etc.). Source
CSV also has `average_rating`, which is **not** in the Phase-2 spec'd table — it's dropped in
this migration to match the spec exactly; flagged as a follow-up in Risks.

### analytics.category_summaries (from `CategorySummary` / `category_summary.csv`)

Direct 1:1 snake_case mapping.

## 3. Primary key strategy

- `catalog.products`: natural key `product_id` (already globally unique and stable — it's the
  scraper's product slug, not a surrogate).
- `reviews.reviews`: composite `(product_id, review_id)` — matches the existing unique index in
  the Mongoose schema and the SQLite canonical store's key.
- `reviews.review_images`: composite `(product_id, review_id, photo_id)` — matches Mongoose's
  existing unique index.
- `analytics.product_summaries`: `product_id` (1 row per product).
- `analytics.category_summaries`: composite `(product_id, complaint_theme)` — matches Mongoose's
  existing unique index.
- `analytics.review_analysis`: composite `(product_id, review_id)` — one current analysis row
  per review (mirrors the SQLite `review_analysis` table's intent, simplified to "latest wins"
  rather than full history, since this table is for future incremental ML work, not built yet).
- `pipeline.ingestion_runs`: `run_id UUID`.
- `pipeline.ingestion_errors`: surrogate `error_id BIGSERIAL` (errors have no natural key).
- `pipeline.product_checkpoints`: `product_id`.

No surrogate `id`/`_id` columns are introduced anywhere natural keys already exist, to keep the
schema and the API's identity semantics (`productId` + `reviewId`) aligned with how the frontend
and the rest of the pipeline already key data.

## 4. Foreign key strategy

- `reviews.reviews.product_id → catalog.products.product_id`, `ON DELETE RESTRICT` — you cannot
  delete a product out from under its reviews by accident; reviews must be deleted/reassigned
  first. `ON UPDATE CASCADE` since `product_id` is a natural key that could theoretically be
  renamed upstream.
- `reviews.review_images (product_id, review_id) → reviews.reviews (product_id, review_id)`,
  `ON DELETE CASCADE` — images are meaningless without their parent review.
- `analytics.product_summaries.product_id → catalog.products.product_id`, `ON DELETE CASCADE`.
- `analytics.category_summaries.product_id → catalog.products.product_id`, `ON DELETE CASCADE`.
- `analytics.review_analysis (product_id, review_id) → reviews.reviews (product_id, review_id)`,
  `ON DELETE CASCADE`.
- `pipeline.ingestion_errors.run_id → pipeline.ingestion_runs.run_id`, `ON DELETE SET NULL` — keep
  the error log even if the run row is pruned.
- `pipeline.product_checkpoints.product_id → catalog.products.product_id`, `ON DELETE CASCADE`;
  `pipeline.product_checkpoints.last_run_id → pipeline.ingestion_runs.run_id`, `ON DELETE SET NULL`.

## 5. Index strategy

Exactly as specified in the build request (see migration `005_create_indexes.sql`), plus the two
composite indexes Mongoose already had (`reviews(product_id, rating)` /
`review_images(product_id, rating, complaint_theme)`) so query performance doesn't regress
relative to today. A `GIN` index over `to_tsvector('english', review_title || ' ' || review_text)`
replaces Mongo's `$regex` search.

## 6. API compatibility requirements

All five routes must return the exact same JSON shape as today's Mongoose-backed routes:

- `GET /api/products` → array of `{ productId, productName, productNameId, productUrl, category }`
- `GET /api/reviews` → `{ page, limit, total, totalPages, items: [...] }`, items shaped like the
  old `Review` documents (camelCase, product fields flattened in via join)
- `GET /api/images` → same pagination envelope, items shaped like old `ReviewImage` documents
- `GET /api/categories` → array shaped like old `CategorySummary` documents
- `GET /api/summaries/products` → array shaped like old `ProductSummary` documents
- `GET /api/dashboard` → `{ products, productSummary, categorySummary, ratingBreakdown,
  topComplaintTheme, topImageBackedComplaintTheme, recentReviews, galleryImages }`, with
  `ratingBreakdown` preserved as Mongo-aggregate-style `{ _id, count }` rows and
  `topComplaintTheme` / `topImageBackedComplaintTheme` preserved as
  `{ complaintTheme, totalReviews }` / `{ complaintTheme, totalImages }`
- `GET /api/health` → now additionally reports `database` / `databaseType`, without leaking
  connection details

One accepted, documented gap: Mongoose documents also carry `_id`, `createdAt`, `updatedAt`.
`_id` is dropped (nothing in the frontend selectors reads `.  _id`; they key off `review_id`/
`reviewId`). `createdAt`/`updatedAt` are preserved as `created_at`/`updated_at` are *not*
re-cased to camelCase in the API response, since nothing currently reads them — flagged in Risks.

## 7. Migration order

1. `catalog.products` (everything else FKs to it)
2. `reviews.reviews` (FKs to products)
3. `reviews.review_images` (FKs to reviews)
4. `analytics.product_summaries` (FKs to products)
5. `analytics.category_summaries` (FKs to products)
6. `analytics.review_analysis` — created but left empty this pass (future incremental-ML work)
7. `pipeline.*` tables — created but left empty this pass (future: point the Python pipeline's
   SQLite state at Postgres too; out of scope here, schema is ready for it)

This is also the referential order the importer must insert in, and it's enforced by FK
constraints regardless (a bad insert order fails loudly instead of silently corrupting data).

## 8. Rollback plan

- **Schema-level:** every migration file is a plain, idempotent-where-practical SQL script.
  `pipeline.schema_migrations` tracks what's applied. To roll back, drop the four application
  schemas: `DROP SCHEMA IF EXISTS catalog, reviews, analytics, pipeline CASCADE;` — this is safe
  because none of these schemas are `public`, and no other application data lives in them.
- **Code-level:** Mongoose is not deleted in this pass — `backend/legacy-mongo/` holds the
  original `config/db.js`, `models/`, and the original `importPipelineData.js` untouched, so
  reverting `server.js`/routes to the Mongo versions is a file-copy away if Postgres turns out to
  have a blocking issue.
- **Data-level:** the source of truth for reviews remains the Python pipeline's
  `data/processed/*.csv|json` and `data/state/pipeline_state.db` — Postgres (like Mongo before
  it) is a derived/imported copy, not the canonical store. Re-running `npm run import` after a
  rollback-and-retry always reconstructs the same state, since the importer is idempotent
  (`ON CONFLICT ... DO UPDATE`).
- **Environment:** `MONGO_URI` remains a supported/documented variable in git history and
  `backend/legacy-mongo/README.md`; nothing about the Mongo Atlas/local instance itself is
  touched by this migration.

## 9. Risks (carried into the final summary)

- `average_rating` from `product_summary.csv` is not persisted (not in the spec'd table). Low
  risk: nothing currently reads it from the backend API (the live dashboard computes average
  rating client-side from raw reviews, not from this summary).
  Consulted: this file is a straightforward place to add the column later if needed.
- `content_hash` / `source_payload_hash` are `NULL` for all rows imported via CSV/JSON, since
  those hashes only exist in the Python pipeline's SQLite state DB, not in the CSV/JSON export.
  Not a compatibility problem (nothing in the current API reads them), but means
  `analytics.review_analysis`'s dedupe-by-content-hash design can't be populated from this
  importer alone yet.
- This backend is not wired to the live dashboard today (see §0) — so "frontend compatibility"
  is verified by contract (matching JSON shape), not by an end-to-end browser click-through in
  this pass.
