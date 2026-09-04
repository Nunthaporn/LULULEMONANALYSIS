const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    productNameId: { type: String, required: true, trim: true },
    productUrl: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    reviewId: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, index: true },
    reviewTitle: { type: String, default: '' },
    reviewText: { type: String, default: '' },
    reviewDate: { type: Date, default: null, index: true },
    reviewerNameOrId: { type: String, default: '' },
    verifiedBuyer: { type: Boolean, default: false, index: true },
    sizePurchased: { type: String, default: '' },
    usualSize: { type: String, default: '' },
    fitFeedback: { type: String, default: '' },
    helpfulVotes: { type: Number, default: 0 },
    hasPhoto: { type: Boolean, default: false, index: true },
    photoCount: { type: Number, default: 0 },
    photoUrls: { type: [String], default: [] },
    luluResponseText: { type: String, default: '' },
    luluResponseDate: { type: Date, default: null },
    complaintTheme: { type: String, default: 'Other', index: true },
    businessInsight: { type: String, default: '' },
    scrapedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

reviewSchema.index({ productId: 1, reviewId: 1 }, { unique: true })

module.exports = mongoose.model('Review', reviewSchema)
