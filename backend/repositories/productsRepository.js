const { query } = require('../config/db')

const PRODUCT_COLUMNS = `
  product_id AS "productId",
  product_name AS "productName",
  product_name_id AS "productNameId",
  product_url AS "productUrl",
  category
`

async function findAll() {
  const result = await query(
    `SELECT ${PRODUCT_COLUMNS} FROM catalog.products ORDER BY category ASC, product_name ASC`,
  )
  return result.rows
}

async function findByProductId(productId) {
  const result = await query(
    `SELECT ${PRODUCT_COLUMNS} FROM catalog.products WHERE product_id = $1`,
    [productId],
  )
  return result.rows[0] || null
}

module.exports = {
  PRODUCT_COLUMNS,
  findAll,
  findByProductId,
}
