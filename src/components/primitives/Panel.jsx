export default function Panel({ children, className = '', id }) {
  return (
    <div
      id={id}
      className={`soft-card min-w-0 rounded-[8px] border border-[#e5e5e5] bg-white ${className}`}
    >
      {children}
    </div>
  )
}
