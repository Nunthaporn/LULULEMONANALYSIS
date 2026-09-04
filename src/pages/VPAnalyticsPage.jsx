import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Download,
  Images,
  Lightbulb,
  MessageSquareQuote,
  Minus,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import Panel from '../components/primitives/Panel'
import SectionHeader from '../components/primitives/SectionHeader'
import Skeleton from '../components/primitives/Skeleton'
import EmptyState from '../components/primitives/EmptyState'
import RatingBadge from '../components/primitives/RatingBadge'
import ZoomableImageFrame from '../components/ZoomableImageFrame'
import ExpertAnalysisPanel from '../components/insights/ExpertAnalysisPanel'
import TrendLine from '../components/charts/TrendLine'
import ProductStyleSelect from '../components/filters/ProductStyleSelect'
import DateRangePicker from '../components/filters/DateRangePicker'
import TimePeriodFilter from '../components/filters/TimePeriodFilter'
import { LOGO_PATH, trendPalette } from '../data/constants'
import {
  buildMonthlyTrendSeries,
  buildQualityInsightCategories,
  buildRollingAverageSeries,
  buildVolumeTrend,
  calculateFactoryActionabilityScore,
  filterReviews,
  isFactoryActionable,
  resolveReviewDefectGroup,
  truncateText,
} from '../data/selectors'
import { clearLoaderCache } from '../data/loaders'
import { useDashboardDataset } from '../hooks/useDataset'
import { useExportActions, useExportRegistration } from '../hooks/useExport'
import { useFilters } from '../hooks/useFilters'
import { useProductFilter } from '../context/ProductFilterContext'

const PRIORITY_STYLES = {
  Critical: 'bg-[#ffe5e8] text-[#E20010]',
  High: 'bg-[#fff4ec] text-[#b35900]',
  Monitor: 'bg-[#f5f5f5] text-[#767676]',
}

const ROADMAP_TIERS = {
  1: { emoji: '🔴', label: 'Immediate Action', border: 'border-[#E20010]', tint: 'bg-[#fff5f6]' },
  2: { emoji: '🟠', label: 'Next Priority', border: 'border-[#f0a04b]', tint: 'bg-[#fff8f0]' },
}
const DEFAULT_ROADMAP_TIER = {
  emoji: '🟡',
  label: 'Monitor',
  border: 'border-[#e8c84a]',
  tint: 'bg-[#fffbea]',
}

function roadmapTierFor(rank) {
  return ROADMAP_TIERS[rank] || DEFAULT_ROADMAP_TIER
}

function shortenAction(value, maxLength = 48) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) {
    return text
  }

  const clipped = text.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  const wholeWords = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped
  return `${wholeWords.trim()}...`
}

