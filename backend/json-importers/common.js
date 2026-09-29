require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')

const { getPool, closePool } = require('../config/db')
const { batchUpsert } = require('../scripts/importPipelineData')

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'processed', 'dashboard_data')
const BATCH_SIZE = 500

const PRODUCT_COLUMNS = [
  'product_id',
  'product_name',
  'product_name_id',
  'product_url',
  'category',
]

const REVIEW_COLUMNS = [
  'product_id',
  'review_id',
  'rating',
  'review_title',
  'review_text',
  'review_date',
  'reviewer_name_or_id',
  'verified_buyer',
  'size_purchased',
  'usual_size',
  'fit_feedback',
  'helpful_votes',
  'has_photo',
  'photo_count',
  'photo_urls',
  'lulu_response_text',
  'lulu_response_date',
  'complaint_theme',
  'business_insight',
  'scraped_at',
  'content_hash',
  'source_payload_hash',
  'raw_payload',
]

function cleanText(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

function pick(...values) {
  return values.find((value) => value !== null && value !== undefined && cleanText(value) !== '') ?? ''
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return ['true', '1', 'yes', 'y', 'verified'].includes(cleanText(value).toLowerCase())
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

function toDate(value) {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean)
  }

  const text = cleanText(value)
  if (!text) {
    return []
  }

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map(cleanText).filter(Boolean)
    }
  } catch (_error) {
    // The scraper may emit semicolon-delimited values instead of JSON.
  }

  return text.split(/\s*;\s*/).map(cleanText).filter(Boolean)
}

