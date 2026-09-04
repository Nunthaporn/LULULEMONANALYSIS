const test = require('node:test')
const assert = require('node:assert/strict')

const { resetSchema, truncateAll, insertProduct, closePool } = require('./setup')
const productsRepository = require('../repositories/productsRepository')

test.before(async () => {
  await resetSchema()
})

test.beforeEach(async () => {
  await truncateAll()
})

test.after(async () => {
  await closePool()
})

test('product insert: findAll returns a newly inserted product', async () => {
  await insertProduct({ product_id: 'p1', product_name: 'Alpha' })
  const products = await productsRepository.findAll()
  assert.equal(products.length, 1)
  assert.equal(products[0].productId, 'p1')
  assert.equal(products[0].productName, 'Alpha')
})

test('product UPSERT: inserting the same product_id twice updates instead of duplicating', async () => {
  await insertProduct({ product_id: 'p1', product_name: 'Alpha' })
  await insertProduct({ product_id: 'p1', product_name: 'Alpha Renamed' })
  const products = await productsRepository.findAll()
  assert.equal(products.length, 1)
  assert.equal(products[0].productName, 'Alpha Renamed')
})

test('products are ordered by category ASC, product_name ASC', async () => {
  await insertProduct({ product_id: 'p2', product_name: 'Zeta', category: 'B' })
  await insertProduct({ product_id: 'p1', product_name: 'Alpha', category: 'A' })
  await insertProduct({ product_id: 'p3', product_name: 'Beta', category: 'A' })
  const products = await productsRepository.findAll()
  assert.deepEqual(
    products.map((p) => p.productId),
    ['p1', 'p3', 'p2'],
  )
})
