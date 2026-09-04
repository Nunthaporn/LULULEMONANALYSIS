import { Eye } from 'lucide-react'
import RatingBadge from '../primitives/RatingBadge'
import Skeleton from '../primitives/Skeleton'

export default function ImageCard({ item, extraCount = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e5e5e5] bg-white text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
        <img
          src={item.thumbnailUrl || item.imageUrl}
          alt={item.reviewTitle}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
            const sibling = event.currentTarget.nextElementSibling
            if (sibling) sibling.classList.remove('hidden')
          }}
        />
        <div className="hidden h-full w-full items-center justify-center">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4 text-white opacity-0 transition group-hover:opacity-100">
          <div className="min-w-0">
            <p className="font-display line-clamp-2 text-sm font-semibold">{item.reviewTitle}</p>
            <p className="mt-1 text-xs text-white/70">{item.complaintTheme}</p>
          </div>
          <div className="shrink-0 rounded-full bg-white/15 p-2">
            <Eye size={15} />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RatingBadge rating={item.rating} compact />
          <span className="rounded-full bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
            {item.complaintTheme}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-[#4a4a4a]">{item.reviewText}</p>
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-[#767676]">
          <span>{item.helpfulVotes} helpful votes</span>
          {extraCount > 0 ? <span>+{extraCount} images</span> : null}
        </div>
      </div>
    </button>
  )
}
