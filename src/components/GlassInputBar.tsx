import React, { useRef, useEffect, useState } from 'react'
import { Plus, ArrowUp, Square, X, FileText, Code2, Loader2, Sparkles } from 'lucide-react'
import { GlassSurface } from './GlassSurface'
import { ModelSelector } from './ModelSelector'
import { EffortPill, type EffortLevel } from './EffortPill'
import type { OllamaModelInfo, FileAttachment, ModelCapabilities } from '../services/ollama'
import type { AppPhase } from './VideoBackground'
import { readFileAsAttachment, formatFileSize, isCodeFile } from '../utils/fileReader'

interface GlassInputBarProps {
  phase: AppPhase
  models: OllamaModelInfo[]
  profiles: import('../types/profile').ChatProfile[]
  selectedModel: string
  onSelectModel: (name: string) => void
  isConnected: boolean
  isModelLoading: boolean
  isGenerating: boolean
  onSendMessage: (text: string, attachments?: FileAttachment[]) => void
  onStopGeneration?: () => void
  onRefreshModels?: () => void
  onCreateProfile?: () => void
  onEditProfile?: (profile: import('../types/profile').ChatProfile) => void
  onDeleteProfile?: (id: string) => void
  capabilities: ModelCapabilities | null
  effort: EffortLevel
  onEffortChange: (effort: EffortLevel) => void
  onOpenRemoveBg?: (attachment: FileAttachment, onApply?: (newAttachment: FileAttachment) => void) => void
}

export const GlassInputBar: React.FC<GlassInputBarProps> = ({
  phase,
  models,
  profiles,
  selectedModel,
  onSelectModel,
  isConnected,
  isModelLoading,
  isGenerating,
  onSendMessage,
  onStopGeneration,
  onRefreshModels,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
  capabilities,
  effort,
  onEffortChange,
  onOpenRemoveBg,
}) => {
  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isReadingFiles, setIsReadingFiles] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Autofocus when page loads or on landing
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [phase])

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const newHeight = Math.min(el.scrollHeight, 160)
      el.style.height = `${Math.max(newHeight, 24)}px`
    }
  }, [inputText])

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    setIsReadingFiles(true)
    try {
      const newAttachments: FileAttachment[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const att = await readFileAsAttachment(file)
        newAttachments.push(att)
      }
      setAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      console.error('Error reading files:', err)
    } finally {
      setIsReadingFiles(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault()
      handleFiles(e.clipboardData.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleSend = () => {
    const trimmed = inputText.trim()
    if ((!trimmed && attachments.length === 0) || isGenerating || isReadingFiles) return
    onSendMessage(trimmed, attachments.length > 0 ? attachments : undefined)
    setInputText('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend =
    (inputText.trim().length > 0 || attachments.length > 0) &&
    !isGenerating &&
    !isReadingFiles

  return (
    <div
      className={`input-island ${isDraggingOver ? 'ring-2 ring-orange-500/60 rounded-3xl transition-all' : ''}`}
      data-phase={phase}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.markdown,.json,.csv,.pdf,.js,.jsx,.ts,.tsx,.py,.html,.css,.scss,.java,.c,.cpp,.h,.cs,.go,.rs,.php,.rb,.sql,.sh,.yaml,.yml,.xml,.log,.env,.toml"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Pill model: rata kiri kapsul input (offset = tombol + dan gap) */}
      <div className="input-island__pill flex gap-2 flex-wrap max-w-full">
        <ModelSelector
          models={models}
          profiles={profiles}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          isConnected={isConnected}
          isModelLoading={isModelLoading}
          onRefreshModels={onRefreshModels}
          onCreateProfile={onCreateProfile}
          onEditProfile={onEditProfile}
          onDeleteProfile={onDeleteProfile}
        />
        <EffortPill
          capabilities={capabilities}
          effort={effort}
          onEffortChange={onEffortChange}
        />
      </div>

      {/* Attachment Previews Tray */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 max-h-36 overflow-y-auto animate-in fade-in slide-in-from-bottom-1 duration-200">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-[#201511]/90 border border-white/15 text-xs text-white backdrop-blur-md shadow-lg group hover:border-orange-500/40 transition-colors"
            >
              {att.isImage && att.previewUrl ? (
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                  {isCodeFile(att.name) ? (
                    <Code2 className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
              )}

              <div className="flex flex-col min-w-0 max-w-[130px] sm:max-w-[200px]">
                <span className="truncate font-medium text-white/95 text-[12px]">{att.name}</span>
                <span className="text-[10px] text-white/50">{formatFileSize(att.size)}</span>
              </div>

              {att.isImage && onOpenRemoveBg && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenRemoveBg(att, (newAtt) => {
                      setAttachments((prev) =>
                        prev.map((a) => (a.id === att.id ? newAtt : a))
                      )
                    })
                  }
                  className="p-1 rounded-full hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 transition-colors ml-0.5"
                  title="Hapus background gambar ini dengan rembg AI"
                  aria-label={`Hapus background ${att.name}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors ml-0.5"
                title="Hapus file"
                aria-label={`Hapus ${att.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Baris kontrol: [+] [kapsul input flex-1] [kirim] */}
      <div className="input-island__row">
        <GlassSurface className="shrink-0" displacementScale={40}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadingFiles}
            className="control-circle text-white/90 hover:text-white"
            aria-label="Upload file atau gambar"
            title="Upload file (gambar, dokumen, kode) untuk dianalisis AI"
          >
            {isReadingFiles ? (
              <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </GlassSurface>

        {/* Kapsul input: fallback CSS (caret & lebar variabel tidak stabil di SVG displacement) */}
        <GlassSurface variant="css" className={`input-capsule flex-1 min-w-0 ${inputText.includes('\n') || inputText.length > 50 ? 'input-capsule--multiline' : ''}`}>
          <div className="input-capsule__inner">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={attachments.length > 0 ? "Tanyakan sesuatu tentang file ini..." : "Tanya apa saja..."}
              rows={1}
              spellCheck={false}
              className="input-capsule__textarea"
              aria-label="Pesan percakapan"
            />
          </div>
        </GlassSurface>

        <GlassSurface className="shrink-0" displacementScale={40}>
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="control-circle send-btn send-btn--active"
              aria-label="Hentikan respons model"
              title="Hentikan generasi (Stop)"
            >
              <Square className="w-4 h-4 fill-white text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`control-circle send-btn ${canSend ? 'send-btn--active' : 'send-btn--disabled'}`}
              aria-label="Kirim pesan"
              title="Kirim pesan (Enter)"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </GlassSurface>
      </div>

      {phase === 'landing' && <p className="input-island__tagline">Everything is local and private.</p>}
    </div>
  )
}