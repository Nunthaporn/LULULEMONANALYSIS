import {
  ALL_FILTER_VALUE,
  DEFAULT_REGION,
  DEFAULT_TIME_PERIOD,
  HIDDEN_PRODUCT_IDS,
  LOW_STAR_RATINGS,
  TIME_PERIOD_OPTIONS,
  businessGroupBlueprints,
  defaultDefectCategory,
  defectCategoryMap,
  officialDefectGroups,
  pageMetadata,
  severityPalette,
  themeDetailCopy,
  themeKeywordMap,
  themePalette,
  trendPalette,
} from './constants'

const OFFICIAL_DEFECT_GROUP_KEYS = new Set(
  officialDefectGroups.filter((group) => group.isCertified).map((group) => group.key),
)

function isHiddenProductId(productId) {
  return HIDDEN_PRODUCT_IDS.includes(String(productId || '').trim())
}

export function resolveReviewDefectGroup(review) {
  const group = String(review?.matchedDefectGroup || '').trim()
  return OFFICIAL_DEFECT_GROUP_KEYS.has(group) ? group : 'Unclassified'
}

export function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export function parseReviewDate(value) {
  if (!hasValue(value)) {
    return null
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function getReviewTimestamp(record) {
  return parseReviewDate(record?.reviewDate)?.getTime() ?? null
}

function getPeriodOption(value) {
  return (
    TIME_PERIOD_OPTIONS.find((option) => option.value === value) ||
    TIME_PERIOD_OPTIONS.find((option) => option.value === DEFAULT_TIME_PERIOD) ||
    TIME_PERIOD_OPTIONS[0]
  )
}

export function shiftDateByMonths(date, monthDelta) {
  const shifted = new Date(date)
  const originalDay = shifted.getDate()

  shifted.setDate(1)
  shifted.setMonth(shifted.getMonth() + monthDelta)

  const daysInTargetMonth = new Date(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    0,
  ).getDate()
  shifted.setDate(Math.min(originalDay, daysInTargetMonth))

  return shifted
}

export function isWithinDateWindow(dateValue, start, end) {
  const time = new Date(dateValue).getTime()
  return !Number.isNaN(time) && time >= start.getTime() && time <= end.getTime()
}

function findLatestReviewDate(...collections) {
  const timestamps = collections
    .flat()
    .map((record) => getReviewTimestamp(record))
    .filter((timestamp) => timestamp !== null)

  if (!timestamps.length) {
    return null
  }

  return new Date(Math.max(...timestamps))
}

function formatDateRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'No dated reviews'
  }

  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
}

function filterByTimePeriod(records = [], selectedTimePeriod = DEFAULT_TIME_PERIOD, anchorDate) {
  if (!anchorDate) {
    return []
  }

  const option = getPeriodOption(selectedTimePeriod)
  const startDate = shiftDateByMonths(anchorDate, -option.months)
  const startTime = startDate.getTime()
  const endTime = anchorDate.getTime()

  return records.filter((record) => {
    const timestamp = getReviewTimestamp(record)
    return timestamp !== null && timestamp >= startTime && timestamp <= endTime
  })
}

function getReviewEvidenceKey(record) {
  return `${record?.productId || 'unknown'}:${record?.reviewId || record?.key || 'unknown'}`
}

