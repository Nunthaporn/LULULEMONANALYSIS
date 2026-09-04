const express = require('express')
const productsRepository = require('../repositories/productsRepository')

const router = express.Router()

router.get('/', async (_req, res, next) => {
  try {
    const products = await productsRepository.findAll()
    res.json(products)
  } catch (error) {
    next(error)
  }
})

module.exports = router
