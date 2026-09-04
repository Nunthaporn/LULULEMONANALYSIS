# PostgreSQL Setup

Companion doc to `docs/postgres_migration_plan.md`. This one is the "how do I actually run this"
reference.

## 1. Required PostgreSQL version

Written and tested against **PostgreSQL 14+**. Nothing in the migrations uses version-specific
syntax beyond what's been standard since Postgres 12 (`GENERATED`, `ON CONFLICT`, `GIN` on
`tsvector`, arrays), so 12+ should work, but 14+ is the assumption.

## 2. Database name

`lululemonvog` — must already exist before running migrations (the migration runner creates
schemas/tables/indexes inside it, but not the database itself). Create it once with:

```sql
CREATE DATABASE lululemonvog;
```

## 3. Schema structure

Four schemas, no application tables in `public`:

- `catalog` — `products`
- `reviews` — `reviews`, `review_images`
- `analytics` — `product_summaries`, `category_summaries`, `review_analysis`
- `pipeline` — `ingestion_runs`, `ingestion_errors`, `product_checkpoints`, `schema_migrations`

## 4. Table structure

See `docs/postgres_migration_plan.md` §2–5 for full column-by-column mapping, primary keys,
foreign keys, and index lists. The authoritative definitions are the SQL files themselves:

```text
backend/db/migrations/001_create_schemas.sql
backend/db/migrations/002_create_core_tables.sql
backend/db/migrations/003_create_analytics_tables.sql
backend/db/migrations/004_create_pipeline_tables.sql
backend/db/migrations/005_create_indexes.sql
```

## 5. Local environment setup

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env` and set real values — at minimum `PGPASSWORD`, and `PGDATABASE=lululemonvog`
if it isn't already the default. Either set `DATABASE_URL` (takes priority) or the individual
`PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` / `PGSSL` variables.

```powershell
npm install
```

## 6. Migration command

```powershell
npm run db:migrate
```

Runs every `.sql` file in `backend/db/migrations/` in filename order, inside a transaction per
file, and records each one in `pipeline.schema_migrations`. Safe to run repeatedly — already-
applied migrations are skipped.

## 7. Import command

```powershell
npm run import
```

Reads `data/processed/all_reviews.json` (falls back to `all_reviews.csv`),
`review_images_mapping.csv`, `product_summary.csv`, and `category_summary.csv` from the Python
pipeline's output, and upserts them into Postgres in batches inside one transaction. Safe to run
repeatedly — uses `ON CONFLICT ... DO UPDATE`, so re-running never creates duplicates.

## 8. Validation command

```powershell
npm run db:validate
```

Recomputes expected counts directly from the same processed CSV/JSON files and compares them
against what's actually in Postgres — total reviews, low-star/1-star/2-star/3-star counts, image
count, summary counts, and a per-product breakdown. Exits non-zero if anything doesn't match.

## 9. Backend start command

```powershell
npm run dev    # nodemon, auto-restart
npm start      # plain node
```

`GET /api/health` reports `{ ok, database: "connected"|"disconnected", databaseType: "postgresql" }`
without leaking host/user/password.

## 10. Rollback steps

1. Stop the backend.
2. `DROP SCHEMA IF EXISTS catalog, reviews, analytics, pipeline CASCADE;` — removes everything
   this migration created, nothing else.
3. Copy `backend/legacy-mongo/{config,models,routes}/*` back to their original `backend/`
   locations, and `backend/legacy-mongo/scripts/importPipelineData.js` back to
   `backend/scripts/importPipelineData.js`.
4. `npm install mongoose` (and optionally `npm uninstall pg`).
5. Restore `MONGO_URI` in `backend/.env`.
6. `npm run dev`.

No pipeline data is ever at risk — `data/processed/` and `data/state/pipeline_state.db` are the
canonical source regardless of which database the API points at.

## 11. Backup recommendation

Before running `npm run import` against a database that already has real data in it (not just a
fresh migration target), take a logical backup:

```powershell
pg_dump -h localhost -U postgres -d lululemonvog -F c -f lululemonvog_backup.dump
```

Restore with `pg_restore -h localhost -U postgres -d lululemonvog lululemonvog_backup.dump` if
needed. Since the importer is idempotent and the Python pipeline's processed files are the real
source of truth, this is a convenience/speed safeguard rather than a hard requirement — worst
case, drop the schemas and re-migrate + re-import from scratch.

## 12. Common PostgreSQL connection errors

| Error | Likely cause | Fix |
|---|---|---|
| `ECONNREFUSED` | Postgres isn't running, or wrong `PGHOST`/`PGPORT` | Confirm the server is up and the port matches (`5432` default) |
| `password authentication failed for user "..."` | Wrong `PGUSER`/`PGPASSWORD`, or `pg_hba.conf` requires a different auth method | Check credentials; check `pg_hba.conf` allows password auth for this user/host |
| `database "lululemonvog" does not exist` | The database itself was never created | `CREATE DATABASE lululemonvog;` as a superuser, then re-run `npm run db:migrate` |
| `relation "catalog.products" does not exist` | Migrations haven't been run yet, or ran against a different database than the app is now pointed at | `npm run db:migrate`, and double check `PGDATABASE`/`DATABASE_URL` match between the migrate and the app/import runs |
| `SSL/TLS required` (managed Postgres hosts) | `PGSSL` not enabled for a host that requires TLS | Set `PGSSL=true` in `.env` |
| `too many clients already` | Pool exhausted, or another process is holding connections | Lower `PGPOOL_MAX` app-side, or raise `max_connections` server-side; make sure old backend processes are actually stopped |
| `unterminated quoted string` / syntax errors from the migration runner | A migration file was hand-edited and broke SQL syntax | Fix the `.sql` file; `pipeline.schema_migrations` only marks a migration applied after it succeeds, so a fixed re-run will retry it |

## Recommended full setup flow

```powershell
cd backend
npm install
npm run db:migrate
npm run import
npm run db:validate
npm run dev
```
