import React, { useState, useRef, useCallback, useEffect } from 'react'

export interface ImageCompareSliderProps {
  originalUrl: string
  resultUrl: string
  originalAlt?: string
  resultAlt?: string
  initialPos?: number
  className?: string
  mode?: 'split' | 'result' | 'original'
  onModeChange?: (mode: 'split' | 'result' | 'original') => void
  showControls?: boolean
}

export const ImageCompareSlider: React.FC<ImageCompareSliderProps> = ({
  originalUrl,
  resultUrl,
  originalAlt = 'Gambar Asli',
  resultAlt = 'Hasil Transparan',
  initialPos = 50,
  className = '',
  mode = 'split',
  onModeChange,
  showControls = true,
}) => {
  const [sliderPos, setSliderPos] = useState(initialPos)
  const [internalMode, setInternalMode] = useState<'split' | 'result' | 'original'>(mode)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const activeMode = onModeChange ? mode : internalMode
  const setMode = (newMode: 'split' | 'result' | 'original') => {
    if (onModeChange) {
      onModeChange(newMode)
    } else {
      setInternalMode(newMode)
    }
  }

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(percent)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    updatePosition(e.clientX)
  }, [updatePosition])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      isDragging.current = true
      updatePosition(e.touches[0].clientX)
    }
  }, [updatePosition])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      updatePosition(e.clientX)
    }
    const handleMouseUp = () => {
      isDragging.current = false
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length === 0) return
      updatePosition(e.touches[0].clientX)
    }
    const handleTouchEnd = () => {
      isDragging.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [updatePosition])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeMode !== 'split') return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setSliderPos((prev) => Math.max(0, prev - 5))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setSliderPos((prev) => Math.min(100, prev + 5))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setSliderPos(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setSliderPos(100)
    }
  }

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Mode Controls */}
      {showControls && (
        <div className="flex items-center gap-1.5 mb-2.5 p-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/80">
          <button
            type="button"
            onClick={() => setMode('split')}
            className={`px-3 py-1 rounded-full transition-all duration-200 font-medium ${
              activeMode === 'split'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'hover:text-white hover:bg-white/10'
            }`}
          >
            Bandingkan (Split)
          </button>
          <button
            type="button"
            onClick={() => setMode('result')}
            className={`px-3 py-1 rounded-full transition-all duration-200 font-medium ${
              activeMode === 'result'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'hover:text-white hover:bg-white/10'
            }`}
          >
            Hanya Hasil
          </button>
          <button
            type="button"
            onClick={() => setMode('original')}
            className={`px-3 py-1 rounded-full transition-all duration-200 font-medium ${
              activeMode === 'original'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'hover:text-white hover:bg-white/10'
            }`}
          >
            Gambar Asli
          </button>
        </div>
      )}

      {/* Main Image Comparison Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={activeMode === 'split' ? handleMouseDown : undefined}
        onTouchStart={activeMode === 'split' ? handleTouchStart : undefined}
        className="relative w-full h-full min-h-[280px] max-h-[600px] flex items-center justify-center rounded-2xl overflow-hidden cursor-crosshair border border-white/10 shadow-inner bg-black/40"
      >
        {/* Layer 1: Result Layer with Checkerboard Background */}
        {activeMode !== 'original' && (
          <div className="absolute inset-0 w-full h-full bg-checkerboard flex items-center justify-center">
            <img
              src={resultUrl}
              alt={resultAlt}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {/* Layer 2: Original Layer (Clipped in Split Mode, or Full in Original Mode) */}
        {activeMode === 'split' && (
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none transition-[clip-path] duration-75"
            style={{
              clipPath: `polygon(0% 0%, ${sliderPos}% 0%, ${sliderPos}% 100%, 0% 100%)`,
            }}
          >
            <img
              src={originalUrl}
              alt={originalAlt}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {activeMode === 'original' && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <img
              src={originalUrl}
              alt={originalAlt}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {/* Layer 3: Split Divider Line & Accessible Handle */}
        {activeMode === 'split' && (
          <>
            {/* Vertical Divider */}
            <div
              className="absolute top-0 bottom-0 z-10 w-0.5 bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.8)] pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              {/* Slider Handle (WCAG SC 2.5.5 AAA touch target 44px) */}
              <div
                role="slider"
                tabIndex={0}
                aria-valuenow={Math.round(sliderPos)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Penggeser Perbandingan Gambar Asli dan Hasil Transparan"
                onKeyDown={handleKeyDown}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 flex items-center justify-center cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black rounded-full pointer-events-auto"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-xl border-2 border-white/80 transition-transform hover:scale-110 active:scale-95">
                  ↔
                </div>
              </div>
            </div>

            {/* Labels floating at bottom corners */}
            <div className="absolute bottom-3 left-3 z-20 pointer-events-none px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-medium text-white/90 border border-white/10 shadow-sm">
              Asli
            </div>
            <div className="absolute bottom-3 right-3 z-20 pointer-events-none px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-medium text-orange-200 border border-white/10 shadow-sm">
              Transparan
            </div>
          </>
        )}
      </div>
    </div>
  )
}
