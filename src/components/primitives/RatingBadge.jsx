import { Star } from 'lucide-react'

const badgeClasses = {
  1: 'bg-[#E20010] text-white',
  2: 'bg-[#1a1a1a] text-white',
  3: 'bg-[#f5f5f5] text-[#1a1a1a] border border-[#e5e5e5]',
}

export default function RatingBadge({ rating, compact = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        compact ? 'px-2.5 py-1 text-[11px]' : ''
      } ${badgeClasses[rating] || 'bg-[#f5f5f5] text-[#1a1a1a] border border-[#e5e5e5]'}`}
    >
      <Star size={compact ? 11 : 12} className="fill-current" />
      {rating} Star
    </span>
  )
}
