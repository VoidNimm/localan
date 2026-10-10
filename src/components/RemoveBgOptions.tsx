import React from 'react'
import { SlidersHorizontal, Folder, FolderCheck } from 'lucide-react'

export type DimensionOption = 'original' | '4096' | '2048' | '1024' | 'custom'

export interface RemoveBgOptionsProps {
  selectedModel?: string
  onModelChange?: (model: string) => void
  downloadedModels?: string[]
  onToggleDownloadedModel?: (modelId: string, isDownloaded: boolean) => void
  dimensionOption: DimensionOption
  onDimensionChange: (dim: DimensionOption) => void
  customDimension?: number
  onCustomDimensionChange?: (dim: number) => void
  hasWorkingFolder?: boolean
  useWorkingFolderSubdir?: boolean
  onToggleWorkingFolderSubdir?: (val: boolean) => void
  rembgFolderName?: string
  onChangeRembgFolder?: () => void
  className?: string
  disabled?: boolean
}

export const RemoveBgOptions: React.FC<RemoveBgOptionsProps> = ({
  dimensionOption,
  onDimensionChange,
  customDimension = 1920,
  onCustomDimensionChange,
  hasWorkingFolder = false,
  useWorkingFolderSubdir = false,
  onToggleWorkingFolderSubdir,
  rembgFolderName,
  onChangeRembgFolder,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={`space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-white/90 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-sm font-semibold text-white/95">
        <SlidersHorizontal className="w-4 h-4 text-orange-400" />
        <span>Pengaturan Ekspor Gambar</span>
      </div>

      {/* Info Model Standar */}
      <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5">
        <span className="text-white/60">Model AI Default</span>
        <span className="text-white/90 font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          BiRefNet General
        </span>
      </div>

      {/* 2. Target Resolution (Dimension) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/70">Resolusi Output</label>
          <span className="text-[10px] text-white/50">Maks. 25 Megapiksel</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'original', label: 'Asli' },
            { id: '4096', label: '4096 px' },
            { id: '2048', label: '2048 px' },
            { id: '1024', label: '1024 px' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onDimensionChange(opt.id as DimensionOption)}
              className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all ${
                dimensionOption === opt.id
                  ? 'bg-orange-500 text-white border-orange-400 shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dimensionOption === 'custom' && onCustomDimensionChange && (
          <div className="pt-1 flex items-center gap-2">
            <span className="text-xs text-white/60">Sisi terpanjang:</span>
            <input
              type="number"
              min="256"
              max="5000"
              step="64"
              value={customDimension}
              onChange={(e) => onCustomDimensionChange(Number(e.target.value) || 1024)}
              disabled={disabled}
              className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded-md text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <span className="text-xs text-white/60">px</span>
          </div>
        )}
      </div>

      {/* 3. Storage Destination Options */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <label className="text-xs font-medium text-white/70 block">Lokasi Penyimpanan File</label>
        
        {/* Working folder option if active */}
        {hasWorkingFolder && onToggleWorkingFolderSubdir && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggleWorkingFolderSubdir(!useWorkingFolderSubdir)}
            className={`w-full text-left p-2 rounded-xl border transition-all text-xs flex items-center justify-between ${
              useWorkingFolderSubdir
                ? 'bg-orange-500/15 border-orange-500/50 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <div className="font-medium">Subfolder Folder Kerja aktif</div>
                <div className="text-[10px] text-white/50">Disimpan ke direktori rembg/</div>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                useWorkingFolderSubdir
                  ? 'bg-orange-500 border-orange-400 text-white'
                  : 'border-white/20 bg-white/5'
              }`}
            >
              {useWorkingFolderSubdir ? '✓' : ''}
            </div>
          </button>
        )}

        {/* Dedicated rembg folder */}
        {!useWorkingFolderSubdir && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <Folder className="w-4 h-4 text-orange-300 shrink-0" />
              <span className="truncate text-white/80">
                {rembgFolderName ? `Folder: ${rembgFolderName}` : 'Unduhan Langsung Browser'}
              </span>
            </div>
            {onChangeRembgFolder && (
              <button
                type="button"
                onClick={onChangeRembgFolder}
                disabled={disabled}
                className="text-[11px] font-medium text-orange-400 hover:text-orange-300 hover:underline shrink-0"
              >
                Ganti Folder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
