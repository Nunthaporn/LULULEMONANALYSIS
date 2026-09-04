const { query } = require('../config/db')

const IMAGE_SELECT = `
  SELECT
    i.product_id AS "productId",
    p.product_name AS "productName",
    p.product_name_id AS "productNameId",
    p.category AS "category",
    i.review_id AS "reviewId",
    i.rating AS "rating",
    i.review_date AS "reviewDate",
    i.review_title AS "reviewTitle",
    i.review_text AS "reviewText",
    i.complaint_theme AS "complaintTheme",
    i.business_insight AS "businessInsight",
    i.image_url AS "imageUrl",
    i.thumbnail_url AS "thumbnailUrl",
    i.local_image_path AS "localImagePath",
    i.photo_id AS "photoId",
    i.photo_caption AS "photoCaption",
    i.image_exists AS "imageExists",
    i.created_at AS "createdAt",
    i.updated_at AS "updatedAt"
  FROM reviews.review_images i
  JOIN catalog.products p ON p.product_id = i.product_id
`

function buildFilters({ productId, rating, complaintTheme }) {
  const clauses = []
  const params = []

  if (productId) {
    params.push(productId)
    clauses.push(`i.product_id = $${params.length}`)
  }

  if (rating !== undefined && rating !== null && rating !== '') {
    const numericRating = Number(rating)
    if (Number.isFinite(numericRating)) {
      params.push(numericRating)
      clauses.push(`i.rating = $${params.length}`)
    }
  }

  if (complaintTheme) {
    params.push(complaintTheme)
    clauses.push(`i.complaint_theme = $${params.length}`)
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereClause, params }
}

async function findPaginated({ productId, rating, complaintTheme, page, limit }) {
  const { whereClause, params } = buildFilters({ productId, rating, complaintTheme })
  const offset = (page - 1) * limit

  const itemsParams = [...params, limit, offset]
  const limitIndex = itemsParams.length - 1
  const offsetIndex = itemsParams.length

  const itemsResult = await query(
    `${IMAGE_SELECT}
     ${whereClause}
     ORDER BY i.review_date DESC NULLS LAST, i.rating ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    itemsParams,
  )

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM reviews.review_images i ${whereClause}`,
    params,
  )

  return {
    items: itemsResult.rows,
    total: countResult.rows[0]?.total || 0,
  }
}

async function findForDashboard({ productId, limit = 20 }) {
  const { whereClause, params } = buildFilters({ productId })
  const itemsParams = [...params, limit]
  const result = await query(
    `${IMAGE_SELECT}
     ${whereClause}
     ORDER BY i.review_date DESC NULLS LAST, i.rating ASC
     LIMIT $${itemsParams.length}`,
    itemsParams,
  )
  return result.rows
}

async function topComplaintThemeByImages({ productId }) {
  const { whereClause, params } = buildFilters({ productId })
  const result = await query(
    `SELECT i.complaint_theme AS "complaintTheme", COUNT(*)::int AS "totalImages"
     FROM reviews.review_images i
     ${whereClause}
     GROUP BY i.complaint_theme
     ORDER BY "totalImages" DESC, i.complaint_theme ASC
     LIMIT 1`,
    params,
  )
  return result.rows[0] || null
}

module.exports = {
  findPaginated,
  findForDashboard,
  topComplaintThemeByImages,
}
