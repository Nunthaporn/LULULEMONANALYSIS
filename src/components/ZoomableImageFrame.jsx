import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useImageZoom } from '../hooks/useImageZoom'

function buildConstrainedSize(limit, naturalValue) {
  if (!naturalValue) {
    return `min(100%, ${limit})`
  }

  return `min(100%, ${limit}, ${naturalValue}px)`
}

export default function ZoomableImageFrame({
  imageUrl,
  alt,
  sourceKind = 'original',
  className = '',
  imageClassName = '',
  controlsClassName = '',
  buttonClassName = '',
  metadataClassName = '',
  maxViewportWidth = '90vw',
  maxViewportHeight = '85vh',
}) {
  const imageRef = useRef(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 })

  const lowResolutionAsset = useMemo(() => {
    if (sourceKind === 'thumbnail') {
      return true
    }

    if (!naturalSize.width || !naturalSize.height) {
      return false
    }

    return Math.max(naturalSize.width, naturalSize.height) <= 320
  }, [naturalSize.height, naturalSize.width, sourceKind])

  const maxScale = lowResolutionAsset ? 1.5 : 4
  const {
    scale,
    position,
    rotation,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useImageZoom(imageUrl, { maxScale })

  const updateRenderSize = useCallback(() => {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setRenderSize({
      width: Math.round(rect.width / scale),
      height: Math.round(rect.height / scale),
    })
  }, [scale])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) {
        return
      }

      setNaturalSize({ width: 0, height: 0 })
      setRenderSize({ width: 0, height: 0 })
    })

    return () => {
      active = false
    }
  }, [imageUrl])

  useEffect(() => {
    updateRenderSize()
    window.addEventListener('resize', updateRenderSize)
    return () => window.removeEventListener('resize', updateRenderSize)
  }, [naturalSize.height, naturalSize.width, updateRenderSize])

  const sourceLabel = lowResolutionAsset ? 'thumbnail/low-res source' : 'original source'
  const renderLabel =
    renderSize.width && renderSize.height ? `display ${renderSize.width}x${renderSize.height}` : ''
  const metadataLabel =
    naturalSize.width && naturalSize.height
      ? `${naturalSize.width}x${naturalSize.height} natural | ${sourceLabel}${
          renderLabel ? ` | ${renderLabel}` : ''
        }`
      : `Loading resolution | ${sourceLabel}`

  return (
    <>
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
        } ${className}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={alt}
          draggable={false}
          decoding="async"
          className={`select-none ${imageClassName}`}
          onLoad={(event) => {
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
            window.requestAnimationFrame(updateRenderSize)
          }}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: buildConstrainedSize(maxViewportWidth, naturalSize.width),
            maxHeight: buildConstrainedSize(maxViewportHeight, naturalSize.height),
            objectFit: 'contain',
            transform: `translate3d(${position.x}px, ${position.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
            transformOrigin: 'center center',
            transition: scale === 1 ? 'transform 150ms ease' : 'none',
          }}
        />

        {import.meta.env.DEV ? (
          <div
            className={`pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white shadow-lg ${metadataClassName}`}
          >
            {metadataLabel}
          </div>
        ) : null}
      </div>

      <div className={controlsClassName}>
        <button
          type="button"
          onClick={zoomOut}
          disabled={!canZoomOut}
          aria-label="Zoom out"
          className={buttonClassName}
        >
          <Minus size={16} />
        </button>
        <span className="w-12 text-center text-xs font-semibold text-black">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={!canZoomIn}
          aria-label="Zoom in"
          className={buttonClassName}
        >
          <Plus size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-[#e5e5e5]" />
        <button
          type="button"
          onClick={reset}
          aria-label="Reset zoom"
          className={buttonClassName}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </>
  )
}
