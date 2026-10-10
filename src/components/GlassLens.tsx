import React, { useEffect, useRef, useState, useCallback } from 'react'
import { GlassSurface } from './GlassSurface'

interface GlassLensProps {
  containerRef: React.RefObject<HTMLElement | null>
  itemSelector: string
  activeItemSelector: string
  activeKey?: string | number | null
  enabled?: boolean
  className?: string
  cornerRadius?: number
}

export const GlassLens: React.FC<GlassLensProps> = ({
  containerRef,
  itemSelector,
  activeItemSelector,
  activeKey,
  enabled = true,
  className = '',
  cornerRadius,
}) => {
  const [style, setStyle] = useState<{
    top: number
    left: number
    width: number
    height: number
    opacity: number
    scale: number
    borderRadius?: string
  }>({ top: 0, left: 0, width: 0, height: 0, opacity: 0, scale: 1, borderRadius: 'var(--radius-pill)' })

  const isPointerInside = useRef(false)
  const hoveredTargetRef = useRef<HTMLElement | null>(null)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback((target: HTMLElement) => {
    const container = containerRef.current
    if (!container || container.offsetWidth < 100) {
      setStyle((s) => ({ ...s, opacity: 0 }))
      return
    }
    const rect = target.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const targetBorderRadius =
      cornerRadius !== undefined
        ? `${cornerRadius}px`
        : window.getComputedStyle(target).borderRadius || 'var(--radius-pill)'

    setStyle({
      top: rect.top - containerRect.top + container.scrollTop,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
      opacity: 1,
      scale: 1,
      borderRadius: targetBorderRadius,
    })
  }, [containerRef, cornerRadius])

  const resetToActive = useCallback(() => {
    const container = containerRef.current
    if (!container || container.offsetWidth < 100) {
      setStyle((s) => ({ ...s, opacity: 0 }))
      return
    }
    const active = container.querySelector(activeItemSelector) as HTMLElement
    if (active) {
      updatePosition(active)
    } else {
      setStyle((s) => ({ ...s, opacity: 0 }))
    }
  }, [containerRef, activeItemSelector, updatePosition])

  // Sync to active item when activeKey changes and pointer is not actively hovering another item
  useEffect(() => {
    if (!enabled) return
    if (!isPointerInside.current) {
      resetToActive()
    }
  }, [activeKey, enabled, resetToActive])

  useEffect(() => {
    if (!enabled || !containerRef.current) return
    const container = containerRef.current

    const handlePointerMove = (e: PointerEvent) => {
      if (container.offsetWidth < 100) return
      const el = e.target as HTMLElement
      // Find the item: directly via selector or through parent row if hovering adjacent controls (e.g. 3-dots action)
      const target =
        (el.closest(itemSelector) as HTMLElement) ||
        (el.closest('[data-slot="sidebar-menu-item"]')?.querySelector(itemSelector) as HTMLElement) ||
        (el.closest('.group\\/menu-item')?.querySelector(itemSelector) as HTMLElement) ||
        null

      if (target) {
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current)
          resetTimeoutRef.current = null
        }
        isPointerInside.current = true
        hoveredTargetRef.current = target
        updatePosition(target)
      } else if (isPointerInside.current) {
        // Pointer is in container but briefly over a margin/gap/label. Give a brief grace period before resetting.
        if (!resetTimeoutRef.current) {
          resetTimeoutRef.current = setTimeout(() => {
            isPointerInside.current = false
            hoveredTargetRef.current = null
            resetToActive()
            resetTimeoutRef.current = null
          }, 120)
        }
      }
    }

    const handlePointerLeave = () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
        resetTimeoutRef.current = null
      }
      isPointerInside.current = false
      hoveredTargetRef.current = null
      resetToActive()
    }

    const handleScroll = () => {
      if (hoveredTargetRef.current) {
        updatePosition(hoveredTargetRef.current)
      } else {
        resetToActive()
      }
    }

    const handleTransitionEnd = (e: TransitionEvent) => {
      const sidebarEl = container.closest('[data-sidebar="sidebar"]')
      // Only react if the sidebar container itself finished its width transition (not children)
      if (e.target === sidebarEl && (e.propertyName === 'width' || e.propertyName === 'max-width')) {
        if (hoveredTargetRef.current) {
          updatePosition(hoveredTargetRef.current)
        } else {
          resetToActive()
        }
      }
    }

    const t1 = setTimeout(resetToActive, 50)
    const t2 = setTimeout(resetToActive, 200)

    const ro = new ResizeObserver(() => {
      if (container.offsetWidth < 100) {
        setStyle((s) => ({ ...s, opacity: 0 }))
      } else if (hoveredTargetRef.current) {
        updatePosition(hoveredTargetRef.current)
      } else {
        resetToActive()
      }
    })
    ro.observe(container)

    // Observe active attribute changes on items
    const mo = new MutationObserver(() => {
      if (!isPointerInside.current) {
        resetToActive()
      }
    })
    mo.observe(container, {
      attributes: true,
      attributeFilter: ['data-active', 'aria-selected'],
      subtree: true,
    })

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    container.addEventListener('scroll', handleScroll, { passive: true })
    container.addEventListener('transitionend', handleTransitionEnd)
    window.addEventListener('resize', resetToActive)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
      ro.disconnect()
      mo.disconnect()
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('transitionend', handleTransitionEnd)
      window.removeEventListener('resize', resetToActive)
    }
  }, [enabled, containerRef, itemSelector, activeItemSelector, cornerRadius, updatePosition, resetToActive])

  if (!enabled) return null

  return (
    <div
      aria-hidden="true"
      className={`absolute pointer-events-none z-0 group-data-[collapsible=icon]:hidden transition-opacity ${className}`}
      style={{
        top: style.top,
        left: style.left,
        width: style.width,
        height: style.height,
        opacity: style.opacity,
        transform: `scale(${style.scale})`,
        borderRadius: style.borderRadius || 'var(--radius-pill)',
        transition:
          'top 200ms cubic-bezier(0.16, 1, 0.3, 1), left 200ms cubic-bezier(0.16, 1, 0.3, 1), width 200ms cubic-bezier(0.16, 1, 0.3, 1), height 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease-out',
        willChange: 'transform, top, left, width, height, opacity',
      }}
    >
      <GlassSurface
        variant="css"
        cornerRadius={cornerRadius}
        className="w-full h-full glass-lens-surface"
        style={style.borderRadius ? { borderRadius: style.borderRadius } : undefined}
      >
        <span className="sr-only">Lens Background</span>
      </GlassSurface>
    </div>
  )
}
