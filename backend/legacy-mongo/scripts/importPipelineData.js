require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const connectDB = require('../config/db')
const Product = require('../models/Product')
const Review = require('../models/Review')
const ReviewImage = require('../models/ReviewImage')
const ProductSummary = require('../models/ProductSummary')
const CategorySummary = require('../models/CategorySummary')

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
      // Fall back to delimiter-based parsing.
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
    productNameId: cleanText(pick(row.productNameId, row.product_name_id, row.productNameId)),
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

function buildReviewDoc(row) {
  const normalized = normalizeKeys(row)
  const photoUrls = splitList(pick(row.photoUrls, row.photo_urls))
  const reviewerNameOrId = cleanText(pick(row.reviewerNameOrId, row.author))
  return {
    productId: normalized.productId,
    productName: normalized.productName,
    productNameId: normalized.productNameId,
    productUrl: normalized.productUrl,
    category: normalized.category,
    reviewId: normalized.reviewId,
    rating: toNumber(row.rating),
    reviewTitle: normalized.reviewTitle,
    reviewText: normalized.reviewText,
    reviewDate: toDate(normalized.reviewDate),
    reviewerNameOrId,
    verifiedBuyer: toBoolean(pick(row.verifiedBuyer, row.verified_buyer, row.is_verified_buyer)),
    sizePurchased: cleanText(pick(row.sizePurchased, row.size_purchased)),
    usualSize: cleanText(pick(row.usualSize, row.usual_size)),
    fitFeedback: cleanText(pick(row.fitFeedback, row.fit_feedback)),
    helpfulVotes: toNumber(pick(row.helpfulVotes, row.helpful_votes, row.likes)),
    hasPhoto: toNumber(pick(row.photoCount, row.photo_count)) > 0 || photoUrls.length > 0,
    photoCount: toNumber(pick(row.photoCount, row.photo_count)),
    photoUrls,
    luluResponseText: cleanText(pick(row.luluResponseText, row.lulu_response_text)),
    luluResponseDate: toDate(pick(row.luluResponseDate, row.lulu_response_time)),
    complaintTheme: normalized.complaintTheme || 'Other',
    businessInsight: normalized.businessInsight,
    scrapedAt: toDate(pick(row.scrapedAt, row.scraped_at)),
  }
}

function buildReviewImageDoc(row) {
  const normalized = normalizeKeys(row)
  return {
    productId: normalized.productId,
    productName: normalized.productName,
    productNameId: normalized.productNameId,
    category: normalized.category,
    reviewId: normalized.reviewId,
    rating: toNumber(row.rating),
    reviewDate: toDate(normalized.reviewDate),
    reviewTitle: normalized.reviewTitle,
    reviewText: normalized.reviewText,
    complaintTheme: normalized.complaintTheme || 'Other',
    businessInsight: normalized.businessInsight,
    imageUrl: normalized.imageUrl,
    thumbnailUrl: cleanText(pick(row.thumbnailUrl, row.thumbnail_url)),
    localImagePath: normalized.localImagePath,
    photoId: cleanText(pick(row.photoId, row.photo_id)),
    photoCaption: cleanText(pick(row.photoCaption, row.photo_caption)),
    imageExists: row.imageExists !== undefined ? toBoolean(row.imageExists) : true,
  }
}

function buildProductSummaryDoc(row) {
  const normalized = normalizeKeys(row)
  return {
    productId: normalized.productId,
    productName: normalized.productName,
    category: normalized.category,
    totalReviews: toNumber(pick(row.totalReviews, row.total_reviews)),
    lowStarReviews: toNumber(pick(row.lowStarReviews, row.low_star_reviews)),
    oneStarReviews: toNumber(pick(row.oneStarReviews, row.one_star_reviews)),
    twoStarReviews: toNumber(pick(row.twoStarReviews, row.two_star_reviews)),
    threeStarReviews: toNumber(pick(row.threeStarReviews, row.three_star_reviews)),
    reviewsWithImages: toNumber(pick(row.reviewsWithImages, row.reviews_with_images)),
    totalImages: toNumber(pick(row.totalImages, row.total_images)),
    topComplaintTheme: cleanText(pick(row.topComplaintTheme, row.top_complaint_theme)) || 'Other',
    topComplaintShare: toNumber(pick(row.topComplaintShare, row.top_complaint_share)),
  }
}

function buildCategorySummaryDoc(row) {
  const normalized = normalizeKeys(row)
  return {
    productId: normalized.productId,
    productName: normalized.productName,
    category: normalized.category,
    complaintTheme: normalized.complaintTheme || 'Other',
    totalReviews: toNumber(pick(row.totalReviews, row.total_reviews)),
    oneStar: toNumber(pick(row.oneStar, row.one_star)),
    twoStar: toNumber(pick(row.twoStar, row.two_star)),
    threeStar: toNumber(pick(row.threeStar, row.three_star)),
    sharePercentage: toNumber(pick(row.sharePercentage, row.share_percentage)),
  }
}

