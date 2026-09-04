const test = require('node:test')
const assert = require('node:assert/strict')

const {
  resetSchema,
  truncateAll,
  insertProduct,
  insertReview,
  query,
  closePool,
} = require('./setup')
const summariesRepository = require('../repositories/summariesRepository')

async function insertProductSummary(overrides = {}) {
  const row = {
    product_id: 'p1',
    product_name: 'Alpha',
    category: 'Jackets',
    total_reviews: 10,
    low_star_reviews: 3,
    ...overrides,
  }
  await query(
    `INSERT INTO analytics.product_summaries (product_id, product_name, category, total_reviews, low_star_reviews)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id) DO UPDATE SET
       total_reviews = EXCLUDED.total_reviews,
       low_star_reviews = EXCLUDED.low_star_reviews`,
    [row.product_id, row.product_name, row.category, row.total_reviews, row.low_star_reviews],
  )
  return row
}

async function insertCategorySummary(overrides = {}) {
  const row = {
    product_id: 'p1',
    product_name: 'Alpha',
    category: 'Jackets',
    complaint_theme: 'Sizing & Fit',
    total_reviews: 5,
    ...overrides,
  }
  await query(
    `INSERT INTO analytics.category_summaries (product_id, product_name, category, complaint_theme, total_reviews)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id, complaint_theme) DO UPDATE SET total_reviews = EXCLUDED.total_reviews`,
    [row.product_id, row.product_name, row.category, row.complaint_theme, row.total_reviews],
  )
  return row
}

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
  await insertProduct({ product_id: 'p1', product_name: 'Alpha' })
})

test.after(async () => {
  await closePool()
})

test('product summary UPSERT does not duplicate on same product_id', async () => {
  await insertProductSummary({ total_reviews: 10 })
  await insertProductSummary({ total_reviews: 20 })
  const rows = await summariesRepository.getProductSummaries()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].totalReviews, 20)
})

test('category summary UPSERT does not duplicate on same (product_id, complaint_theme)', async () => {
  await insertCategorySummary({ total_reviews: 5 })
  await insertCategorySummary({ total_reviews: 9 })
  const rows = await summariesRepository.getCategorySummaries({})
  assert.equal(rows.length, 1)
  assert.equal(rows[0].totalReviews, 9)
})

test('dashboard aggregation returns the full expected shape', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1, complaint_theme: 'Sizing & Fit' })
  await insertProductSummary()
  await insertCategorySummary()

  const dashboard = await summariesRepository.getDashboard({})

  assert.ok(Array.isArray(dashboard.products))
  assert.ok(Array.isArray(dashboard.productSummary))
  assert.ok(Array.isArray(dashboard.categorySummary))
  assert.ok(Array.isArray(dashboard.ratingBreakdown))
  assert.ok(Array.isArray(dashboard.recentReviews))
  assert.ok(Array.isArray(dashboard.galleryImages))
  assert.ok('topComplaintTheme' in dashboard)
  assert.ok('topImageBackedComplaintTheme' in dashboard)
})

test('dashboard filters by productId when provided', async () => {
  await insertProduct({ product_id: 'p2', product_name: 'Beta' })
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1 })
  await insertReview({ product_id: 'p2', review_id: 'r2', rating: 1 })

  const dashboard = await summariesRepository.getDashboard({ productId: 'p1' })
  assert.equal(dashboard.products.length, 1)
  assert.equal(dashboard.products[0].productId, 'p1')
  assert.equal(dashboard.recentReviews.length, 1)
  assert.equal(dashboard.recentReviews[0].productId, 'p1')
})

test('empty database behavior: dashboard on an empty DB returns empty arrays and null tops', async () => {
  await truncateAll()
  const dashboard = await summariesRepository.getDashboard({})
  assert.deepEqual(dashboard.products, [])
  assert.deepEqual(dashboard.productSummary, [])
  assert.deepEqual(dashboard.ratingBreakdown, [])
  assert.equal(dashboard.topComplaintTheme, null)
  assert.equal(dashboard.topImageBackedComplaintTheme, null)
})