function PriorityBadge({ priority, compact = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-[0.12em] sm:tracking-[0.16em] ${
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]'
      } ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.Monitor}`}
    >
      {priority}
    </span>
  )
}

function TrendDirectionBadge({ arrow, sentiment, deltaPercent, label }) {
  const ArrowIcon = arrow === 'up' ? TrendingUp : arrow === 'down' ? TrendingDown : Minus
  const tone =
    {
      good: 'bg-[#edf6f0] text-[#1f6f3e]',
      bad: 'bg-[#ffe5e8] text-[#E20010]',
      neutral: 'bg-[#f5f5f5] text-[#767676]',
    }[sentiment] || 'bg-[#f5f5f5] text-[#767676]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}
    >
      <ArrowIcon size={13} />
      {label}
      {Number.isFinite(deltaPercent) && deltaPercent !== 0
        ? ` (${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(0)}%)`
        : ''}
    </span>
  )
}

function ZoomableEvidenceImage({ imageUrl, alt, sourceKind = 'original' }) {
  return (
    <ZoomableImageFrame
      imageUrl={imageUrl}
      alt={alt}
      sourceKind={sourceKind}
      className="max-h-[60vh] w-full rounded-2xl bg-black/5 md:max-h-[70vh]"
      maxViewportWidth="100%"
      maxViewportHeight="60vh"
      controlsClassName="mt-3 flex max-w-full flex-wrap items-center justify-center gap-2"
      buttonClassName="rounded-full border border-[#e5e5e5] p-2 text-black transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-30"
    />
  )
}

function EvidenceLightbox({ evidence, onClose }) {
  useEffect(() => {
    if (!evidence) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }, [evidence, onClose])

  if (!evidence) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-3 py-4 sm:px-4 sm:py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-[95vw] flex-col items-center overflow-y-auto rounded-[20px] bg-white p-4 shadow-2xl sm:max-w-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close evidence"
          className="absolute right-3 top-3 z-10 rounded-full bg-white p-3 text-black shadow-md transition hover:bg-[#f5f5f5] sm:right-4 sm:top-4 sm:p-2"
        >
          <X size={18} />
        </button>

        <ZoomableEvidenceImage
          key={evidence.url}
          imageUrl={evidence.url}
          alt={evidence.reviewTitle}
          sourceKind={evidence.isThumbnailOnly ? 'thumbnail' : 'original'}
        />

        <div className="mt-5 flex w-full flex-wrap items-center gap-2">
          <RatingBadge rating={evidence.rating} compact />
          <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.16em]">
            {evidence.category}
          </span>
        </div>
        <p className="mt-4 w-full text-sm font-semibold text-black">{evidence.reviewTitle}</p>
        <p className="mt-2 w-full text-sm leading-7 text-[#4a4a4a]">
          {truncateText(evidence.reviewText, 320)}
        </p>
      </div>
    </div>
  )
}

function EvidenceGalleryModal({ categoryLabel, images, onClose, onImageClick }) {
  useEffect(() => {
    if (!categoryLabel) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }, [categoryLabel, onClose])

  if (!categoryLabel) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-4 sm:px-4 sm:py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-[95vw] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl sm:max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Photo Evidence — {categoryLabel}
            </p>
            <h3 className="font-display mt-2 break-words text-lg font-semibold text-black sm:text-xl">
              {images.length} photo{images.length === 1 ? '' : 's'} from guest reviews
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#e5e5e5] bg-white p-2 text-black"
            aria-label="Close evidence"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {images.length ? (
            <div className="grid grid-cols-2 gap-3 min-[430px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {images.map((evidence) => (
                <button
                  key={evidence.key}
                  type="button"
                  onClick={() => onImageClick({ ...evidence, category: categoryLabel })}
                  className="aspect-square overflow-hidden rounded-lg border border-[#e5e5e5]"
                >
                  <img
                    src={evidence.thumbnailUrl || evidence.url}
                    alt={categoryLabel}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No photos in this category"
              description="Try a broader time period, clear the date range, or choose a different product style."
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryReviewsModal({ categoryLabel, reviews, onClose, onImageClick }) {
  useEffect(() => {
    if (!categoryLabel) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }, [categoryLabel, onClose])

  if (!categoryLabel) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-4 sm:px-4 sm:py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-[95vw] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl sm:max-w-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              All Reviews — {categoryLabel}
            </p>
            <h3 className="font-display mt-2 break-words text-lg font-semibold text-black sm:text-xl">
              {reviews.length} review{reviews.length === 1 ? '' : 's'} in this category
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#e5e5e5] bg-white p-2 text-black"
            aria-label="Close evidence"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {reviews.length ? (
            reviews.map((review) => (
              <div key={review.key} className="rounded-2xl border border-[#e5e5e5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-black">{review.title}</p>
                  <RatingBadge rating={review.rating} compact />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">{review.reviewText}</p>
                {(review.imageEvidence?.length || review.imageUrls?.length) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(review.imageEvidence?.length
                      ? review.imageEvidence
                      : review.imageUrls.map((url) => ({
                          url,
                          thumbnailUrl: url,
                          isThumbnailOnly: false,
                        }))
                    ).map((image) => (
                      <button
                        key={image.url}
                        type="button"
                        onClick={() =>
                          onImageClick({
                            url: image.url,
                            thumbnailUrl: image.thumbnailUrl,
                            isThumbnailOnly: image.isThumbnailOnly,
                            reviewTitle: review.title,
                            reviewText: review.reviewText,
                            rating: review.rating,
                            category: categoryLabel,
                          })
                        }
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#e5e5e5]"
                      >
                        <img
                          src={image.thumbnailUrl || image.url}
                          alt="Customer evidence"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="No reviews in this category"
              description="Try a broader time period, clear the date range, or choose a different product style."
            />
          )}
        </div>
      </div>
    </div>
  )
}

function VPAnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 rounded-[20px]" />
      <Skeleton className="h-64 rounded-[20px]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-[20px]" />
      <Skeleton className="h-[360px] rounded-[20px]" />
    </div>
  )
}

export default function VPAnalytics({ showExpertAnalysis = false }) {
  const {
    selectedProductId,
    productOptions,
    loadingProducts,
    setSelectedProductId,
    setSelectedTimePeriod,
  } = useProductFilter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedEvidence, setSelectedEvidence] = useState(null)
  const [highlightedCategory, setHighlightedCategory] = useState(null)
  const [reviewsModalCategory, setReviewsModalCategory] = useState(null)
  const [galleryModalCategory, setGalleryModalCategory] = useState(null)
  const highlightTimeoutRef = useRef(null)
  const { data, loading, error } = useDashboardDataset(true, refreshKey)
  const { filters, updateFilter } = useFilters({ from: '', to: '' })
  const { downloadCsv } = useExportActions()

  useEffect(() => {
    return () => window.clearTimeout(highlightTimeoutRef.current)
  }, [])

  function handleJumpToEvidence(categoryKey) {
    const target = document.getElementById(`evidence-card-${categoryKey}`)
    if (!target) {
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightedCategory(categoryKey)
    window.clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedCategory(null), 2000)
  }

  const displayReviews = useMemo(() => {
    if (!data) {
      return []
    }

    return filterReviews(data.masterReviews, { from: filters.from, to: filters.to })
  }, [data, filters])

  const monthlyTrend = useMemo(() => buildMonthlyTrendSeries(displayReviews), [displayReviews])
  const ratingTrend = useMemo(() => buildRollingAverageSeries(monthlyTrend), [monthlyTrend])
  const rawVolumeTrend = useMemo(() => buildVolumeTrend(monthlyTrend), [monthlyTrend])
  const ratingDirection = useMemo(() => {
    const latest = ratingTrend.at(-1)
    const previous = ratingTrend.at(-2)
    if (!latest || !previous || latest.rollingAverage === previous.rollingAverage) {
      return { arrow: 'flat', sentiment: 'neutral', deltaPercent: 0, label: 'Rating steady' }
    }
    const delta = latest.rollingAverage - previous.rollingAverage
    const deltaPercent = previous.rollingAverage ? (delta / previous.rollingAverage) * 100 : 0
    return delta > 0
      ? { arrow: 'up', sentiment: 'good', deltaPercent, label: 'Rating improving' }
      : { arrow: 'down', sentiment: 'bad', deltaPercent, label: 'Rating declining' }
  }, [ratingTrend])
  const volumeDirection = useMemo(() => {
    if (rawVolumeTrend.direction === 'stable') {
      return { arrow: 'flat', sentiment: 'neutral', deltaPercent: 0, label: 'Complaint volume steady' }
    }
    return rawVolumeTrend.direction === 'increased'
      ? {
          arrow: 'up',
          sentiment: 'bad',
          deltaPercent: rawVolumeTrend.deltaPercent,
          label: 'Complaint volume rising',
        }
      : {
          arrow: 'down',
          sentiment: 'good',
          deltaPercent: rawVolumeTrend.deltaPercent,
          label: 'Complaint volume falling',
        }
  }, [rawVolumeTrend])
  const hasTrendData = monthlyTrend.length > 1

  const score = useMemo(() => calculateFactoryActionabilityScore(displayReviews), [displayReviews])
  const categories = useMemo(
    () => buildQualityInsightCategories(displayReviews, { evidenceLimit: 4 }),
    [displayReviews],
  )
  const topCategories = useMemo(() => categories.filter((row) => row.count > 0).slice(0, 3), [categories])
  const topCategoriesShare = useMemo(
    () => Number(topCategories.reduce((sum, row) => sum + row.sharePercent, 0).toFixed(1)),
    [topCategories],
  )
  const totalGuestImages = useMemo(
    () => displayReviews.reduce((sum, review) => sum + (review.imageUrls?.length || 0), 0),
    [displayReviews],
  )
  const topCategory = categories[0] && categories[0].count > 0 ? categories[0] : null

  const reviewsModalCategoryLabel =
    categories.find((row) => row.key === reviewsModalCategory)?.label || null
  const reviewsModalReviews = useMemo(() => {
    if (!reviewsModalCategory) {
      return []
    }

    return displayReviews.filter(
      (review) =>
        isFactoryActionable(review) && resolveReviewDefectGroup(review) === reviewsModalCategory,
    )
  }, [displayReviews, reviewsModalCategory])

  const galleryModalCategoryLabel =
    categories.find((row) => row.key === galleryModalCategory)?.label || null
  const galleryModalImages = useMemo(() => {
    if (!galleryModalCategory) {
      return []
    }

    const reviews = displayReviews.filter(
      (review) =>
        isFactoryActionable(review) && resolveReviewDefectGroup(review) === galleryModalCategory,
    )
    return reviews.flatMap((review) =>
      (review.imageEvidence?.length
        ? review.imageEvidence
        : (review.imageUrls || []).map((url) => ({
            url,
            thumbnailUrl: url,
            isThumbnailOnly: false,
          }))
      ).map((image) => ({
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        isThumbnailOnly: Boolean(image.isThumbnailOnly),
        key: `${review.key}-${image.url}`,
        reviewTitle: review.title,
        reviewText: review.reviewText,
        rating: review.rating,
      })),
    )
  }, [displayReviews, galleryModalCategory])

  const executiveInsight = useMemo(() => {
    if (!topCategories.length) {
      return 'No dominant pattern yet.'
    }

    const labels = topCategories.slice(0, 2).map((row) => row.label)
    const categoryNames =
      labels.length > 1
        ? `${labels.slice(0, -1).join(', ')} + ${labels.at(-1)}`
        : labels[0]
    return `${score.actionableShare.toFixed(0)}% factory-actionable | ${categoryNames} drive ${topCategoriesShare}%`
  }, [score.actionableShare, topCategories, topCategoriesShare])

  const exportConfig = useMemo(
    () =>
      data
        ? {
            fileName: `lululemon-production-quality-${selectedProductId}.csv`,
            rows: categories.map((row) => ({
              category: row.label,
              review_count: row.count,
              image_evidence: row.imageCount,
              share_percent: row.sharePercent,
              priority: row.priority,
              owner: row.owner,
              recommended_action: row.recommendedAction,
            })),
            json: { categories },
          }
        : null,
    [categories, data, selectedProductId],
  )

  useExportRegistration(exportConfig)

  const dataSource =
    error || !data
      ? { label: 'Preview Data', className: 'bg-[#fff4ec] text-[#b35900]' }
      : { label: 'Live Guest Data', className: 'bg-[#edf6f0] text-[#1f6f3e]' }

  function handleRefresh() {
    clearLoaderCache()
    setRefreshKey((key) => key + 1)
  }

  function handleExport() {
    if (exportConfig) {
      downloadCsv(exportConfig.fileName, exportConfig.rows)
    }
  }

  function handleClearDateRange() {
    updateFilter('from', '')
    updateFilter('to', '')
    setSelectedTimePeriod('12M')
  }

  if (loading) {
    return <VPAnalyticsSkeleton />
  }

  if (error || !data) {
    return (
      <Panel className="p-4 text-sm text-[#4a4a4a] sm:p-8">
        Production quality intelligence could not load right now. Refresh the page and try again.
      </Panel>
    )
  }

  const hasReviews = displayReviews.length > 0
  const hasDateRange = Boolean(filters.from || filters.to)
  const evidenceCategories = categories.filter((row) => row.count > 0)

  return (
    <div className="space-y-8">
      <Panel className="p-4 sm:p-6 lg:p-7">
        <Link to="/" className="text-sm text-[#767676] hover:text-[#000000]">
          {'<- Back to executive brief'}
        </Link>
        <div className="mt-4 flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-white">
              <img
                src={LOGO_PATH}
                alt="lululemon logo"
                className="h-10 w-10 rounded-full object-contain"
              />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                Executive Insights
              </p>
              <h1 className="font-display mt-2 break-words text-2xl font-semibold tracking-normal text-black sm:text-3xl">
                Production Quality Intelligence
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4a4a4a]">
                What guests are telling us, the evidence behind it, and which quality owners
                should act next.
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em] ${dataSource.className}`}
          >
            {dataSource.label}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.2fr)_minmax(300px,1.2fr)_auto_auto_auto] xl:items-end">
          <ProductStyleSelect
            value={selectedProductId}
            options={productOptions}
            onChange={setSelectedProductId}
            disabled={loadingProducts}
            className="min-w-0"
          />
          <TimePeriodFilter className="min-w-0" />
          <DateRangePicker from={filters.from} to={filters.to} onChange={updateFilter} />
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:border-black xl:w-auto"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!exportConfig}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E20010] disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto"
          >
            <Download size={15} />
            Export
          </button>
          {hasDateRange ? (
            <button
              type="button"
              onClick={handleClearDateRange}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2.5 text-sm font-semibold text-[#4a4a4a] transition hover:border-black hover:text-black xl:w-auto"
            >
              <X size={15} />
              Clear Date Range
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-[#767676]">
          Anchored to latest review date: {data.anchorDateLabel}. Showing {data.periodRangeLabel}
          {hasDateRange ? ', narrowed by the custom date range above.' : '.'}
        </p>
      </Panel>

      {showExpertAnalysis && hasReviews ? <ExpertAnalysisPanel reviews={displayReviews} /> : null}

      {hasReviews ? (
        <>
          <Panel className="p-4 sm:p-6 lg:p-7">
            <SectionHeader eyebrow="Executive Summary" title="Guest Signal Snapshot" />

            <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <MessageSquareQuote size={18} className="text-[#767676]" />
                <p className="font-display mt-2 text-2xl font-semibold text-black">{score.total}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                  Reviews
                </p>
              </div>
              <div className="rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <ShieldCheck size={18} className="text-[#767676]" />
                <p className="font-display mt-2 text-2xl font-semibold text-black">
                  {score.actionableShare.toFixed(0)}%
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                  Actionable
                </p>
              </div>
              <div className="rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <Camera size={18} className="text-[#767676]" />
                <p className="font-display mt-2 text-2xl font-semibold text-black">{totalGuestImages}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                  Images
                </p>
              </div>
              <div className="rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <AlertTriangle size={18} className="text-[#767676]" />
                <p className="font-display mt-2 text-2xl font-semibold text-black">
                  {topCategory?.label || 'None'}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                  Risk Area
                </p>
              </div>
              <div className="rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <Target size={18} className="text-[#767676]" />
                <p className="font-display mt-2 text-base font-semibold leading-6 text-black">
                  {topCategory?.issueLabel || 'No leading concern yet'}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                  Top Concern
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-[8px] border border-[#f1c7cb] bg-[#fff9fa] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#E20010]">
                <Lightbulb size={18} />
              </span>
              <p className="font-display text-base font-semibold leading-6 text-black">
                {executiveInsight}
              </p>
            </div>
          </Panel>

          <Panel className="p-4 sm:p-6 lg:p-7">
            <SectionHeader
              eyebrow="Guest Sentiment Trend"
              title="Is Quality Getting Better or Worse Over Time?"
              description="Rolling 3-month average rating and low-star complaint volume, so leadership can see trajectory, not just a snapshot."
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <TrendDirectionBadge {...ratingDirection} />
              <TrendDirectionBadge {...volumeDirection} />
            </div>

            {hasTrendData ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                    Rolling Average Rating (1-3 star pool)
                  </p>
                  <div className="mt-3">
                    <TrendLine
                      data={ratingTrend}
                      type="line"
                      title="Rolling average rating trend"
                      lines={[{ dataKey: 'rollingAverage', stroke: trendPalette.negative, name: 'Rolling avg rating' }]}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                    Complaint Volume by Month
                  </p>
                  <div className="mt-3">
                    <TrendLine
                      data={monthlyTrend}
                      type="line"
                      title="Monthly complaint volume trend"
                      lines={[{ dataKey: 'total', stroke: trendPalette.neutral, name: 'Complaints' }]}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[18px] border border-[#e5e5e5] bg-[#fafafa] p-5 text-sm text-[#4a4a4a]">
                Not enough dated reviews in this selection to chart a trend. Try a broader time
                period or clear the date range.
              </div>
            )}
          </Panel>

          <Panel className="p-4 sm:p-6 lg:p-7">
            <SectionHeader eyebrow="Quality Priorities" title="Where Should We Focus First?" />

            <div className="mt-5 space-y-2">
              {categories.map((row) => {
                const isClickable = row.count > 0
                const isActive = highlightedCategory === row.key
                const content = (
                  <>
                    <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8a8a8]">
                        #{row.officialRank}
                      </span>
                      <p className={`min-w-0 truncate text-sm font-semibold ${isActive ? 'text-[#E20010]' : 'text-black'}`}>
                        {row.label}
                      </p>
                    </div>
                    <div className="h-3 w-full min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
                      <div
                        className="h-full rounded-full bg-[#E20010]"
                        style={{ width: `${row.barWidth}%` }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:w-40 sm:justify-end">
                      <span className={`text-sm font-semibold ${isActive ? 'text-[#E20010]' : 'text-black'}`}>
                        {row.count} review{row.count === 1 ? '' : 's'}
                      </span>
                      <span className="text-sm text-[#767676]">{row.sharePercent}%</span>
                    </div>
                    {isClickable ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#767676] transition group-hover:text-[#E20010] sm:w-28 sm:opacity-0 sm:group-hover:opacity-100">
                        View Evidence
                        <ArrowRight size={13} />
                      </span>
                    ) : null}
                  </>
                )

                if (!isClickable) {
                  return (
                    <div
                      key={row.key}
                      className="flex flex-col gap-2 rounded-2xl px-3 py-2 sm:flex-row sm:items-center sm:gap-4"
                    >
                      {content}
                    </div>
                  )
                }

                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => handleJumpToEvidence(row.key)}
                    className={`group flex w-full flex-col gap-2 rounded-2xl px-3 py-2 text-left transition sm:flex-row sm:items-center sm:gap-4 ${
                      isActive ? 'bg-[#fff5f6]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    {content}
                  </button>
                )
              })}
            </div>

            {topCategories.length ? (
              <div className="mt-5 rounded-[18px] border border-[#e5e5e5] bg-[#fafafa] p-5 text-sm leading-6 text-[#4a4a4a]">
                <span className="font-display font-semibold text-black">
                  {topCategoriesShare}% of all quality complaints
                </span>{' '}
                originate from the top {topCategories.length} categor
                {topCategories.length === 1 ? 'y' : 'ies'}.
              </div>
            ) : null}
          </Panel>

          <Panel className="p-4 sm:p-6 lg:p-7">
            <SectionHeader
              eyebrow="Visual Evidence"
              title="See the Issues Guests Are Reporting"
              description="Tap any photo to view it full-size alongside the guest's own words."
            />

            {evidenceCategories.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {evidenceCategories.map((row) => {
                  const Icon = row.icon
                  const isHighlighted = highlightedCategory === row.key
                  return (
                    <div
                      key={row.key}
                      id={`evidence-card-${row.key}`}
                      className={`flex h-full scroll-mt-28 flex-col rounded-[20px] border bg-white p-4 transition-all duration-700 sm:p-5 ${
                        isHighlighted
                          ? 'border-[#E20010] shadow-[0_0_0_4px_rgba(226,0,16,0.16),0_0_28px_rgba(226,0,16,0.35)]'
                          : 'border-[#e5e5e5]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fafafa] text-black">
                          {Icon ? <Icon size={16} /> : null}
                        </span>
                        <PriorityBadge priority={row.priority} compact />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-black">{row.label}</p>
                      <p className="mt-1 text-xs text-[#767676]">
                        {row.count} complaint{row.count === 1 ? '' : 's'} | {row.imageCount} photo
                        {row.imageCount === 1 ? '' : 's'}
                      </p>

                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                        Most Common Concern
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#4a4a4a]">{row.issueLabel}</p>

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, slotIndex) => {
                          const evidence = row.evidenceImages[slotIndex]
                          const remaining = row.imageCount - row.evidenceImages.length
                          const showMoreBadge = slotIndex === 3 && remaining > 0

                          if (!evidence) {
                            return (
                              <div
                                key={`placeholder-${slotIndex}`}
                                className="flex aspect-square items-center justify-center rounded-lg bg-[#fafafa] text-[#a8a8a8]"
                              >
                                <Camera size={16} />
                              </div>
                            )
                          }

                          return (
                            <button
                              key={evidence.key}
                              type="button"
                              onClick={() =>
                                setSelectedEvidence({ ...evidence, category: row.label })
                              }
                              className="relative aspect-square overflow-hidden rounded-lg border border-[#e5e5e5]"
                            >
                              <img
                                src={evidence.thumbnailUrl || evidence.url}
                                alt={row.label}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              {showMoreBadge ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold text-white">
                                  +{remaining} more
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-4 flex flex-1 flex-col items-stretch justify-end gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setGalleryModalCategory(row.key)}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e5e5e5] px-3 text-xs font-semibold text-black transition hover:border-black sm:flex-1"
                        >
                          <Images size={13} />
                          View Evidence
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewsModalCategory(row.key)}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#e5e5e5] px-3 text-xs font-semibold text-black transition hover:border-black sm:flex-1"
                        >
                          <MessageSquareQuote size={13} />
                          View All Reviews
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No quality evidence in this selection"
                  description="Try a broader time period, clear the date range, or choose a different product style."
                />
              </div>
            )}
          </Panel>

          <Panel className="p-4 sm:p-6 lg:p-7">
            <SectionHeader
              eyebrow="Factory Response Plan"
              title="Who Owns the Issue and What Should They Do?"
              description="Ranked by impact — the top card needs attention first."
            />

            {evidenceCategories.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {evidenceCategories.slice(0, 3).map((row) => {
                  const tier = roadmapTierFor(row.officialRank)
                  return (
                    <div
                      key={row.key}
                      className={`flex items-start gap-3 rounded-2xl border-l-4 ${tier.border} ${tier.tint} p-4`}
                    >
                      <span className="text-lg">{tier.emoji}</span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                          {tier.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-black">{row.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#4a4a4a]">
                          {shortenAction(row.recommendedAction)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((row, index) => (
                <div
                  key={row.key}
                  className={`flex h-full flex-col rounded-[20px] border p-4 sm:p-5 lg:rounded-[24px] lg:p-6 ${
                    index === 0 && row.count > 0
                      ? 'border-[#f1c7cb] bg-[#fff9fa]'
                      : 'border-[#e5e5e5] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display min-w-0 text-lg font-semibold text-black sm:text-xl">{row.label}</p>
                    <PriorityBadge priority={row.priority} compact />
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                    Issue
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#4a4a4a]">{row.issueLabel}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                        Complaints
                      </p>
                      <p className="mt-1 text-sm font-semibold text-black">{row.count}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#767676]">
                        Impact
                      </p>
                      <p className="mt-1 text-sm font-semibold text-black">{row.sharePercent}%</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-black p-4 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                      Owner
                    </p>
                    <p className="mt-1 text-base font-semibold">{row.owner}</p>
                  </div>

                  <div className="mt-3 flex-1 rounded-2xl border border-[#f1c7cb] bg-[#fff9fa] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b35900]">
                      Recommended Action
                    </p>
                    <p className="mt-1 text-sm leading-6 text-black">{row.recommendedAction}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel className="p-4 sm:p-6 lg:p-7">
          <EmptyState
            title="No low-star reviews in this selection"
            description="Try a broader time period, clear the date range, or choose a different product style."
          />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Link to="/gallery">
          <Panel className="p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Quick Link
            </p>
            <h3 className="font-display mt-3 text-xl font-semibold text-[#000000] sm:text-2xl">
              View Image Evidence Gallery
            </h3>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#4a4a4a]">
              Open the full customer photo gallery
              <ArrowRight size={15} />
            </p>
          </Panel>
        </Link>
        <Link to="/reviews">
          <Panel className="p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Quick Link
            </p>
            <h3 className="font-display mt-3 text-xl font-semibold text-[#000000] sm:text-2xl">
              Browse all reviews
            </h3>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#4a4a4a]">
              Open the review explorer
              <ArrowRight size={15} />
            </p>
          </Panel>
        </Link>
      </div>

      <EvidenceGalleryModal
        categoryLabel={galleryModalCategoryLabel}
        images={galleryModalImages}
        onClose={() => setGalleryModalCategory(null)}
        onImageClick={setSelectedEvidence}
      />

      <CategoryReviewsModal
        categoryLabel={reviewsModalCategoryLabel}
        reviews={reviewsModalReviews}
        onClose={() => setReviewsModalCategory(null)}
        onImageClick={setSelectedEvidence}
      />

      <EvidenceLightbox evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
    </div>
  )
}