function buildProductDoc(row) {
  const normalized = normalizeKeys(row)
  return {
    productName: normalized.productName,
    productId: normalized.productId,
    productNameId: normalized.productNameId,
    productUrl: normalized.productUrl,
    category: normalized.category,
  }
}

function mergePreferExisting(base, patch) {
  const merged = { ...base }

  for (const [key, value] of Object.entries(patch)) {
    const normalized = cleanText(value)
    if (normalized) {
      merged[key] = value
    } else if (!(key in merged)) {
      merged[key] = value
    }
  }

  return merged
}

async function upsertCollection({ Model, rows, filterBuilder, updateBuilder }) {
  if (!rows.length) {
    return { processed: 0, inserted: 0, modified: 0, matchedExisting: 0 }
  }

  const operations = rows.map((row) => ({
    updateOne: {
      filter: filterBuilder(row),
      update: { $set: updateBuilder(row) },
      upsert: true,
    },
  }))

  const result = await Model.bulkWrite(operations, { ordered: false })
  return {
    processed: rows.length,
    inserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    matchedExisting: result.matchedCount || 0,
  }
}

async function main() {
  const processedDir = resolveProcessedDir()
  const allReviewsJsonPath = path.join(processedDir, 'all_reviews.json')
  const allReviewsCsvPath = path.join(processedDir, 'all_reviews.csv')
  const reviewImagesCsvPath = path.join(processedDir, 'review_images_mapping.csv')
  const productSummaryCsvPath = path.join(processedDir, 'product_summary.csv')
  const categorySummaryCsvPath = path.join(processedDir, 'category_summary.csv')

  const allReviewRows = fs.existsSync(allReviewsJsonPath)
    ? parseJson(allReviewsJsonPath)
    : parseCsv(allReviewsCsvPath)
  const reviewImageRows = parseCsv(reviewImagesCsvPath)
  const productSummaryRows = parseCsv(productSummaryCsvPath)
  const categorySummaryRows = parseCsv(categorySummaryCsvPath)

  const productMap = new Map()
  for (const row of allReviewRows) {
    const product = buildProductDoc(row)
    if (product.productId) {
      productMap.set(product.productId, product)
    }
  }
  for (const row of productSummaryRows) {
    const summaryProduct = buildProductDoc(row)
    if (summaryProduct.productId) {
      const existing = productMap.get(summaryProduct.productId) || {}
      productMap.set(summaryProduct.productId, mergePreferExisting(existing, summaryProduct))
    }
  }

  await connectDB()

  const productResult = await upsertCollection({
    Model: Product,
    rows: [...productMap.values()],
    filterBuilder: (row) => ({ productId: row.productId }),
    updateBuilder: buildProductDoc,
  })

  const reviewResult = await upsertCollection({
    Model: Review,
    rows: allReviewRows,
    filterBuilder: (row) => {
      const normalized = normalizeKeys(row)
      return { productId: normalized.productId, reviewId: normalized.reviewId }
    },
    updateBuilder: buildReviewDoc,
  })

  const imageResult = await upsertCollection({
    Model: ReviewImage,
    rows: reviewImageRows,
    filterBuilder: (row) => {
      const normalized = normalizeKeys(row)
      return {
        productId: normalized.productId,
        reviewId: normalized.reviewId,
        photoId: cleanText(pick(row.photoId, row.photo_id)),
      }
    },
    updateBuilder: buildReviewImageDoc,
  })

  const productSummaryResult = await upsertCollection({
    Model: ProductSummary,
    rows: productSummaryRows,
    filterBuilder: (row) => ({ productId: normalizeKeys(row).productId }),
    updateBuilder: buildProductSummaryDoc,
  })

  const categorySummaryResult = await upsertCollection({
    Model: CategorySummary,
    rows: categorySummaryRows,
    filterBuilder: (row) => {
      const normalized = normalizeKeys(row)
      return { productId: normalized.productId, complaintTheme: normalized.complaintTheme }
    },
    updateBuilder: buildCategorySummaryDoc,
  })

  console.log('Import summary')
  console.log('--------------')
  console.log(
    `products processed: ${productResult.processed} (inserted ${productResult.inserted}, updated ${productResult.modified})`,
  )
  console.log(
    `reviews processed: ${reviewResult.processed} (inserted ${reviewResult.inserted}, updated ${reviewResult.modified})`,
  )
  console.log(
    `review images processed: ${imageResult.processed} (inserted ${imageResult.inserted}, updated ${imageResult.modified})`,
  )
  console.log(
    `product summaries processed: ${productSummaryResult.processed} (inserted ${productSummaryResult.inserted}, updated ${productSummaryResult.modified})`,
  )
  console.log(
    `category summaries processed: ${categorySummaryResult.processed} (inserted ${categorySummaryResult.inserted}, updated ${categorySummaryResult.modified})`,
  )

  process.exit(0)
}

main().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
