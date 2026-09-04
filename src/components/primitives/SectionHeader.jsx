export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
  titlePrefix = null,
}) {
  return (
    <div className={`min-w-0 ${align === 'center' ? 'mx-auto max-w-3xl text-center' : ''} ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#767676]">
        {eyebrow}
      </p>
      <div
        className={`mt-3 flex min-w-0 gap-3 ${
          align === 'center' ? 'items-center justify-center' : 'items-start'
        }`}
      >
        {titlePrefix}
        <h2 className="font-display min-w-0 break-words text-2xl font-semibold leading-tight tracking-normal text-[#000000] sm:text-3xl md:text-4xl">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4a4a4a] sm:text-[15px]">
          {description}
        </p>
      ) : null}
    </div>
  )
}
