const mongoose = require('mongoose')

const categorySummarySchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    complaintTheme: { type: String, required: true, trim: true, index: true },
    totalReviews: { type: Number, default: 0 },
    oneStar: { type: Number, default: 0 },
    twoStar: { type: Number, default: 0 },
    threeStar: { type: Number, default: 0 },
    sharePercentage: { type: Number, default: 0 },
  },
  { timestamps: true },
)

categorySummarySchema.index({ productId: 1, complaintTheme: 1 }, { unique: true })

module.exports = mongoose.model('CategorySummary', categorySummarySchema)
