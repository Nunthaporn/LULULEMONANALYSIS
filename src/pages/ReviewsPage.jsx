import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import Panel from '../components/primitives/Panel'
import SectionHeader from '../components/primitives/SectionHeader'
import EmptyState from '../components/primitives/EmptyState'
import Skeleton from '../components/primitives/Skeleton'
import RatingBadge from '../components/primitives/RatingBadge'
import ImageLightbox from '../components/ImageLightbox'
import FilterBar from '../components/filters/FilterBar'
import ThemeMultiSelect from '../components/filters/ThemeMultiSelect'
import DateRangePicker from '../components/filters/DateRangePicker'
import TimePeriodFilter from '../components/filters/TimePeriodFilter'
import { ALL_FILTER_VALUE, LOGO_PATH } from '../data/constants'
import {
  filterReviews,
  formatShortDate,
  hasValue,
  sortReviews,
  truncateText,
} from '../data/selectors'
import { useDashboardDataset } from '../hooks/useDataset'
import { useExportRegistration } from '../hooks/useExport'
import { useFilters } from '../hooks/useFilters'
import { useProductFilter } from '../context/ProductFilterContext'

const ROWS_PER_PAGE = 25

const columnDefinitions = [
  { key: 'rating', label: 'Rating' },
  { key: 'date', label: 'Date' },
  { key: 'product', label: 'Product' },
  { key: 'theme', label: 'Theme' },
  { key: 'reviewId', label: 'Review ID' },
  { key: 'title', label: 'Title' },
  { key: 'text', label: 'Review Text' },
  { key: 'fit', label: 'Fit Feedback' },
  { key: 'images', label: 'Photo' },
  { key: 'response', label: 'Lululemon Response' },
]

