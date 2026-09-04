require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const { query, closePool } = require('../config/db')

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  const text = fs.readFileSync(filePath, 'utf8')
  return parse(text, { columns: true, skip_empty_lines: true, bom: true })
}

function parseJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function resolveProcessedDir() {
  const projectRoot = path.resolve(__dirname, '..', '..')
  const candidates = [
    path.join(projectRoot, 'pipeline', 'data', 'processed'),
    path.join(projectRoot, 'data', 'processed'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error(`Could not find processed pipeline data. Tried: ${candidates.join(', ')}`)
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function padRight(value, width) {
  const text = String(value)
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

function printRow(cols, widths) {
  console.log(cols.map((col, index) => padRight(col, widths[index])).join(' | '))
}

async function main() {
  const processedDir = resolveProcessedDir()
  const allReviewsJsonPath = path.join(processedDir, 'all_reviews.json')
  const allReviewsCsvPath = path.join(processedDir, 'all_reviews.csv')

  const expectedReviews = fs.existsSync(allReviewsJsonPath)
    ? parseJson(allReviewsJsonPath)
    : parseCsv(allReviewsCsvPath)
  const expectedImages = parseCsv(path.join(processedDir, 'review_images_mapping.csv'))
  const expectedProductSummaries = parseCsv(path.join(processedDir, 'product_summary.csv'))
  const expectedCategorySummaries = parseCsv(path.join(processedDir, 'category_summary.csv'))

  const expectedTotals = {
    products: new Set(expectedReviews.map((r) => r.product_id || r.productId)).size,
    reviews: expectedReviews.length,
    lowStar: expectedReviews.filter((r) => toNumber(r.rating) <= 3 && toNumber(r.rating) >= 1)
      .length,
    oneStar: expectedReviews.filter((r) => toNumber(r.rating) === 1).length,
    twoStar: expectedReviews.filter((r) => toNumber(r.rating) === 2).length,
    threeStar: expectedReviews.filter((r) => toNumber(r.rating) === 3).length,
    images: expectedImages.length,
    productSummaries: expectedProductSummaries.length,
    categorySummaries: expectedCategorySummaries.length,
  }

  const [
    productsCount,
    reviewsCount,
    lowStarCount,
    oneStarCount,
    twoStarCount,
    threeStarCount,
    imagesCount,
    productSummariesCount,
    categorySummariesCount,
  ] = await Promise.all([
    query('SELECT COUNT(*)::int AS c FROM catalog.products'),
    query('SELECT COUNT(*)::int AS c FROM reviews.reviews'),
    query('SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE rating BETWEEN 1 AND 3'),
    query('SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE rating = 1'),
    query('SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE rating = 2'),
    query('SELECT COUNT(*)::int AS c FROM reviews.reviews WHERE rating = 3'),
    query('SELECT COUNT(*)::int AS c FROM reviews.review_images'),
    query('SELECT COUNT(*)::int AS c FROM analytics.product_summaries'),
    query('SELECT COUNT(*)::int AS c FROM analytics.category_summaries'),
  ])

  const actualTotals = {
    products: productsCount.rows[0].c,
    reviews: reviewsCount.rows[0].c,
    lowStar: lowStarCount.rows[0].c,
    oneStar: oneStarCount.rows[0].c,
    twoStar: twoStarCount.rows[0].c,
    threeStar: threeStarCount.rows[0].c,
    images: imagesCount.rows[0].c,
    productSummaries: productSummariesCount.rows[0].c,
    categorySummaries: categorySummariesCount.rows[0].c,
  }

  const rows = [
    ['products', expectedTotals.products, actualTotals.products],
    ['reviews (total)', expectedTotals.reviews, actualTotals.reviews],
    ['reviews (low-star 1-3)', expectedTotals.lowStar, actualTotals.lowStar],
    ['reviews (1-star)', expectedTotals.oneStar, actualTotals.oneStar],
    ['reviews (2-star)', expectedTotals.twoStar, actualTotals.twoStar],
    ['reviews (3-star)', expectedTotals.threeStar, actualTotals.threeStar],
    ['review images', expectedTotals.images, actualTotals.images],
    ['product summaries', expectedTotals.productSummaries, actualTotals.productSummaries],
    ['category summaries', expectedTotals.categorySummaries, actualTotals.categorySummaries],
  ]

  console.log('PostgreSQL Migration Validation')
  console.log('================================')
  console.log()

  const widths = [24, 10, 10, 8]
  printRow(['metric', 'expected', 'actual', 'status'], widths)
  printRow(['-'.repeat(24), '-'.repeat(10), '-'.repeat(10), '-'.repeat(8)], widths)

  let hasCriticalMismatch = false
  for (const [label, expected, actual] of rows) {
    const match = expected === actual
    if (!match) {
      hasCriticalMismatch = true
    }
    printRow([label, expected, actual, match ? 'OK' : 'MISMATCH'], widths)
  }

  console.log()
  console.log('Per-product counts')
  console.log('-------------------')

  const perProductExpected = new Map()
  for (const row of expectedReviews) {
    const productId = row.product_id || row.productId
    if (!productId) continue
    if (!perProductExpected.has(productId)) {
      perProductExpected.set(productId, { total: 0, lowStar: 0 })
    }
    const entry = perProductExpected.get(productId)
    entry.total += 1
    const rating = toNumber(row.rating)
    if (rating >= 1 && rating <= 3) {
      entry.lowStar += 1
    }
  }
  const perProductImagesExpected = new Map()
  for (const row of expectedImages) {
    const productId = row.product_id || row.productId
    if (!productId) continue
    perProductImagesExpected.set(productId, (perProductImagesExpected.get(productId) || 0) + 1)
  }

  const perProductActualResult = await query(`
    SELECT
      p.product_id AS "productId",
      COUNT(DISTINCT r.review_id) FILTER (WHERE r.review_id IS NOT NULL) AS total,
      COUNT(DISTINCT r.review_id) FILTER (WHERE r.rating BETWEEN 1 AND 3) AS "lowStar",
      (SELECT COUNT(*) FROM reviews.review_images i WHERE i.product_id = p.product_id) AS images
    FROM catalog.products p
    LEFT JOIN reviews.reviews r ON r.product_id = p.product_id
    GROUP BY p.product_id
    ORDER BY p.product_id
  `)

  const productWidths = [30, 12, 12, 10]
  printRow(['product_id', 'total (exp/act)', 'lowStar (exp/act)', 'images (exp/act)'], productWidths)
  for (const row of perProductActualResult.rows) {
    const expected = perProductExpected.get(row.productId) || { total: 0, lowStar: 0 }
    const expectedImages2 = perProductImagesExpected.get(row.productId) || 0
    const totalStr = `${expected.total}/${row.total}`
    const lowStarStr = `${expected.lowStar}/${row.lowStar}`
    const imagesStr = `${expectedImages2}/${row.images}`
    if (Number(row.total) !== expected.total || Number(row.lowStar) !== expected.lowStar) {
      hasCriticalMismatch = true
    }
    printRow([row.productId, totalStr, lowStarStr, imagesStr], productWidths)
  }

  console.log()
  if (hasCriticalMismatch) {
    console.log('RESULT: FAILED — critical count mismatches detected above.')
  } else {
    console.log('RESULT: PASSED — all counts match expected processed-data counts.')
  }

  return hasCriticalMismatch
}

if (require.main === module) {
  main()
    .then((hasCriticalMismatch) => closePool().then(() => process.exit(hasCriticalMismatch ? 1 : 0)))
    .catch((error) => {
      console.error('Validation failed to run:', error.message)
      closePool().finally(() => process.exit(1))
    })
}

module.exports = { main }
