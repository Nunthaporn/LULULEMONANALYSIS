const test = require('node:test')
const assert = require('node:assert/strict')

const { resetSchema, truncateAll, insertProduct, query, getPool, closePool } = require('./setup')
const { batchUpsert } = require('../scripts/importPipelineData')

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
  await insertProduct({ product_id: 'p1' })
})

test.after(async () => {
  await closePool()
})

test('importer idempotency: running the same batch twice inserts once, then only updates', async () => {
  const pool = getPool()
  const client = await pool.connect()
  const rows = [
    { product_id: 'p1', review_id: 'r1', rating: 1, review_title: 'a', review_text: '', review_date: null, reviewer_name_or_id: '', verified_buyer: false, size_purchased: '', usual_size: '', fit_feedback: '', helpful_votes: 0, has_photo: false, photo_count: 0, photo_urls: [], lulu_response_text: '', lulu_response_date: null, complaint_theme: 'Other', business_insight: '', scraped_at: null, content_hash: null, source_payload_hash: null, raw_payload: '{}' },
    { product_id: 'p1', review_id: 'r2', rating: 2, review_title: 'b', review_text: '', review_date: null, reviewer_name_or_id: '', verified_buyer: false, size_purchased: '', usual_size: '', fit_feedback: '', helpful_votes: 0, has_photo: false, photo_count: 0, photo_urls: [], lulu_response_text: '', lulu_response_date: null, complaint_theme: 'Other', business_insight: '', scraped_at: null, content_hash: null, source_payload_hash: null, raw_payload: '{}' },
  ]
  const columns = [
    'product_id', 'review_id', 'rating', 'review_title', 'review_text', 'review_date',
    'reviewer_name_or_id', 'verified_buyer', 'size_purchased', 'usual_size', 'fit_feedback',
    'helpful_votes', 'has_photo', 'photo_count', 'photo_urls', 'lulu_response_text',
    'lulu_response_date', 'complaint_theme', 'business_insight', 'scraped_at', 'content_hash',
    'source_payload_hash', 'raw_payload',
  ]

  try {
    const first = await batchUpsert(client, {
      schemaTable: 'reviews.reviews',
      columns,
      conflictColumns: ['product_id', 'review_id'],
      rows,
      batchSize: 500,
    })
    assert.equal(first.inserted, 2)
    assert.equal(first.updated, 0)

    const second = await batchUpsert(client, {
      schemaTable: 'reviews.reviews',
      columns,
      conflictColumns: ['product_id', 'review_id'],
      rows,
      batchSize: 500,
    })
    assert.equal(second.inserted, 0)
    assert.equal(second.updated, 2)

    const countResult = await client.query('SELECT COUNT(*)::int AS c FROM reviews.reviews')
    assert.equal(countResult.rows[0].c, 2, 'running the batch twice must not create duplicates')
  } finally {
    client.release()
  }
})
