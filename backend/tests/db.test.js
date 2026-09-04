const test = require('node:test')
const assert = require('node:assert/strict')

const { query, resetSchema, truncateAll, closePool } = require('./setup')

test.before(async () => {
  await resetSchema()
})

test.after(async () => {
  await closePool()
})

test('database connectivity configuration: SELECT 1 succeeds', async () => {
  const result = await query('SELECT 1 AS ok')
  assert.equal(result.rows[0].ok, 1)
})

test('required schemas exist', async () => {
  const result = await query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)`,
    [['catalog', 'reviews', 'analytics', 'pipeline']],
  )
  const found = result.rows.map((r) => r.schema_name).sort()
  assert.deepEqual(found, ['analytics', 'catalog', 'pipeline', 'reviews'])
})

test('migrations are tracked and rerunning is a no-op', async () => {
  const before = await query('SELECT COUNT(*)::int AS c FROM pipeline.schema_migrations')
  assert.ok(before.rows[0].c >= 5, 'expected at least 5 tracked migrations')
  await resetSchema()
  const after = await query('SELECT COUNT(*)::int AS c FROM pipeline.schema_migrations')
  assert.equal(after.rows[0].c, before.rows[0].c, 'rerunning migrations must not duplicate tracking rows')
})

test('empty database behavior: counts are zero with no rows', async () => {
  await truncateAll()
  const result = await query('SELECT COUNT(*)::int AS c FROM reviews.reviews')
  assert.equal(result.rows[0].c, 0)
})
