const express = require('express')
const reviewsRepository = require('../repositories/reviewsRepository')

const router = express.Router()

function parsePage(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

function parseLimit(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25
  }
  return Math.min(Math.floor(parsed), 200)
}

router.get('/', async (req, res, next) => {
  try {
    const { productId, rating, complaintTheme, search } = req.query
    const page = parsePage(req.query.page)
    const limit = parseLimit(req.query.limit)

    const { items, total } = await reviewsRepository.findPaginated({
      productId,
      rating,
      complaintTheme,
      search,
      page,
      limit,
    })

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      items,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
