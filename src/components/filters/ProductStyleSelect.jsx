export default function ProductStyleSelect({
  value,
  options = [],
  onChange,
  disabled = false,
  compact = false,
  className = '',
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm text-[#4a4a4a] ${className}`}>
      {!compact ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
          Product Style
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`w-full min-w-0 rounded-full border border-[#d9d9d9] bg-white text-sm font-medium text-[#000000] shadow-sm transition hover:border-black disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-4 py-2.5 lg:w-[190px] xl:w-[230px] 2xl:w-[260px]' : 'px-4 py-2.5'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
