import Panel from './Panel'

export default function KpiTile({
  label,
  value,
  note,
  delta,
  sparkline = null,
  icon: Icon = null,
  className = '',
}) {
  return (
    <Panel
      className={`group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-black hover:shadow-[0_16px_36px_rgba(0,0,0,0.07)] sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        {Icon ? <Icon size={18} className="mt-0.5 shrink-0 text-[#767676]" /> : <div />}
        {delta ? (
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              delta.tone === 'positive'
                ? 'bg-[#edf6f0] text-[#1f6f3e]'
                : delta.tone === 'negative'
                  ? 'bg-[#ffe5e8] text-[#E20010]'
                  : 'bg-[#f5f5f5] text-[#767676]'
            }`}
          >
            {delta.label}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
        {label}
      </p>
      <p className="font-display mt-3 min-w-0 break-words text-[1.8rem] font-semibold leading-none tracking-normal text-[#000000] sm:text-[2.15rem] lg:text-[2.45rem]">
        {value}
      </p>
      {sparkline ? <div className="mt-4">{sparkline}</div> : null}
      {note ? <p className="mt-4 text-sm leading-6 text-[#4a4a4a]">{note}</p> : null}
    </Panel>
  )
}
