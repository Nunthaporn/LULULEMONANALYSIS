# Legacy MongoDB backend (pre-Postgres-migration)

This directory holds an untouched copy of the backend's original MongoDB/Mongoose persistence
layer, taken immediately before the PostgreSQL migration (see
`docs/postgres_migration_plan.md`). It exists purely as a rollback reference — nothing in the
active application requires or imports from this directory.

## Contents

- `config/db.js` — original `mongoose.connect(MONGO_URI)` setup
- `models/*.js` — original Mongoose schemas (`Product`, `Review`, `ReviewImage`,
  `ProductSummary`, `CategorySummary`)
- `routes/*.js` — original Mongoose-backed Express routes
- `scripts/importPipelineData.js` — original `bulkWrite`-based importer

## Rolling back to MongoDB

1. Copy the files in this directory back over their original locations
   (`backend/config/db.js`, `backend/models/`, `backend/routes/`, `backend/scripts/`).
2. Reinstall `mongoose` in `backend/package.json` (`npm install mongoose`) and remove `pg` if you
   want a clean revert.
3. Restore `MONGO_URI` in `backend/.env`.
4. `npm run dev` as before.

The underlying data was never deleted — the Python pipeline's `data/processed/*.csv|json` and
`data/state/pipeline_state.db` remain the canonical source of truth regardless of which database
the Express API is pointed at. Re-running the (Mongo or Postgres) importer against that data
always reconstructs the same application-layer state.
