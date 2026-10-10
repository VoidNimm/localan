import React, { useLayoutEffect, useRef, useState } from 'react'
import LiquidGlass from 'liquid-glass-react'

/**
 * GlassSurface: satu-satunya pintu masuk efek kaca.
 *
 * Temuan dari sumber liquid-glass-react: komponen merender BEBERAPA elemen saudara
 * (lapisan gelap, kontainer kaca, span highlight) yang masing-masing `position: relative;
 * top: 50%; left: 50%` + `translate(-50%, -50%)`. Tanpa kontainer ber-ukuran, tiap lapisan
 * menumpuk di alur normal dan bergeser 50% dari induk -> tampak "yatim" di tengah layar.
 * Ukuran kaca juga hanya diukur dari isinya saat mount / resize window.
 *
 * Solusi: wrapper `relative` ber-ukuran (ukuran dari children asli di alur normal), dan
 * LiquidGlass dirender sebagai lapisan dekoratif `position: absolute` di dalam wrapper itu
 * dengan isi kosong seukuran wrapper (diukur ResizeObserver, di-remount saat ukuran berubah).
 * Children interaktif ada di atas lapisan, sehingga caret/klik/fokus tidak disentuh library.
 *
 * variant="css": fallback murni CSS (backdrop-filter) untuk elemen yang tidak stabil
 * dengan SVG displacement, mis. kapsul input lebar dengan caret.
 */

interface GlassSurfaceProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  variant?: 'liquid' | 'css'
  displacementScale?: number
  blurAmount?: number
  saturation?: number
  cornerRadius?: number
}

const detectFallback = (): boolean => {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  const ua = navigator.userAgent || ''
  if (/^((?!chrome|android).)*safari/i.test(ua) || /firefox/i.test(ua)) return true
  try {
    const canvas = document.createElement('canvas')
    return !(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return true
  }
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  className = '',
  style,
  variant = 'liquid',
  displacementScale = 40,
  blurAmount = 0.08,
  saturation = 120,
  cornerRadius,
}) => {
  const [useFallback] = useState(detectFallback)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || variant !== 'liquid' || useFallback) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant, useFallback])

  const useCss = variant === 'css' || useFallback
  const radiusValue = cornerRadius !== undefined ? `${cornerRadius}px` : 'var(--radius-pill)'

  return (
    <div
      ref={ref}
      className={`glass-surface relative ${useCss ? 'glass-pill' : ''} ${className}`}
      style={{ borderRadius: radiusValue, ...style }}
    >
      {!useCss && size && size.w > 0 && (
        <div
          aria-hidden="true"
          className="glass-surface__layer absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius: radiusValue }}
        >
          <LiquidGlass
            key={`${size.w}x${size.h}`}
            cornerRadius={cornerRadius ?? 9999}
            displacementScale={displacementScale}
            blurAmount={blurAmount}
            saturation={saturation}
            aberrationIntensity={1}
            elasticity={0}
            padding="0px"
            style={{ position: 'absolute', top: '50%', left: '50%' }}
          >
            <div style={{ width: size.w, height: size.h }} />
          </LiquidGlass>
        </div>
      )}
      <div className="relative z-[1] flex items-center">{children}</div>
    </div>
  )
}
