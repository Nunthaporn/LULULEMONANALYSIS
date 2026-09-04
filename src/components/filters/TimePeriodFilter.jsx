import { TIME_PERIOD_OPTIONS } from '../../data/constants'
import { useProductFilter } from '../../context/ProductFilterContext'

export default function TimePeriodFilter({ meta = '', className = '' }) {
  const { selectedTimePeriod, setSelectedTimePeriod } = useProductFilter()

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
          Period
        </span>
        <div
          className="inline-flex max-w-full overflow-x-auto rounded-full border border-[#e5e5e5] bg-white p-1"
          data-tour="time-period"
        >
          {TIME_PERIOD_OPTIONS.map((option) => {
            const selected = option.value === selectedTimePeriod

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedTimePeriod(option.value)}
                className={`min-w-11 rounded-full px-3 py-2 text-sm font-semibold transition sm:min-w-12 sm:px-4 ${
                  selected
                    ? 'bg-black text-white'
                    : 'text-[#4a4a4a] hover:bg-[#fafafa] hover:text-black'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
      {meta ? <p className="text-sm text-[#767676]">{meta}</p> : null}
    </div>
  )
}
