import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const TOUR_STORAGE_KEY = 'lululemon:guided-tour-completed'

const TOUR_STEPS = [
  {
    id: 'region-selector',
    selector: '[data-tour="region-selector"]',
    title: 'Start with your Region',
    body: 'Switch between North America, Asia, Australia, and New Zealand review data here — every KPI, chart, and review on the site follows this selection.',
  },
  {
    id: 'time-period',
    selector: '[data-tour="time-period"]',
    title: 'Set your Time Period',
    body: "ALL, 12M, 6M, 3M, or 1M controls how far back every chart, KPI, and review looks — it's remembered across visits. Once you open Insights, Analytics, Reviews, or Gallery, a Product selector appears here too, to narrow down to one specific style.",
  },
  {
    id: 'kpi-stats',
    selector: '[data-tour="kpi-stats"]',
    title: 'Read the Executive Summary',
    body: "These numbers always reflect your current Region and Time Period. \"Factory-actionable\" means the complaint traces to a specific, fixable production defect rather than a service or pricing issue.",
  },
  {
    id: 'destination-cards',
    selector: '[data-tour="destination-cards"]',
    title: 'Explore the rest of the report',
    body: 'Insights, Analytics, Reviews, and Gallery each give a different lens on the same guest data — defect ownership, trend analysis, raw review evidence, and photo proof.',
  },
]

const STEP_TIMEOUT_MS = 4000

function findVisibleTarget(selector) {
  const candidates = document.querySelectorAll(selector)
  for (const el of candidates) {
    if (el.offsetParent !== null) {
      return el
    }
  }
  return null
}

export default function GuidedTour() {
  const [active, setActive] = useState(
    () => window.localStorage.getItem(TOUR_STORAGE_KEY) !== 'true',
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [ringRadius, setRingRadius] = useState(16)
  const frameRef = useRef(null)
  const scrolledRef = useRef(false)

  const finish = () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    setActive(false)
  }

  useEffect(() => {
    if (!active) {
      return undefined
    }

    const step = TOUR_STEPS[stepIndex]
    if (!step) {
      return undefined
    }

    scrolledRef.current = false
    let notFoundTimeout = null

    const measure = () => {
      const target = findVisibleTarget(step.selector)

      if (target) {
        if (notFoundTimeout) {
          clearTimeout(notFoundTimeout)
          notFoundTimeout = null
        }
        if (!scrolledRef.current) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          scrolledRef.current = true
        }
        setRect(target.getBoundingClientRect())
        const parsedRadius = parseFloat(window.getComputedStyle(target).borderRadius) || 0
        setRingRadius(parsedRadius > 0 ? Math.min(parsedRadius + 4, 40) : 16)
      } else {
        setRect(null)
        if (!notFoundTimeout) {
          // Target isn't on this page (e.g. Product selector only exists off the
          // Home page) — skip ahead instead of leaving the tour invisibly stuck.
          notFoundTimeout = setTimeout(() => {
            setStepIndex((prev) => {
              if (prev < TOUR_STEPS.length - 1) {
                return prev + 1
              }
              finish()
              return prev
            })
          }, STEP_TIMEOUT_MS)
        }
      }

      frameRef.current = requestAnimationFrame(measure)
    }

    frameRef.current = requestAnimationFrame(measure)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      if (notFoundTimeout) {
        clearTimeout(notFoundTimeout)
      }
    }
  }, [active, stepIndex])

  const advance = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1)
    } else {
      finish()
    }
  }

  const goBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1))
  }

  if (!active || !rect) {
    return null
  }

  const step = TOUR_STEPS[stepIndex]
  const isLastStep = stepIndex === TOUR_STEPS.length - 1
  const cardWidth = 300
  const estimatedCardHeight = 240
  const padding = 12

  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const spaceLeft = rect.left
  const targetIsTall = rect.height > window.innerHeight * 0.55
  const placeLeft =
    targetIsTall &&
    spaceBelow < estimatedCardHeight + padding &&
    spaceLeft > cardWidth + padding * 2

  const placeAbove = spaceBelow < estimatedCardHeight + padding && spaceAbove > spaceBelow

  let top
  let left
  if (placeLeft) {
    const centeredTop = rect.top + rect.height / 2 - estimatedCardHeight / 2
    top = Math.min(
      Math.max(padding, centeredTop),
      window.innerHeight - estimatedCardHeight - padding,
    )
    left = rect.left - padding - cardWidth
  } else {
    top = placeAbove
      ? Math.max(padding, rect.top - padding - estimatedCardHeight)
      : Math.min(rect.bottom + padding, window.innerHeight - estimatedCardHeight - padding)
    left = Math.min(Math.max(rect.left, padding), window.innerWidth - cardWidth - padding)
  }

  return (
    <>
      <div
        className="pointer-events-none fixed z-[60] ring-2 ring-[#E20010] ring-offset-2 ring-offset-white transition-all duration-150"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: `${ringRadius}px`,
        }}
      />

      <div
        className="fixed z-[60] w-[300px] rounded-[8px] border border-[#e5e5e5] bg-white p-4 shadow-2xl transition-all duration-150"
        style={{ top, left }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E20010]">
            Quick tour · {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Dismiss tour"
            className="shrink-0 text-[#767676] transition hover:text-black"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold text-black">{step.title}</p>
        <p className="mt-1.5 text-sm leading-6 text-[#4a4a4a]">{step.body}</p>
        <div className="mt-4 flex items-center justify-end gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-[#767676] transition hover:text-black"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={advance}
            className="inline-flex items-center justify-center rounded-full bg-[#E20010] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c4000e]"
          >
            {isLastStep ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
