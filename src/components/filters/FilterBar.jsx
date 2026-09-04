export default function FilterBar({ children, className = '' }) {
  return (
    <div
      className={`rounded-[20px] border border-[#e5e5e5] bg-white p-4 lg:sticky lg:top-20 lg:z-20 ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {children}
      </div>
    </div>
  )
}
