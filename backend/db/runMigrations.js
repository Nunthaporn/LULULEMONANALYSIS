require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')

const { getPool, closePool } = require('../config/db')

const MIGRATIONS_DIR = __dirname

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS pipeline;
    CREATE TABLE IF NOT EXISTS pipeline.schema_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT migration_name FROM pipeline.schema_migrations')
  return new Set(result.rows.map((row) => row.migration_name))
}

async function runMigrations() {
  const pool = getPool()
  const client = await pool.connect()
  const files = listMigrationFiles()

  console.log(`Found ${files.length} migration file(s) in backend/db/migrations`)

  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file} (already applied)`)
        continue
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`RUN   ${file}`)

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO pipeline.schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
          [file],
        )
        await client.query('COMMIT')
        console.log(`DONE  ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`FAILED ${file}: ${error.message}`)
        throw error
      }
    }

    console.log('All migrations complete.')
  } finally {
    client.release()
  }
}

async function main() {
  try {
    await runMigrations()
    await closePool()
    process.exit(0)
  } catch (error) {
    console.error('Migration run aborted.')
    await closePool().catch(() => {})
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { runMigrations, listMigrationFiles }
