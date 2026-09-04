const express = require('express')
const Review = require('../models/Review')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const {
      productId,
      rating,
      complaintTheme,
      search,
      page = 1,
      limit = 25,
    } = req.query

    const filters = {}

    if (productId) {
      filters.productId = productId
    }
    if (rating) {
      filters.rating = Number(rating)
    }
    if (complaintTheme) {
      filters.complaintTheme = complaintTheme
    }
    if (search) {
      filters.$or = [
        { reviewTitle: { $regex: search, $options: 'i' } },
        { reviewText: { $regex: search, $options: 'i' } },
        { reviewId: { $regex: search, $options: 'i' } },
      ]
    }

    const pageNumber = Math.max(Number(page) || 1, 1)
    const pageSize = Math.max(Math.min(Number(limit) || 25, 200), 1)
    const skip = (pageNumber - 1) * pageSize

    const [items, total] = await Promise.all([
      Review.find(filters)
        .sort({ reviewDate: -1, helpfulVotes: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Review.countDocuments(filters),
    ])

    res.json({
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      items,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
