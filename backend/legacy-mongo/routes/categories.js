const express = require('express')
const CategorySummary = require('../models/CategorySummary')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const filters = {}
    if (req.query.productId) {
      filters.productId = req.query.productId
    }

    const rows = await CategorySummary.find(filters)
      .sort({ productId: 1, totalReviews: -1, complaintTheme: 1 })
      .lean()

    res.json(rows)
  } catch (error) {
    next(error)
  }
})

module.exports = router
