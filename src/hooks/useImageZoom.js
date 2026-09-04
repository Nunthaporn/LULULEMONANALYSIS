import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.5
const MAX_SCALE = 4
const DEFAULT_SCALE = 1
const ZOOM_STEP = 0.25

function clamp(value, minScale = MIN_SCALE, maxScale = MAX_SCALE) {
  return Math.min(maxScale, Math.max(minScale, value))
}

export function useImageZoom(resetKey = null, options = {}) {
  const minScale = options.minScale ?? MIN_SCALE
  const maxScale = options.maxScale ?? MAX_SCALE
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const dragState = useRef(null)

  const zoomIn = useCallback(() => {
    setScale((value) => clamp(Number((value + ZOOM_STEP).toFixed(2)), minScale, maxScale))
  }, [maxScale, minScale])

  const zoomOut = useCallback(() => {
    setScale((value) => {
      const next = clamp(Number((value - ZOOM_STEP).toFixed(2)), minScale, maxScale)
      if (next <= DEFAULT_SCALE) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }, [maxScale, minScale])

  const reset = useCallback(() => {
    setScale(clamp(DEFAULT_SCALE, minScale, maxScale))
    setPosition({ x: 0, y: 0 })
    setRotation(0)
    dragState.current = null
  }, [maxScale, minScale])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) {
        setScale((value) => clamp(value, minScale, maxScale))
      }
    })

    return () => {
      active = false
    }
  }, [maxScale, minScale])

  useEffect(() => {
    let active = true
    dragState.current = null
    queueMicrotask(() => {
      if (active) {
        reset()
      }
    })

    return () => {
      active = false
    }
  }, [reset, resetKey])

  const handleWheel = useCallback((event) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setScale((value) => {
      const next = clamp(Number((value + delta).toFixed(2)), minScale, maxScale)
      if (next <= DEFAULT_SCALE) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }, [maxScale, minScale])

  const handleMouseDown = useCallback(
    (event) => {
      if (scale <= 1) {
        return
      }
      dragState.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      }
    },
    [position, scale],
  )

  const handleMouseMove = useCallback((event) => {
    if (!dragState.current) {
      return
    }
    const { startX, startY, originX, originY } = dragState.current
    setPosition({
      x: originX + (event.clientX - startX),
      y: originY + (event.clientY - startY),
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    dragState.current = null
  }, [])

  return {
    scale,
    position,
    rotation,
    isZoomed: scale > 1,
    canZoomIn: scale < maxScale,
    canZoomOut: scale > minScale,
    zoomIn,
    zoomOut,
    reset,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
