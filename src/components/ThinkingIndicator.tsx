import React, { useState, useEffect } from 'react'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { GlassSurface } from './GlassSurface'

interface ThinkingIndicatorProps {
  modelName?: string
  hasAttachments?: boolean
  isModelLoading?: boolean
  isThinkingEnabled?: boolean
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  hasAttachments = false,
  isModelLoading = false,
  isThinkingEnabled = true,
}) => {
  const getThinkingStage = () => {
    if (isModelLoading) {
      return 'Memuat model ke memori...'
    }
    if (hasAttachments) {
      return 'Membaca dokumen lampiran...'
    }
    if (!isThinkingEnabled) {
      return 'Sedang menjawab...'
    }
    return 'Sedang berpikir...'
  }

  return (
    <GlassSurface
      className="animate-in fade-in zoom-in-95 duration-200 select-none max-w-fit shadow-xl"
      displacementScale={35}
      blurAmount={0.08}
      saturation={125}
      cornerRadius={9999}
    >
      <div className="flex items-center gap-3.5 px-4 py-2.5 sm:px-5">
        {/* Animated AI Logo during loading / thinking */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-md bg-orange-500/25 blur-sm animate-pulse" />
          <img
            src="/assets/logo.png"
            alt="AI Berpikir"
            className="w-5 h-5 object-contain rounded-md relative z-10 animate-pulse shadow-sm"
          />
        </div>

        {/* Concise Thinking Message */}
        <div className="flex flex-col min-w-0 gap-1 pr-1">
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-[13px] font-medium text-white/95 thinking-shimmer">
              {getThinkingStage()}
            </span>

            {/* 3 Bouncing Dots */}
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 rounded-full bg-orange-400 animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </GlassSurface>
  )
}

interface ReasoningBlockProps {
  thinking: string
  isComplete: boolean
  durationStr?: string
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ thinking, isComplete, durationStr }) => {
  // If thinking is actively streaming, keep it expanded by default; when complete, allow toggling
  const [isExpanded, setIsExpanded] = useState(!isComplete)

  // Auto-collapse when complete
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    if (isComplete) {
      timeoutId = setTimeout(() => {
        setIsExpanded(false)
      }, 0)
    }
    return () => clearTimeout(timeoutId)
  }, [isComplete])

  return (
    <GlassSurface
      variant="css"
      cornerRadius={16}
      className="my-3 overflow-hidden text-xs transition-all border border-white/10 w-full block"
    >
      <div className="w-full flex flex-col">
        {/* Header bar */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] text-white/70 hover:text-white transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            {!isComplete ? (
              <div className="relative shrink-0 flex items-center justify-center">
                <img
                  src="/assets/logo.png"
                  alt="AI Berpikir"
                  className="w-3.5 h-3.5 object-contain rounded-sm animate-pulse"
                />
              </div>
            ) : (
              <Brain className="w-3.5 h-3.5 text-white/40" />
            )}
            <span className="font-medium text-xs">
              {isComplete ? `Proses berpikir${durationStr ? ` (${durationStr})` : ''}` : 'Sedang berpikir secara mendalam...'}
            </span>
            {!isComplete && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping ml-1" />
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span>{isExpanded ? 'Sembunyikan' : 'Lihat'}</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {/* Collapsible thought text */}
        {isExpanded && (
          <div className="p-3.5 max-h-56 overflow-y-auto border-t border-white/5 bg-black/20 text-white/70 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {thinking || 'Menganalisis pertanyaan dan merumuskan penalaran...'}
          </div>
        )}
      </div>
    </GlassSurface>
  )
}
