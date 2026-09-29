const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildProductRow,
  buildReviewRow,
  validateProducts,
  validateReviews,
} = require('../json-importers/common')

test('buildProductRow maps dashboard JSON keys to PostgreSQL columns', () => {
  assert.deepEqual(buildProductRow({
    product_id: 'define_jacket_nulu',
    product_name: 'Define Jacket Nulu',
    productNameId: 'Define_Jacket_Nulu',
    product_url: 'https://example.test/product',
    category: 'Jackets',
  }), {
    product_id: 'define_jacket_nulu',
    product_name: 'Define Jacket Nulu',
    product_name_id: 'Define_Jacket_Nulu',
    product_url: 'https://example.test/product',
    category: 'Jackets',
  })
})

test('buildReviewRow normalizes a scraped regional review and keeps its raw payload', () => {
  const source = {
    product_id: 'define_jacket_nulu',
    review_id: 'hk-asia-001',
    rating: 2,
    title: 'Too loose',
    review_text: 'Not figure hugging.',
    submission_time: '2026-01-19T00:00:00.000Z',
    author: 'Tina',
    is_verified_buyer: true,
    likes: 3,
    photo_count: 1,
    photo_urls: '["https://example.test/photo.jpg"]',
    region: 'asia',
    source_site: 'lululemon.com.hk',
  }

  const row = buildReviewRow(source)

  assert.equal(row.review_title, 'Too loose')
  assert.equal(row.verified_buyer, true)
  assert.equal(row.helpful_votes, 3)
  assert.equal(row.has_photo, true)
  assert.deepEqual(row.photo_urls, ['https://example.test/photo.jpg'])
  assert.equal(JSON.parse(row.raw_payload).source_site, 'lululemon.com.hk')
})

test('validators reject incomplete products and invalid review ratings', () => {
  assert.throws(
    () => validateProducts([buildProductRow({ product_id: 'p1' })], 'products.json'),
    /missing product_name/,
  )
  assert.throws(
    () => validateReviews([{ product_id: 'p1', review_id: 'r1', rating: 0 }], 'reviews.json'),
    /rating must be an integer from 1 to 5/,
  )
})