export default function Reviews() {
  const { selectedProductId, selectedProductName, selectedTimePeriod, selectedRegion, regionOptions } =
    useProductFilter()
  const selectedRegionLabel =
    regionOptions.find((option) => option.value === selectedRegion)?.label || selectedRegion
  const { data, loading, error } = useDashboardDataset(true)
  const { filters, updateFilter, resetFilters } = useFilters({
    rating: ALL_FILTER_VALUE,
    themes: [],
    verified: ALL_FILTER_VALUE,
    from: '',
    to: '',
    sort: 'newest',
  })
  const [searchParams] = useSearchParams()
  const [expandedIds, setExpandedIds] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxImage, setLightboxImage] = useState(null)
  const productChangeRef = useRef(false)
  const [visibleColumns, setVisibleColumns] = useState(
    Object.fromEntries(columnDefinitions.map((column) => [column.key, true])),
  )

  const filteredReviews = useMemo(() => {
    if (!data) {
      return []
    }

    return sortReviews(filterReviews(data.masterReviews, filters), filters.sort)
  }, [data, filters])
  const exportConfig = useMemo(
    () =>
      data
        ? {
            fileName: `lululemon-reviews-${selectedProductId}.csv`,
            rows: filteredReviews,
            json: filteredReviews,
          }
        : null,
    [data, filteredReviews, selectedProductId],
  )

  useExportRegistration(exportConfig)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) {
        return
      }

      setCurrentPage(1)
      setSelectedIndex(0)
    })

    return () => {
      active = false
    }
  }, [filters, selectedTimePeriod])

  useEffect(() => {
    if (!productChangeRef.current) {
      productChangeRef.current = true
      return
    }

    queueMicrotask(() => {
      resetFilters()
      setExpandedIds([])
      setCurrentPage(1)
      setSelectedIndex(0)
    })
  }, [resetFilters, selectedProductId])

  useEffect(() => {
    const targetId = searchParams.get('id')
    const expand = searchParams.get('expand') === 'true'

    if (!targetId || !expand || filteredReviews.length === 0) {
      return
    }

    const rowIndex = filteredReviews.findIndex((review) => review.reviewId === targetId)
    if (rowIndex === -1) {
      return
    }

    let active = true
    queueMicrotask(() => {
      if (!active) {
        return
      }

      setExpandedIds((current) => (current.includes(targetId) ? current : [...current, targetId]))
      setCurrentPage(Math.floor(rowIndex / ROWS_PER_PAGE) + 1)
      setSelectedIndex(rowIndex % ROWS_PER_PAGE)
    })

    return () => {
      active = false
    }
  }, [filteredReviews, searchParams])

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / ROWS_PER_PAGE))
  const paginatedRows = filteredReviews.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )

  useEffect(() => {
    function handleKeydown(event) {
      const tagName = document.activeElement?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tagName)) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) => Math.min(index + 1, Math.max(paginatedRows.length - 1, 0)))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => Math.max(index - 1, 0))
      }
      if (event.key === 'ArrowRight') {
        const selected = paginatedRows[selectedIndex]
        if (!selected) {
          return
        }

        setExpandedIds((current) =>
          current.includes(selected.reviewId) ? current : [...current, selected.reviewId],
        )
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [paginatedRows, selectedIndex])

  if (loading) {
    return <Skeleton className="h-[760px] rounded-[20px]" />
  }

  if (error || !data) {
    return (
      <Panel className="p-4 text-sm text-[#4a4a4a] sm:p-8">
        Reviews explorer could not load.
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      <Panel className="p-4 sm:p-6 lg:p-8">
        <Link to="/analytics" className="text-sm text-[#767676] hover:text-[#000000]">
          {'<- Back to Analytics'}
        </Link>
        <SectionHeader
          eyebrow="Reviews Explorer"
          title="Browse the full low-star review set."
          description={`Filter, sort, and expand low-star reviews for ${
            selectedProductId === 'all' ? 'all loaded lululemon product styles' : selectedProductName
          } in the ${selectedRegionLabel} region, with image evidence and brand-response context attached when available.`}
          className="mt-4"
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
      </Panel>

      <FilterBar>
        <div className="w-full">
          <TimePeriodFilter
            meta={`Selected period: ${data.selectedTimePeriod}. Showing ${data.periodRangeLabel}.`}
          />
        </div>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.3fr)_minmax(140px,0.8fr)_minmax(260px,1fr)_minmax(140px,0.8fr)]">
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Rating
            </span>
            <select
              value={filters.rating}
              onChange={(event) => updateFilter('rating', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value={ALL_FILTER_VALUE}>All Ratings</option>
              <option value="1">1 Star</option>
              <option value="2">2 Star</option>
              <option value="3">3 Star</option>
            </select>
          </label>
          <ThemeMultiSelect
            value={filters.themes}
            options={data.themeOptions}
            onChange={(value) => updateFilter('themes', value)}
          />
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Verified
            </span>
            <select
              value={filters.verified}
              onChange={(event) => updateFilter('verified', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value={ALL_FILTER_VALUE}>All</option>
              <option value="true">Verified only</option>
              <option value="false">Unverified only</option>
            </select>
          </label>
          <DateRangePicker from={filters.from} to={filters.to} onChange={updateFilter} />
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Sort
            </span>
            <select
              value={filters.sort}
              onChange={(event) => updateFilter('sort', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="helpful">Most helpful</option>
              <option value="lowest-rating">Lowest rating</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex w-full items-center justify-end border-t border-[#f0f0f0] pt-3">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000] hover:border-black"
          >
            Clear Filters
          </button>
        </div>
      </FilterBar>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-[#f0f0f0] px-4 py-4 text-sm text-[#4a4a4a] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <p>
            Showing <span className="font-semibold text-[#000000]">{filteredReviews.length}</span> of{' '}
            <span className="font-semibold text-[#000000]">{data.masterReviews.length}</span>{' '}
            low-star reviews in {data.selectedTimePeriod} &middot; {selectedRegionLabel}
          </p>
          <p>
            Page {currentPage} of {totalPages}
          </p>
        </div>

        {paginatedRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No reviews found for this selection"
              description="Try a broader time period, adjust the product selector, or clear the local review filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] text-left">
              <thead className="bg-white text-[11px] uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                <tr>
                  {visibleColumns.rating ? (
                    <th className="min-w-24 px-4 py-4 sm:px-5">Rating</th>
                  ) : null}
                  {visibleColumns.date ? (
                    <th className="min-w-28 px-4 py-4 sm:px-5">Date</th>
                  ) : null}
                  {visibleColumns.product ? (
                    <th className="min-w-48 px-4 py-4 sm:px-5">Product</th>
                  ) : null}
                  {visibleColumns.theme ? (
                    <th className="min-w-40 px-4 py-4 sm:px-5">Theme</th>
                  ) : null}
                  {visibleColumns.reviewId ? (
                    <th className="min-w-24 px-4 py-4 sm:px-5">Review ID</th>
                  ) : null}
                  {visibleColumns.title ? (
                    <th className="min-w-40 px-4 py-4 sm:px-5">Title</th>
                  ) : null}
                  {visibleColumns.text ? (
                    <th className="min-w-72 px-4 py-4 sm:px-5">Review Text</th>
                  ) : null}
                  {visibleColumns.fit ? (
                    <th className="min-w-40 px-4 py-4 sm:px-5">Fit Feedback</th>
                  ) : null}
                  {visibleColumns.images ? (
                    <th className="min-w-24 px-4 py-4 sm:px-5">Photo</th>
                  ) : null}
                  {visibleColumns.response ? (
                    <th className="min-w-32 px-4 py-4 sm:px-5">Lululemon Response</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((review, index) => {
                  const expanded = expandedIds.includes(review.reviewId)
                  const selected = index === selectedIndex

                  return (
                    <Fragment key={review.key}>
                      <tr
                        className={`border-t border-[#f0f0f0] align-top transition ${
                          selected ? 'bg-[#f5f5f5]' : index % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
                        }`}
                      >
                        {visibleColumns.rating ? (
                          <td className="min-w-24 px-4 py-4 sm:px-5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((current) =>
                                  current.includes(review.reviewId)
                                    ? current.filter((item) => item !== review.reviewId)
                                    : [...current, review.reviewId],
                                )
                              }
                              className="flex items-center gap-2"
                            >
                              <RatingBadge rating={review.rating} compact />
                              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </td>
                        ) : null}
                        {visibleColumns.date ? (
                          <td className="min-w-28 px-4 py-4 text-sm text-[#4a4a4a] sm:px-5">
                            {formatShortDate(review.reviewDate)}
                          </td>
                        ) : null}
                        {visibleColumns.product ? (
                          <td className="min-w-48 px-4 py-4 text-sm font-medium text-[#000000] sm:px-5">
                            {review.productName || '-'}
                          </td>
                        ) : null}
                        {visibleColumns.theme ? (
                          <td className="min-w-40 px-4 py-4 sm:px-5">
                            <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.16em]">
                              {review.complaintTheme}
                            </span>
                          </td>
                        ) : null}
                        {visibleColumns.reviewId ? (
                          <td className="min-w-24 px-4 py-4 text-sm text-[#4a4a4a] sm:px-5">
                            {review.reviewId}
                          </td>
                        ) : null}
                        {visibleColumns.title ? (
                          <td className="min-w-40 px-4 py-4 font-medium text-[#000000] sm:px-5">
                            {review.title || 'Untitled review'}
                          </td>
                        ) : null}
                        {visibleColumns.text ? (
                          <td className="min-w-72 max-w-xl px-4 py-4 text-sm leading-7 text-[#4a4a4a] sm:px-5">
                            {truncateText(review.reviewText, 160)}
                          </td>
                        ) : null}
                        {visibleColumns.fit ? (
                          <td className="min-w-40 px-4 py-4 text-sm text-[#4a4a4a] sm:px-5">
                            {review.fitFeedback || 'Not specified'}
                          </td>
                        ) : null}
                        {visibleColumns.images ? (
                          <td className="px-4 py-4 sm:px-5">
                            {review.hasImageEvidence ? (
                              <span className="rounded-full bg-[#ffe5e8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E20010] sm:tracking-[0.16em]">
                                Photo
                              </span>
                            ) : (
                              <span className="text-sm text-[#767676]">No photo</span>
                            )}
                          </td>
                        ) : null}
                        {visibleColumns.response ? (
                          <td className="px-4 py-4 sm:px-5">
                            {hasValue(review.luluResponseText) ? (
                              <span className="rounded-full bg-[#edf6f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1f6f3e] sm:tracking-[0.16em]">
                                Response
                              </span>
                            ) : (
                              <span className="text-sm text-[#767676]">No response</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-[#f0f0f0] bg-[#fafafa]">
                          <td
                            colSpan={
                              columnDefinitions.filter((column) => visibleColumns[column.key]).length
                            }
                            className="px-4 py-5 sm:px-5"
                          >
                            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                                  Full Review
                                </p>
                                <p className="mt-3 text-sm leading-7 text-[#4a4a4a]">
                                  {review.reviewText}
                                </p>
                                {review.businessInsight ? (
                                  <div className="mt-4 rounded-[20px] bg-[#fafafa] p-4 text-sm leading-7 text-[#4a4a4a]">
                                    {review.businessInsight}
                                  </div>
                                ) : null}
                                {review.luluResponseText ? (
                                  <div className="mt-4 rounded-[20px] border border-[#e5e5e5] bg-white p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                                      lululemon Response
                                    </p>
                                    <p className="mt-3 text-sm leading-7 text-[#4a4a4a]">
                                      {review.luluResponseText}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                              <div className="space-y-4">
                                <div className="rounded-[20px] border border-[#e5e5e5] bg-white p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                                    Review Metadata
                                  </p>
                                  <ul className="mt-3 space-y-2 text-sm text-[#4a4a4a]">
                                    <li>Helpful votes: {review.helpfulVotes}</li>
                                    <li>Fit feedback: {review.fitFeedback || 'Not specified'}</li>
                                    <li>
                                      Size purchased: {review.sizePurchased || 'Not specified'}
                                    </li>
                                    <li>Usual size: {review.usualSize || 'Not specified'}</li>
                                  </ul>
                                </div>
                                {(review.imageEvidence?.length || review.imageUrls.length) ? (
                                  <div className="rounded-[20px] border border-[#e5e5e5] bg-white p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                                      Photos
                                    </p>
                                    <div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
                                      {(review.imageEvidence?.length
                                        ? review.imageEvidence
                                        : review.imageUrls.map((url) => ({
                                            url,
                                            thumbnailUrl: url,
                                            isThumbnailOnly: false,
                                          }))
                                      )
                                        .slice(0, 6)
                                        .map((image) => (
                                        <button
                                          key={image.url}
                                          type="button"
                                          onClick={() =>
                                            setLightboxImage({
                                              url: image.url,
                                              alt: review.title,
                                              sourceKind: image.isThumbnailOnly
                                                ? 'thumbnail'
                                                : 'original',
                                            })
                                          }
                                          className="overflow-hidden rounded-2xl bg-[#f5f5f5]"
                                        >
                                          <img
                                            src={image.thumbnailUrl || image.url}
                                            alt={review.title}
                                            loading="lazy"
                                            className="aspect-square h-full w-full object-cover"
                                          />
                                        </button>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLightboxImage({
                                          url: review.imageEvidence?.[0]?.url || review.imageUrls[0],
                                          alt: review.title,
                                          sourceKind: review.imageEvidence?.[0]?.isThumbnailOnly
                                            ? 'thumbnail'
                                            : 'original',
                                        })
                                      }
                                      className="mt-3 inline-flex items-center gap-1 text-sm text-[#767676] hover:text-[#000000]"
                                    >
                                      Open image
                                      <ExternalLink size={14} />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-black/8 px-4 py-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between sm:px-5">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPage === 1}
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000] disabled:opacity-40 min-[430px]:w-auto"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000] disabled:opacity-40 min-[430px]:w-auto"
          >
            Next
          </button>
        </div>
      </Panel>

      <ImageLightbox
        imageUrl={lightboxImage?.url}
        alt={lightboxImage?.alt}
        sourceKind={lightboxImage?.sourceKind}
        isOpen={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  )
}
