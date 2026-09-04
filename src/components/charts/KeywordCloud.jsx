export default function KeywordCloud({ items = [] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <span
          key={item.word}
          className="rounded-full border border-[#e5e5e5] bg-white px-3 py-2 text-[#000000]"
          style={{ fontSize: `${item.size}rem` }}
        >
          {item.word}
        </span>
      ))}
    </div>
  )
}
