const { query } = require('../config/db')

const REVIEW_SELECT = `
  SELECT
    r.product_id AS "productId",
    p.product_name AS "productName",
    p.product_name_id AS "productNameId",
    p.product_url AS "productUrl",
    p.category AS "category",
    r.review_id AS "reviewId",
    r.rating AS "rating",
    r.review_title AS "reviewTitle",
    r.review_text AS "reviewText",
    r.review_date AS "reviewDate",
    r.reviewer_name_or_id AS "reviewerNameOrId",
    r.verified_buyer AS "verifiedBuyer",
    r.size_purchased AS "sizePurchased",
    r.usual_size AS "usualSize",
    r.fit_feedback AS "fitFeedback",
    r.helpful_votes AS "helpfulVotes",
    r.has_photo AS "hasPhoto",
    r.photo_count AS "photoCount",
    r.photo_urls AS "photoUrls",
    r.lulu_response_text AS "luluResponseText",
    r.lulu_response_date AS "luluResponseDate",
    r.complaint_theme AS "complaintTheme",
    r.business_insight AS "businessInsight",
    r.scraped_at AS "scrapedAt",
    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt"
  FROM reviews.reviews r
  JOIN catalog.products p ON p.product_id = r.product_id
`

function buildFilters({ productId, rating, complaintTheme, search }) {
  const clauses = []
  const params = []

  if (productId) {
    params.push(productId)
    clauses.push(`r.product_id = $${params.length}`)
  }

  if (rating !== undefined && rating !== null && rating !== '') {
    const numericRating = Number(rating)
    if (Number.isFinite(numericRating)) {
      params.push(numericRating)
      clauses.push(`r.rating = $${params.length}`)
    }
  }

  if (complaintTheme) {
    params.push(complaintTheme)
    clauses.push(`r.complaint_theme = $${params.length}`)
  }

  if (search) {
    params.push(search)
    const searchIndex = params.length
    params.push(`%${search}%`)
    const likeIndex = params.length
    clauses.push(
      `(to_tsvector('english', coalesce(r.review_title, '') || ' ' || coalesce(r.review_text, '')) ` +
        `@@ plainto_tsquery('english', $${searchIndex}) OR r.review_id ILIKE $${likeIndex})`,
    )
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereClause, params }
}

async function findPaginated({ productId, rating, complaintTheme, search, page, limit }) {
  const { whereClause, params } = buildFilters({ productId, rating, complaintTheme, search })
  const offset = (page - 1) * limit

  const itemsParams = [...params, limit, offset]
  const limitIndex = itemsParams.length - 1
  const offsetIndex = itemsParams.length

  const itemsResult = await query(
    `${REVIEW_SELECT}
     ${whereClause}
     ORDER BY r.review_date DESC NULLS LAST, r.helpful_votes DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    itemsParams,
  )

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM reviews.reviews r ${whereClause}`,
    params,
  )

  return {
    items: itemsResult.rows,
    total: countResult.rows[0]?.total || 0,
  }
}

async function findRecentLowStar({ productId, ratings = [1, 2, 3], limit = 10 }) {
  const params = [ratings]
  const clauses = [`r.rating = ANY($1)`]

  if (productId) {
    params.push(productId)
    clauses.push(`r.product_id = $${params.length}`)
  }

  params.push(limit)

  const result = await query(
    `${REVIEW_SELECT}
     WHERE ${clauses.join(' AND ')}
     ORDER BY r.review_date DESC NULLS LAST, r.helpful_votes DESC
     LIMIT $${params.length}`,
    params,
  )
  return result.rows
}

async function ratingBreakdown({ productId, ratings = [1, 2, 3] }) {
  const params = [ratings]
  const clauses = [`rating = ANY($1)`]

  if (productId) {
    params.push(productId)
    clauses.push(`product_id = $${params.length}`)
  }

  const result = await query(
    `SELECT rating AS "_id", COUNT(*)::int AS count
     FROM reviews.reviews
     WHERE ${clauses.join(' AND ')}
     GROUP BY rating
     ORDER BY rating ASC`,
    params,
  )
  return result.rows
}

async function topComplaintThemeLowStar({ productId, ratings = [1, 2, 3] }) {
  const params = [ratings]
  const clauses = [`rating = ANY($1)`]

  if (productId) {
    params.push(productId)
    clauses.push(`product_id = $${params.length}`)
  }

  const result = await query(
    `SELECT complaint_theme AS "complaintTheme", COUNT(*)::int AS "totalReviews"
     FROM reviews.reviews
     WHERE ${clauses.join(' AND ')}
     GROUP BY complaint_theme
     ORDER BY "totalReviews" DESC, complaint_theme ASC
     LIMIT 1`,
    params,
  )
  return result.rows[0] || null
}

module.exports = {
  findPaginated,
  findRecentLowStar,
  ratingBreakdown,
  topComplaintThemeLowStar,
}
