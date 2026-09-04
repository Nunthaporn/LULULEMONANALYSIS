export default function DateRangePicker({ from, to, onChange }) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
          From
        </span>
        <input
          type="date"
          value={from}
          onChange={(event) => onChange('from', event.target.value)}
          className="w-full min-w-0 rounded-full border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#000000] shadow-sm transition hover:border-black"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm text-[#4a4a4a]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
          To
        </span>
        <input
          type="date"
          value={to}
          onChange={(event) => onChange('to', event.target.value)}
          className="w-full min-w-0 rounded-full border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#000000] shadow-sm transition hover:border-black"
        />
      </label>
    </div>
  )
}
