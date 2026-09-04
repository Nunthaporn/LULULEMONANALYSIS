const express = require('express')
const summariesRepository = require('../repositories/summariesRepository')

const router = express.Router()

router.get('/summaries/products', async (_req, res, next) => {
  try {
    const rows = await summariesRepository.getProductSummaries()
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await summariesRepository.getDashboard({ productId: req.query.productId })
    res.json(dashboard)
  } catch (error) {
    next(error)
  }
})

module.exports = router