function readJsonArray(fileName) {
  const filePath = path.join(DATA_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSON file not found: ${filePath}`)
  }

  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(value)) {
    throw new Error(`${fileName} must contain a top-level JSON array`)
  }
  return value
}

function buildProductRow(row) {
  return {
    product_id: cleanText(pick(row.product_id, row.productId)),
    product_name: cleanText(pick(row.product_name, row.productName)),
    product_name_id: cleanText(pick(row.productNameId, row.product_name_id)),
    product_url: cleanText(pick(row.product_url, row.productUrl)),
    category: cleanText(row.category),
  }
}

function buildReviewRow(row) {
  const photoUrls = toStringList(pick(row.photo_urls, row.photoUrls))
  const photoCount = toNonNegativeInteger(pick(row.photo_count, row.photoCount))

  return {
    product_id: cleanText(pick(row.product_id, row.productId)),
    review_id: cleanText(pick(row.review_id, row.reviewId)),
    rating: Number(row.rating),
    review_title: cleanText(pick(row.title, row.review_title, row.reviewTitle)),
    review_text: cleanText(pick(row.review_text, row.reviewText)),
    review_date: toDate(pick(row.submission_time, row.review_date, row.reviewDate)),
    reviewer_name_or_id: cleanText(pick(row.author, row.reviewer_name_or_id, row.reviewerNameOrId)),
    verified_buyer: toBoolean(pick(row.is_verified_buyer, row.verified_buyer, row.verifiedBuyer)),
    size_purchased: cleanText(pick(row.size_purchased, row.sizePurchased)),
    usual_size: cleanText(pick(row.usual_size, row.usualSize)),
    fit_feedback: cleanText(pick(row.fit_feedback, row.fitFeedback)),
    helpful_votes: toNonNegativeInteger(pick(row.likes, row.helpful_votes, row.helpfulVotes)),
    has_photo: photoCount > 0 || photoUrls.length > 0,
    photo_count: photoCount,
    photo_urls: photoUrls,
    lulu_response_text: cleanText(pick(row.lulu_response_text, row.luluResponseText)),
    lulu_response_date: toDate(pick(row.lulu_response_time, row.lulu_response_date, row.luluResponseDate)),
    complaint_theme: cleanText(pick(row.complaint_theme, row.complaintTheme)) || 'Other',
    business_insight: cleanText(pick(row.business_insight, row.businessInsight)),
    scraped_at: toDate(pick(row.scraped_at, row.scrapedAt)),
    content_hash: cleanText(pick(row.content_hash, row.contentHash)) || null,
    source_payload_hash: cleanText(pick(row.source_payload_hash, row.sourcePayloadHash)) || null,
    raw_payload: JSON.stringify(row),
  }
}

function validateProducts(rows, fileName) {
  rows.forEach((row, index) => {
    for (const field of PRODUCT_COLUMNS) {
      if (!row[field]) {
        throw new Error(`${fileName} row ${index + 1}: missing ${field}`)
      }
    }
  })
}

function validateReviews(rows, fileName) {
  rows.forEach((row, index) => {
    if (!row.product_id) {
      throw new Error(`${fileName} row ${index + 1}: missing product_id`)
    }
    if (!row.review_id) {
      throw new Error(`${fileName} row ${index + 1}: missing review_id`)
    }
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) {
      throw new Error(`${fileName} row ${index + 1}: rating must be an integer from 1 to 5`)
    }
  })
}

function uniqueProducts(rows) {
  const products = new Map()
  for (const row of rows) {
    const product = buildProductRow(row)
    if (product.product_id && !products.has(product.product_id)) {
      products.set(product.product_id, product)
    }
  }
  return [...products.values()]
}

async function insertProductsIfMissing(client, rows) {
  if (!rows.length) {
    return 0
  }

  let inserted = 0
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const chunk = rows.slice(start, start + BATCH_SIZE)
    const params = []
    const tuples = chunk.map((row) => {
      const placeholders = PRODUCT_COLUMNS.map((column) => {
        params.push(row[column])
        return `$${params.length}`
      })
      return `(${placeholders.join(', ')})`
    })

    const result = await client.query(
      `INSERT INTO catalog.products (${PRODUCT_COLUMNS.join(', ')})
       VALUES ${tuples.join(', ')}
       ON CONFLICT (product_id) DO NOTHING
       RETURNING product_id`,
      params,
    )
    inserted += result.rowCount
  }
  return inserted
}

async function inTransaction(callback) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function importProductsFile(fileName) {
  const rows = readJsonArray(fileName).map(buildProductRow)
  validateProducts(rows, fileName)

  const result = await inTransaction((client) => batchUpsert(client, {
    schemaTable: 'catalog.products',
    columns: PRODUCT_COLUMNS,
    conflictColumns: ['product_id'],
    rows,
    batchSize: BATCH_SIZE,
  }))

  return { fileName, type: 'products', ...result }
}

async function importReviewsFile(fileName) {
  const sourceRows = readJsonArray(fileName)
  const reviewRows = sourceRows.map(buildReviewRow)
  validateReviews(reviewRows, fileName)

  return inTransaction(async (client) => {
    const products = uniqueProducts(sourceRows)
    validateProducts(products, fileName)
    const productsInserted = await insertProductsIfMissing(client, products)
    const result = await batchUpsert(client, {
      schemaTable: 'reviews.reviews',
      columns: REVIEW_COLUMNS,
      conflictColumns: ['product_id', 'review_id'],
      rows: reviewRows,
      batchSize: BATCH_SIZE,
    })

    return { fileName, type: 'reviews', productsInserted, ...result }
  })
}

function printResult(result) {
  console.log(`${result.fileName}: processed=${result.processed}, inserted=${result.inserted}, updated=${result.updated}`)
  if (result.type === 'reviews') {
    console.log(`${result.fileName}: missing products inserted=${result.productsInserted}`)
  }
}

async function run(importer, fileName) {
  try {
    const result = await importer(fileName)
    printResult(result)
  } catch (error) {
    console.error(`Import failed for ${fileName}: ${error.message}`)
    process.exitCode = 1
  } finally {
    await closePool()
  }
}

module.exports = {
  DATA_DIR,
  PRODUCT_COLUMNS,
  REVIEW_COLUMNS,
  buildProductRow,
  buildReviewRow,
  importProductsFile,
  importReviewsFile,
  printResult,
  readJsonArray,
  run,
  validateProducts,
  validateReviews,
}
