const mongoose = require('mongoose')

const reviewImageSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    productNameId: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    reviewId: { type: String, required: true, trim: true, index: true },
    rating: { type: Number, required: true, index: true },
    reviewDate: { type: Date, default: null },
    reviewTitle: { type: String, default: '' },
    reviewText: { type: String, default: '' },
    complaintTheme: { type: String, default: 'Other', index: true },
    businessInsight: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    localImagePath: { type: String, default: '' },
    photoId: { type: String, default: '' },
    photoCaption: { type: String, default: '' },
    imageExists: { type: Boolean, default: true },
  },
  { timestamps: true },
)

reviewImageSchema.index({ productId: 1, rating: 1, complaintTheme: 1 })
reviewImageSchema.index({ productId: 1, reviewId: 1, photoId: 1 }, { unique: true })

module.exports = mongoose.model('ReviewImage', reviewImageSchema)
