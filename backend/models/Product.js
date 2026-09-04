const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true, unique: true, index: true },
    productNameId: { type: String, required: true, trim: true },
    productUrl: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Product', productSchema)
