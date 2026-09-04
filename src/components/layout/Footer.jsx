import { useDashboardDataset } from '../../hooks/useDataset'

export default function Footer() {
  const { data } = useDashboardDataset(true)
  const updatedLabel = data?.anchorDateLabel || 'latest export'

  return (
    <footer className="border-t border-[#e5e5e5] bg-white">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-4 py-7 text-sm text-[#4a4a4a] sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 xl:px-8">
        <p>
          Data updated through {updatedLabel} | {data?.selectedTimePeriod ?? '6M'} VOG window |{' '}
          {data?.masterReviews.length ?? 0} low-star reviews | {data?.imageItems.length ?? 0}{' '}
          customer images
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p>
            Voice of Guest – Quality Improvement Opportunity for{' '}
            {data?.isAllProducts
              ? 'multi-product lululemon review intelligence.'
              : `${data?.selectedProductName || 'lululemon'} review intelligence.`}
          </p>
        </div>
      </div>
    </footer>
  )
}
