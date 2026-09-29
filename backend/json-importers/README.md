# Dashboard JSON to PostgreSQL

These scripts import JSON arrays from `data/processed/dashboard_data` into the existing PostgreSQL schemas.

## Setup

From `backend/`:

```powershell
Copy-Item .env.example .env
# Edit .env with the PostgreSQL connection values.
npm run db:migrate
```

## Import all files

```powershell
npm run import:json
```

The files are imported in this order:

1. `products.json`
2. `reviews.json`
3. `reviews_asia.json`
4. `reviews_australia.json`
5. `reviews_new_zealand.json`

## Import one file

```powershell
npm run import:json:products
npm run import:json:reviews
npm run import:json:reviews:asia
npm run import:json:reviews:australia
npm run import:json:reviews:new-zealand
```

Each script validates its JSON before opening a transaction. Imports use PostgreSQL upserts, so rerunning a script updates existing rows instead of creating duplicates. Review scripts also insert a missing product before its reviews to satisfy the foreign key.

All scraper-specific fields, including `region`, `source_site`, `origin_site`, and semantic matching fields, remain available in `reviews.reviews.raw_payload` (`JSONB`). Common fields are also normalized into PostgreSQL columns for the existing API.
