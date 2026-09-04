import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Factory,
  Gauge,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Star,
  Target,
} from 'lucide-react'
import Panel from '../primitives/Panel'
import { TIME_PERIOD_OPTIONS } from '../../data/constants'
import {
  buildResponseMetrics,
  calculateFactoryActionabilityScore,
  formatShortDate,
  getTopComplaintTheme,
  isWithinDateWindow,
  resolveDefectCategory,
  shiftDateByMonths,
} from '../../data/selectors'

export const SUMMARY_PERIOD_OPTIONS = [...TIME_PERIOD_OPTIONS].sort((left, right) => left.months - right.months)

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

function formatPercent(value) {
  return `${Math.round(value || 0)}%`
}

function getAverageRating(reviews) {
  if (!reviews.length) {
    return null
  }

  const sum = reviews.reduce((total, review) => total + (review.rating || 0), 0)
  return sum / reviews.length
}

function formatVolumeChange({ currentCount, previousCount, direction, periodNoun, deltaPercent }) {
  if (!previousCount) {
    return `No prior ${periodNoun} data to compare`
  }

  if (direction === 'stable') {
    return `Volume held steady at ${formatNumber(currentCount)} reviews vs prior ${periodNoun}`
  }

  const delta = Math.abs(currentCount - previousCount)
  const percent = Math.abs(Math.round(deltaPercent))

  if (previousCount < 10 || percent > 250) {
    return `Volume ${direction} by ${formatNumber(delta)} reviews vs prior ${periodNoun} (${formatNumber(previousCount)} to ${formatNumber(currentCount)})`
  }

  return `Volume ${direction} ${percent}% vs prior ${periodNoun} (${formatNumber(previousCount)} to ${formatNumber(currentCount)})`
}

export default function ExecutiveSummaryPanel({ data, periodValue, onPeriodChange }) {
  const selectedOption =
    SUMMARY_PERIOD_OPTIONS.find((option) => option.value === periodValue) || SUMMARY_PERIOD_OPTIONS[0]

  const windowEnd = new Date()
  const windowStart = shiftDateByMonths(windowEnd, -selectedOption.months)
  const previousWindowEnd = windowStart
  const previousWindowStart = shiftDateByMonths(windowStart, -selectedOption.months)
  const periodNoun = selectedOption.months === 1 ? '30-day' : `${selectedOption.months}mo`

  const currentWindowReviews = data.masterReviews.filter((review) =>
    isWithinDateWindow(review.reviewDate, windowStart, windowEnd),
  )
  const previousWindowReviews = data.masterReviews.filter((review) =>
    isWithinDateWindow(review.reviewDate, previousWindowStart, previousWindowEnd),
  )
  const currentWindowImages = data.imageItems.filter((item) =>
    isWithinDateWindow(item.reviewDate, windowStart, windowEnd),
  )

  const topTheme = getTopComplaintTheme(currentWindowReviews)
  const topThemeAction = topTheme ? resolveDefectCategory(topTheme.theme) : null
  const responseMetrics = buildResponseMetrics(currentWindowReviews)
  const averageRating = getAverageRating(currentWindowReviews)
  const actionability = calculateFactoryActionabilityScore(currentWindowReviews)

  const delta = currentWindowReviews.length - previousWindowReviews.length
  const deltaPercent = previousWindowReviews.length
    ? (delta / previousWindowReviews.length) * 100
    : 0
  const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stable'
  const TrendIcon = direction === 'increased' ? ArrowUpRight : direction === 'decreased' ? ArrowDownRight : Gauge

  const rangeLabel = `${formatShortDate(windowStart)} - ${formatShortDate(windowEnd)}`

  const stats = [
    { label: 'Low-star Reviews', value: formatNumber(currentWindowReviews.length), icon: Star },
    { label: 'Avg Rating', value: averageRating ? averageRating.toFixed(2) : 'N/A', icon: Gauge },
    { label: 'Factory Actionable', value: formatPercent(actionability.actionableShare), icon: Factory },
    { label: 'Photo Evidence', value: formatNumber(currentWindowImages.length), icon: Camera },
    { label: 'Brand Response', value: formatPercent(responseMetrics.responseRate), icon: ShieldCheck },
  ]

  const takeawayText = topTheme
    ? direction === 'increased'
      ? `Volume is rising - prioritize ${topTheme.theme} with ${topThemeAction?.owner || 'the owning team'} to reverse the trend.`
      : `${topTheme.theme} remains the leading risk - ${topThemeAction?.owner || 'the owning team'} can act now while volume is manageable.`
    : 'No dominant risk theme this period - continue routine monitoring.'

  const highlights = [
    {
      icon: TrendIcon,
      text: formatVolumeChange({
        currentCount: currentWindowReviews.length,
        previousCount: previousWindowReviews.length,
        direction,
        periodNoun,
        deltaPercent,
      }),
    },
    {
      icon: Ruler,
      text: topTheme
        ? `${topTheme.theme} leads at ${topTheme.share.toFixed(0)}% of low-star volume`
        : 'No single theme dominates this period',
    },
    {
      icon: Camera,
      text: `${formatNumber(currentWindowImages.length)} reviews carry photo proof`,
    },
  ]

  const insights = [
    {
      icon: Target,
      text: topThemeAction
        ? `${topTheme.theme} maps to ${topThemeAction.owner} - ready for action`
        : 'No defect group traced this period',
    },
    {
      icon: MessageCircle,
      text: `Brand responded to ${formatPercent(responseMetrics.responseRate)} of flagged reviews`,
    },
    {
      icon: Factory,
      text: `${formatPercent(actionability.actionableShare)} of complaints are vendor-ready`,
    },
  ]

  return (
    <Panel className="overflow-hidden rounded-[8px] !border-[#1a1a1a] !bg-black p-0 text-white">
      <div className="p-5 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Executive Summary
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold leading-[1.05] tracking-normal text-white sm:text-3xl">
              {rangeLabel}
            </h2>
          </div>

          <div
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1"
            data-tour="time-period"
          >
            {SUMMARY_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`min-w-10 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  option.value === periodValue
                    ? 'bg-[#E20010] text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-[8px] border border-[#E20010]/40 bg-[#E20010]/10 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E20010]">
            <Target size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Key Takeaway
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-white sm:text-base">{takeawayText}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-tour="kpi-stats">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-2 text-white/50">
                  <Icon size={14} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{stat.label}</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Key Highlights
            </p>
            <div className="mt-3 space-y-2.5">
              {highlights.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={index} className="flex items-start gap-2.5">
                    <Icon size={15} className="mt-0.5 shrink-0 text-[#E20010]" />
                    <p className="text-sm leading-6 text-white/85">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Key Insights
            </p>
            <div className="mt-3 space-y-2.5">
              {insights.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={index} className="flex items-start gap-2.5">
                    <Icon size={15} className="mt-0.5 shrink-0 text-[#E20010]" />
                    <p className="text-sm leading-6 text-white/85">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
