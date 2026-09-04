import { useEffect } from 'react'
import { X } from 'lucide-react'
import ZoomableImageFrame from './ZoomableImageFrame'

export default function ImageLightbox({
  imageUrl,
  alt = 'Customer photo',
  isOpen,
  onClose,
  sourceKind = 'original',
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !imageUrl) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-3 py-4 sm:px-4 sm:py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[96dvh] max-w-[95vw] flex-col items-center sm:max-w-[96vw]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="fixed right-3 top-3 z-[110] rounded-full bg-white p-3 text-black shadow-lg transition hover:bg-[#f5f5f5] sm:right-4 sm:top-4 sm:p-2"
        >
          <X size={18} />
        </button>

        <ZoomableImageFrame
          key={`${imageUrl}:${alt}`}
          imageUrl={imageUrl}
          alt={alt}
          sourceKind={sourceKind}
          className="max-h-[60vh] max-w-[95vw] rounded-[12px] bg-black/20 sm:max-h-[85vh] sm:max-w-[90vw]"
          maxViewportWidth="95vw"
          maxViewportHeight="85vh"
          controlsClassName="mt-4 flex max-w-[95vw] items-center gap-2 overflow-x-auto rounded-full bg-white px-3 py-2 shadow-lg sm:max-w-none"
          buttonClassName="rounded-full p-2 text-black transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-30"
        />
      </div>
    </div>
  )
}
