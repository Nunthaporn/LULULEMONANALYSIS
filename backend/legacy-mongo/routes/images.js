const express = require('express')
const ReviewImage = require('../models/ReviewImage')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { productId, rating, complaintTheme, page = 1, limit = 25 } = req.query
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

    const pageNumber = Math.max(Number(page) || 1, 1)
    const pageSize = Math.max(Math.min(Number(limit) || 25, 200), 1)
    const skip = (pageNumber - 1) * pageSize

    const [items, total] = await Promise.all([
      ReviewImage.find(filters)
        .sort({ reviewDate: -1, rating: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      ReviewImage.countDocuments(filters),
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
