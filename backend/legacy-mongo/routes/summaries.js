const express = require('express')
const Product = require('../models/Product')
const Review = require('../models/Review')
const ReviewImage = require('../models/ReviewImage')
const ProductSummary = require('../models/ProductSummary')
const CategorySummary = require('../models/CategorySummary')

const router = express.Router()

router.get('/summaries/products', async (_req, res, next) => {
  try {
    const rows = await ProductSummary.find().sort({ lowStarReviews: -1, productName: 1 }).lean()
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

router.get('/dashboard', async (req, res, next) => {
  try {
    const productId = req.query.productId
    const isAll = !productId || productId === 'all'
    const filter = isAll ? {} : { productId }
    const lowStarFilter = {
      ...filter,
      rating: { $in: [1, 2, 3] },
    }

    const [
      products,
      productSummary,
      categorySummary,
      ratingBreakdown,
      recentReviews,
      galleryImages,
      topTheme,
      topImageTheme,
    ] = await Promise.all([
      Product.find(isAll ? {} : { productId }).sort({ category: 1, productName: 1 }).lean(),
      ProductSummary.find(isAll ? {} : { productId }).sort({ lowStarReviews: -1 }).lean(),
      CategorySummary.find(filter).sort({ totalReviews: -1, complaintTheme: 1 }).lean(),
      Review.aggregate([
        { $match: lowStarFilter },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Review.find(lowStarFilter).sort({ reviewDate: -1, helpfulVotes: -1 }).limit(10).lean(),
      ReviewImage.find(filter).sort({ reviewDate: -1, rating: 1 }).limit(20).lean(),
      Review.aggregate([
        { $match: lowStarFilter },
        { $group: { _id: '$complaintTheme', totalReviews: { $sum: 1 } } },
        { $sort: { totalReviews: -1, _id: 1 } },
        { $limit: 1 },
      ]),
      ReviewImage.aggregate([
        { $match: filter },
        { $group: { _id: '$complaintTheme', totalImages: { $sum: 1 } } },
        { $sort: { totalImages: -1, _id: 1 } },
        { $limit: 1 },
      ]),
    ])

    res.json({
      products,
      productSummary,
      categorySummary,
      ratingBreakdown,
      topComplaintTheme: topTheme[0]
        ? { complaintTheme: topTheme[0]._id, totalReviews: topTheme[0].totalReviews }
        : null,
      topImageBackedComplaintTheme: topImageTheme[0]
        ? { complaintTheme: topImageTheme[0]._id, totalImages: topImageTheme[0].totalImages }
        : null,
      recentReviews,
      galleryImages,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
