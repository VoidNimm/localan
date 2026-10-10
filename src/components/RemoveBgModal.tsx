import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Folder,
  Download,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  FolderCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import {
  removeBackground,
  checkRembgHealth,
  DEFAULT_REMBG_MODEL,
  RembgServerOfflineError,
  RembgOOMError,
  RembgTimeoutError,
  RembgAbortError,
} from '@/services/removeBg'
import {
  generateRembgFileName,
  getStoredRembgFolder,
  checkHandlePermission,
  requestHandlePermission,
  selectNewRembgFolder,
  saveRembgOutputToFolder,
  writeBlobSafelyToDirectory,
  saveFallbackFile,
} from '@/services/removeBgStorage'
import { resolveBlobFromSource } from '@/utils/blob'
import { getImageDimensions, resizeImage } from '@/utils/fileReader'
import type { FileAttachment } from '@/utils/fileReader'
import { ImageCompareSlider } from './ImageCompareSlider'
import type { DirectoryReference } from '@/adapters/storage'

export interface RemoveBgSourceImage {
  file?: File | Blob
  previewUrl: string
  name: string
}

interface RemoveBgModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceImage: RemoveBgSourceImage | null
  workingFolderHandle?: DirectoryReference | null
  onApplyToChat?: (attachment: FileAttachment) => void
}

type DimensionOption = 'original' | '4096' | '2048' | '1024' | 'custom'
type PreviewMode = 'split' | 'result' | 'original'

const STORAGE_PREF_KEY = 'local_chat_rembg_pref'

interface UserPreferences {
  model: string
  dimension: DimensionOption
  customDim: number
}

