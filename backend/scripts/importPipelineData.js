require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const { getPool, closePool } = require('../config/db')

const REVIEW_BATCH_SIZE = 500
const IMAGE_BATCH_SIZE = 1000
const SUMMARY_BATCH_SIZE = 1000

function cleanText(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return ['true', '1', 'yes', 'y', 'verified'].includes(String(value).trim().toLowerCase())
}

function toDate(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean)
  }
  const text = cleanText(value)
  if (!text) {
    return []
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'))
      if (Array.isArray(parsed)) {
        return parsed.map(cleanText).filter(Boolean)
      }
    } catch (_error) {
      // Fall back to delimiter-based parsing below.
    }
  }
  return text
    .split(/\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function pick(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }
  return ''
}

function normalizeKeys(row) {
  return {
    productId: cleanText(pick(row.productId, row.product_id)),
    productName: cleanText(pick(row.productName, row.product_name)),
    productNameId: cleanText(pick(row.productNameId, row.product_name_id)),
    productUrl: cleanText(pick(row.productUrl, row.product_url)),
    category: cleanText(row.category),
    reviewId: cleanText(pick(row.reviewId, row.review_id)),
    reviewTitle: cleanText(pick(row.reviewTitle, row.review_title, row.title)),
    reviewText: cleanText(pick(row.reviewText, row.review_text)),
    reviewDate: pick(row.reviewDate, row.review_date, row.submission_time),
    complaintTheme: cleanText(pick(row.complaintTheme, row.complaint_theme)),
    businessInsight: cleanText(pick(row.businessInsight, row.business_insight)),
    imageUrl: cleanText(pick(row.imageUrl, row.image_url)),
    localImagePath: cleanText(pick(row.localImagePath, row.local_image_path)),
  }
}

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  })
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

function buildProductRow(row) {
  const normalized = normalizeKeys(row)
  return {
    product_id: normalized.productId,
    product_name: normalized.productName,
    product_name_id: normalized.productNameId,
    product_url: normalized.productUrl,
    category: normalized.category,
  }
}

function buildReviewRow(row) {
  const normalized = normalizeKeys(row)
  const photoUrls = splitList(pick(row.photoUrls, row.photo_urls))
  const photoCount = toNumber(pick(row.photoCount, row.photo_count))
  return {
    product_id: normalized.productId,
    review_id: normalized.reviewId,
    rating: toNumber(row.rating),
    review_title: normalized.reviewTitle,
    review_text: normalized.reviewText,
    review_date: toDate(normalized.reviewDate),
    reviewer_name_or_id: cleanText(pick(row.reviewerNameOrId, row.author)),
    verified_buyer: toBoolean(pick(row.verifiedBuyer, row.verified_buyer, row.is_verified_buyer)),
    size_purchased: cleanText(pick(row.sizePurchased, row.size_purchased)),
    usual_size: cleanText(pick(row.usualSize, row.usual_size)),
    fit_feedback: cleanText(pick(row.fitFeedback, row.fit_feedback)),
    helpful_votes: toNumber(pick(row.helpfulVotes, row.helpful_votes, row.likes)),
    has_photo: photoCount > 0 || photoUrls.length > 0,
    photo_count: photoCount,
    photo_urls: photoUrls,
    lulu_response_text: cleanText(pick(row.luluResponseText, row.lulu_response_text)),
    lulu_response_date: toDate(pick(row.luluResponseDate, row.lulu_response_time)),
    complaint_theme: normalized.complaintTheme || 'Other',
    business_insight: normalized.businessInsight,
    scraped_at: toDate(pick(row.scrapedAt, row.scraped_at)),
    content_hash: cleanText(pick(row.contentHash, row.content_hash)) || null,
    source_payload_hash: cleanText(pick(row.sourcePayloadHash, row.source_payload_hash)) || null,
    raw_payload: JSON.stringify(row),
  }
}

function buildImageRow(row) {
  const normalized = normalizeKeys(row)
  return {
    product_id: normalized.productId,
    review_id: normalized.reviewId,
    photo_id: cleanText(pick(row.photoId, row.photo_id)),
    rating: toNumber(row.rating),
    review_date: toDate(normalized.reviewDate),
    review_title: normalized.reviewTitle,
    review_text: normalized.reviewText,
    complaint_theme: normalized.complaintTheme || 'Other',
    business_insight: normalized.businessInsight,
    image_url: normalized.imageUrl,
    thumbnail_url: cleanText(pick(row.thumbnailUrl, row.thumbnail_url)),
    local_image_path: normalized.localImagePath,
    photo_caption: cleanText(pick(row.photoCaption, row.photo_caption)),
    image_exists: row.imageExists !== undefined ? toBoolean(row.imageExists) : true,
  }
}

