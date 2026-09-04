import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function ThemeMultiSelect({ value = [], options = [], onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const activeValues = new Set(value)

  const summaryLabel = useMemo(() => {
    if (value.length === 0) {
      return 'All Categories'
    }

    if (value.length === 1) {
      return value[0]
    }

    return `${value.length} categories selected`
  }, [value])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="relative flex min-w-0 flex-col gap-1" ref={containerRef}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#767676] sm:tracking-[0.18em]">
        Complaint Theme
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[42px] w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-left text-sm text-[#000000]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#767676] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-0 rounded-[20px] border border-[#e5e5e5] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.08)] sm:min-w-[260px]">
          <div className="max-h-72 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                value.length === 0
                  ? 'bg-[#000000] text-white'
                  : 'text-[#000000] hover:bg-[#fafafa]'
              }`}
            >
              <span>All Categories</span>
              {value.length === 0 ? <Check size={15} /> : null}
            </button>

            {options.map((option) => {
              const active = activeValues.has(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (active) {
                      onChange(value.filter((item) => item !== option))
                    } else {
                      onChange([...value, option])
                    }
                  }}
                  className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-[#000000] text-white'
                      : 'text-[#000000] hover:bg-[#fafafa]'
                  }`}
                >
                  <span className="truncate pr-3">{option}</span>
                  {active ? <Check size={15} className="shrink-0" /> : null}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#f0f0f0] px-1 pt-3">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-[#767676] transition hover:text-[#000000]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-[#000000] px-3 py-1.5 text-xs font-medium text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
