const mongoose = require('mongoose')

const productSummarySchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true, unique: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    totalReviews: { type: Number, default: 0 },
    lowStarReviews: { type: Number, default: 0 },
    oneStarReviews: { type: Number, default: 0 },
    twoStarReviews: { type: Number, default: 0 },
    threeStarReviews: { type: Number, default: 0 },
    reviewsWithImages: { type: Number, default: 0 },
    totalImages: { type: Number, default: 0 },
    topComplaintTheme: { type: String, default: 'Other' },
    topComplaintShare: { type: Number, default: 0 },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ProductSummary', productSummarySchema)