function buildProductSummaryRow(row) {
  const normalized = normalizeKeys(row)
  return {
    product_id: normalized.productId,
    product_name: normalized.productName,
    category: normalized.category,
    total_reviews: toNumber(pick(row.totalReviews, row.total_reviews)),
    low_star_reviews: toNumber(pick(row.lowStarReviews, row.low_star_reviews)),
    one_star_reviews: toNumber(pick(row.oneStarReviews, row.one_star_reviews)),
    two_star_reviews: toNumber(pick(row.twoStarReviews, row.two_star_reviews)),
    three_star_reviews: toNumber(pick(row.threeStarReviews, row.three_star_reviews)),
    reviews_with_images: toNumber(pick(row.reviewsWithImages, row.reviews_with_images)),
    total_images: toNumber(pick(row.totalImages, row.total_images)),
    top_complaint_theme: cleanText(pick(row.topComplaintTheme, row.top_complaint_theme)) || 'Other',
    top_complaint_share: toNumber(pick(row.topComplaintShare, row.top_complaint_share)),
  }
}

function buildCategorySummaryRow(row) {
  const normalized = normalizeKeys(row)
  return {
    product_id: normalized.productId,
    product_name: normalized.productName,
    category: normalized.category,
    complaint_theme: normalized.complaintTheme || 'Other',
    total_reviews: toNumber(pick(row.totalReviews, row.total_reviews)),
    one_star: toNumber(pick(row.oneStar, row.one_star)),
    two_star: toNumber(pick(row.twoStar, row.two_star)),
    three_star: toNumber(pick(row.threeStar, row.three_star)),
    share_percentage: toNumber(pick(row.sharePercentage, row.share_percentage)),
  }
}

function mergePreferNonEmpty(base, patch) {
  const merged = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (cleanText(value)) {
      merged[key] = value
    } else if (!(key in merged)) {
      merged[key] = value
    }
  }
  return merged
}

