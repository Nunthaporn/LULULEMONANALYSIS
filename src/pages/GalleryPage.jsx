import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Panel from '../components/primitives/Panel'
import SectionHeader from '../components/primitives/SectionHeader'
import EmptyState from '../components/primitives/EmptyState'
import Skeleton from '../components/primitives/Skeleton'
import FilterBar from '../components/filters/FilterBar'
import DateRangePicker from '../components/filters/DateRangePicker'
import TimePeriodFilter from '../components/filters/TimePeriodFilter'
import ImageGroupCard from '../components/gallery/ImageGroupCard'
import Lightbox from '../components/gallery/Lightbox'
import { ALL_FILTER_VALUE, LOGO_PATH } from '../data/constants'
import { filterGalleryItems } from '../data/selectors'
import { useDashboardDataset } from '../hooks/useDataset'
import { useExportRegistration } from '../hooks/useExport'
import { useFilters } from '../hooks/useFilters'
import { useProductFilter } from '../context/ProductFilterContext'

export default function Gallery() {
  const { selectedProductId, selectedProductName } = useProductFilter()
  const { data, loading, error } = useDashboardDataset(true)
  const { filters, updateFilter, resetFilters } = useFilters({
    rating: ALL_FILTER_VALUE,
    theme: ALL_FILTER_VALUE,
    verified: ALL_FILTER_VALUE,
    size: ALL_FILTER_VALUE,
    from: '',
    to: '',
    sortBy: 'newest',
  })
  const [activeIndex, setActiveIndex] = useState(-1)
  const productChangeRef = useRef(false)

  const filteredItems = useMemo(() => {
    if (!data) {
      return []
    }

    return filterGalleryItems(data.imageItems, filters)
  }, [data, filters])

  const groupedItems = useMemo(() => {
    const groups = new Map()

    filteredItems.forEach((item, index) => {
      const groupKey = item.reviewId || item.key
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { reviewId: groupKey, firstIndex: index, items: [] })
      }
      groups.get(groupKey).items.push(item)
    })

    return [...groups.values()]
  }, [filteredItems])
  const exportConfig = useMemo(
    () =>
      data
        ? {
            fileName: `lululemon-gallery-${selectedProductId}.csv`,
            rows: filteredItems,
            json: filteredItems,
          }
        : null,
    [data, filteredItems, selectedProductId],
  )

  useExportRegistration(exportConfig)

  useEffect(() => {
    if (!productChangeRef.current) {
      productChangeRef.current = true
      return
    }

    resetFilters()
    setActiveIndex(-1)
  }, [resetFilters, selectedProductId])

  if (loading) {
    return <Skeleton className="h-[760px] rounded-[20px]" />
  }

  if (error || !data) {
    return (
      <Panel className="p-4 text-sm text-[#4a4a4a] sm:p-8">
        Image gallery could not load.
      </Panel>
    )
  }

  const ratingBreakdown = [1, 2, 3].map((rating) => ({
    rating,
    count: data.imageItems.filter((item) => item.rating === rating).length,
  }))

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-6 lg:p-8">
        <Link to="/analytics" className="text-sm text-[#767676] hover:text-[#000000]">
          {'<- Back to Analytics'}
        </Link>
        <SectionHeader
          eyebrow="Review Images By Category"
          title="Customer-submitted photo evidence"
          description={`This gallery surfaces the visual proof attached to low-star reviews for ${
            selectedProductId === 'all' ? 'all loaded product styles' : selectedProductName
          }, so product, quality, and CX teams can inspect complaint evidence directly.`}
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

      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#4a4a4a]">
          <span className="max-w-full rounded-full bg-[#000000] px-3 py-2 text-xs text-white sm:px-4 sm:text-sm">
            {data.imageItems.length} images in {data.selectedTimePeriod}
          </span>
          {ratingBreakdown.map((item) => (
            <span
              key={item.rating}
              className="rounded-full border border-black/8 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm"
            >
              {item.count} x {item.rating}-star
            </span>
          ))}
        </div>
      </Panel>

      <FilterBar>
        <div className="w-full">
          <TimePeriodFilter
            meta={`Selected period: ${data.selectedTimePeriod}. Showing ${data.periodRangeLabel}.`}
          />
        </div>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(120px,0.7fr)_minmax(160px,1fr)_minmax(110px,0.9fr)_minmax(120px,0.8fr)_minmax(260px,1fr)_minmax(120px,0.8fr)]">
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
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Complaint Theme
            </span>
            <select
              value={filters.theme}
              onChange={(event) => updateFilter('theme', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value={ALL_FILTER_VALUE}>All Themes</option>
              {data.themeRows.map((theme) => (
                <option key={theme.slug} value={theme.theme}>
                  {theme.theme}
                </option>
              ))}
            </select>
          </label>
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
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Size
            </span>
            <select
              value={filters.size}
              onChange={(event) => updateFilter('size', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value={ALL_FILTER_VALUE}>All Sizes</option>
              {data.sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <DateRangePicker from={filters.from} to={filters.to} onChange={updateFilter} />
          <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
              Sort
            </span>
            <select
              value={filters.sortBy}
              onChange={(event) => updateFilter('sortBy', event.target.value)}
              className="w-full min-w-0 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000]"
            >
              <option value="newest">Newest</option>
              <option value="helpful">Helpful votes</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex w-full flex-col gap-3 border-t border-[#f0f0f0] pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-[#4a4a4a]">
            Showing {filteredItems.length} images across {groupedItems.length} reviews
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#000000] hover:border-black sm:w-auto"
          >
            Clear Filters
          </button>
        </div>
      </FilterBar>

      {filteredItems.length === 0 ? (
        <EmptyState
          title={
            data.imageItems.length === 0
              ? 'No image-backed reviews found for this selection.'
              : 'No matching image evidence'
          }
          description={
            data.imageItems.length === 0
              ? 'Try a broader time period or another product style.'
              : 'Try adjusting or clearing the gallery filters.'
          }
        />
      ) : (
        <div className="grid gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {groupedItems.map((group) => (
            <ImageGroupCard
              key={group.reviewId}
              group={group}
              onClick={() => setActiveIndex(group.firstIndex)}
            />
          ))}
        </div>
      )}

      <Lightbox
        items={filteredItems}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(-1)}
        onChange={setActiveIndex}
      />
    </div>
  )
}
