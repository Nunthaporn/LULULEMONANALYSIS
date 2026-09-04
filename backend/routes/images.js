const express = require('express')
const imagesRepository = require('../repositories/imagesRepository')

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
    const { productId, rating, complaintTheme } = req.query
    const page = parsePage(req.query.page)
    const limit = parseLimit(req.query.limit)

    const { items, total } = await imagesRepository.findPaginated({
      productId,
      rating,
      complaintTheme,
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
