import { Eye, Images } from 'lucide-react'
import RatingBadge from '../primitives/RatingBadge'
import Skeleton from '../primitives/Skeleton'

export default function ImageGroupCard({ group, onClick }) {
  const primary = group.items[0]
  const stackPeeks = group.items.slice(1, 3)
  const photoCount = group.items.length

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e5e5e5] bg-white text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
        {stackPeeks.map((peek, index) => (
          <div
            key={peek.key}
            aria-hidden="true"
            className="absolute inset-0 rounded-[20px] bg-[#e5e5e5]"
            style={{
              transform: `translate(${6 * (index + 1)}px, ${-6 * (index + 1)}px) scale(${1 - 0.03 * (index + 1)})`,
              zIndex: 1 - index,
            }}
          />
        ))}
        <img
          src={primary.thumbnailUrl || primary.imageUrl}
          alt={primary.reviewTitle}
          loading="lazy"
          className="relative z-10 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
            const sibling = event.currentTarget.nextElementSibling
            if (sibling) sibling.classList.remove('hidden')
          }}
        />
        <div className="hidden h-full w-full items-center justify-center">
          <Skeleton className="h-full w-full rounded-none" />
        </div>

        {photoCount > 1 ? (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Images size={12} />
            {photoCount} photos
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4 text-white opacity-0 transition group-hover:opacity-100">
          <div className="min-w-0">
            <p className="font-display line-clamp-2 text-sm font-semibold">{primary.reviewTitle}</p>
            <p className="mt-1 text-xs text-white/70">{primary.complaintTheme}</p>
          </div>
          <div className="shrink-0 rounded-full bg-white/15 p-2">
            <Eye size={15} />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RatingBadge rating={primary.rating} compact />
          <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
            {primary.complaintTheme}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-[#4a4a4a]">{primary.reviewText}</p>
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-[#767676]">
          <span>{primary.helpfulVotes} helpful votes</span>
          {photoCount > 1 ? <span>{photoCount} photos in this review</span> : null}
        </div>
      </div>
    </button>
  )
}
