const express = require('express')
const Product = require('../models/Product')

const router = express.Router()

router.get('/', async (_req, res, next) => {
  try {
    const products = await Product.find().sort({ category: 1, productName: 1 }).lean()
    res.json(products)
  } catch (error) {
    next(error)
  }
})

module.exports = router
