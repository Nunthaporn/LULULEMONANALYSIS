const riskClasses = {
  High: 'bg-[#ffe5e8] text-[#E20010]',
  Medium: 'bg-[#fff4ec] text-[#b35900]',
  Low: 'bg-[#f5f5f5] text-[#767676]',
  Excluded: 'bg-[#f0f0f0] text-[#a8a8a8]',
}

export default function RiskBadge({ level, compact = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-[0.16em] ${
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]'
      } ${riskClasses[level] || riskClasses.Low}`}
    >
      {level}
    </span>
  )
}
