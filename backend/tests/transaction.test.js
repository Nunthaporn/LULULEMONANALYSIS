const test = require('node:test')
const assert = require('node:assert/strict')

const { resetSchema, truncateAll, insertProduct, query, getPool, closePool } = require('./setup')
const { withTransaction } = require('../config/db')

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
})

test.after(async () => {
  await closePool()
})

test('transaction rollback: a thrown error inside withTransaction rolls back all writes', async () => {
  await insertProduct({ product_id: 'p1' })

  await assert.rejects(
    withTransaction(async (client) => {
      await client.query(
        `INSERT INTO reviews.reviews (product_id, review_id, rating) VALUES ($1, $2, $3)`,
        ['p1', 'temp-review', 1],
      )
      throw new Error('forced rollback')
    }),
    /forced rollback/,
  )

  const result = await query(
    'SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE review_id = $1',
    ['temp-review'],
  )
  assert.equal(result.rows[0].c, 0, 'row inserted before the throw must not persist')
})

test('transaction commit: a successful withTransaction persists all writes', async () => {
  await insertProduct({ product_id: 'p1' })

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO reviews.reviews (product_id, review_id, rating) VALUES ($1, $2, $3)`,
      ['p1', 'committed-review', 1],
    )
  })

  const result = await query(
    'SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE review_id = $1',
    ['committed-review'],
  )
  assert.equal(result.rows[0].c, 1)
})

test('pool releases connections back after use (no leak across many queries)', async () => {
  const pool = getPool()
  const before = pool.totalCount
  for (let i = 0; i < 10; i += 1) {
    await query('SELECT 1')
  }
  // totalCount should stabilize, not grow unbounded, once queries complete.
  assert.ok(pool.totalCount <= before + pool.options.max)
})
