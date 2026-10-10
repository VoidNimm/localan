import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { BrainCircuit, ChevronDown, Check } from 'lucide-react'
import { GlassSurface } from './GlassSurface'
import { GlassLens } from './GlassLens'
import type { ModelCapabilities } from '../services/ollama'

export type EffortLevel = 'none' | 'low' | 'medium' | 'high'

interface EffortPillProps {
  capabilities: ModelCapabilities | null
  effort: EffortLevel
  onEffortChange: (effort: EffortLevel) => void
}

const EffortPillBase: React.FC<EffortPillProps> = ({
  capabilities,
  effort,
  onEffortChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const handleSelect = useCallback(
    (level: EffortLevel) => {
      onEffortChange(level)
      setIsOpen(false)
    },
    [onEffortChange],
  )

  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  // Hide completely if no capabilities fetched or if model doesn't support thinking
  if (!capabilities || !capabilities.hasThinking) {
    return null
  }

  const isGptOss = capabilities.isGptOss

  // Options configuration
  const options = isGptOss
    ? [
        { value: 'low' as EffortLevel, label: 'Rendah' },
        { value: 'medium' as EffortLevel, label: 'Sedang' },
        { value: 'high' as EffortLevel, label: 'Tinggi' },
      ]
    : [
        { value: 'none' as EffortLevel, label: 'Mati' },
        { value: 'low' as EffortLevel, label: 'Hidup' },
      ]

  const currentOption = options.find((o) => o.value === (isGptOss && effort === 'none' ? 'medium' : effort)) || options[0]

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <GlassSurface className="group select-none shadow-md">
        <button
          type="button"
          onClick={toggle}
          className="pill-model h-[var(--control-h)] px-4 flex items-center gap-2 text-xs font-medium text-white cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Atur tingkat berpikir AI"
        >
          <BrainCircuit className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 ${currentOption.value === 'none' ? 'text-white/50' : 'text-emerald-400'}`} />
          <span className="font-semibold tracking-wide text-white whitespace-nowrap">Berpikir: {currentOption.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </GlassSurface>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 bottom-full mb-3 w-40 rounded-2xl glass-effect p-2 shadow-2xl z-50 border border-white/20 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          style={{ backgroundColor: 'rgba(26, 16, 12, 0.92)' }}
        >
          <div ref={listRef} className="py-1 space-y-1 relative">
            <GlassLens
              containerRef={listRef}
              itemSelector=".lens-item"
              activeItemSelector=".lens-item[aria-selected='true']"
            />
            {options.map((opt) => {
              const isSelected = opt.value === currentOption.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`lens-item relative z-10 w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 text-xs ${
                    isSelected ? 'text-white border border-emerald-500/40' : 'hover:text-white text-white/80'
                  }`}
                >
                  <span className="font-medium text-white">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export const EffortPill = memo(EffortPillBase)
