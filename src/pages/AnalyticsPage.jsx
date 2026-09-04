import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  Image as ImageIcon,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Panel from '../components/primitives/Panel'
import SectionHeader from '../components/primitives/SectionHeader'
import KpiTile from '../components/primitives/KpiTile'
import Skeleton from '../components/primitives/Skeleton'
import EmptyState from '../components/primitives/EmptyState'
import RatingBadge from '../components/primitives/RatingBadge'
import ThemeBarChart from '../components/charts/ThemeBarChart'
import TrendLine from '../components/charts/TrendLine'
import TimePeriodFilter from '../components/filters/TimePeriodFilter'
import { LOGO_PATH, severityPalette, themePalette } from '../data/constants'
import { formatShortDate, hasValue, sortReviews, truncateText } from '../data/selectors'
import { useDashboardDataset } from '../hooks/useDataset'
import { useExportRegistration } from '../hooks/useExport'

function Sparkline({ values = [] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-12 items-end gap-1">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="flex-1 rounded-full bg-[#d9d9d9]"
          style={{ height: `${Math.max((value / max) * 100, 12)}%` }}
        />
      ))}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-72 rounded-[20px]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-[20px]" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[380px] rounded-[20px]" />
      ))}
    </div>
  )
}

export default function Analytics() {
  const { data, loading, error } = useDashboardDataset(true)
  const exportConfig = useMemo(
    () =>
      data
        ? {
            fileName: 'lululemon-analytics.csv',
            rows: data.themeRows.map((item) => ({
              complaint_theme: item.theme,
              total_reviews: item.totalReviews,
              total_reviews_with_images: item.totalReviewsWithImages,
              total_images: item.totalImages,
              overall_share_percent: Number(item.overallShare.toFixed(1)),
              image_backed_share_percent: Number(item.imageBackedShare.toFixed(1)),
              interpretation: item.businessInterpretation,
            })),
            json: {
              themeRows: data.themeRows,
              groupRows: data.groupRows,
              responseMetrics: data.responseMetrics,
              ratingsDistribution: data.ratingsDistribution,
            },
          }
        : null,
    [data],
  )

  useExportRegistration(exportConfig)

  if (loading) {
    return <AnalyticsSkeleton />
  }

  if (error || !data) {
    return (
      <Panel className="p-4 text-sm text-[#4a4a4a] sm:p-8">
        Analytics could not load right now. Refresh the page and try again.
      </Panel>
    )
  }

  const sparklineValues = data.monthlyTrend.slice(-12).map((item) => item.total)
  const latestMonth = data.monthlyTrend.at(-1)
  const previousMonth = data.monthlyTrend.at(-2)
  const volumeDelta = latestMonth && previousMonth ? latestMonth.total - previousMonth.total : 0
  const topThemes = data.themeRows.slice(0, 4)
  const topThemeBreakdown = data.themeRows.slice(0, 5)
  const hasThemeData = data.themeRows.length > 0
  const hasTrendData = data.monthlyTrend.length > 0
  const hasRatingsData = data.ratingsDistribution.some((item) => item.count > 0)
  const recentCriticalReviews = sortReviews(data.masterReviews, 'lowest-rating').slice(0, 5)
  const imagePreviewItems = [...data.imageItems]
    .sort((left, right) => {
      const leftDate = new Date(left.reviewDate).getTime()
      const rightDate = new Date(right.reviewDate).getTime()
      return rightDate - leftDate
    })
    .slice(0, 4)
  const heroTitle = data.isAllProducts
    ? 'Cross-product guest signals reveal where quality, fit, and service issues cluster most.'
    : `${data.topComplaintTheme?.theme || 'Low-star feedback'} remains the clearest risk signal for ${data.selectedProductName}.`
  const heroDescription = data.isAllProducts
    ? 'Use the product selector to move from a portfolio view into a specific style. Every KPI, chart, review, and image preview below updates from the selected reporting period.'
    : data.masterReviews.length > 0
      ? `This view isolates ${data.selectedProductName} so teams can move from complaint concentration into theme, fit, response, review, and photo evidence without leaving the dashboard.`
      : 'Historical data is available for this product, but the selected period has no recent VOG activity.'
  const heroPills = [
    `Product / ${data.isAllProducts ? 'All Products' : data.selectedProductName}`,
    `Period / ${data.selectedTimePeriod}`,
    `Evidence / ${data.masterReviews.length} low-star reviews + ${data.imageItems.length} customer images`,
  ]

  return (
    <div className="space-y-8">
      <Panel className="p-4 sm:p-5">
        <TimePeriodFilter
          meta={`Anchored to latest review date: ${data.anchorDateLabel}. Showing ${data.periodRangeLabel}.`}
        />
      </Panel>

      <Panel className="story-grid overflow-hidden p-4 sm:p-6 lg:p-8">
        <SectionHeader
          eyebrow="Executive Summary"
          title={heroTitle}
          description={heroDescription}
          titlePrefix={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-white">
              <img
                src={LOGO_PATH}
                alt="lululemon logo"
                className="h-10 w-10 rounded-full object-contain"
              />
            </span>
          }
        />
        <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
          {heroPills.map((item) => (
            <span
              key={item}
              className="max-w-full break-words rounded-full border border-[#e5e5e5] bg-white px-3 py-2 text-xs text-[#4a4a4a] sm:px-4 sm:text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </Panel>

      {!data.isAllProducts && data.masterReviews.length === 0 ? (
        <Panel className="border-[#f1c7cb] bg-[#fff9fa] p-4 text-sm font-medium leading-7 text-[#4a4a4a] sm:p-6">
          Historical data available. No recent VOG activity in the selected period.
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label="Total Low-Star Reviews"
          value={data.masterReviews.length}
          note={`Low-star volume across all 1-star, 2-star, and 3-star ${data.isAllProducts ? 'product styles' : `${data.selectedProductName} reviews`}.`}
          delta={{
            tone: volumeDelta > 0 ? 'negative' : volumeDelta < 0 ? 'positive' : 'neutral',
            label: `${volumeDelta > 0 ? '+' : ''}${volumeDelta} vs prior month`,
          }}
          sparkline={<Sparkline values={sparklineValues} />}
          icon={Workflow}
        />
        <KpiTile
          label="Average Rating"
          value={data.averageRating || 'No data'}
          note="Average rating across low-star reviews in the selected period."
          delta={{
            tone: 'neutral',
            label: `Current month ${latestMonth?.averageRating || 0}`,
          }}
          icon={Sparkles}
        />
        <KpiTile
          label="Top Complaint Theme"
          value={data.topComplaintTheme?.theme || 'No data'}
          note={`${data.topComplaintTheme?.share?.toFixed(1) || '0.0'}% of all low-star reviews fall under the leading complaint theme.`}
          icon={ShieldCheck}
        />
        <KpiTile
          label="Top Image-Backed Complaint Theme"
          value={data.topImageBackedTheme?.theme || 'No image-backed reviews'}
          note={`${data.topImageBackedTheme?.share?.toFixed(1) || '0.0'}% of image-backed complaints sit in the leading theme.`}
          icon={ImageIcon}
        />
        <KpiTile
          label="Photo-Backed Reviews"
          value={data.photoBackedStats.count}
          note={`${data.photoBackedStats.share.toFixed(1)}% of low-star reviews include customer-submitted image evidence.`}
          icon={Camera}
        />
        <KpiTile
          label="Brand Response Rate"
          value={`${data.responseMetrics.responseRate.toFixed(1)}%`}
          note={`${data.responseMetrics.respondedCount} low-star reviews received visible brand replies.`}
          icon={MessageSquareQuote}
        />
      </div>

      {data.isAllProducts ? (
        <div className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
          <Panel className="p-4 sm:p-6 lg:p-8">
            <SectionHeader
              eyebrow="Product Comparison"
              title="Low-star review concentration can now be compared across product styles."
              description="When multiple styles are loaded through the pipeline, this comparison layer helps teams see which products generate the heaviest low-star burden first."
            />
            {data.comparisonBarData.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="No recent product activity"
                  description="Historical data is available, but no low-star reviews fall inside the selected period."
                />
              </div>
            ) : null}
            {data.comparisonBarData.length ? (
              <div className="mt-6 h-[300px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={260}>
                <BarChart data={data.comparisonBarData} margin={{ top: 8, right: 20, left: 8, bottom: 32 }}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="productName"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#767676', fontSize: 12 }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#767676', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e5e5',
                      borderRadius: 16,
                    }}
                    formatter={(value, _name, item) => [
                      `${value} low-star reviews`,
                      item?.payload?.topComplaintTheme
                        ? `Top theme: ${item.payload.topComplaintTheme}`
                        : 'Low-star reviews',
                    ]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload
                      if (!row) {
                        return label
                      }

                      return `${label} • ${row.totalReviews} total reviews`
                    }}
                  />
                  <Bar
                    dataKey="lowStarReviews"
                    radius={[12, 12, 0, 0]}
                    fill="#1a1a1a"
                    isAnimationActive={false}
                  >
                    {data.comparisonBarData.map((row, index) => (
                      <Cell
                        key={row.productName}
                        fill={index === 0 ? '#E20010' : themePalette[Math.min(index + 1, themePalette.length - 1)]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : null}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="p-4 sm:p-6 lg:p-8">
              <SectionHeader
                eyebrow="Product Comparison Table"
                title="Product-level summary"
                description="Every product added to the pipeline appears here automatically after the next export run."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] text-left">
                <thead className="bg-white text-[11px] uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                  <tr>
                    <th className="min-w-40 px-5 py-4">Product Name</th>
                    <th className="min-w-28 px-5 py-4">Category</th>
                    <th className="min-w-24 px-5 py-4">Total Reviews</th>
                    <th className="min-w-24 px-5 py-4">Low-Star Reviews</th>
                    <th className="min-w-20 px-5 py-4">1-Star</th>
                    <th className="min-w-20 px-5 py-4">2-Star</th>
                    <th className="min-w-20 px-5 py-4">3-Star</th>
                    <th className="min-w-24 px-5 py-4">Reviews With Images</th>
                    <th className="min-w-24 px-5 py-4">Total Images</th>
                    <th className="min-w-40 px-5 py-4">Top Complaint Theme</th>
                    <th className="min-w-24 px-5 py-4">Top Complaint Share</th>
                    <th className="min-w-64 px-5 py-4">Period Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparisonRows.map((row, index) => (
                    <tr
                      key={row.productId}
                      className={`border-t border-[#f0f0f0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}
                    >
                      <td className="min-w-40 px-5 py-4 font-medium text-[#000000]">{row.productName}</td>
                      <td className="min-w-28 px-5 py-4 text-[#4a4a4a]">{row.category || '-'}</td>
                      <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{row.totalReviews}</td>
                      <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{row.lowStarReviews}</td>
                      <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{row.oneStarReviews}</td>
                      <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{row.twoStarReviews}</td>
                      <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{row.threeStarReviews}</td>
                      <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{row.reviewsWithImages}</td>
                      <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{row.totalImages}</td>
                      <td className="min-w-40 px-5 py-4 text-[#4a4a4a]">{row.topComplaintTheme || '-'}</td>
                      <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">
                        {row.topComplaintShare ? `${row.topComplaintShare.toFixed(1)}%` : '-'}
                      </td>
                      <td className="min-w-64 px-5 py-4 text-[#4a4a4a]">
                        {row.statusMessage || 'Active VOG signal in selected period.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
        <Panel className="p-4 sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="Complaint Themes"
            title="Complaint concentration makes the highest-priority themes hard to ignore."
            description="Distinct theme colors separate the issue types clearly so the leading signals are presentation-ready at a glance."
          />
          <div className="mt-6">
            {hasThemeData ? (
              <ThemeBarChart
                data={data.themeRows}
                dataKey="totalReviews"
                percentageKey="overallShare"
                title="Complaint themes ranked by low-star review count"
              />
            ) : (
              <div className="rounded-[20px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#4a4a4a] sm:p-6">
                No complaint themes found for the selected product and time period.
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Theme Share Breakdown
            </p>
            <div className="mt-4 space-y-4">
              {topThemeBreakdown.length ? (
                topThemeBreakdown.map((theme, index) => (
                  <div key={theme.slug}>
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${index === 0 ? 'text-[#E20010]' : 'text-[#000000]'}`}
                        >
                          {theme.theme}
                        </p>
                        <p className="mt-1 text-xs text-[#767676]">
                          {theme.totalReviews} reviews
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-semibold ${index === 0 ? 'text-[#E20010]' : 'text-[#4a4a4a]'}`}
                      >
                        {theme.overallShare.toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(theme.overallShare, 8)}%`,
                          backgroundColor: index === 0 ? '#E20010' : theme.fill,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#4a4a4a]">
                  No theme share is available for this selection.
                </p>
              )}
            </div>
          </Panel>

          <Panel className="p-4 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Priority Readout
            </p>
            <div className="mt-4 space-y-4">
              {topThemes.length ? (
                topThemes.map((theme) => (
                  <div key={theme.slug}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-sm font-medium text-[#000000]">{theme.theme}</p>
                      <p className="text-sm text-[#4a4a4a]">{theme.totalReviews} reviews</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(theme.overallShare, 8)}%`,
                          backgroundColor: theme.fill,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#4a4a4a]">
                  No priority readout is available for this selection.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="p-4 sm:p-6 lg:p-8">
        <SectionHeader
          eyebrow="Monthly Trend"
          title="Low-star signal volume by review month."
          description="The trend view shows whether recent guest dissatisfaction is rising, stabilizing, or concentrating in specific severity bands."
        />
        <div className="mt-6">
          {hasTrendData ? (
            <TrendLine
              data={data.monthlyTrend}
              type="area"
              title="Monthly low-star review trend"
              areas={[
                { dataKey: 'oneStar', stroke: severityPalette[1], fill: severityPalette[1] },
                { dataKey: 'twoStar', stroke: severityPalette[2], fill: severityPalette[2] },
                { dataKey: 'threeStar', stroke: severityPalette[3], fill: severityPalette[3] },
              ]}
            />
          ) : (
            <div className="rounded-[20px] border border-[#e5e5e5] bg-[#fafafa] p-6 text-sm text-[#4a4a4a]">
              No monthly trend is available for the selected period.
            </div>
          )}
        </div>
      </Panel>

      <div className="grid gap-5">
        <Panel className="p-4 sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="Ratings Distribution"
            title="Most evidence sits in severe dissatisfaction, but mixed frustration remains meaningful."
            description="The low-star pool is still anchored by 1-star reviews, while 3-star reviews help show expectation gaps that do not always lead to total rejection."
          />
          {hasRatingsData ? (
            <>
              <div className="mt-6 h-[300px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={260}>
                  <PieChart>
                    <Pie
                      data={data.ratingsDistribution}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={74}
                      outerRadius={120}
                      paddingAngle={3}
                      isAnimationActive={false}
                    >
                      {data.ratingsDistribution.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e5e5',
                        borderRadius: 16,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.ratingsDistribution.map((entry) => (
                  <span
                    key={entry.label}
                    className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-sm text-[#4a4a4a]"
                  >
                    {entry.label}: {entry.count}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[20px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#4a4a4a] sm:p-6">
              No rating distribution is available for the selected period.
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-4 sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="Image Evidence Preview"
            title="Customer photos show what text alone can miss."
            description="Image-backed reviews are filtered to the same product and time period, keeping visual evidence aligned with the executive readout."
          />
          {imagePreviewItems.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {imagePreviewItems.map((item) => (
                <Link
                  key={item.key}
                  to="/gallery"
                  className="overflow-hidden rounded-[20px] border border-[#e5e5e5] bg-white transition hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                >
                  <div className="aspect-[4/3] bg-[#f5f5f5]">
                    <img
                      src={item.thumbnailUrl || item.imageUrl}
                      alt={item.reviewTitle}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <RatingBadge rating={item.rating} compact />
                      <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                        {item.complaintTheme}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-black">
                      {item.reviewTitle}
                    </p>
                    <p className="text-xs text-[#767676]">{formatShortDate(item.reviewDate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[20px] border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#4a4a4a] sm:p-6">
              No image-backed reviews found for this selection.
            </div>
          )}
        </Panel>

        <Panel className="p-4 sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="Recent Critical Reviews"
            title="Review-level evidence keeps the signal grounded."
            description="The most severe recent reviews are kept close to the KPI layer so teams can inspect the guest language behind the signal."
          />
          <div className="mt-6 space-y-3">
            {recentCriticalReviews.length ? (
              recentCriticalReviews.map((review) => (
                <Link
                  key={review.key}
                  to={`/reviews?id=${review.reviewId}&expand=true`}
                  className="block rounded-[20px] border border-[#e5e5e5] bg-white p-4 transition hover:border-black"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingBadge rating={review.rating} compact />
                    <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                      {review.productName}
                    </span>
                    <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                      {review.complaintTheme}
                    </span>
                    {review.hasImageEvidence ? (
                      <span className="rounded-full bg-[#ffe5e8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E20010]">
                        Photo
                      </span>
                    ) : null}
                    {hasValue(review.luluResponseText) ? (
                      <span className="rounded-full bg-[#edf6f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f6f3e]">
                        Response
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-black">{review.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">
                    {truncateText(review.reviewText, 150)}
                  </p>
                  <p className="mt-2 text-xs text-[#767676]">
                    {formatShortDate(review.reviewDate)}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-[20px] border border-[#e5e5e5] bg-[#fafafa] p-6 text-sm text-[#4a4a4a]">
                No recent critical reviews found for this selection.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-8">
          <SectionHeader
            eyebrow="Category Detail Table"
            title="Theme-by-theme complaint detail remains the reference layer."
            description="This reference table keeps the full complaint breakdown visible for appendix-level review."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[820px] text-left">
            <thead className="bg-white text-[11px] uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              <tr>
                <th className="min-w-48 px-5 py-4">Complaint Theme</th>
                <th className="min-w-24 px-5 py-4">Low-Star Reviews</th>
                <th className="min-w-24 px-5 py-4">Image-Backed Reviews</th>
                <th className="min-w-20 px-5 py-4">1-Star Images</th>
                <th className="min-w-20 px-5 py-4">2-Star Images</th>
                <th className="min-w-20 px-5 py-4">3-Star Images</th>
                <th className="min-w-20 px-5 py-4">Share %</th>
              </tr>
            </thead>
            <tbody>
              {data.themeRows.length ? (
                data.themeRows.map((theme) => (
                  <tr key={theme.slug} className="border-t border-[#f0f0f0]">
                    <td className="min-w-48 px-5 py-4 font-medium text-[#000000]">{theme.theme}</td>
                    <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{theme.totalReviews}</td>
                    <td className="min-w-24 px-5 py-4 text-[#4a4a4a]">{theme.totalReviewsWithImages}</td>
                    <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{theme.oneStarImages}</td>
                    <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{theme.twoStarImages}</td>
                    <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{theme.threeStarImages}</td>
                    <td className="min-w-20 px-5 py-4 text-[#4a4a4a]">{theme.share.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-[#f0f0f0]">
                  <td colSpan={7} className="px-5 py-6 text-sm text-[#4a4a4a]">
                    No category detail is available for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
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
        <Link to="/gallery">
          <Panel className="p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Quick Link
            </p>
            <h3 className="font-display mt-3 text-xl font-semibold text-[#000000] sm:text-2xl">
              View image evidence
            </h3>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#4a4a4a]">
              Open the customer photo gallery
              <ArrowRight size={15} />
            </p>
          </Panel>
        </Link>
      </div>
    </div>
  )
}