function buildImageCountByReview(images = []) {
  const counts = new Map()

  images.forEach((image) => {
    const key = getReviewEvidenceKey(image)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return counts
}

function attachImageEvidence(reviews = [], images = []) {
  const imageCountByReview = buildImageCountByReview(images)

  return reviews.map((review) => {
    const imageEvidenceCount = imageCountByReview.get(getReviewEvidenceKey(review)) || 0
    const embeddedPhotoCount = Math.max(
      safeNumber(review.photoCount),
      Array.isArray(review.imageUrls) ? review.imageUrls.length : 0,
    )

    return {
      ...review,
      imageEvidenceCount,
      hasImageEvidence: imageEvidenceCount > 0 || embeddedPhotoCount > 0,
    }
  })
}

export function normalizeTruth(value) {
  if (!hasValue(value)) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return ['true', 'yes', 'y', '1', 'verified'].includes(
    String(value).trim().toLowerCase(),
  )
}

export function normalizeOptionalTruth(value) {
  if (!hasValue(value)) {
    return null
  }

  return normalizeTruth(value)
}

export function normalizeId(value) {
  return hasValue(value) ? String(value).trim() : ''
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatShortDate(value) {
  if (!hasValue(value)) {
    return 'Unknown'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value)
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthLabel(value) {
  if (!hasValue(value)) {
    return 'Unknown'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).slice(0, 7)
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function truncateText(value, maxLength = 140) {
  if (!hasValue(value)) {
    return 'No review text available.'
  }

  const text = String(value).trim()
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}...`
}

export function shortThemeLabel(value) {
  const labelMap = {
    'Fabric & Material Quality': 'Fabric & Material',
    'Color & Product Description': 'Color & Description',
    'Shipping & Delivery': 'Shipping',
    'Stitching & Construction': 'Stitching',
    'Product Cleanliness': 'Cleanliness',
  }

  return labelMap[value] || value
}

export function ratingBadgeClassName() {
  return 'text-white'
}

export function parseUrlList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String)
  }

  if (!hasValue(value)) {
    return []
  }

  const text = String(value).trim()
  if (text === '[]') {
    return []
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const normalized = text.replace(/'/g, '"')
      const parsed = JSON.parse(normalized)
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
    } catch {
      return text
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
  }

  return text
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function mergeUniqueValues(...collections) {
  return [...new Set(collections.flat().filter(Boolean))]
}

export function buildImageEvidenceItems(originalUrls = [], thumbnailUrls = []) {
  const originals = Array.isArray(originalUrls) ? originalUrls.filter(Boolean).map(String) : []
  const thumbnails = Array.isArray(thumbnailUrls) ? thumbnailUrls.filter(Boolean).map(String) : []
  const count = Math.max(originals.length, thumbnails.length)
  const seen = new Set()
  const items = []

  for (let index = 0; index < count; index += 1) {
    const originalUrl = originals[index] || ''
    const thumbnailUrl = thumbnails[index] || ''
    const url = originalUrl || thumbnailUrl

    if (!url || seen.has(url)) {
      continue
    }

    seen.add(url)
    items.push({
      key: url,
      url,
      originalUrl: url,
      thumbnailUrl: thumbnailUrl || url,
      isThumbnailOnly: !originalUrl && Boolean(thumbnailUrl),
    })
  }

  return items
}

export function pickFirstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) {
      return value
    }
  }

  return ''
}

function scoreThemeMatch(text, keywords) {
  const haystack = text.toLowerCase()
  return keywords.reduce((score, keyword) => {
    if (haystack.includes(keyword)) {
      return score + keyword.split(' ').length + 1
    }

    return score
  }, 0)
}

export function inferComplaintTheme({ title, reviewText }) {
  const combined = `${title || ''} ${reviewText || ''}`.trim()
  if (!combined) {
    return 'Other'
  }

  const scores = Object.entries(themeKeywordMap).map(([theme, keywords]) => ({
    theme,
    score: scoreThemeMatch(combined, keywords),
  }))

  scores.sort((left, right) => right.score - left.score)
  return scores[0]?.score ? scores[0].theme : 'Other'
}

function normalizeProducts(products = []) {
  return products.map((item) => ({
    productName: pickFirstValue(item.product_name, item.productName),
    productId: pickFirstValue(item.product_id, item.productId),
    productNameId: pickFirstValue(item.productNameId, item.product_name_id),
    productUrl: pickFirstValue(item.product_url, item.productUrl),
    category: pickFirstValue(item.category, item.product_category),
  }))
}

function normalizeReviews(reviews = []) {
  return reviews
    .map((review, index) => {
      const title = pickFirstValue(review.review_title, review.title)
      const reviewText = pickFirstValue(review.review_text, review.text)
      const complaintTheme =
        pickFirstValue(review.complaint_theme, review.complaintTheme) ||
        inferComplaintTheme({ title, reviewText })
      const originalImageUrls = parseUrlList(review.photo_urls)
      const photoThumbnails = parseUrlList(review.photo_thumbnails)
      const imageEvidence = buildImageEvidenceItems(originalImageUrls, photoThumbnails)

      return {
        key: `${pickFirstValue(review.product_id, review.productId)}-${normalizeId(review.review_id || review.reviewId || index)}`,
        productName: pickFirstValue(review.product_name, review.productName),
        productId: pickFirstValue(review.product_id, review.productId),
        productNameId: pickFirstValue(review.productNameId, review.product_name_id),
        productUrl: pickFirstValue(review.product_url, review.productUrl),
        category: pickFirstValue(review.category, review.product_category),
        reviewId: normalizeId(review.review_id || review.reviewId || index),
        rating: safeNumber(review.rating),
        title: title || 'Untitled review',
        reviewText: reviewText || 'No review text available.',
        reviewDate: pickFirstValue(review.review_date, review.submission_time, review.created_at),
        dateLabel: formatShortDate(
          pickFirstValue(review.review_date, review.submission_time, review.created_at),
        ),
        monthKey: hasValue(
          pickFirstValue(review.review_date, review.submission_time, review.created_at),
        )
          ? String(
              pickFirstValue(review.review_date, review.submission_time, review.created_at),
            ).slice(0, 7)
          : '',
        reviewerNameOrId: pickFirstValue(
          review.reviewer_name_or_id,
          review.author,
          review.reviewerNameOrId,
        ),
        complaintTheme,
        businessInsight:
          pickFirstValue(review.business_insight, review.businessInsight) ||
          themeDetailCopy[complaintTheme]?.action ||
          '',
        matchedDefectCode: pickFirstValue(review.matched_defect_code, review.matchedDefectCode),
        matchedDefectDesc: pickFirstValue(review.matched_defect_desc, review.matchedDefectDesc),
        matchedDefectGroupCode: pickFirstValue(
          review.matched_defect_group_code,
          review.matchedDefectGroupCode,
        ),
        matchedDefectGroup: pickFirstValue(review.matched_defect_group, review.matchedDefectGroup),
        similarityScore: safeNumber(pickFirstValue(review.similarity_score, review.similarityScore)),
        semanticMatchMethod: pickFirstValue(
          review.semantic_match_method,
          review.semanticMatchMethod,
        ),
        operationRelated:
          normalizeOptionalTruth(pickFirstValue(review.operation_related, review.operationRelated)) ??
          false,
        confidenceScore: safeNumber(pickFirstValue(review.confidence_score, review.confidenceScore)),
        helpfulVotes: safeNumber(pickFirstValue(review.helpful_votes, review.likes)),
        verifiedBuyer:
          normalizeOptionalTruth(
            pickFirstValue(review.verified_buyer, review.is_verified_buyer),
          ) ?? false,
        reviewerLocation: pickFirstValue(
          review.reviewer_location,
          review.reviewerLocation,
          review.location,
        ),
        fitFeedback: pickFirstValue(review.fit_feedback, review.fitFeedback),
        sizePurchased: pickFirstValue(review.size_purchased, review.sizePurchased),
        usualSize: pickFirstValue(review.usual_size, review.usualSize),
        color: pickFirstValue(review.color, review.product_color),
        height: safeNumber(review.height) || null,
        weight: safeNumber(review.weight) || null,
        badge: pickFirstValue(review.badge, review.incentivized_review_label),
        photoCount: Math.max(safeNumber(review.photo_count), imageEvidence.length),
        imageUrls: imageEvidence.map((item) => item.url),
        originalImageUrls,
        photoThumbnails,
        imageEvidence,
        totalComments: safeNumber(review.total_comments),
        luluResponseAuthor: pickFirstValue(
          review.lulu_response_author,
          review.luluResponseAuthor,
        ),
        luluResponseText: pickFirstValue(review.lulu_response_text, review.luluResponseText),
        luluResponseTime: pickFirstValue(review.lulu_response_time, review.luluResponseDate),
        scrapedAt: pickFirstValue(review.scraped_at, review.scrapedAt),
        region: pickFirstValue(review.region) || 'north_america',
      }
    })
    .filter((review) => LOW_STAR_RATINGS.includes(review.rating))
}

function normalizeImages(images = []) {
  return images.map((item, index) => {
    const imageUrl = pickFirstValue(item.image_url, item.imageUrl)
    const thumbnailUrl = pickFirstValue(item.thumbnail_url, item.thumbnailUrl, imageUrl)

    return {
      key: `${pickFirstValue(item.product_id, item.productId)}-${normalizeId(item.review_id || item.reviewId || 'image')}-${pickFirstValue(item.photo_id, item.photoId, item.photo_number, index)}`,
      productName: pickFirstValue(item.product_name, item.productName),
      productId: pickFirstValue(item.product_id, item.productId),
      productNameId: pickFirstValue(item.productNameId, item.product_name_id),
      productUrl: pickFirstValue(item.product_url, item.productUrl),
      category: pickFirstValue(item.category, item.product_category),
      reviewId: normalizeId(item.review_id || item.reviewId),
      rating: safeNumber(item.rating),
      reviewDate: pickFirstValue(item.review_date, item.reviewDate),
      dateLabel: formatShortDate(pickFirstValue(item.review_date, item.reviewDate)),
      reviewTitle: pickFirstValue(item.review_title, item.reviewTitle) || 'Untitled review',
      reviewText: pickFirstValue(item.review_text, item.reviewText) || 'No review text available.',
      complaintTheme: pickFirstValue(item.complaint_theme, item.complaintTheme) || 'Other',
      businessInsight:
        pickFirstValue(item.business_insight, item.businessInsight) ||
        themeDetailCopy[pickFirstValue(item.complaint_theme, item.complaintTheme)]?.action ||
        '',
      photoId: normalizeId(item.photo_id || item.photoId || item.photo_number || index + 1),
      photoNumber: safeNumber(item.photo_number || index + 1),
      imageUrl: imageUrl || thumbnailUrl,
      originalUrl: imageUrl || thumbnailUrl,
      thumbnailUrl,
      isThumbnailOnly: !imageUrl && Boolean(thumbnailUrl),
      localImagePath: pickFirstValue(item.local_image_path, item.localImagePath),
      verifiedBuyer:
        normalizeOptionalTruth(
          pickFirstValue(item.verified_buyer, item.verifiedBuyer),
        ) ?? false,
      helpfulVotes: safeNumber(pickFirstValue(item.helpful_votes, item.helpfulVotes)),
      sizePurchased: pickFirstValue(item.size_purchased, item.sizePurchased),
      fitFeedback: pickFirstValue(item.fit_feedback, item.fitFeedback),
      imageExists:
        normalizeOptionalTruth(pickFirstValue(item.image_exists, item.imageExists)) ?? true,
      region: pickFirstValue(item.region) || 'north_america',
    }
  })
}

function normalizeCategorySummary(categorySummary = []) {
  return categorySummary.map((item) => ({
    productName: pickFirstValue(item.product_name, item.productName),
    productId: pickFirstValue(item.product_id, item.productId),
    productNameId: pickFirstValue(item.productNameId, item.product_name_id),
    category: pickFirstValue(item.category, item.product_category),
    complaintTheme: pickFirstValue(item.complaint_theme, item.complaintTheme) || 'Other',
    totalReviews: safeNumber(pickFirstValue(item.total_reviews, item.totalReviews)),
    oneStar: safeNumber(pickFirstValue(item.one_star, item.oneStar)),
    twoStar: safeNumber(pickFirstValue(item.two_star, item.twoStar)),
    threeStar: safeNumber(pickFirstValue(item.three_star, item.threeStar)),
    sharePercentage: safeNumber(
      pickFirstValue(item.share_percentage, item.sharePercentage),
    ),
  }))
}

function normalizeProductSummaries(productSummary = []) {
  return productSummary.map((item) => ({
    productName: pickFirstValue(item.product_name, item.productName),
    productId: pickFirstValue(item.product_id, item.productId),
    productNameId: pickFirstValue(item.productNameId, item.product_name_id),
    productUrl: pickFirstValue(item.product_url, item.productUrl),
    category: pickFirstValue(item.category, item.product_category),
    totalReviews: safeNumber(pickFirstValue(item.total_reviews, item.totalReviews)),
    lowStarReviews: safeNumber(pickFirstValue(item.low_star_reviews, item.lowStarReviews)),
    oneStarReviews: safeNumber(pickFirstValue(item.one_star_reviews, item.oneStarReviews)),
    twoStarReviews: safeNumber(pickFirstValue(item.two_star_reviews, item.twoStarReviews)),
    threeStarReviews: safeNumber(
      pickFirstValue(item.three_star_reviews, item.threeStarReviews),
    ),
    reviewsWithImages: safeNumber(
      pickFirstValue(item.reviews_with_images, item.reviewsWithImages),
    ),
    totalImages: safeNumber(pickFirstValue(item.total_images, item.totalImages)),
    averageRating: safeNumber(pickFirstValue(item.average_rating, item.averageRating)),
    topComplaintTheme: pickFirstValue(item.top_complaint_theme, item.topComplaintTheme),
    topComplaintShare: safeNumber(
      pickFirstValue(item.top_complaint_share, item.topComplaintShare),
    ),
  }))
}

function filterByProductId(records = [], selectedProductId = 'all') {
  if (selectedProductId === 'all') {
    return records
  }

  return records.filter((record) => record.productId === selectedProductId)
}

function buildThemeRows(categoryRows = [], reviews = [], images = []) {
  const themeSet = new Set([
    ...categoryRows.map((row) => row.complaintTheme),
    ...reviews.map((row) => row.complaintTheme),
    ...images.map((row) => row.complaintTheme),
  ])

  const totalLowStarReviews = reviews.length
  const imageReviewSets = new Map()
  images.forEach((item) => {
    if (!imageReviewSets.has(item.complaintTheme)) {
      imageReviewSets.set(item.complaintTheme, new Set())
    }
    imageReviewSets.get(item.complaintTheme).add(getReviewEvidenceKey(item))
  })

  const totalImageBackedReviews = new Set(images.map((item) => getReviewEvidenceKey(item))).size

  const rows = [...themeSet]
    .filter(Boolean)
    .map((theme) => {
      const categoryRow = categoryRows.find((row) => row.complaintTheme === theme)
      const themedReviews = reviews.filter((review) => review.complaintTheme === theme)
      const themedImages = images.filter((image) => image.complaintTheme === theme)
      const imageBackedReviewCount = imageReviewSets.get(theme)?.size || 0

      return {
        theme,
        slug: slugify(theme),
        shortTheme: shortThemeLabel(theme),
        totalReviews: categoryRow?.totalReviews || themedReviews.length,
        totalReviewsWithImages: imageBackedReviewCount,
        totalImages: themedImages.length,
        oneStarImages: themedImages.filter((image) => image.rating === 1).length,
        twoStarImages: themedImages.filter((image) => image.rating === 2).length,
        threeStarImages: themedImages.filter((image) => image.rating === 3).length,
        businessInterpretation:
          themeDetailCopy[theme]?.action || 'No interpretation available yet.',
        share:
          totalLowStarReviews > 0
            ? (themedReviews.length / totalLowStarReviews) * 100
            : categoryRow?.sharePercentage || 0,
        overallShare:
          totalLowStarReviews > 0 ? (themedReviews.length / totalLowStarReviews) * 100 : 0,
        imageBackedShare:
          totalImageBackedReviews > 0
            ? (imageBackedReviewCount / totalImageBackedReviews) * 100
            : 0,
      }
    })
    .sort((left, right) => right.totalReviews - left.totalReviews)
    .map((row, index) => ({
      ...row,
      fill: themePalette[index % themePalette.length],
    }))

  return rows
}

export function getThemePercentage(records = [], theme) {
  if (!records.length || !hasValue(theme)) {
    return 0
  }

  const count = records.filter((record) => record.complaintTheme === theme).length
  return (count / records.length) * 100
}

export function getTopComplaintTheme(records = []) {
  if (!records.length) {
    return null
  }

  const counts = new Map()
  records.forEach((record) => {
    counts.set(record.complaintTheme, (counts.get(record.complaintTheme) || 0) + 1)
  })

  const [theme, count] =
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0] || []

  if (!theme) {
    return null
  }

  return {
    theme,
    count,
    share: getThemePercentage(records, theme),
  }
}

export function getTopImageBackedTheme(images = []) {
  if (!images.length) {
    return null
  }

  const grouped = new Map()
  images.forEach((image) => {
    if (!grouped.has(image.complaintTheme)) {
      grouped.set(image.complaintTheme, new Set())
    }

    grouped.get(image.complaintTheme).add(getReviewEvidenceKey(image))
  })

  const totalImageBackedReviews = new Set(images.map((image) => getReviewEvidenceKey(image))).size
  const [theme, reviewSet] =
    [...grouped.entries()].sort((left, right) => right[1].size - left[1].size)[0] || []

  if (!theme) {
    return null
  }

  return {
    theme,
    count: reviewSet.size,
    share: totalImageBackedReviews ? (reviewSet.size / totalImageBackedReviews) * 100 : 0,
  }
}

export function buildBusinessGroups(themeRows = []) {
  const totalReviews = themeRows.reduce((sum, item) => sum + item.totalReviews, 0)

  return businessGroupBlueprints.map((blueprint) => {
    const memberThemes = themeRows.filter((item) => blueprint.categories.includes(item.theme))
    const total = memberThemes.reduce((sum, item) => sum + item.totalReviews, 0)
    const totalImages = memberThemes.reduce((sum, item) => sum + item.totalImages, 0)

    return {
      ...blueprint,
      total,
      totalImages,
      share: totalReviews ? (total / totalReviews) * 100 : 0,
      themes: memberThemes,
    }
  })
}

export function buildRatingsDistribution(reviews = []) {
  return LOW_STAR_RATINGS.map((rating) => ({
    label: `${rating}-Star`,
    count: reviews.filter((review) => review.rating === rating).length,
    fill: severityPalette[rating],
  }))
}

export function buildMonthlyTrendSeries(reviews = []) {
  const rows = new Map()

  reviews.forEach((review) => {
    const monthKey = review.monthKey || 'Unknown'
    if (!rows.has(monthKey)) {
      rows.set(monthKey, {
        monthKey,
        label: formatMonthLabel(`${monthKey}-01`),
        oneStar: 0,
        twoStar: 0,
        threeStar: 0,
        total: 0,
        ratingSum: 0,
      })
    }

    const row = rows.get(monthKey)
    row.total += 1
    row.ratingSum += review.rating
    if (review.rating === 1) row.oneStar += 1
    if (review.rating === 2) row.twoStar += 1
    if (review.rating === 3) row.threeStar += 1
  })

  return [...rows.values()]
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map((row) => ({
      ...row,
      averageRating: row.total ? Number((row.ratingSum / row.total).toFixed(2)) : 0,
    }))
}

export function buildRollingAverageSeries(monthlyTrend = []) {
  return monthlyTrend.map((row, index) => {
    const slice = monthlyTrend.slice(Math.max(0, index - 2), index + 1)
    const total = slice.reduce((sum, item) => sum + item.total, 0)
    const weightedRating = slice.reduce(
      (sum, item) => sum + item.averageRating * item.total,
      0,
    )

    return {
      ...row,
      rollingAverage: total ? Number((weightedRating / total).toFixed(2)) : row.averageRating,
    }
  })
}

export function buildThemeShareByMonth(reviews = [], topThemes = []) {
  const selectedThemes =
    topThemes.length > 0
      ? topThemes
      : [...new Set(reviews.map((review) => review.complaintTheme))].slice(0, 5)

  const rows = new Map()

  reviews.forEach((review) => {
    const monthKey = review.monthKey || 'Unknown'
    if (!rows.has(monthKey)) {
      rows.set(monthKey, {
        monthKey,
        label: formatMonthLabel(`${monthKey}-01`),
      })
    }

    const row = rows.get(monthKey)
    selectedThemes.forEach((theme) => {
      if (!Object.prototype.hasOwnProperty.call(row, theme)) {
        row[theme] = 0
      }
    })

    row[review.complaintTheme] = (row[review.complaintTheme] || 0) + 1
  })

  return [...rows.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey))
}

export function buildResponseMetrics(reviews = []) {
  const responded = reviews.filter((review) => hasValue(review.luluResponseText))
  const responseRate = reviews.length ? (responded.length / reviews.length) * 100 : 0

  const latencyHours = responded
    .map((review) => {
      const submitted = new Date(review.reviewDate).getTime()
      const respondedAt = new Date(review.luluResponseTime).getTime()
      if (Number.isNaN(submitted) || Number.isNaN(respondedAt)) {
        return null
      }

      return (respondedAt - submitted) / (1000 * 60 * 60)
    })
    .filter((value) => value !== null && value >= 0)
    .sort((left, right) => left - right)

  const medianLatency =
    latencyHours.length === 0
      ? 0
      : latencyHours.length % 2 === 1
        ? latencyHours[Math.floor(latencyHours.length / 2)]
        : (latencyHours[latencyHours.length / 2 - 1] + latencyHours[latencyHours.length / 2]) / 2

  const latencyBuckets = [
    { label: '<24h', min: 0, max: 24 },
    { label: '24-72h', min: 24, max: 72 },
    { label: '3-7d', min: 72, max: 168 },
    { label: '7d+', min: 168, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({
    ...bucket,
    count: latencyHours.filter((value) => value >= bucket.min && value < bucket.max).length,
  }))

  const authors = new Map()
  const byTheme = new Map()

  responded.forEach((review) => {
    const author = review.luluResponseAuthor || 'Unknown responder'
    authors.set(author, (authors.get(author) || 0) + 1)
    byTheme.set(review.complaintTheme, (byTheme.get(review.complaintTheme) || 0) + 1)
  })

  return {
    responseRate,
    respondedCount: responded.length,
    medianLatency,
    latencyBuckets,
    topAuthors: [...authors.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    responseByTheme: [...byTheme.entries()]
      .map(([theme, count]) => ({ theme, count }))
      .sort((left, right) => right.count - left.count),
    sampleExchanges: responded.slice(0, 4),
  }
}

export function buildPhotoBackedStats(reviews = [], images = []) {
  const imageBackedReviewCount = new Set(images.map((image) => getReviewEvidenceKey(image))).size
  return {
    count: imageBackedReviewCount,
    share: reviews.length ? (imageBackedReviewCount / reviews.length) * 100 : 0,
  }
}

export function buildFitFeedbackDistribution(reviews = []) {
  const counts = new Map()

  reviews.forEach((review) => {
    const label = hasValue(review.fitFeedback) ? review.fitFeedback : 'Not specified'
    counts.set(label, (counts.get(label) || 0) + 1)
  })

  return [...counts.entries()]
    .map(([label, count], index) => ({
      label,
      count,
      fill: themePalette[index % themePalette.length],
    }))
    .sort((left, right) => right.count - left.count)
}

export function buildSizeDistribution(reviews = []) {
  const counts = new Map()

  reviews.forEach((review) => {
    if (!hasValue(review.sizePurchased)) {
      return
    }

    const label = String(review.sizePurchased)
    counts.set(label, (counts.get(label) || 0) + 1)
  })

  return [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((left, right) => safeNumber(left.size) - safeNumber(right.size))
}

export function buildSizeDeltaPoints(reviews = []) {
  return reviews
    .filter((review) => hasValue(review.sizePurchased) && hasValue(review.usualSize))
    .map((review, index) => ({
      id: `${review.reviewId}-${index}`,
      purchased: safeNumber(review.sizePurchased),
      usual: safeNumber(review.usualSize),
      rating: review.rating,
      complaintTheme: review.complaintTheme,
      title: review.title,
    }))
    .filter((point) => point.purchased || point.usual)
}

export function buildHeightWeightPoints(reviews = []) {
  return reviews
    .filter((review) => review.height && review.weight)
    .map((review, index) => ({
      id: `${review.reviewId}-${index}`,
      height: review.height,
      weight: review.weight,
      fitFeedback: review.fitFeedback || 'Not specified',
      rating: review.rating,
      title: review.title,
    }))
}

export function buildFitByTheme(reviews = []) {
  const rows = new Map()

  reviews.forEach((review) => {
    if (!rows.has(review.complaintTheme)) {
      rows.set(review.complaintTheme, {
        theme: review.complaintTheme,
        total: 0,
        trueToSize: 0,
        runsSmall: 0,
        runsLarge: 0,
        tooTight: 0,
      })
    }

    const row = rows.get(review.complaintTheme)
    row.total += 1
    const feedback = (review.fitFeedback || '').toLowerCase()
    if (feedback.includes('true')) row.trueToSize += 1
    else if (feedback.includes('small')) row.runsSmall += 1
    else if (feedback.includes('large')) row.runsLarge += 1
    else if (feedback.includes('tight')) row.tooTight += 1
  })

  return [...rows.values()].sort((left, right) => right.total - left.total).slice(0, 6)
}

export function buildLocationRows(reviews = []) {
  const counts = new Map()

  reviews.forEach((review) => {
    if (!hasValue(review.reviewerLocation)) {
      return
    }

    counts.set(review.reviewerLocation, (counts.get(review.reviewerLocation) || 0) + 1)
  })

  return [...counts.entries()]
    .map(([location, count]) => ({ location, count }))
    .sort((left, right) => right.count - left.count)
}

export function buildThemeByRegion(reviews = []) {
  const rows = new Map()

  reviews.forEach((review) => {
    if (!hasValue(review.reviewerLocation)) {
      return
    }

    if (!rows.has(review.reviewerLocation)) {
      rows.set(review.reviewerLocation, { location: review.reviewerLocation })
    }

    const row = rows.get(review.reviewerLocation)
    row[review.complaintTheme] = (row[review.complaintTheme] || 0) + 1
  })

  return [...rows.values()]
}

export function extractKeywords(reviews = []) {
  const stopwords = new Set([
    'the',
    'and',
    'that',
    'this',
    'with',
    'have',
    'from',
    'were',
    'after',
    'they',
    'their',
    'there',
    'about',
    'because',
    'would',
    'could',
    'very',
    'really',
    'just',
    'into',
    'them',
    'then',
    'when',
    'what',
    'been',
    'only',
    'more',
    'than',
    'your',
    'wear',
    'wore',
    'jacket',
    'define',
    'lululemon',
    'not',
    'but',
    'was',
    'for',
    'like',
    'are',
    'had',
    'you',
    'one',
    'back',
    'her',
    'his',
    'all',
    'out',
    'get',
    'got',
    'too',
    'now',
    'can',
    'will',
    'still',
    'even',
    'much',
    'how',
    'who',
    'why',
    'these',
    'those',
    'such',
    'over',
    'also',
    'has',
    'had',
    'did',
    'does',
    'should',
    'though',
    'while',
    'first',
    'second',
    'time',
    'going',
    'went',
    'bought',
    'buy',
    'product',
    'review',
  ])

  const counts = new Map()

  reviews.forEach((review) => {
    const tokens = `${review.title} ${review.reviewText}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopwords.has(token))

    tokens.forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + 1)
    })
  })

  const maxCount = Math.max(...counts.values(), 1)
  return [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      size: 0.95 + (count / maxCount) * 1.45,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 20)
}