export const RemoveBgModal: React.FC<RemoveBgModalProps> = ({
  open,
  onOpenChange,
  sourceImage,
  workingFolderHandle,
  onApplyToChat,
}) => {
  // Preferences
  const selectedModel = DEFAULT_REMBG_MODEL

  const [dimensionOption, setDimensionOption] = useState<DimensionOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREF_KEY)
      if (saved) return JSON.parse(saved).dimension || 'original'
    } catch {
      // ignore
    }
    return 'original'
  })

  const [customDimension, setCustomDimension] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREF_KEY)
      if (saved) return JSON.parse(saved).customDim || 1920
    } catch {
      // ignore
    }
    return 1920
  })

  const [isOptionsOpen, setIsOptionsOpen] = useState(false)

  // Image Dimensions
  const [origDimensions, setOrigDimensions] = useState<{ width: number; height: number } | null>(null)

  // Process State
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('Menghubungi server rembg...')
  const [processElapsed, setProcessElapsed] = useState(0)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [inferenceDuration, setInferenceDuration] = useState<number | null>(null)

  // Error State
  const [errorType, setErrorType] = useState<'offline' | 'oom' | 'timeout' | 'generic' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Storage Target
  const [rembgFolderHandle, setRembgFolderHandle] = useState<DirectoryReference | null>(null)
  const [folderPermission, setFolderPermission] = useState<PermissionState>('prompt')
  const [useWorkingFolderSubdir, setUseWorkingFolderSubdir] = useState(false)
  const [isSavedSuccess, setIsSavedSuccess] = useState<string | null>(null)

  // Preview UI
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split')

  // Abort controller
  const abortControllerRef = useRef<AbortController | null>(null)

  // Save preferences
  useEffect(() => {
    try {
      const pref: UserPreferences = {
        model: selectedModel,
        dimension: dimensionOption,
        customDim: customDimension,
      }
      localStorage.setItem(STORAGE_PREF_KEY, JSON.stringify(pref))
    } catch {
      // ignore
    }
  }, [selectedModel, dimensionOption, customDimension])

  // Load Folder Handle on mount / open
  useEffect(() => {
    if (!open) return
    let active = true
    getStoredRembgFolder().then(async (handle: DirectoryReference | null) => {
      if (active && handle) {
        setRembgFolderHandle(handle)
        const perm = await checkHandlePermission(handle)
        if (active) setFolderPermission(perm)
      }
    })
    return () => {
      active = false
    }
  }, [open])

  // Get image dimensions when source changes
  useEffect(() => {
    if (!sourceImage) return

    let active = true
    const imgFileOrUrl = sourceImage.file
    if (imgFileOrUrl) {
      getImageDimensions(imgFileOrUrl)
        .then((dims) => {
          if (active) setOrigDimensions(dims)
        })
        .catch(() => {
          if (active) setOrigDimensions(null)
        })
    } else {
      const img = new Image()
      img.onload = () => {
        if (active) setOrigDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.src = sourceImage.previewUrl
    }

    return () => {
      active = false
    }
  }, [sourceImage])

  // Timer for dynamic loading state
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isProcessing) {
      interval = setInterval(() => {
        setProcessElapsed((prev) => {
          const next = prev + 1
          if (next >= 3) {
            setProgressText(
              'Sedang mengunduh / memuat bobot model ke GPU (RTX 4060)... Proses ini lebih lama pada penggunaan pertama.'
            )
          }
          if (next >= 12) {
            setProgressText('Memisahkan background dari gambar...')
          }
          return next
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isProcessing])

  // Calculate target dimension number
  const getTargetMaxDim = useCallback((): number | null => {
    if (dimensionOption === 'original') return null
    if (dimensionOption === '4096') return 4096
    if (dimensionOption === '2048') return 2048
    if (dimensionOption === '1024') return 1024
    if (dimensionOption === 'custom') return customDimension > 0 ? customDimension : null
    return null
  }, [dimensionOption, customDimension])

  // Calculated dimension display
  const targetDimDisplay = React.useMemo(() => {
    if (!origDimensions) return 'Menghitung...'
    const maxDim = getTargetMaxDim()
    if (!maxDim || Math.max(origDimensions.width, origDimensions.height) <= maxDim) {
      return `${origDimensions.width} × ${origDimensions.height} px (Ukuran Asli)`
    }
    const scale = maxDim / Math.max(origDimensions.width, origDimensions.height)
    const targetW = Math.round(origDimensions.width * scale)
    const targetH = Math.round(origDimensions.height * scale)
    return `${targetW} × ${targetH} px`
  }, [origDimensions, getTargetMaxDim])

  // Process Image
  const handleProcess = useCallback(async () => {
    if (!sourceImage) return

    setIsProcessing(true)
    setErrorType(null)
    setErrorMessage(null)
    setProgressText('Menghubungi server rembg...')
    setIsSavedSuccess(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const startTime = performance.now()

    try {
      // 1. Check health
      const health = await checkRembgHealth()
      if (!health.isOnline) {
        throw new RembgServerOfflineError()
      }

      // 2. Prepare file / blob & optional resize
      let inputBlob: Blob | File | undefined = sourceImage.file
      if (!inputBlob) {
        inputBlob = await resolveBlobFromSource(sourceImage.previewUrl)
      }

      const targetDim = getTargetMaxDim()
      if (targetDim !== null) {
        setProgressText('Menyesuaikan ukuran gambar...')
        const resized = await resizeImage(inputBlob, targetDim)
        inputBlob = resized.blob
      }

      setProgressText('Mengirim gambar ke model rembg...')
      const output = await removeBackground(inputBlob, {
        model: selectedModel,
        signal: controller.signal,
        onProgress: (msg) => setProgressText(msg),
      })

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1)
      setInferenceDuration(parseFloat(elapsedSec))
      setResultBlob(output)

      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(output)
      })
    } catch (err: unknown) {
      if (err instanceof RembgAbortError) {
        // User aborted, keep previous state or reset
        return
      }
      if (err instanceof RembgServerOfflineError) {
        setErrorType('offline')
        setErrorMessage(
          'Server rembg offline di http://127.0.0.1:7000. Jalankan start-rembg.bat atau `npm run rembg`.'
        )
      } else if (err instanceof RembgOOMError) {
        setErrorType('oom')
        setErrorMessage(err.message)
      } else if (err instanceof RembgTimeoutError) {
        setErrorType('timeout')
        setErrorMessage(err.message)
      } else {
        setErrorType('generic')
        setErrorMessage(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [sourceImage, getTargetMaxDim, selectedModel])

  // Auto-process on initial dialog open if not already processed
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    if (open && sourceImage && !resultBlob && !isProcessing && !errorType) {
      timer = setTimeout(() => {
        void handleProcess()
      }, 50)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [open, sourceImage, resultBlob, isProcessing, errorType, handleProcess])

  // Cancel processing
  const handleCancelProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsProcessing(false)
    }
  }

  // Handle Save to Device
  const handleSaveToDevice = async () => {
    if (!resultBlob || !sourceImage) return

    try {
      const dimLabel = dimensionOption === 'original' ? 'orig' : targetDimDisplay.split(' ')[0]
      const finalFileName = generateRembgFileName(sourceImage.name, selectedModel, dimLabel)

      // Option A: Save to active working folder's rembg/ subfolder
      if (useWorkingFolderSubdir && workingFolderHandle) {
        const saved = await saveRembgOutputToFolder(workingFolderHandle, finalFileName, resultBlob)
        setIsSavedSuccess(`Tersimpan: ${saved.fullPath || `rembg/${finalFileName}`}`)
        return
      }

      // Option B: Save to user's dedicated rembg folder
      if (rembgFolderHandle) {
        const perm = await checkHandlePermission(rembgFolderHandle)
        if (perm !== 'granted') {
          const reqPerm = await requestHandlePermission(rembgFolderHandle)
          setFolderPermission(reqPerm)
          if (reqPerm !== 'granted') {
            const res = await saveFallbackFile(finalFileName, resultBlob)
            if (res.status === 'saved') {
              setIsSavedSuccess(`Tersimpan: ${res.fullPath || res.fileName}`)
            }
            return
          }
        }
        const saved = await writeBlobSafelyToDirectory(rembgFolderHandle, finalFileName, resultBlob)
        setIsSavedSuccess(`Tersimpan: ${saved.fullPath || `${rembgFolderHandle.name}/${finalFileName}`}`)
        return
      }

      // Option C: Fallback to dialog / browser download
      const res = await saveFallbackFile(finalFileName, resultBlob)
      if (res.status === 'saved') {
        setIsSavedSuccess(`Tersimpan: ${res.fullPath || res.fileName}`)
      }
    } catch (err) {
      console.error('Failed to save to device:', err)
    }
  }

  // Handle select new folder
  const handleSelectFolder = async () => {
    try {
      const handle = await selectNewRembgFolder()
      if (handle) {
        setRembgFolderHandle(handle)
        setFolderPermission('granted')
        setUseWorkingFolderSubdir(false)
      }
    } catch (err) {
      console.error('Failed to select folder:', err)
    }
  }

  // Handle Request Permission
  const handleRequestPermission = async () => {
    if (!rembgFolderHandle) return
    const perm = await requestHandlePermission(rembgFolderHandle)
    setFolderPermission(perm)
  }

  // Apply to chat attachment
  const handleApplyToChat = () => {
    if (!resultBlob || !resultUrl || !sourceImage || !onApplyToChat) return

    const newAttachment: FileAttachment = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      name: `nobg_${sourceImage.name.replace(/\.[^/.]+$/, '')}.png`,
      size: resultBlob.size,
      type: 'image/png',
      isImage: true,
      previewUrl: resultUrl,
    }

    onApplyToChat(newAttachment)
    onOpenChange(false)
  }

  // Reset when modal closes
  const handleClose = () => {
    if (isProcessing) {
      handleCancelProcess()
    }
    onOpenChange(false)
  }

  // Warning check for huge images (>4096 or >10MB)
  const isExtremeImage = React.useMemo(() => {
    if (!sourceImage) return false
    const isBigDim = origDimensions ? Math.max(origDimensions.width, origDimensions.height) > 4096 : false
    const isBigSize = sourceImage.file ? sourceImage.file.size > 10 * 1024 * 1024 : false
    return isBigDim || isBigSize
  }, [sourceImage, origDimensions])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl w-[94vw] sm:w-[90vw] max-h-[92vh] flex flex-col p-0 glass-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-[#f5f5f7] bg-[#1a110e]/95"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-white/10 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-semibold text-white tracking-wide">
                Hapus Background (rembg)
              </DialogTitle>
              <p className="text-[11px] text-white/50 truncate max-w-[280px] sm:max-w-md">
                {sourceImage?.name || 'Gambar'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inferenceDuration !== null && !isProcessing && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-orange-300">
                ⚡ {inferenceDuration}s
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tutup modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Body (Split Preview & Options) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {/* Preview Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('split')}
                disabled={!resultUrl}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  previewMode === 'split' && resultUrl
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-white/70 hover:text-white disabled:opacity-30'
                }`}
              >
                Bandingkan (Slider)
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('result')}
                disabled={!resultUrl}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  previewMode === 'result' && resultUrl
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-white/70 hover:text-white disabled:opacity-30'
                }`}
              >
                Hasil Transparan
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('original')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  previewMode === 'original'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Gambar Asli
              </button>
            </div>

            {/* Dimension Info Indicator */}
            {origDimensions && (
              <div className="text-[11px] text-white/60 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                Dimensi: <span className="text-white/90">{targetDimDisplay}</span>
              </div>
            )}
          </div>

          {/* Interactive Preview Canvas */}
          <div
            className="relative w-full h-[320px] sm:h-[400px] rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-inner select-none flex items-center justify-center"
          >
            {/* 1. Loading Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-medium text-white">{progressText}</p>
                  <p className="text-xs text-white/50">Waktu berjalan: {processElapsed}s</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelProcess}
                  className="rounded-full border-white/20 text-white hover:bg-white/10 text-xs px-4 h-8"
                >
                  Batal
                </Button>
              </div>
            )}

            {/* 2. Error State */}
            {errorType && !isProcessing && (
              <div className="absolute inset-0 z-20 bg-black/85 p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-semibold text-red-200">
                    {errorType === 'offline'
                      ? 'Server rembg Belum Aktif'
                      : errorType === 'oom'
                      ? 'Memori GPU Penuh (OOM)'
                      : 'Gagal Memproses Gambar'}
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed">{errorMessage}</p>
                </div>

                {/* Error recovery buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {errorType === 'oom' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDimensionOption('1024')
                        setTimeout(() => handleProcess(), 100)
                      }}
                      className="border-white/20 text-white hover:bg-white/10 text-xs rounded-full h-8 px-3"
                    >
                      Turunkan ke 1024 px
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleProcess}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-xs rounded-full h-8 px-4 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </Button>
                </div>
              </div>
            )}

            {/* 3. Actual Image Render */}
            {sourceImage && (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {resultUrl ? (
                  <ImageCompareSlider
                    originalUrl={sourceImage.previewUrl}
                    resultUrl={resultUrl}
                    mode={previewMode}
                    onModeChange={setPreviewMode}
                    showControls={false}
                    className="w-full h-full"
                  />
                ) : !isProcessing && !errorType ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                    <img
                      src={sourceImage.previewUrl}
                      alt="Gambar Asli"
                      className="max-w-full max-h-full object-contain opacity-80"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Extreme Image Warning */}
          {isExtremeImage && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Gambar Berukuran Sangat Besar (&gt;4K / &gt;10 MB)</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Pemrosesan dengan resolusi penuh mungkin membutuhkan waktu lebih lama dan memori GPU yang besar. Pilihan Anda tetap dihormati.
                </p>
              </div>
            </div>
          )}

          {/* Advanced Options (Resize) */}
          <div className="glass-well p-4 rounded-xl border border-white/5 space-y-3">
            {/* Accordion: Opsi Lanjutan (Resize) */}
            <div>
              <button
                type="button"
                onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                className="w-full flex items-center justify-between text-xs text-white/70 hover:text-white py-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-medium">Opsi Lanjutan (Ukuran Gambar / Resize)</span>
                </div>
                {isOptionsOpen ? (
                  <ChevronUp className="w-4 h-4 text-white/50" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/50" />
                )}
              </button>

              {isOptionsOpen && (
                <div className="pt-3 space-y-3 animate-in fade-in duration-150">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'original', label: 'Ukuran Asli (Default)' },
                      { id: '4096', label: 'Maks 4096 px (4K)' },
                      { id: '2048', label: 'Maks 2048 px (2K)' },
                      { id: '1024', label: 'Maks 1024 px (HD Ringan)' },
                      { id: 'custom', label: 'Kustom' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDimensionOption(opt.id as DimensionOption)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          dimensionOption === opt.id
                            ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                            : 'bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {dimensionOption === 'custom' && (
                    <div className="flex items-center gap-2 pt-1 max-w-xs">
                      <span className="text-xs text-white/60">Sisi Terpanjang (px):</span>
                      <input
                        type="number"
                        min={256}
                        max={8192}
                        step={64}
                        value={customDimension}
                        onChange={(e) => setCustomDimension(parseInt(e.target.value) || 1024)}
                        className="bg-black/40 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white w-24 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-white/50">
                    Target output:{' '}
                    <span className="text-white font-medium">{targetDimDisplay}</span>. Resolusi
                    lebih kecil menghemat VRAM dan mempercepat inferensi.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Storage & Device Destination */}
          <div className="glass-well p-3.5 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Folder className="w-4 h-4 text-orange-400" />
                <span className="font-semibold text-white/90">Tujuan Penyimpanan ke Device</span>
              </div>

              {/* Action Buttons for Folder */}
              <div className="flex flex-wrap items-center gap-2">
                {workingFolderHandle && (
                  <button
                    type="button"
                    onClick={() => setUseWorkingFolderSubdir(!useWorkingFolderSubdir)}
                    className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                      useWorkingFolderSubdir
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Pakai Folder Kerja (subfolder rembg/)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSelectFolder}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  {rembgFolderHandle ? 'Ganti Folder' : 'Pilih Folder rembg'}
                </button>
              </div>
            </div>

            {/* Folder Status text */}
            <div className="text-[11px] text-white/60 flex items-center justify-between">
              <div>
                {useWorkingFolderSubdir ? (
                  <span className="text-emerald-300">
                    📁 Aktif: Menulis langsung ke subfolder <code className="text-emerald-200">rembg/</code> di dalam Folder Kerja.
                  </span>
                ) : rembgFolderHandle ? (
                  <span>
                    📁 Folder Khusus: <span className="text-white font-medium">{rembgFolderHandle.name}</span>
                    {folderPermission === 'prompt' && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="ml-2 text-orange-400 hover:text-orange-300 underline cursor-pointer"
                      >
                        (Izinkan Akses Ulang)
                      </button>
                    )}
                  </span>
                ) : (
                  <span>
                    ℹ️ Belum ada folder dipilih. Hasil akan otomatis diunduh melalui browser biasa jika disimpan.
                  </span>
                )}
              </div>
            </div>

            {isSavedSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] text-emerald-300 truncate">{isSavedSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedSuccess(null)}
                  className="text-emerald-400/60 hover:text-emerald-200 p-0.5 rounded cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={handleProcess}
              className="border-white/15 text-white/80 hover:text-white hover:bg-white/10 text-xs rounded-full h-9 px-4 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Proses Ulang</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onApplyToChat && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!resultBlob || isProcessing}
                onClick={handleApplyToChat}
                className="border-orange-500/40 text-orange-300 hover:bg-orange-500/20 text-xs rounded-full h-9 px-4 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Gantikan di Lampiran Chat</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              disabled={!resultBlob || isProcessing}
              onClick={handleSaveToDevice}
              className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-medium text-xs rounded-full h-9 px-5 flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan ke Device</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
