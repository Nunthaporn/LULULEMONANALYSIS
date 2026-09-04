const { query } = require('../config/db')
const productsRepository = require('./productsRepository')
const reviewsRepository = require('./reviewsRepository')
const imagesRepository = require('./imagesRepository')

const PRODUCT_SUMMARY_SELECT = `
  SELECT
    product_id AS "productId",
    product_name AS "productName",
    category AS "category",
    total_reviews AS "totalReviews",
    low_star_reviews AS "lowStarReviews",
    one_star_reviews AS "oneStarReviews",
    two_star_reviews AS "twoStarReviews",
    three_star_reviews AS "threeStarReviews",
    reviews_with_images AS "reviewsWithImages",
    total_images AS "totalImages",
    top_complaint_theme AS "topComplaintTheme",
    top_complaint_share AS "topComplaintShare"
  FROM analytics.product_summaries
`

const CATEGORY_SUMMARY_SELECT = `
  SELECT
    product_id AS "productId",
    product_name AS "productName",
    category AS "category",
    complaint_theme AS "complaintTheme",
    total_reviews AS "totalReviews",
    one_star AS "oneStar",
    two_star AS "twoStar",
    three_star AS "threeStar",
    share_percentage AS "sharePercentage"
  FROM analytics.category_summaries
`

async function getProductSummaries() {
  const result = await query(
    `${PRODUCT_SUMMARY_SELECT} ORDER BY low_star_reviews DESC, product_name ASC`,
  )
  return result.rows
}

async function getProductSummariesFiltered({ productId } = {}) {
  if (!productId) {
    return getProductSummaries()
  }
  const result = await query(
    `${PRODUCT_SUMMARY_SELECT} WHERE product_id = $1 ORDER BY low_star_reviews DESC, product_name ASC`,
    [productId],
  )
  return result.rows
}

async function getCategorySummaries({ productId } = {}) {
  if (!productId) {
    const result = await query(
      `${CATEGORY_SUMMARY_SELECT} ORDER BY total_reviews DESC, complaint_theme ASC`,
    )
    return result.rows
  }
  const result = await query(
    `${CATEGORY_SUMMARY_SELECT} WHERE product_id = $1 ORDER BY total_reviews DESC, complaint_theme ASC`,
    [productId],
  )
  return result.rows
}

async function getProducts({ productId } = {}) {
  if (!productId) {
    return productsRepository.findAll()
  }
  const product = await productsRepository.findByProductId(productId)
  return product ? [product] : []
}

async function getDashboard({ productId } = {}) {
  const isAll = !productId || productId === 'all'
  const filter = isAll ? {} : { productId }

  const [
    products,
    productSummary,
    categorySummary,
    ratingBreakdown,
    recentReviews,
    galleryImages,
    topComplaintTheme,
    topImageBackedComplaintTheme,
  ] = await Promise.all([
    getProducts(filter),
    getProductSummariesFiltered(filter),
    getCategorySummaries(filter),
    reviewsRepository.ratingBreakdown(filter),
    reviewsRepository.findRecentLowStar({ ...filter, limit: 10 }),
    imagesRepository.findForDashboard({ ...filter, limit: 20 }),
    reviewsRepository.topComplaintThemeLowStar(filter),
    imagesRepository.topComplaintThemeByImages(filter),
  ])

  return {
    products,
    productSummary,
    categorySummary,
    ratingBreakdown,
    topComplaintTheme: topComplaintTheme || null,
    topImageBackedComplaintTheme: topImageBackedComplaintTheme || null,
    recentReviews,
    galleryImages,
  }
}

module.exports = {
  getProductSummaries,
  getCategorySummaries,
  getDashboard,
}
