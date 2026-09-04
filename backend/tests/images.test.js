const test = require('node:test')
const assert = require('node:assert/strict')

const { resetSchema, truncateAll, insertProduct, insertReview, query, closePool } = require('./setup')
const imagesRepository = require('../repositories/imagesRepository')

async function insertImage(overrides = {}) {
  const image = {
    product_id: 'p1',
    review_id: 'r1',
    photo_id: 'photo1',
    rating: 1,
    complaint_theme: 'Fabric & Material Quality',
    image_url: 'https://example.com/photo1.jpg',
    ...overrides,
  }
  await query(
    `INSERT INTO reviews.review_images (product_id, review_id, photo_id, rating, complaint_theme, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (product_id, review_id, photo_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       complaint_theme = EXCLUDED.complaint_theme,
       image_url = EXCLUDED.image_url`,
    [image.product_id, image.review_id, image.photo_id, image.rating, image.complaint_theme, image.image_url],
  )
  return image
}

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
  await insertProduct({ product_id: 'p1' })
  await insertReview({ product_id: 'p1', review_id: 'r1' })
})

test.after(async () => {
  await closePool()
})

test('image insert: a new image is retrievable and joined to product fields', async () => {
  await insertImage({ photo_id: 'photo1' })
  const { items, total } = await imagesRepository.findPaginated({ page: 1, limit: 25 })
  assert.equal(total, 1)
  assert.equal(items[0].photoId, 'photo1')
  assert.equal(items[0].productId, 'p1')
})

test('image UPSERT: same (product_id, review_id, photo_id) updates instead of duplicating', async () => {
  await insertImage({ photo_id: 'photo1', image_url: 'https://example.com/v1.jpg' })
  await insertImage({ photo_id: 'photo1', image_url: 'https://example.com/v2.jpg' })
  const countResult = await query('SELECT COUNT(*)::int AS c FROM reviews.review_images')
  assert.equal(countResult.rows[0].c, 1)
  const { items } = await imagesRepository.findPaginated({ page: 1, limit: 25 })
  assert.equal(items[0].imageUrl, 'https://example.com/v2.jpg')
})

test('image pagination', async () => {
  for (let i = 0; i < 5; i += 1) {
    await insertImage({ photo_id: `photo${i}` })
  }
  const pageOne = await imagesRepository.findPaginated({ page: 1, limit: 2 })
  assert.equal(pageOne.items.length, 2)
  assert.equal(pageOne.total, 5)
})
