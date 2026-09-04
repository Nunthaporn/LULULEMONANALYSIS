import { AlertTriangle, BadgeCheck, Factory, ShieldCheck } from 'lucide-react'
import Panel from '../primitives/Panel'
import {
  buildOperationAnalysisRows,
  buildPriorityReadout,
  buildProductionDefectMatrix,
} from '../../data/selectors'

function pct(value) {
  return `${Math.round(value || 0)}%`
}

function buildConfidenceBands(reviews = []) {
  const bands = [
    { label: 'High confidence', min: 0.72, tone: 'bg-[#E20010]' },
    { label: 'Review recommended', min: 0.45, tone: 'bg-[#737373]' },
    { label: 'Unmatched signal', min: -1, tone: 'bg-[#d4d4d4]' },
  ]

  const total = reviews.length || 1
  return bands.map((band, index) => {
    const next = bands[index - 1]?.min ?? Infinity
    const count = reviews.filter((review) => {
      const score = Number(review.confidenceScore || review.similarityScore || 0)
      return score >= band.min && score < next
    }).length

    return {
      ...band,
      count,
      share: (count / total) * 100,
    }
  })
}

export default function ExpertAnalysisPanel({ reviews = [] }) {
  const matrixRows = buildProductionDefectMatrix(reviews)
    .filter((row) => row.isProduction)
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
  const maxCount = Math.max(1, ...matrixRows.map((row) => row.count))
  const operationRows = buildOperationAnalysisRows(
    matrixRows.map((row, index) => ({
      label: row.label,
      issueLabel: row.actionIssueLabel,
      operationArea: row.operationArea,
      recommendedAction: row.preventionAction,
      owner: row.owner,
      operationRelated: row.isProduction,
      count: row.count,
      percentage: reviews.length ? (row.count / reviews.length) * 100 : 0,
      riskLevel: index === 0 ? 'High' : index <= 2 ? 'Medium' : 'Low',
    })),
  )
  const priorities = buildPriorityReadout(operationRows)
  const confidenceBands = buildConfidenceBands(reviews)
  const operationsCount = reviews.filter((review) => review.operationRelated).length
  const operationsShare = reviews.length ? (operationsCount / reviews.length) * 100 : 0

  return (
    <section className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                Expert Analysis
              </p>
              <h3 className="mt-2 text-lg font-semibold text-black">Defect groups</h3>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
              <ShieldCheck size={18} />
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {matrixRows.map((row) => (
              <div key={row.key} className="min-w-0">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-black">{row.label}</span>
                  <span className="text-[#767676]">{row.count} reviews</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div
                    className="h-full rounded-full bg-[#E20010]"
                    style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
                  Match Quality
                </p>
                <h3 className="mt-2 text-lg font-semibold text-black">Confidence</h3>
              </div>
              <BadgeCheck size={22} className="text-[#E20010]" />
            </div>
            <div className="mt-6 grid gap-3">
              {confidenceBands.map((band) => (
                <div key={band.label} className="rounded-[8px] border border-[#e5e5e5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-black">{band.label}</span>
                    <span className="text-sm text-[#767676]">{pct(band.share)}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div className={`h-full rounded-full ${band.tone}`} style={{ width: pct(band.share) }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="border-[#f1c7cb] bg-[#fff9fa] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E20010] text-white">
                <Factory size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E20010]">
                  Operations flagged
                </p>
                <p className="mt-2 text-3xl font-semibold text-black">{pct(operationsShare)}</p>
                <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">{operationsCount} reviews</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-[#E20010]" />
          <h3 className="text-lg font-semibold text-black">Priority queue</h3>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {priorities.map((item) => (
            <div key={item.priority} className="rounded-[8px] border border-[#e5e5e5] bg-white p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E20010]">
                {item.priority}
              </span>
              <p className="mt-3 text-sm font-semibold text-black">{item.issue}</p>
              <p className="mt-2 truncate text-xs leading-5 text-[#767676]">{item.owner}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  )
}
