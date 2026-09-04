import { AlertTriangle, ClipboardList, Lightbulb, TrendingUp } from 'lucide-react'
import Panel from '../primitives/Panel'
import SectionHeader from '../primitives/SectionHeader'
import { buildExecutiveNarrative } from '../../data/selectors'

const GROUPS = [
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'risks', label: 'Quality Risks', icon: AlertTriangle },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
  { key: 'recommendedActions', label: 'Recommended Actions', icon: ClipboardList },
]

export default function MonthlyNarrativePanel({ data }) {
  const narrative = buildExecutiveNarrative(data)

  if (!narrative) {
    return null
  }

  return (
    <Panel className="p-5 sm:p-6 lg:p-8">
      <SectionHeader
        eyebrow={`Monthly executive narrative — ${narrative.monthLabel}`}
        title={narrative.headline}
      />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {GROUPS.map((group) => {
          const Icon = group.icon
          const items = narrative[group.key] || []
          return (
            <div key={group.key}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#767676]">
                {group.label}
              </p>
              <div className="mt-3 space-y-2.5">
                {items.map((text, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <Icon size={15} className="mt-0.5 shrink-0 text-[#E20010]" />
                    <p className="text-sm leading-6 text-[#4a4a4a]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