async function batchUpsert(client, { schemaTable, columns, conflictColumns, rows, batchSize }) {
  const stats = { processed: rows.length, inserted: 0, updated: 0 }
  if (!rows.length) {
    return stats
  }

  const updateAssignments = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`)
    .concat(['updated_at = NOW()'])
    .join(', ')

  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize)
    const params = []
    const valueTuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        params.push(row[column])
        return `$${params.length}`
      })
      return `(${placeholders.join(', ')})`
    })

    const sql = `
      INSERT INTO ${schemaTable} (${columns.join(', ')})
      VALUES ${valueTuples.join(', ')}
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateAssignments}
      RETURNING (xmax = 0) AS inserted
    `
    const result = await client.query(sql, params)
    for (const row of result.rows) {
      if (row.inserted) {
        stats.inserted += 1
      } else {
        stats.updated += 1
      }
    }
  }

  return stats
}

async function main() {
  const startedAt = Date.now()
  const processedDir = resolveProcessedDir()
  const allReviewsJsonPath = path.join(processedDir, 'all_reviews.json')
  const allReviewsCsvPath = path.join(processedDir, 'all_reviews.csv')
  const reviewImagesCsvPath = path.join(processedDir, 'review_images_mapping.csv')
  const productSummaryCsvPath = path.join(processedDir, 'product_summary.csv')
  const categorySummaryCsvPath = path.join(processedDir, 'category_summary.csv')

  const allReviewRows = fs.existsSync(allReviewsJsonPath)
    ? parseJson(allReviewsJsonPath)
    : parseCsv(allReviewsCsvPath)
  const reviewImageRows = fs.existsSync(reviewImagesCsvPath) ? parseCsv(reviewImagesCsvPath) : []
  const productSummaryRows = fs.existsSync(productSummaryCsvPath)
    ? parseCsv(productSummaryCsvPath)
    : []
  const categorySummaryRows = fs.existsSync(categorySummaryCsvPath)
    ? parseCsv(categorySummaryCsvPath)
    : []

  const productMap = new Map()
  for (const row of allReviewRows) {
    const product = buildProductRow(row)
    if (product.product_id) {
      productMap.set(product.product_id, product)
    }
  }
  for (const row of productSummaryRows) {
    const summaryProduct = buildProductRow(row)
    if (summaryProduct.product_id) {
      const existing = productMap.get(summaryProduct.product_id) || {}
      productMap.set(summaryProduct.product_id, mergePreferNonEmpty(existing, summaryProduct))
    }
  }

  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const productResult = await batchUpsert(client, {
      schemaTable: 'catalog.products',
      columns: ['product_id', 'product_name', 'product_name_id', 'product_url', 'category'],
      conflictColumns: ['product_id'],
      rows: [...productMap.values()],
      batchSize: SUMMARY_BATCH_SIZE,
    })

    const reviewRows = allReviewRows.map(buildReviewRow).filter((row) => row.product_id && row.review_id)
    const reviewResult = await batchUpsert(client, {
      schemaTable: 'reviews.reviews',
      columns: [
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
      ],
      conflictColumns: ['product_id', 'review_id'],
      rows: reviewRows,
      batchSize: REVIEW_BATCH_SIZE,
    })

    const imageRows = reviewImageRows
      .map(buildImageRow)
      .filter((row) => row.product_id && row.review_id)
    const imageResult = await batchUpsert(client, {
      schemaTable: 'reviews.review_images',
      columns: [
        'product_id',
        'review_id',
        'photo_id',
        'rating',
        'review_date',
        'review_title',
        'review_text',
        'complaint_theme',
        'business_insight',
        'image_url',
        'thumbnail_url',
        'local_image_path',
        'photo_caption',
        'image_exists',
      ],
      conflictColumns: ['product_id', 'review_id', 'photo_id'],
      rows: imageRows,
      batchSize: IMAGE_BATCH_SIZE,
    })

    const productSummaryUpsertRows = productSummaryRows
      .map(buildProductSummaryRow)
      .filter((row) => row.product_id)
    const productSummaryResult = await batchUpsert(client, {
      schemaTable: 'analytics.product_summaries',
      columns: [
        'product_id',
        'product_name',
        'category',
        'total_reviews',
        'low_star_reviews',
        'one_star_reviews',
        'two_star_reviews',
        'three_star_reviews',
        'reviews_with_images',
        'total_images',
        'top_complaint_theme',
        'top_complaint_share',
      ],
      conflictColumns: ['product_id'],
      rows: productSummaryUpsertRows,
      batchSize: SUMMARY_BATCH_SIZE,
    })

    const categorySummaryUpsertRows = categorySummaryRows
      .map(buildCategorySummaryRow)
      .filter((row) => row.product_id && row.complaint_theme)
    const categorySummaryResult = await batchUpsert(client, {
      schemaTable: 'analytics.category_summaries',
      columns: [
        'product_id',
        'product_name',
        'category',
        'complaint_theme',
        'total_reviews',
        'one_star',
        'two_star',
        'three_star',
        'share_percentage',
      ],
      conflictColumns: ['product_id', 'complaint_theme'],
      rows: categorySummaryUpsertRows,
      batchSize: SUMMARY_BATCH_SIZE,
    })

    await client.query('COMMIT')

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2)

    console.log('Import summary')
    console.log('--------------')
    console.log(`products processed: ${productResult.processed}`)
    console.log(`products inserted: ${productResult.inserted}`)
    console.log(`products updated: ${productResult.updated}`)
    console.log()
    console.log(`reviews processed: ${reviewResult.processed}`)
    console.log(`reviews inserted: ${reviewResult.inserted}`)
    console.log(`reviews updated: ${reviewResult.updated}`)
    console.log()
    console.log(`review images processed: ${imageResult.processed}`)
    console.log(`review images inserted: ${imageResult.inserted}`)
    console.log(`review images updated: ${imageResult.updated}`)
    console.log()
    console.log(`product summaries processed: ${productSummaryResult.processed}`)
    console.log(`category summaries processed: ${categorySummaryResult.processed}`)
    console.log()
    console.log(`duration: ${durationSeconds}s`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

if (require.main === module) {
  main()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Import failed:', error.message)
      closePool().finally(() => process.exit(1))
    })
}

module.exports = { main, batchUpsert }
