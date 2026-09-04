const path = require('path')
const { query, getPool, closePool } = require('../config/db')
const { runMigrations } = require('../db/runMigrations')

async function resetSchema() {
  await runMigrations()
}

async function truncateAll() {
  await query(`
    TRUNCATE TABLE
      pipeline.ingestion_errors,
      pipeline.product_checkpoints,
      pipeline.ingestion_runs,
      analytics.review_analysis,
      analytics.category_summaries,
      analytics.product_summaries,
      reviews.review_images,
      reviews.reviews,
      catalog.products
    RESTART IDENTITY CASCADE
  `)
}

async function insertProduct(overrides = {}) {
  const product = {
    product_id: 'test_product',
    product_name: 'Test Product',
    product_name_id: 'Test_Product',
    product_url: 'https://example.com/test-product',
    category: 'Test Category',
    ...overrides,
  }
  await query(
    `INSERT INTO catalog.products (product_id, product_name, product_name_id, product_url, category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       product_name_id = EXCLUDED.product_name_id,
       product_url = EXCLUDED.product_url,
       category = EXCLUDED.category`,
    [product.product_id, product.product_name, product.product_name_id, product.product_url, product.category],
  )
  return product
}

async function insertReview(overrides = {}) {
  const review = {
    product_id: 'test_product',
    review_id: 'r1',
    rating: 1,
    review_title: 'Bad quality',
    review_text: 'The fabric fell apart quickly.',
    review_date: new Date('2026-01-01T00:00:00Z'),
    complaint_theme: 'Fabric & Material Quality',
    helpful_votes: 0,
    ...overrides,
  }
  await query(
    `INSERT INTO reviews.reviews (product_id, review_id, rating, review_title, review_text, review_date, complaint_theme, helpful_votes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (product_id, review_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       review_title = EXCLUDED.review_title,
       review_text = EXCLUDED.review_text,
       review_date = EXCLUDED.review_date,
       complaint_theme = EXCLUDED.complaint_theme,
       helpful_votes = EXCLUDED.helpful_votes`,
    [
      review.product_id,
      review.review_id,
      review.rating,
      review.review_title,
      review.review_text,
      review.review_date,
      review.complaint_theme,
      review.helpful_votes,
    ],
  )
  return review
}

module.exports = {
  resetSchema,
  truncateAll,
  insertProduct,
  insertReview,
  query,
  getPool,
  closePool,
}
