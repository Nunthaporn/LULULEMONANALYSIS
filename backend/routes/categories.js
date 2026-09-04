const express = require('express')
const summariesRepository = require('../repositories/summariesRepository')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const rows = await summariesRepository.getCategorySummaries({
      productId: req.query.productId,
    })
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

module.exports = router
