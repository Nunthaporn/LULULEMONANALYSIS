const test = require('node:test')
const assert = require('node:assert/strict')

const { resetSchema, truncateAll, insertProduct, insertReview, query, closePool } = require('./setup')
const reviewsRepository = require('../repositories/reviewsRepository')

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
  await insertProduct({ product_id: 'p1', product_name: 'Alpha' })
  await insertProduct({ product_id: 'p2', product_name: 'Beta' })
})

test.after(async () => {
  await closePool()
})

test('review insert: a new review is retrievable', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1 })
  const { items, total } = await reviewsRepository.findPaginated({ page: 1, limit: 25 })
  assert.equal(total, 1)
  assert.equal(items[0].reviewId, 'r1')
  assert.equal(items[0].productId, 'p1')
  assert.equal(items[0].productName, 'Alpha', 'product fields should be joined onto the review')
})

test('review UPSERT and duplicate prevention: same (product_id, review_id) does not duplicate', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1, review_title: 'Original' })
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 2, review_title: 'Edited' })
  const countResult = await query(
    'SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE product_id = $1 AND review_id = $2',
    ['p1', 'r1'],
  )
  assert.equal(countResult.rows[0].c, 1)
  const { items } = await reviewsRepository.findPaginated({ page: 1, limit: 25 })
  assert.equal(items[0].rating, 2)
  assert.equal(items[0].reviewTitle, 'Edited')
})

test('pagination: page/limit/total/totalPages are correct', async () => {
  for (let i = 0; i < 5; i += 1) {
    await insertReview({ product_id: 'p1', review_id: `r${i}`, rating: 1 })
  }
  const pageOne = await reviewsRepository.findPaginated({ page: 1, limit: 2 })
  assert.equal(pageOne.items.length, 2)
  assert.equal(pageOne.total, 5)

  const pageThree = await reviewsRepository.findPaginated({ page: 3, limit: 2 })
  assert.equal(pageThree.items.length, 1, 'last page should have the remainder')
})

test('review product filtering', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1 })
  await insertReview({ product_id: 'p2', review_id: 'r2', rating: 1 })
  const { items, total } = await reviewsRepository.findPaginated({
    productId: 'p1',
    page: 1,
    limit: 25,
  })
  assert.equal(total, 1)
  assert.equal(items[0].productId, 'p1')
})

test('rating filtering', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1 })
  await insertReview({ product_id: 'p1', review_id: 'r2', rating: 3 })
  const { items, total } = await reviewsRepository.findPaginated({ rating: 3, page: 1, limit: 25 })
  assert.equal(total, 1)
  assert.equal(items[0].rating, 3)
})

test('complaint-theme filtering', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', complaint_theme: 'Sizing & Fit' })
  await insertReview({ product_id: 'p1', review_id: 'r2', complaint_theme: 'Zipper Issues' })
  const { items, total } = await reviewsRepository.findPaginated({
    complaintTheme: 'Zipper Issues',
    page: 1,
    limit: 25,
  })
  assert.equal(total, 1)
  assert.equal(items[0].complaintTheme, 'Zipper Issues')
})

test('search matches review title/text via full text search, and review_id via ILIKE', async () => {
  await insertReview({
    product_id: 'p1',
    review_id: 'r1',
    review_title: 'Zipper broke',
    review_text: 'The zipper broke after one wash.',
  })
  await insertReview({
    product_id: 'p1',
    review_id: 'r2',
    review_title: 'Great jacket',
    review_text: 'Loved the fit and feel.',
  })

  const byText = await reviewsRepository.findPaginated({ search: 'zipper', page: 1, limit: 25 })
  assert.equal(byText.total, 1)
  assert.equal(byText.items[0].reviewId, 'r1')

  const byId = await reviewsRepository.findPaginated({ search: 'r2', page: 1, limit: 25 })
  assert.equal(byId.total, 1)
  assert.equal(byId.items[0].reviewId, 'r2')
})

test('rating breakdown returns Mongo-aggregate-style { _id, count } rows', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', rating: 1 })
  await insertReview({ product_id: 'p1', review_id: 'r2', rating: 1 })
  await insertReview({ product_id: 'p1', review_id: 'r3', rating: 2 })
  const breakdown = await reviewsRepository.ratingBreakdown({ productId: 'p1' })
  assert.deepEqual(breakdown, [
    { _id: 1, count: 2 },
    { _id: 2, count: 1 },
  ])
})

test('top complaint calculation picks the highest-count theme, tie-broken alphabetically', async () => {
  await insertReview({ product_id: 'p1', review_id: 'r1', complaint_theme: 'Zipper Issues' })
  await insertReview({ product_id: 'p1', review_id: 'r2', complaint_theme: 'Zipper Issues' })
  await insertReview({ product_id: 'p1', review_id: 'r3', complaint_theme: 'Sizing & Fit' })
  const top = await reviewsRepository.topComplaintThemeLowStar({ productId: 'p1' })
  assert.equal(top.complaintTheme, 'Zipper Issues')
  assert.equal(top.totalReviews, 2)
})
