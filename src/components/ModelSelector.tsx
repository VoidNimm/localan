import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Loader2, Server, RefreshCw, Plus, User, Edit2, Trash2 } from 'lucide-react'
import type { OllamaModelInfo } from '../services/ollama'
import type { ChatProfile } from '../types/profile'
import { GlassSurface } from './GlassSurface'
import { GlassLens } from './GlassLens'

interface ModelSelectorProps {
  models: OllamaModelInfo[]
  profiles: ChatProfile[]
  selectedModel: string
  onSelectModel: (modelName: string) => void
  isConnected: boolean
  isModelLoading?: boolean
  onRefreshModels?: () => void
  onCreateProfile?: () => void
  onEditProfile?: (profile: ChatProfile) => void
  onDeleteProfile?: (profileId: string) => void
}

const formatGB = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`

const ModelSelectorBase: React.FC<ModelSelectorProps> = ({
  models,
  profiles,
  selectedModel,
  onSelectModel,
  isConnected,
  isModelLoading = false,
  onRefreshModels,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentProfile = useMemo(() => profiles.find(p => p.id === selectedModel), [profiles, selectedModel])
  
  const current = useMemo<{ name: string; label: string }>(() => {
    if (currentProfile) {
      return { name: currentProfile.name, label: `Profile (${currentProfile.baseModel})` }
    }
    const m = models.find((m) => m.name === selectedModel)
    return m ?? models[0] ?? { name: selectedModel, label: 'Local LLM' }
  }, [models, selectedModel, currentProfile])

  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const handleSelect = useCallback(
    (name: string) => {
      onSelectModel(name)
      setIsOpen(false)
    },
    [onSelectModel],
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

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <GlassSurface className="group select-none shadow-md">
        <button
          type="button"
          onClick={toggle}
          className="pill-model h-[var(--control-h)] px-4 flex items-center gap-2 text-xs font-medium text-white cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Pilih model AI lokal"
        >
          {isModelLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
          ) : currentProfile ? (
            <User className="w-3.5 h-3.5 text-orange-300 transition-transform duration-200 group-hover:scale-110" />
          ) : (
            <img
              src="/assets/logo.png"
              alt="Model AI"
              className="w-4 h-4 object-contain rounded-sm transition-transform duration-200 group-hover:scale-105 shrink-0"
            />
          )}

          <span className="font-semibold tracking-wide text-white">{current.name}</span>
          <span className="text-white/60 hidden sm:inline-block">({current.label})</span>

          <ChevronDown
            className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </GlassSurface>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 bottom-full mb-3 w-72 sm:w-80 rounded-2xl glass-effect p-2 shadow-2xl z-50 border border-white/20 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col"
          style={{ backgroundColor: 'rgba(26, 16, 12, 0.92)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-xs text-white/70">
            <span className="flex items-center gap-1.5 font-medium">
              <Server className="w-3 h-3 text-orange-400" />
              Ollama Local Models
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
                title={isConnected ? 'Ollama Terhubung' : 'Ollama Offline'}
              />
              <span className="text-[10px] text-white/50">{isConnected ? 'Connected' : 'Offline'}</span>
              {onRefreshModels && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRefreshModels()
                  }}
                  className="p-1 hover:text-white transition-colors"
                  title="Perbarui daftar model"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div ref={listRef} className="max-h-60 overflow-y-auto overflow-x-hidden py-1 space-y-1 relative">
            <GlassLens
              containerRef={listRef}
              itemSelector=".lens-item"
              activeItemSelector=".lens-item[aria-selected='true']"
            />
            
            {profiles.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Profiles
              </div>
            )}
            
            {profiles.map((p) => {
              const isSelected = p.id === selectedModel
              return (
                <div key={p.id} className="relative group/item">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(p.id)}
                    className={`lens-item relative z-10 w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start justify-between gap-2 text-xs ${
                      isSelected ? 'text-white border border-orange-500/40' : 'hover:text-white text-white/80'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-orange-300" />
                        <span className="font-semibold text-white truncate">{p.name}</span>
                      </div>
                      <p className="text-[11px] text-white/60 mt-0.5 leading-tight truncate">Base: {p.baseModel}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity z-20">
                    {onEditProfile && (
                      <button onClick={(e) => { e.stopPropagation(); onEditProfile(p); }} className="p-1.5 text-white/50 hover:text-white" title="Edit Profile">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteProfile && (
                      <button onClick={(e) => { e.stopPropagation(); onDeleteProfile(p.id); }} className="p-1.5 text-white/50 hover:text-red-400" title="Delete Profile">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider mt-2">
              Raw Models
            </div>

            {models.map((m) => {
              const isSelected = m.name === selectedModel
              return (
                <button
                  key={m.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={m.description}
                  onClick={() => handleSelect(m.name)}
                  className={`lens-item relative z-10 w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start justify-between gap-2 text-xs ${
                    isSelected ? 'text-white border border-orange-500/40' : 'hover:text-white text-white/80'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <img
                        src="/assets/logo.png"
                        alt="Model AI"
                        className="w-3.5 h-3.5 object-contain rounded-sm opacity-60 group-hover/item:opacity-100 shrink-0 transition-opacity"
                      />
                      <span className="font-semibold text-white truncate">{m.name}</span>
                      {m.parameterSize && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-orange-300">
                          {m.parameterSize}
                        </span>
                      )}
                      {m.sizeBytes ? (
                        <span className="text-[10px] font-mono text-white/40">{formatGB(m.sizeBytes)}</span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5 leading-tight truncate">{m.label}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
                </button>
              )
            })}
          </div>
          
          <div className="mt-1 pt-1 border-t border-white/10 shrink-0">
            {onCreateProfile && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onCreateProfile()
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-orange-300 hover:text-orange-200 hover:bg-white/5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Profile</span>
              </button>
            )}
            {!isConnected && (
              <div className="px-3 py-2 mt-1 text-[11px] text-amber-300/80 leading-snug">
                Ollama belum terdeteksi aktif di port 11434. Pastikan aplikasi Ollama berjalan di komputer Anda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const ModelSelector = memo(ModelSelectorBase)
