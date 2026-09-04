import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import RatingBadge from '../primitives/RatingBadge'
import ZoomableImageFrame from '../ZoomableImageFrame'

export default function Lightbox({ items = [], activeIndex, onClose, onChange }) {
  const activeItem = items[activeIndex] || null
  const [touchStart, setTouchStart] = useState(null)

  const relatedCount = useMemo(
    () => items.filter((item) => item.reviewId === activeItem?.reviewId).length,
    [activeItem?.reviewId, items],
  )

  useEffect(() => {
    if (!activeItem) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
      if (event.key === 'ArrowLeft') {
        onChange(Math.max(activeIndex - 1, 0))
      }
      if (event.key === 'ArrowRight') {
        onChange(Math.min(activeIndex + 1, items.length - 1))
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [activeIndex, activeItem, items.length, onChange, onClose])

  if (!activeItem) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-4 sm:px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-[95vw] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl lg:max-w-6xl lg:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative flex min-h-[240px] max-h-[60vh] flex-1 items-center justify-center bg-black sm:min-h-[320px] lg:max-h-none lg:max-w-[52%]"
          onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX || null)}
          onTouchEnd={(event) => {
            const current = event.changedTouches[0]?.clientX || null
            if (touchStart === null || current === null) {
              return
            }

            const delta = current - touchStart
            if (delta > 40) {
              onChange(Math.max(activeIndex - 1, 0))
            }
            if (delta < -40) {
              onChange(Math.min(activeIndex + 1, items.length - 1))
            }
          }}
        >
          <ZoomableImageFrame
            key={activeItem.key}
            imageUrl={activeItem.imageUrl}
            alt={activeItem.reviewTitle}
            sourceKind={activeItem.isThumbnailOnly ? 'thumbnail' : 'original'}
            className="h-full w-full"
            maxViewportWidth="100%"
            maxViewportHeight="70vh"
            controlsClassName="absolute bottom-3 left-1/2 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full bg-white px-3 py-2 shadow-lg sm:bottom-4 sm:max-w-none"
            buttonClassName="rounded-full p-2 text-black transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-30"
          />
          <button
            type="button"
            onClick={() => onChange(Math.max(activeIndex - 1, 0))}
            disabled={activeIndex === 0}
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25 disabled:opacity-30 lg:block"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(activeIndex + 1, items.length - 1))}
            disabled={activeIndex === items.length - 1}
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25 disabled:opacity-30 lg:block"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex w-full flex-col overflow-y-auto p-4 sm:p-6 lg:max-w-[48%]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                Photo Evidence
              </p>
              <h3 className="font-display mt-3 break-words text-xl font-semibold tracking-normal text-[#000000] sm:text-2xl">
                {activeItem.reviewTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/8 bg-white p-2 text-[#000000]"
              aria-label="Close lightbox"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <RatingBadge rating={activeItem.rating} compact />
            <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.16em]">
              {activeItem.complaintTheme}
            </span>
            <span className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-[11px] font-medium text-[#4a4a4a]">
              {activeItem.dateLabel}
            </span>
            <span className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-[11px] font-medium text-[#4a4a4a]">
              {activeItem.verifiedBuyer ? 'Verified buyer' : 'Unverified'}
            </span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-7 text-[#4a4a4a]">
            <p>{activeItem.reviewText}</p>
            <div className="rounded-2xl bg-[#fafafa] p-4 italic text-[#4a4a4a]">
              {activeItem.businessInsight}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                  Helpful votes
                </p>
                <p className="mt-2 text-sm text-[#000000]">{activeItem.helpfulVotes}</p>
              </div>
              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
                  Size / Fit
                </p>
                <p className="mt-2 text-sm text-[#000000]">
                  {[activeItem.sizePurchased, activeItem.fitFeedback].filter(Boolean).join(' | ') ||
                    'Not specified'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-[#4a4a4a]">
                {relatedCount} image records in this review set
              </span>
              <Link
                to={`/reviews?id=${activeItem.reviewId}&expand=true`}
                className="inline-flex items-center gap-1 text-[#767676] hover:text-[#000000]"
              >
                View parent review
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