export function buildSearchIndex({ reviews = [] }) {
  const routeEntries = Object.values(pageMetadata).map((page) => ({
    group: 'Pages',
    label: page.title,
    description: page.title,
    path: page.path,
  }))

  const reviewEntries = reviews.slice(0, 120).map((review) => ({
    group: 'Reviews',
    label: review.title || `Review ${review.reviewId}`,
    description: `${review.productName} • ${review.complaintTheme} • ${truncateText(review.reviewText, 90)}`,
    path: `/reviews?id=${review.reviewId}`,
  }))

  return [...routeEntries, ...reviewEntries]
}

export function filterSearchIndex(index = [], query = '') {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return index.slice(0, 16)
  }

  return index
    .filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 18)
}

export function filterReviews(reviews = [], filters = {}) {
  const {
    rating = ALL_FILTER_VALUE,
    themes = [],
    verified = ALL_FILTER_VALUE,
    from = '',
    to = '',
    query = '',
  } = filters

  const normalizedQuery = String(query || '').trim().toLowerCase()
  const fromTime = parseDateStart(from)
  const toTime = parseDateEnd(to)

  return reviews.filter((review) => {
    const reviewDate = pickFirstValue(review.reviewDate, review.review_date, review.submission_time)
    const reviewTime = new Date(reviewDate).getTime()
    const reviewRating = pickFirstValue(review.rating, review.Rating)
    const reviewTheme = pickFirstValue(review.complaintTheme, review.complaint_theme)
    const verifiedBuyer =
      normalizeOptionalTruth(
        pickFirstValue(review.verifiedBuyer, review.verified_buyer, review.is_verified_buyer),
      ) ?? false
    const reviewTitle = pickFirstValue(review.title, review.review_title)
    const reviewText = pickFirstValue(review.reviewText, review.review_text, review.text)
    const reviewId = pickFirstValue(review.reviewId, review.review_id)
    const productName = pickFirstValue(review.productName, review.product_name)

    const matchesRating = rating === ALL_FILTER_VALUE || String(reviewRating) === String(rating)
    const matchesTheme = themes.length === 0 || themes.includes(reviewTheme)
    const matchesVerified =
      verified === ALL_FILTER_VALUE ||
      (verified === 'true' && verifiedBuyer === true) ||
      (verified === 'false' && verifiedBuyer === false)
    const matchesFrom = fromTime === null || (!Number.isNaN(reviewTime) && reviewTime >= fromTime)
    const matchesTo = toTime === null || (!Number.isNaN(reviewTime) && reviewTime <= toTime)
    const matchesQuery =
      !normalizedQuery ||
      `${reviewTitle} ${reviewText} ${reviewId} ${reviewTheme} ${productName}`
        .toLowerCase()
        .includes(normalizedQuery)

    return (
      matchesRating &&
      matchesTheme &&
      matchesVerified &&
      matchesFrom &&
      matchesTo &&
      matchesQuery
    )
  })
}

