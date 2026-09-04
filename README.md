# lululemon Review Intelligence Dashboard

This repo is now organized around three clearly separated areas:

- `src/` and `public/` for the React dashboard
- `pipeline/` for the Python review-processing workflow
- `backend/` for the PostgreSQL + Express API

## Project structure

```text
.
├── backend/                  # Express + PostgreSQL API
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   └── server.js
├── data/                     # Pipeline input, raw output, processed output, images
│   ├── input/
│   ├── raw/
│   ├── processed/
│   └── images/
├── pipeline/                 # Python pipeline implementation
│   ├── __init__.py
│   ├── pipeline_common.py
│   ├── multi_product_reviews_scraper.py
│   ├── low_star_processor.py
│   ├── complaint_classifier.py
│   ├── multi_product_image_mapper.py
│   ├── summary_generator.py
│   ├── dashboard_exporter.py
│   ├── run_export.py
│   └── run_full_pipeline.py
├── public/
│   ├── data/
│   │   └── dashboard_data/   # Frontend-served JSON from the pipeline
│   └── lululemon-logo.png
├── src/                      # React frontend
│   ├── components/
│   │   ├── charts/
│   │   ├── filters/
│   │   ├── gallery/
│   │   ├── layout/
│   │   ├── primitives/
│   │   └── search/
│   ├── context/
│   ├── data/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── App.jsx
│   └── main.jsx
├── run_export.py             # Thin root wrapper for legacy command
├── run_full_pipeline.py      # Thin root wrapper for main pipeline command
├── package.json
└── vite.config.js
```

## Frontend routes

- `/analytics`
- `/reviews`
- `/gallery`

`/` redirects to `/analytics`.

## Pipeline data flow

```text
data/
├── input/
│   └── products.csv
├── raw/
│   └── product_raw_json/
├── processed/
│   ├── all_reviews.csv
│   ├── all_reviews.json
│   ├── low_star_reviews.csv
│   ├── product_rating_distribution.csv
│   ├── review_images_mapping.csv
│   ├── category_summary.csv
│   ├── product_summary.csv
│   └── dashboard_data/
│       ├── reviews.json
│       ├── images.json
│       ├── category.json
│       ├── products.json
│       └── productSummary.json
└── images/
    └── {product_id}/
        ├── 1_star/
        ├── 2_star/
        └── 3_star/
```

## Getting started

### Prerequisites

- Node.js 24+ and npm
- Python 3.12+
- (Optional, only if you run the `backend/` API) PostgreSQL 14+

### 1. Clone and install the frontend

```powershell
git clone <this-repo-url>
cd LULULEMONANALYSIS
npm install
```

### 2. Set up the Python pipeline environment

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r pipeline/requirements.txt
```

### 3. Configure environment variables

```powershell
copy .env.example .env
```

Open `.env` and fill in `LULULEMON_COOKIE` — an authenticated session cookie string copied from
your browser while logged into `shop.lululemon.com` (DevTools → Network → any request → Headers →
`cookie`). This is what lets the scraper read reviews. The other values in `.env.example` already
have sensible defaults.

### 4. Run the dashboard locally

```powershell
npm run dev
```

This starts Vite and serves the dashboard from the JSON already committed under
`public/data/dashboard_data/` — you don't need to run the pipeline just to browse the existing data.

```powershell
npm run build      # production build to dist/
npm run preview    # preview the production build locally
```

### 5. (Optional) Run the backend API

```powershell
cd backend
npm install
copy .env.example .env   # fill in DATABASE_URL or PG* variables
npm run db:migrate
node scripts/importPipelineData.js
npm run dev
```

The dashboard never calls this API — it's an optional Postgres-backed layer for other consumers.

## Running the scraper

### Multi-product scraping (North America)

Products are driven by `data/input/products.csv` (columns: `product_name`, `product_id`,
`productNameId`, `product_url`, `category`). To scrape a new product, add a row pointing at its
`shop.lululemon.com` product page, then run the full pipeline:

```powershell
python run_full_pipeline.py
```

This scrapes every product in `products.csv` (`pipeline/multi_product_reviews_scraper.py`), then
classifies, matches, maps images, summarizes, and exports the dashboard JSON in one go
(`pipeline/dashboard_exporter.py` writes to both `data/processed/dashboard_data/` and
`public/data/dashboard_data/`).

Useful variants:

```powershell
# Re-run only after products.csv or thresholds changed, without re-scraping
python run_full_pipeline.py --mode process-only

