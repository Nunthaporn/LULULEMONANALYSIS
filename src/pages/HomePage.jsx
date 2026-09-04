import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Factory,
  Gauge,
  Image as ImageIcon,
  MessageSquareQuote,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import ExecutiveSummaryPanel from '../components/home/ExecutiveSummaryPanel'
import MonthlyNarrativePanel from '../components/home/MonthlyNarrativePanel'
import Panel from '../components/primitives/Panel'
import SectionHeader from '../components/primitives/SectionHeader'
import Skeleton from '../components/primitives/Skeleton'
import { LOGO_PATH } from '../data/constants'
import { buildVolumeTrend, formatShortDate, truncateText } from '../data/selectors'
import { useDashboardDataset } from '../hooks/useDataset'

function resolveTrendCopy(volumeTrend) {
  const percent = Math.abs(Math.round(volumeTrend.deltaPercent || 0))
  const delta = Math.abs(volumeTrend.delta || 0)
  const movementCopy =
    percent > 250
      ? `${delta} more low-star reviews than the prior month.`
      : `${percent}% increase versus the prior month.`

  if (volumeTrend.direction === 'increased') {
    return {
      label: 'Complaint volume rising',
      tone: 'negative',
      icon: TrendingUp,
      copy: movementCopy,
    }
  }

  if (volumeTrend.direction === 'decreased') {
    const easingCopy =
      percent > 250
        ? `${delta} fewer low-star reviews than the prior month.`
        : `${percent}% decrease versus the prior month.`

    return {
      label: 'Complaint volume easing',
      tone: 'positive',
      icon: TrendingDown,
      copy: easingCopy,
    }
  }

  return {
    label: 'Complaint volume steady',
    tone: 'neutral',
    icon: Gauge,
    copy: 'No material movement versus the prior month.',
  }
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[520px] rounded-[8px]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-[8px]" />
        ))}
      </div>
    </div>
  )
}

const destinationCards = [
  {
    title: 'Insights',
    to: '/insights',
    text: 'Executive guest-to-factory view with defect groups, operational risk, and action ownership.',
    icon: Factory,
  },
  {
    title: 'Analytics',
    to: '/analytics',
    text: 'Full analytical dashboard for trends, themes, ratings, and product comparison.',
    icon: BarChart3,
  },
  {
    title: 'Reviews',
    to: '/reviews',
    text: 'Searchable review evidence for analyst follow-up and root-cause reading.',
    icon: MessageSquareQuote,
  },
  {
    title: 'Gallery',
    to: '/gallery',
    text: 'Customer image evidence connected to low-star reviews and complaint themes.',
    icon: ImageIcon,
  },
]

export default function HomePage() {
  const { data, loading, error } = useDashboardDataset(true)
  const [summaryPeriod, setSummaryPeriod] = useState('1M')

  if (loading) {
    return <HomeSkeleton />
  }

  if (error || !data) {
    return (
      <Panel className="p-6">
        <SectionHeader
          eyebrow="Dashboard unavailable"
          title="The executive brief could not load."
          description={error?.message || 'Please retry after the dashboard data is available.'}
        />
      </Panel>
    )
  }

  const volumeTrend = buildVolumeTrend(data.monthlyTrend)
  const trend = resolveTrendCopy(volumeTrend)
  const TrendIcon = trend.icon
  const topRisk = data.topComplaintTheme
  const topProduct = data.comparisonRows?.[0]
  const latestReview = [...data.masterReviews]
    .sort((left, right) => new Date(right.reviewDate || 0) - new Date(left.reviewDate || 0))
    .at(0)

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[8px] border border-[#e5e5e5] bg-black text-white">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0 px-5 py-8 sm:px-8 sm:py-10 lg:px-10 xl:px-12">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <img src={LOGO_PATH} alt="lululemon logo" className="h-11 w-11 rounded-full object-contain" />
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                Executive Intelligence Brief
              </span>
            </div>

            <h1 className="mt-8 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-normal sm:text-5xl lg:text-6xl xl:text-7xl">
              Voice of Guest – Quality Improvement Opportunity.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/72 sm:text-lg">
              A leadership view of guest dissatisfaction, product risk, evidence strength, and factory-actionable defect patterns.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/insights"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E20010] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c4000e]"
              >
                Open Insights
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/analytics"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
              >
                View Analytics
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.04] p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
            <div className="rounded-[8px] border border-white/10 bg-white p-5 text-black shadow-2xl sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                    Board readout
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight">
                    {topRisk?.theme || 'No dominant risk theme'}
                  </h2>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe5e8] text-[#E20010]">
                  <ShieldAlert size={21} />
                </span>
              </div>
              <p className="mt-5 text-sm leading-7 text-[#4a4a4a]">
                {topRisk?.theme
                  ? `${topRisk.theme} accounts for ${topRisk.share.toFixed(1)}% of selected low-star reviews.`
                  : 'No low-star review theme is large enough to call out for this selection.'}
              </p>

              <div className="mt-5 rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="flex items-center gap-3">
                  <TrendIcon
                    size={18}
                    className={
                      trend.tone === 'positive'
                        ? 'text-[#1f6f3e]'
                        : trend.tone === 'negative'
                          ? 'text-[#E20010]'
                          : 'text-[#767676]'
                    }
                  />
                  <p className="text-sm font-semibold text-black">{trend.label}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">{trend.copy}</p>
              </div>

              {topProduct ? (
                <div className="mt-5 grid gap-3 border-t border-[#e5e5e5] pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                      Highest impact product
                    </p>
                    <p className="mt-1 text-sm font-semibold text-black">{topProduct.productName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                      Latest signal
                    </p>
                    <p className="mt-1 text-sm font-semibold text-black">
                      {latestReview ? formatShortDate(latestReview.reviewDate) : 'No recent review'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <ExecutiveSummaryPanel
        data={data}
        periodValue={summaryPeriod}
        onPeriodChange={setSummaryPeriod}
      />

      <MonthlyNarrativePanel data={data} />

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Leadership takeaway"
            title="Focus the next quality conversation on evidence-backed risk."
            description="The highest-value path is not more reporting. It is connecting guest signals to the product, quality, and operations owners who can reduce recurrence."
          />
          {latestReview ? (
            <div className="mt-6 rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                Recent guest signal
              </p>
              <p className="mt-3 text-base font-semibold text-black">{latestReview.title}</p>
              <p className="mt-2 text-sm leading-7 text-[#4a4a4a]">
                {truncateText(latestReview.reviewText, 220)}
              </p>
            </div>
          ) : null}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2" data-tour="destination-cards">
          {destinationCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.to} to={card.to} className="group">
                <Panel className="h-full p-5 transition duration-300 group-hover:-translate-y-1 group-hover:border-black group-hover:shadow-[0_18px_44px_rgba(0,0,0,0.08)] sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f5] text-black">
                      <Icon size={19} />
                    </span>
                    <ArrowRight size={17} className="mt-3 text-[#767676] transition group-hover:translate-x-1 group-hover:text-[#E20010]" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-black">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4a4a4a]">{card.text}</p>
                </Panel>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