export function sortReviews(reviews = [], sortBy = 'newest') {
  const items = [...reviews]

  items.sort((left, right) => {
    const leftDate = new Date(left.reviewDate).getTime()
    const rightDate = new Date(right.reviewDate).getTime()

    if (sortBy === 'oldest') {
      return leftDate - rightDate
    }

    if (sortBy === 'helpful') {
      return right.helpfulVotes - left.helpfulVotes
    }

    if (sortBy === 'lowest-rating') {
      return left.rating - right.rating || rightDate - leftDate
    }

    return rightDate - leftDate
  })

  return items
}

function parseDateStart(value) {
  if (!hasValue(value)) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function parseDateEnd(value) {
  if (!hasValue(value)) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function filterGalleryItems(items = [], filters = {}) {
  const {
    rating = ALL_FILTER_VALUE,
    theme = ALL_FILTER_VALUE,
    verified = ALL_FILTER_VALUE,
    size = ALL_FILTER_VALUE,
    from = '',
    to = '',
    sortBy = 'newest',
  } = filters

  const fromTime = parseDateStart(from)
  const toTime = parseDateEnd(to)

  const filtered = items.filter((item) => {
    const itemDate = pickFirstValue(item.reviewDate, item.review_date)
    const imageTime = new Date(itemDate).getTime()
    const itemRating = pickFirstValue(item.rating, item.Rating)
    const itemTheme = pickFirstValue(item.complaintTheme, item.complaint_theme, item.theme)
    const verifiedBuyer =
      normalizeOptionalTruth(pickFirstValue(item.verifiedBuyer, item.verified_buyer)) ?? false
    const itemSize = pickFirstValue(item.sizePurchased, item.size_purchased)

    const matchesRating = rating === ALL_FILTER_VALUE || String(itemRating) === String(rating)
    const matchesTheme = theme === ALL_FILTER_VALUE || itemTheme === theme
    const matchesVerified =
      verified === ALL_FILTER_VALUE ||
      (verified === 'true' && verifiedBuyer === true) ||
      (verified === 'false' && verifiedBuyer === false)
    const matchesSize = size === ALL_FILTER_VALUE || itemSize === size
    const matchesFrom = fromTime === null || (!Number.isNaN(imageTime) && imageTime >= fromTime)
    const matchesTo = toTime === null || (!Number.isNaN(imageTime) && imageTime <= toTime)

    return (
      matchesRating &&
      matchesTheme &&
      matchesVerified &&
      matchesSize &&
      matchesFrom &&
      matchesTo
    )
  })

  filtered.sort((left, right) => {
    if (sortBy === 'helpful') {
      return right.helpfulVotes - left.helpfulVotes
    }

    return new Date(right.reviewDate).getTime() - new Date(left.reviewDate).getTime()
  })

  return filtered
}

export function buildInsightRows(groupRows = [], themeRows = []) {
  return businessGroupBlueprints.map((group, index) => {
    const groupMetrics = groupRows.find((row) => row.slug === group.slug)
    return {
      ...group,
      total: groupMetrics?.total || 0,
      share: groupMetrics?.share || 0,
      supportingThemes: themeRows.filter((theme) => group.categories.includes(theme.theme)),
      severityScore: Number((((groupMetrics?.share || 0) / 100) * 5).toFixed(1)),
      impact: index < 2 ? 'High' : 'Medium',
      effort: index === 0 ? 'Medium' : index === 1 ? 'Low' : 'Medium',
    }
  })
}

export function buildRecommendationMatrix(recommendations = []) {
  const impactScale = { Low: 1, Medium: 2, High: 3 }
  const effortScale = { Low: 1, Medium: 2, High: 3 }

  return recommendations.map((recommendation) => ({
    ...recommendation,
    x: effortScale[recommendation.effort] || 2,
    y: impactScale[recommendation.impact] || 2,
  }))
}

export function highlightMatch(text, query) {
  if (!query.trim()) {
    return [{ match: false, text }]
  }

  const normalizedText = String(text)
  const normalizedQuery = query.trim()
  const regex = new RegExp(`(${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')

  return normalizedText.split(regex).filter(Boolean).map((segment) => ({
    match: segment.toLowerCase() === normalizedQuery.toLowerCase(),
    text: segment,
  }))
}

export function getThemeOptions(reviews = []) {
  return [...new Set(reviews.map((review) => review.complaintTheme).filter(Boolean))].sort()
}

export function getGallerySizeOptions(items = []) {
  return [...new Set(items.map((item) => item.sizePurchased).filter(Boolean))].sort(
    (left, right) => safeNumber(left) - safeNumber(right),
  )
}

function getAverageRating(reviews = []) {
  if (!reviews.length) {
    return 0
  }

  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0)
  return Number((ratingSum / reviews.length).toFixed(2))
}

function buildProductComparisonRows(
  products = [],
  productSummaryRows = [],
  reviews = [],
  images = [],
) {
  const productMap = new Map()

  products.forEach((product) => {
    if (!product.productId) {
      return
    }

    productMap.set(product.productId, product)
  })

  productSummaryRows.forEach((summary) => {
    if (!summary.productId || productMap.has(summary.productId)) {
      return
    }

    productMap.set(summary.productId, {
      productId: summary.productId,
      productName: summary.productName,
      productNameId: summary.productNameId,
      productUrl: summary.productUrl,
      category: summary.category,
    })
  })

  reviews.forEach((review) => {
    if (!review.productId || productMap.has(review.productId)) {
      return
    }

    productMap.set(review.productId, {
      productId: review.productId,
      productName: review.productName,
      productNameId: review.productNameId,
      productUrl: review.productUrl,
      category: review.category,
    })
  })

  return [...productMap.values()]
    .map((product) => {
      const productReviews = reviews.filter((review) => review.productId === product.productId)
      const productImages = images.filter((image) => image.productId === product.productId)
      const historicalSummary =
        productSummaryRows.find((row) => row.productId === product.productId) || null
      const topTheme = getTopComplaintTheme(productReviews)
      const imageBackedReviewKeys = new Set(
        productImages.map((image) => getReviewEvidenceKey(image)),
      )
      const oneStarReviews = productReviews.filter((review) => review.rating === 1).length
      const twoStarReviews = productReviews.filter((review) => review.rating === 2).length
      const threeStarReviews = productReviews.filter((review) => review.rating === 3).length
      const hasHistoricalData = (historicalSummary?.lowStarReviews || 0) > 0

      return {
        ...product,
        totalReviews: productReviews.length,
        lowStarReviews: productReviews.length,
        oneStarReviews,
        twoStarReviews,
        threeStarReviews,
        reviewsWithImages: imageBackedReviewKeys.size,
        totalImages: productImages.length,
        averageRating: getAverageRating(productReviews),
        topComplaintTheme: topTheme?.theme || '',
        topComplaintShare: topTheme?.share || 0,
        historicalLowStarReviews: historicalSummary?.lowStarReviews || 0,
        hasRecentActivity: productReviews.length > 0,
        statusMessage:
          productReviews.length === 0 && hasHistoricalData
            ? 'Historical data available. No recent VOG activity in the selected period.'
            : '',
      }
    })
    .sort((left, right) => {
      if (right.lowStarReviews !== left.lowStarReviews) {
        return right.lowStarReviews - left.lowStarReviews
      }

      return left.productName.localeCompare(right.productName)
    })
}

export function buildDashboardData(
  {
    products = [],
    reviews = [],
    images = [],
    category = [],
    productSummary = [],
  },
  selectedProductId = 'all',
  selectedTimePeriod = DEFAULT_TIME_PERIOD,
  selectedRegion = DEFAULT_REGION,
) {
  const normalizedProducts = normalizeProducts(products).filter(
    (product) => !isHiddenProductId(product.productId),
  )
  const normalizedReviews = normalizeReviews(reviews)
    .filter((review) => !isHiddenProductId(review.productId))
    .filter((review) => review.region === selectedRegion)
  const normalizedImages = normalizeImages(images)
    .filter((image) => !isHiddenProductId(image.productId))
    .filter((image) => image.region === selectedRegion)
  const normalizedCategory = normalizeCategorySummary(category).filter(
    (row) => !isHiddenProductId(row.productId),
  )
  const normalizedProductSummary = normalizeProductSummaries(productSummary).filter(
    (row) => !isHiddenProductId(row.productId),
  )
  const effectiveSelectedProductId = isHiddenProductId(selectedProductId) ? 'all' : selectedProductId
  const anchorDate = findLatestReviewDate(normalizedReviews, normalizedImages)
  const periodOption = getPeriodOption(selectedTimePeriod)
  const periodStartDate = anchorDate ? shiftDateByMonths(anchorDate, -periodOption.months) : null
  const periodReviews = filterByTimePeriod(
    normalizedReviews,
    selectedTimePeriod,
    anchorDate,
  )
  const periodImages = filterByTimePeriod(normalizedImages, selectedTimePeriod, anchorDate)

  const filteredReviews = attachImageEvidence(
    filterByProductId(periodReviews, effectiveSelectedProductId),
    filterByProductId(periodImages, effectiveSelectedProductId),
  )
  const filteredImages = filterByProductId(periodImages, effectiveSelectedProductId)
  const filteredCategory = filterByProductId(normalizedCategory, effectiveSelectedProductId)
  const filteredProductSummary = filterByProductId(normalizedProductSummary, effectiveSelectedProductId)

  const selectedProduct =
    effectiveSelectedProductId === 'all'
      ? null
      : normalizedProducts.find((product) => product.productId === effectiveSelectedProductId) || null
  const selectedProductName = selectedProduct?.productName || 'All Products'
  const dashboardTitle =
    effectiveSelectedProductId === 'all'
      ? 'Voice of Guest – Quality Improvement Opportunity'
      : `${selectedProductName} Voice of Guest – Quality Improvement Opportunity`

  const themeRows = buildThemeRows([], filteredReviews, filteredImages)
  const groupRows = buildBusinessGroups(themeRows)
  const monthlyTrend = buildMonthlyTrendSeries(filteredReviews)
  const rollingAverageSeries = buildRollingAverageSeries(monthlyTrend)
  const themeShareByMonth = buildThemeShareByMonth(
    filteredReviews,
    themeRows.slice(0, 5).map((theme) => theme.theme),
  )
  const responseMetrics = buildResponseMetrics(filteredReviews)
  const ratingsDistribution = buildRatingsDistribution(filteredReviews)
  const photoBackedStats = buildPhotoBackedStats(filteredReviews, filteredImages)
  const fitFeedbackDistribution = buildFitFeedbackDistribution(filteredReviews)
  const sizeDistribution = buildSizeDistribution(filteredReviews)
  const sizeDeltaPoints = buildSizeDeltaPoints(filteredReviews)
  const heightWeightPoints = buildHeightWeightPoints(filteredReviews)
  const fitByTheme = buildFitByTheme(filteredReviews)
  const locationRows = buildLocationRows(filteredReviews)
  const themeByRegion = buildThemeByRegion(filteredReviews)
  const insightRows = buildInsightRows(groupRows, themeRows)
  const recommendationMatrix = buildRecommendationMatrix(insightRows)
  const searchIndex = buildSearchIndex({ reviews: normalizedReviews })
  const topComplaintTheme = themeRows[0]
    ? {
        ...themeRows[0],
        theme: themeRows[0].theme,
        count: themeRows[0].totalReviews,
        share: themeRows[0].overallShare,
      }
    : null

  const topImageThemeRow =
    [...themeRows].sort((left, right) => {
      if (right.totalReviewsWithImages === left.totalReviewsWithImages) {
        return right.totalImages - left.totalImages
      }

      return right.totalReviewsWithImages - left.totalReviewsWithImages
    })[0] || null

  const topImageBackedTheme = topImageThemeRow
    ? {
        ...topImageThemeRow,
        theme: topImageThemeRow.theme,
        count: topImageThemeRow.totalReviewsWithImages,
        share: topImageThemeRow.imageBackedShare,
      }
    : null

  const comparisonRows = buildProductComparisonRows(
    normalizedProducts,
    normalizedProductSummary,
    periodReviews,
    periodImages,
  )
  const comparisonBarData = comparisonRows.filter((row) => row.lowStarReviews > 0).map((row) => ({
    productName: row.productName,
    lowStarReviews: row.lowStarReviews,
    totalReviews: row.totalReviews,
    topComplaintTheme: row.topComplaintTheme,
    topComplaintShare: row.topComplaintShare,
  }))
  const averageRating = getAverageRating(filteredReviews)

  return {
    products: normalizedProducts,
    selectedProductId: effectiveSelectedProductId,
    selectedRegion,
    selectedTimePeriod: periodOption.value,
    periodMonths: periodOption.months,
    anchorDate,
    anchorDateLabel: anchorDate ? formatShortDate(anchorDate) : 'Unknown',
    periodStartDate,
    periodStartLabel: periodStartDate ? formatShortDate(periodStartDate) : 'Unknown',
    periodRangeLabel: formatDateRangeLabel(periodStartDate, anchorDate),
    selectedProduct,
    selectedProductName,
    dashboardTitle,
    isAllProducts: effectiveSelectedProductId === 'all',
    themeRows,
    groupRows,
    imageItems: filteredImages,
    imageReviews: [],
    curatedReviews: filteredReviews,
    masterReviews: filteredReviews,
    categorySummary: filteredCategory,
    productSummaryRows: filteredProductSummary,
    allProductSummaryRows: normalizedProductSummary,
    comparisonRows,
    comparisonBarData,
    ratingsDistribution,
    monthlyTrend,
    rollingAverageSeries,
    themeShareByMonth,
    responseMetrics,
    photoBackedStats,
    averageRating,
    fitFeedbackDistribution,
    sizeDistribution,
    sizeDeltaPoints,
    heightWeightPoints,
    fitByTheme,
    locationRows,
    themeByRegion,
    insightRows,
    recommendationMatrix,
    searchIndex,
    themeOptions: getThemeOptions(filteredReviews),
    sizeOptions: getGallerySizeOptions(filteredImages),
    topComplaintTheme,
    topImageBackedTheme,
    topTheme: topImageBackedTheme,
    lowStarReviewCount: filteredReviews.length,
  }
}

export function getSeverityColor(rating) {
  return severityPalette[rating] || trendPalette.neutral
}

export function resolveDefectCategory(theme) {
  return defectCategoryMap[theme] || defaultDefectCategory
}

export function buildDefectCategoryDistribution(reviews = []) {
  const buckets = new Map()

  reviews.forEach((review) => {
    const meta = resolveDefectCategory(review.complaintTheme)
    if (!buckets.has(meta.label)) {
      buckets.set(meta.label, {
        label: meta.label,
        theme: meta.label,
        slug: slugify(meta.label),
        shortTheme: meta.label,
        issueLabel: meta.issueLabel,
        operationArea: meta.operationArea,
        recommendedAction: meta.recommendedAction,
        owner: meta.owner,
        operationRelated: meta.operationRelated,
        count: 0,
      })
    }

    buckets.get(meta.label).count += 1
  })

  const total = reviews.length

  return [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .map((row, index) => ({
      ...row,
      percentage: total ? (row.count / total) * 100 : 0,
      riskLevel: index === 0 ? 'High' : index <= 2 ? 'Medium' : 'Low',
      fill: index === 0 ? severityPalette[1] : index <= 2 ? severityPalette[2] : severityPalette[3],
    }))
}

export function buildOperationAnalysisRows(distributionRows = []) {
  return distributionRows.filter((row) => row.operationRelated)
}

export function buildPriorityReadout(operationRows = []) {
  return operationRows.slice(0, 4).map((row, index) => ({
    priority: `P${index + 1}`,
    issue: row.issueLabel,
    impact: row.riskLevel,
    owner: row.owner,
    action: row.recommendedAction,
    count: row.count,
  }))
}

export function buildVolumeTrend(monthlyTrend = []) {
  const latest = monthlyTrend.at(-1)
  const previous = monthlyTrend.at(-2)

  if (!latest || !previous) {
    return { direction: 'stable', delta: 0, deltaPercent: 0 }
  }

  const delta = latest.total - previous.total
  const deltaPercent = previous.total ? (delta / previous.total) * 100 : 0

  return {
    direction: delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stable',
    delta,
    deltaPercent,
  }
}

export function buildExecutiveNarrative(data = {}) {
  const { monthlyTrend = [], masterReviews = [] } = data
  const latestMonth = monthlyTrend.at(-1)

  if (!latestMonth) {
    return null
  }

  const currentMonthReviews = masterReviews.filter((review) => review.monthKey === latestMonth.monthKey)
  const volumeTrend = buildVolumeTrend(monthlyTrend)
  const topTheme = getTopComplaintTheme(currentMonthReviews)
  const topThemeMeta = topTheme ? resolveDefectCategory(topTheme.theme) : null
  const actionability = calculateFactoryActionabilityScore(currentMonthReviews)
  const responseMetrics = buildResponseMetrics(currentMonthReviews)
  const photoBackedCount = currentMonthReviews.filter((review) => review.hasImageEvidence).length
  const photoBackedShare = currentMonthReviews.length
    ? (photoBackedCount / currentMonthReviews.length) * 100
    : 0

  const hasPriorMonth = monthlyTrend.length > 1
  const trendPercent = Math.abs(Math.round(volumeTrend.deltaPercent || 0))
  const trendDelta = Math.abs(volumeTrend.delta || 0)

  const trends = [
    !hasPriorMonth
      ? 'No prior month of data is available yet for a trend comparison.'
      : volumeTrend.direction === 'increased'
        ? `Low-star review volume rose ${trendPercent}% vs. the prior month (${trendDelta} more reviews).`
        : volumeTrend.direction === 'decreased'
          ? `Low-star review volume eased ${trendPercent}% vs. the prior month (${trendDelta} fewer reviews).`
          : 'Low-star review volume held steady versus the prior month.',
  ]

  const risks = [
    topTheme
      ? `Top quality risk this month: ${topTheme.theme} (${topTheme.count} mentions, ${topTheme.share.toFixed(0)}% of low-star reviews).`
      : "No single theme dominates this month's low-star reviews.",
  ]

  const insights = [
    `${Math.round(actionability.actionableShare)}% of this month's complaints are factory-actionable.`,
    `${Math.round(photoBackedShare)}% of this month's low-star reviews include customer photo evidence.`,
    `Brand responded to ${Math.round(responseMetrics.responseRate)}% of this month's flagged reviews.`,
  ]

  const recommendedActions = [
    topThemeMeta
      ? `${topThemeMeta.recommendedAction} (Owner: ${topThemeMeta.owner})`
      : 'Continue routine monitoring — no dominant defect pattern this month.',
  ]

  return {
    monthLabel: latestMonth.label,
    headline: `${latestMonth.label}: ${latestMonth.total} low-star review${latestMonth.total === 1 ? '' : 's'}, averaging ${latestMonth.averageRating.toFixed(2)}★.`,
    trends,
    risks,
    insights,
    recommendedActions,
  }
}

export function buildRootCauseInsights({ topComplaintTheme, topImageBackedTheme, volumeTrend } = {}) {
  const insights = []

  if (topComplaintTheme?.theme) {
    insights.push(
      `${topComplaintTheme.theme} is the largest low-star signal this period, at ${topComplaintTheme.share.toFixed(1)}% of low-star reviews.`,
    )

    const meta = resolveDefectCategory(topComplaintTheme.theme)
    insights.push(
      meta.operationRelated
        ? `${topComplaintTheme.theme} complaints are operation-related and should be reviewed by the ${meta.operationArea} team.`
        : `${topComplaintTheme.theme} complaints sit outside manufacturing operations and point to service or expectation gaps.`,
    )
  }

  if (topImageBackedTheme?.theme) {
    insights.push(
      `Reviews with images provide stronger evidence for ${topImageBackedTheme.theme} issues.`,
    )
  }

  if (volumeTrend && volumeTrend.direction !== 'stable') {
    insights.push(
      `Low-star review volume ${volumeTrend.direction} by ${Math.abs(volumeTrend.delta)} reviews compared with the previous period.`,
    )
  } else if (volumeTrend) {
    insights.push('Low-star review volume remained stable compared with the previous period.')
  }

  return insights
}

export function buildOverallAverageRating(productSummaryRows = []) {
  const totalReviews = productSummaryRows.reduce((sum, row) => sum + row.totalReviews, 0)

  if (!totalReviews) {
    return 0
  }

  const weightedSum = productSummaryRows.reduce(
    (sum, row) => sum + row.averageRating * row.totalReviews,
    0,
  )

  return Number((weightedSum / totalReviews).toFixed(2))
}

export function isFactoryActionable(review) {
  return resolveReviewDefectGroup(review) !== 'Unclassified'
}

export function resolveDefectGroupMeta(groupLabel) {
  return (
    officialDefectGroups.find((item) => item.key === groupLabel) ||
    officialDefectGroups.find((item) => item.key === 'Unclassified')
  )
}

export function resolveOperationArea(groupLabel) {
  return resolveDefectGroupMeta(groupLabel).operationArea
}

export function resolveOwner(groupLabel) {
  return resolveDefectGroupMeta(groupLabel).owner
}

export function resolvePreventionAction(groupLabel) {
  return resolveDefectGroupMeta(groupLabel).preventionAction
}

function countByDefectGroup(reviews = []) {
  const counts = new Map()

  reviews.forEach((review) => {
    const key = resolveReviewDefectGroup(review)

    if (!counts.has(key)) {
      counts.set(key, { key, count: 0, imageCount: 0 })
    }

    const row = counts.get(key)
    row.count += 1
    if (review.hasImageEvidence) {
      row.imageCount += 1
    }
  })

  return counts
}

export function calculateFactoryActionabilityScore(reviews = []) {
  const total = reviews.length
  const actionableReviews = reviews.filter((review) => isFactoryActionable(review))
  const actionable = actionableReviews.length
  const nonProduction = total - actionable
  const withImages = reviews.filter((review) => review.hasImageEvidence).length
  const officialCounts = [...countByDefectGroup(actionableReviews).entries()].filter(
    ([key]) => key !== 'Unclassified',
  )
  const topEntry = officialCounts.sort((left, right) => right[1].count - left[1].count)[0]

  return {
    total,
    actionable,
    actionableShare: total ? (actionable / total) * 100 : 0,
    nonProduction,
    nonProductionShare: total ? (nonProduction / total) * 100 : 0,
    withImages,
    withImagesShare: total ? (withImages / total) * 100 : 0,
    highestRiskCategory: topEntry ? resolveDefectGroupMeta(topEntry[0]).label : null,
  }
}

export function buildProductionDefectMatrix(reviews = []) {
  const actionableReviews = reviews.filter((review) => isFactoryActionable(review))
  const nonActionableReviews = reviews.filter((review) => !isFactoryActionable(review))
  const actionableCounts = countByDefectGroup(actionableReviews)
  const maxCount = Math.max(
    0,
    ...officialDefectGroups
      .filter((group) => group.isProduction)
      .map((group) => actionableCounts.get(group.key)?.count || 0),
  )

  return officialDefectGroups.map((group) => {
    if (!group.isProduction) {
      return {
        key: group.key,
        label: group.label,
        signalExamples: group.actionIssueLabel,
        count: nonActionableReviews.length,
        imageCount: nonActionableReviews.filter((review) => review.hasImageEvidence).length,
        riskLevel: 'Excluded',
        operationArea: group.operationArea,
        heatmapLabel: group.heatmapLabel,
        owner: group.owner,
        preventionAction: group.preventionAction,
        actionIssueLabel: group.actionIssueLabel,
        whyItMatters: 'Not a manufacturing defect signal.',
        qaChecklist: group.qaChecklist,
        icon: group.icon,
        isProduction: false,
      }
    }

    const row = actionableCounts.get(group.key) || { count: 0, imageCount: 0 }
    const riskLevel =
      row.count === 0
        ? 'Low'
        : row.count === maxCount && row.imageCount > 0
          ? 'High'
          : row.count === maxCount || row.imageCount > 0 || row.count >= 2
            ? 'Medium'
            : 'Low'

    return {
      key: group.key,
      label: group.label,
      signalExamples: group.actionIssueLabel,
      count: row.count,
      imageCount: row.imageCount,
      riskLevel,
      operationArea: group.operationArea,
      heatmapLabel: group.heatmapLabel,
      owner: group.owner,
      preventionAction: group.preventionAction,
      actionIssueLabel: group.actionIssueLabel,
      whyItMatters: `${group.label} defects matched against the official defect master list.`,
      qaChecklist: group.qaChecklist,
      icon: group.icon,
      isProduction: true,
    }
  })
}

export function buildOperationRiskHeatmap(reviews = []) {
  const matrixRows = buildProductionDefectMatrix(reviews)
  const sorted = [...reviews].sort(
    (left, right) => new Date(left.reviewDate).getTime() - new Date(right.reviewDate).getTime(),
  )
  const midpoint = Math.floor(sorted.length / 2)
  const firstCounts = countByDefectGroup(
    sorted.slice(0, midpoint).filter((review) => isFactoryActionable(review)),
  )
  const secondCounts = countByDefectGroup(
    sorted.slice(midpoint).filter((review) => isFactoryActionable(review)),
  )

  return matrixRows.map((row) => {
    const before = firstCounts.get(row.key)?.count || 0
    const after = secondCounts.get(row.key)?.count || 0

    return {
      key: row.key,
      label: row.heatmapLabel,
      riskLevel: row.riskLevel,
      count: row.count,
      imageCount: row.imageCount,
      trend: after > before ? 'up' : after < before ? 'down' : 'flat',
      owner: row.owner,
      preventionAction: row.preventionAction,
      icon: row.icon,
      isProduction: row.isProduction,
    }
  })
}

export function buildSewerQAActionBoard(reviews = []) {
  const matrixRows = buildProductionDefectMatrix(reviews).filter((row) => row.isProduction)

  return [...matrixRows]
    .sort((left, right) => right.count - left.count)
    .map((row, index) => ({
      key: row.key,
      issue: row.actionIssueLabel,
      whereToAct: row.heatmapLabel,
      whatToCheck: row.qaChecklist,
      reviewCount: row.count,
      imageCount: row.imageCount,
      priority: index === 0 ? 'P1' : index <= 2 ? 'P2' : 'P3',
      icon: row.icon,
    }))
}

export function buildProductionEvidenceWall(reviews = [], images = [], limit = 12) {
  const priorityByCategory = new Map(
    buildSewerQAActionBoard(reviews).map((row) => [row.key, row.priority]),
  )
  const imageByReviewKey = new Map()

  images.forEach((image) => {
    const key = getReviewEvidenceKey(image)
    if (!imageByReviewKey.has(key)) {
      imageByReviewKey.set(key, image)
    }
  })

  return reviews
    .map((review) => {
      if (!isFactoryActionable(review)) {
        return null
      }

      const categoryKey = resolveReviewDefectGroup(review)
      const meta = resolveDefectGroupMeta(categoryKey)
      const matchedImage = imageByReviewKey.get(getReviewEvidenceKey(review))
      const confidenceScore = Math.min(
        100,
        60 +
          (review.hasImageEvidence ? 25 : 0) +
          (review.rating === 1 ? 15 : review.rating === 2 ? 8 : 0),
      )

      return {
        key: review.key,
        rating: review.rating,
        title: review.title,
        reviewText: review.reviewText,
        productName: review.productName,
        reviewDate: review.reviewDate,
        category: meta.label,
        operationArea: meta.heatmapLabel,
        owner: meta.owner,
        priority: priorityByCategory.get(categoryKey) || 'P3',
        confidenceScore,
        imageUrl: matchedImage?.imageUrl || matchedImage?.thumbnailUrl || null,
        thumbnailUrl: matchedImage?.thumbnailUrl || matchedImage?.imageUrl || null,
        isThumbnailOnly: !matchedImage?.imageUrl && Boolean(matchedImage?.thumbnailUrl),
        hasImageEvidence: Boolean(review.hasImageEvidence),
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, limit)
}

function impactLevelForShare(sharePercent) {
  if (sharePercent >= 20) return 'High'
  if (sharePercent >= 8) return 'Medium'
  return 'Low'
}

function evidenceStrengthForRatio(ratio) {
  if (ratio >= 0.4) return 'High'
  if (ratio > 0) return 'Medium'
  return 'Low'
}

function priorityForLevels(impactLevel, evidenceStrength) {
  if (impactLevel === 'High' && evidenceStrength === 'High') return 'Critical'
  if (impactLevel === 'Low') return 'Monitor'
  return 'High'
}

export function buildQualityInsightCategories(reviews = [], options = {}) {
  const { evidenceLimit = 8 } = options
  const officialGroups = officialDefectGroups.filter((group) => group.isCertified)

  const reviewsByGroup = new Map(officialGroups.map((group) => [group.key, []]))
  reviews.forEach((review) => {
    if (!isFactoryActionable(review)) {
      return
    }

    const officialGroup = resolveReviewDefectGroup(review)

    if (reviewsByGroup.has(officialGroup)) {
      reviewsByGroup.get(officialGroup).push(review)
    }
  })

  const grandTotal = [...reviewsByGroup.values()].reduce((sum, list) => sum + list.length, 0)
  const maxCount = Math.max(0, ...[...reviewsByGroup.values()].map((list) => list.length))

  return officialGroups
    .map((group) => {
      const groupReviews = reviewsByGroup.get(group.key) || []
      const count = groupReviews.length

      const imageTotal = groupReviews.reduce(
        (sum, review) => sum + (review.imageEvidence?.length || review.imageUrls?.length || 0),
        0,
      )
      const imageBackedReviewCount = groupReviews.filter((review) => review.hasImageEvidence).length
      const sharePercent = grandTotal ? Number(((count / grandTotal) * 100).toFixed(1)) : 0
      const impactLevel = count ? impactLevelForShare(sharePercent) : 'Low'
      const evidenceStrength = evidenceStrengthForRatio(count ? imageBackedReviewCount / count : 0)

      const evidenceImages = groupReviews
        .flatMap((review) =>
          (review.imageEvidence?.length
            ? review.imageEvidence
            : (review.imageUrls || []).map((url) => ({
                url,
                originalUrl: url,
                thumbnailUrl: url,
                isThumbnailOnly: false,
              }))
          ).map((image) => ({
            url: image.originalUrl || image.url || image.thumbnailUrl,
            thumbnailUrl: image.thumbnailUrl || image.originalUrl || image.url,
            isThumbnailOnly: Boolean(image.isThumbnailOnly),
            key: `${review.key}-${image.originalUrl || image.url || image.thumbnailUrl}`,
            reviewTitle: review.title,
            reviewText: review.reviewText,
            rating: review.rating,
          })),
        )
        .slice(0, evidenceLimit)

      return {
        key: group.key,
        label: group.label,
        summary: group.customerSummary || '',
        icon: group.icon,
        owner: group.owner,
        recommendedAction: group.preventionAction,
        issueLabel: group.actionIssueLabel,
        count,
        imageCount: imageTotal,
        imageBackedReviewCount,
        sharePercent,
        barWidth: maxCount ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0,
        impactLevel,
        evidenceStrength,
        priority: count ? priorityForLevels(impactLevel, evidenceStrength) : 'Monitor',
        evidenceImages,
      }
    })
    .sort((left, right) => right.count - left.count)
    .map((row, index) => ({ ...row, officialRank: index + 1 }))
}

export function buildProductionCategoryTrend(reviews = []) {
  const officialKeys = officialDefectGroups
    .filter((group) => group.isCertified)
    .map((group) => group.key)
  const rows = new Map()

  reviews.forEach((review) => {
    if (!isFactoryActionable(review)) {
      return
    }

    const categoryKey = resolveReviewDefectGroup(review)
    const monthKey = review.monthKey || 'Unknown'
    if (!rows.has(monthKey)) {
      rows.set(monthKey, { monthKey, label: formatMonthLabel(`${monthKey}-01`) })
    }

    const row = rows.get(monthKey)
    row[categoryKey] = (row[categoryKey] || 0) + 1
  })

  return [...rows.values()]
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map((row) => {
      officialKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(row, key)) {
          row[key] = 0
        }
      })

      return row
    })
}

export function buildPreventionPriorityRanking(reviews = []) {
  const matrixRows = buildProductionDefectMatrix(reviews).filter((row) => row.isProduction)

  return [...matrixRows]
    .sort((left, right) => right.count - left.count)
    .map((row, index) => ({
      rank: index + 1,
      issue: row.actionIssueLabel,
      whyItMatters: row.whyItMatters,
      owner: row.owner,
      preventionAction: row.preventionAction,
      evidenceStrength: row.riskLevel === 'High' ? 'High' : row.riskLevel === 'Medium' ? 'Medium' : 'Low',
      count: row.count,
    }))
}

export function buildNonProductionBreakdown(reviews = []) {
  const counts = new Map()

  reviews
    .filter((review) => !isFactoryActionable(review))
    .forEach((review) => {
      const theme = review.complaintTheme || 'Other'
      counts.set(theme, (counts.get(theme) || 0) + 1)
    })

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
}

export function buildExecutiveProductionInsights(reviews = []) {
  const score = calculateFactoryActionabilityScore(reviews)
  const matrixRows = buildProductionDefectMatrix(reviews).filter((row) => row.isProduction)
  const topRow = [...matrixRows].sort((left, right) => right.count - left.count)[0]
  const topImageRow = [...matrixRows].sort((left, right) => right.imageCount - left.imageCount)[0]
  const insights = []

  insights.push(`${score.actionableShare.toFixed(0)}% of low-star reviews are factory actionable.`)

  if (topRow && topRow.count > 0) {
    insights.push(`${topRow.label} is the highest-risk defect group this period.`)
  }

  if (topImageRow && topImageRow.imageCount > 0) {
    insights.push(`Image evidence is strongest for ${topImageRow.label.toLowerCase()} complaints.`)
  }

  insights.push(
    `${score.nonProduction} non-production complaint${score.nonProduction === 1 ? '' : 's'} ${
      score.nonProduction === 1 ? 'is' : 'are'
    } excluded from factory action planning.`,
  )

  return insights
}