# Incremental collector (checkpoints, only fetches new/changed reviews)
python run_full_pipeline.py --mode incremental
python run_full_pipeline.py --mode incremental --dry-run   # preview only, no writes

# Scrape a single product or custom product list directly
python -m pipeline.multi_product_reviews_scraper --products data/input/products.csv
```

Add `--mode full-reconcile` to fully re-fetch and reconcile every product against the existing
dataset (writes `data/processed/reconciliation_report.csv`).

### Multi-region scraping (Asia, Australia, New Zealand)

The regional storefronts (`lululemon.com.hk`, `lululemon.com.au`, `lululemon.co.nz`, …) use their
own authenticated sessions, so there's no single cookie/env var that covers all of them — each
region is scraped from a request captured directly out of your browser:

1. **Log into the target regional storefront** (e.g. `www.lululemon.com.au`) and open a product
   page's reviews.
2. **Capture the reviews request:** open DevTools → Network, filter for `graphql`, find the
   `POST` request for the `GetReviews` operation (triggered when reviews load/paginate), right-click
   it → **Copy → Copy as cURL (bash)**, and save it to a file, e.g. `curl_australia.txt`.
3. **Point a products CSV at that region's product URLs** — copy `data/input/products.csv` to
   e.g. `data/input/products_australia.csv` and replace `product_url` with that storefront's product
   page links (same `product_id`/`productNameId` values keep results comparable across regions).
4. **Run the date-window scraper** against the captured request:

   ```powershell
   python -m pipeline.scrape_review_date_window `
     --curl-file curl_australia.txt `
     --products data/input/products_australia.csv `
     --start-date 2026-01-01 `
     --end-date 2026-08-25 `
     --output-prefix data/processed/reviews_australia_raw
   ```

   This writes `reviews_australia_raw.csv` / `.json` (and a raw-page archive) filtered to that date
   window and to `--ratings` (default `1,2,3`).
5. **Shape the output into the dashboard's region files.** The dashboard reads
   `public/data/dashboard_data/reviews_<region>.json` and `images_<region>.json`, where `<region>` is
   one of `asia`, `australia`, `new_zealand` (see `src/data/constants.js` → `REGION_OPTIONS`). Convert
   the scraped rows into that shape (see an existing file like
   `public/data/dashboard_data/reviews_asia.json` for the exact field list — `region` and
   `source_site` are required), save the review rows to
   `data/processed/dashboard_data/reviews_<region>.json`, and drop any review photos into
   `public/data/images/<region>/` (and mirror to `data/processed/images/<region>/`), referenced from
   `images_<region>.json`.
6. **Run the defect matcher** to fill in `matched_defect_group` / `operation_related` for the new
   region data and mirror it to `public/data/dashboard_data/`:

   ```powershell
   python -m pipeline.match_region_defects
   ```

   This processes `reviews_asia.json`, `reviews_australia.json`, and `reviews_new_zealand.json`
   together, so make sure all three exist (even if some are just re-runs of already-matched data)
   before running it.
7. Reload `npm run dev` and pick the region from the Region selector in the header to verify it.

## Deployment

The dashboard (`src/` + `public/data/`) is a fully static build — it reads pre-generated JSON from
`public/data/dashboard_data/` at runtime and does not call the backend API. The `backend/` (Express +
PostgreSQL) service is a separate, optional API layer for consumers other than this dashboard.

The site is published via GitHub Pages: `.github/workflows/deploy-pages.yml` runs `npm run build` on
every push to `main` and deploys the resulting `dist/` directory. No containerization is involved.

### Refreshing data in production

1. Run the pipeline (`python run_full_pipeline.py --mode incremental`) wherever it has network access to
   the review source.
2. Commit the updated `public/data/dashboard_data/*.json`.
3. Push to `main` — the GitHub Pages workflow rebuilds and redeploys automatically.

## Notes

- The Python pipeline implementation was moved into `pipeline/` to keep the repo root clean.
- `run_full_pipeline.py` and `run_export.py` remain at the root as compatibility wrappers.
- The dashboard reads its runtime JSON from `public/data/dashboard_data/`.
- The pipeline writes processed outputs to `data/processed/` and mirrors dashboard JSON into `public/data/dashboard_data/`.
