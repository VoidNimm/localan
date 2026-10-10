import { useState, useRef, useCallback, useEffect } from 'react'
import {
  removeBackground,
  checkRembgHealth,
  DEFAULT_REMBG_MODEL,
  RembgServerOfflineError,
  RembgOOMError,
  RembgTimeoutError,
  RembgAbortError,
  RembgModelNotDownloadedError,
} from '@/services/removeBg'
import { modelAvailabilityService } from '@/services/removeBgModels'
import {
  generateRembgFileName,
  saveRembgOutputToFolder,
  writeBlobSafelyToDirectory,
  saveFallbackFile,
} from '@/services/removeBgStorage'
import { getImageDimensions, resizeImage } from '@/utils/fileReader'
import type { DimensionOption } from '@/components/RemoveBgOptions'
import type { DirectoryReference } from '@/adapters/storage'

export const MAX_SAFE_MEGAPIXELS = 25 // 25 MP (~5000x5000)
export const MAX_SAFE_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export interface RembgQueueItem {
  id: string
  file: File | Blob
  fileName: string
  originalUrl: string
  resultUrl?: string
  resultBlob?: Blob
  status: 'pending' | 'processing' | 'done' | 'error' | 'cancelled'
  progressText?: string
  elapsedSeconds?: number
  durationMs?: number
  errorMessage?: string
  errorType?: 'offline' | 'oom' | 'timeout' | 'generic'
  dimensions?: { width: number; height: number }
  isExceedingMp?: boolean
  savedPath?: string
}

export interface UseRemoveBgQueueOptions {
  model?: string
  dimensionOption?: DimensionOption
  customDim?: number
  workingFolderHandle?: DirectoryReference | null
  rembgFolderHandle?: DirectoryReference | null
  useWorkingFolderSubdir?: boolean
  autoSave?: boolean
}

export function useRemoveBgQueue(options: UseRemoveBgQueueOptions = {}) {
  const [items, setItems] = useState<RembgQueueItem[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isCancelledRef = useRef(false)
  const isProcessingRef = useRef(false)
  const itemsRef = useRef<RembgQueueItem[]>([])
  const optionsRef = useRef(options)

  // Sinkronkan refs di effect agar mematuhi aturan compiler React
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Helper untuk update item sinkron baik di ref maupun di state
  const updateItem = useCallback((id: string, patch: Partial<RembgQueueItem>) => {
    itemsRef.current = itemsRef.current.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    )
    setItems([...itemsRef.current])
  }, [])

  // Periksa status server saat inisialisasi dan sebelum start
  const checkStatus = useCallback(async () => {
    try {
      const health = await checkRembgHealth()
      setIsServerOnline(health.isOnline)
      return health.isOnline
    } catch {
      setIsServerOnline(false)
      return false
    }
  }, [])

  useEffect(() => {
    let active = true
    checkRembgHealth()
      .then((health) => {
        if (active) setIsServerOnline(health.isOnline)
      })
      .catch(() => {
        if (active) setIsServerOnline(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Pemrosesan individual item
  const processItem = useCallback(async (item: RembgQueueItem): Promise<void> => {
    const currentOpts = optionsRef.current
    const effectiveModel = currentOpts.model || DEFAULT_REMBG_MODEL
    const effectiveDim = currentOpts.dimensionOption || 'original'
    const effectiveCustom = currentOpts.customDim || 1920

    setActiveItemId(item.id)
    abortControllerRef.current = new AbortController()
    isCancelledRef.current = false

    updateItem(item.id, {
      status: 'processing',
      progressText: 'Mempersiapkan gambar...',
      errorMessage: undefined,
      errorType: undefined,
    })

    const startTime = Date.now()

    try {
      // 0. Validasi ketersediaan model lokal (cegah unduhan otomatis jika model belum diunduh)
      if (!modelAvailabilityService.isModelDownloaded(effectiveModel)) {
        throw new RembgModelNotDownloadedError(effectiveModel)
      }

      // 1. Resize gambar jika diperlukan (atau jika > 25 MP untuk proteksi RAM)
      let fileToProcess = item.file
      let targetMaxDim: number | null = null

      if (effectiveDim === '4096') targetMaxDim = 4096
      else if (effectiveDim === '2048') targetMaxDim = 2048
      else if (effectiveDim === '1024') targetMaxDim = 1024
      else if (effectiveDim === 'custom') targetMaxDim = effectiveCustom
      else if (item.isExceedingMp) {
        targetMaxDim = 4096 // auto-cap jika > 25 MP
      }

      if (targetMaxDim && item.dimensions) {
        const longestSide = Math.max(item.dimensions.width, item.dimensions.height)
        if (longestSide > targetMaxDim) {
          updateItem(item.id, {
            progressText: `Menyesuaikan resolusi ke ${targetMaxDim} px...`,
          })
          const resized = await resizeImage(item.file, targetMaxDim)
          fileToProcess = resized.blob
        }
      }

      if (isCancelledRef.current) throw new RembgAbortError()

      // 2. Jalankan inferensi AI rembg
      updateItem(item.id, {
        progressText: `Memproses via AI (${effectiveModel})...`,
      })

      const resultBlob = await removeBackground(fileToProcess, {
        model: effectiveModel,
        signal: abortControllerRef.current?.signal,
        onProgress: (phase) => {
          updateItem(item.id, { progressText: phase })
        },
      })

      if (isCancelledRef.current) throw new RembgAbortError()

      const durationMs = Date.now() - startTime
      const resultUrl = URL.createObjectURL(resultBlob)
      let savedPath: string | undefined = undefined

      // 3. Auto-save jika diaktifkan
      if (currentOpts.autoSave) {
        const outFileName = generateRembgFileName(item.fileName, effectiveModel, effectiveDim)
        if (currentOpts.useWorkingFolderSubdir && currentOpts.workingFolderHandle) {
          const res = await saveRembgOutputToFolder(currentOpts.workingFolderHandle, outFileName, resultBlob)
          savedPath = res.fullPath || `rembg/${outFileName}`
        } else if (currentOpts.rembgFolderHandle) {
          const res = await writeBlobSafelyToDirectory(currentOpts.rembgFolderHandle, outFileName, resultBlob)
          savedPath = res.fullPath || outFileName
        } else {
          const res = await saveFallbackFile(outFileName, resultBlob)
          if (res.status === 'saved') {
            savedPath = res.fullPath || res.fileName
          }
        }
      }

      updateItem(item.id, {
        status: 'done',
        resultBlob,
        resultUrl,
        durationMs,
        progressText: `Selesai (${(durationMs / 1000).toFixed(1)}s)`,
        savedPath,
      })
    } catch (err: unknown) {
      if (err instanceof RembgAbortError || isCancelledRef.current) {
        updateItem(item.id, {
          status: 'cancelled',
          progressText: 'Dibatalkan oleh pengguna.',
        })
      } else {
        let errType: 'offline' | 'oom' | 'timeout' | 'generic' = 'generic'
        let errMsg = 'Gagal memproses gambar.'
        let statusBadgeText = 'Terjadi kesalahan.'

        if (err instanceof RembgServerOfflineError) {
          errType = 'offline'
          errMsg = err.message
          statusBadgeText = 'Server Offline'
          setIsServerOnline(false)
        } else if (err instanceof RembgOOMError) {
          errType = 'oom'
          errMsg = err.message
          statusBadgeText = 'Gagal (HTTP 500 / VRAM Penuh)'
        } else if (err instanceof RembgTimeoutError) {
          errType = 'timeout'
          errMsg = err.message
          statusBadgeText = 'Waktu Habis (Timeout)'
        } else if (err instanceof RembgModelNotDownloadedError) {
          errType = 'generic'
          errMsg = err.message
          statusBadgeText = 'Model Belum Diunduh'
        } else if (err instanceof Error) {
          errMsg = err.message
        }

        updateItem(item.id, {
          status: 'error',
          errorType: errType,
          errorMessage: errMsg,
          progressText: statusBadgeText,
        })
      }
    } finally {
      setActiveItemId(null)
      abortControllerRef.current = null
    }
  }, [updateItem])

  // Menjalankan antrean FIFO (1 per 1)
  const startQueue = useCallback(async () => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setIsProcessingQueue(true)
    isCancelledRef.current = false

    // Pastikan server online
    const online = await checkStatus()
    if (!online) {
      isProcessingRef.current = false
      setIsProcessingQueue(false)
      return
    }

    try {
      while (true) {
        if (isCancelledRef.current) break

        const nextItem = itemsRef.current.find((i) => i.status === 'pending')
        if (!nextItem) break

        await processItem(nextItem)
      }
    } finally {
      isProcessingRef.current = false
      setIsProcessingQueue(false)
    }
  }, [checkStatus, processItem])

  // Menambahkan files ke antrean (Opsi B: Auto-start jika antrean belum berjalan)
  const addFiles = useCallback(async (files: File[]) => {
    const newItems: RembgQueueItem[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue

      const id = 'rembg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
      const previewUrl = URL.createObjectURL(file)

      let dimensions: { width: number; height: number } | undefined = undefined
      let isExceedingMp = false

      try {
        const dims = await getImageDimensions(file)
        dimensions = dims
        const mp = (dims.width * dims.height) / 1_000_000
        if (mp > MAX_SAFE_MEGAPIXELS) {
          isExceedingMp = true
        }
      } catch {
        // Abaikan jika tidak bisa membaca dimensi
      }

      newItems.push({
        id,
        file,
        fileName: file.name,
        originalUrl: previewUrl,
        status: 'pending',
        progressText: isProcessingRef.current ? 'Menunggu giliran...' : 'Siap (tekan Mulai)',
        dimensions,
        isExceedingMp,
      })
    }

    if (newItems.length > 0) {
      itemsRef.current = [...itemsRef.current, ...newItems]
      setItems([...itemsRef.current])
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target?.originalUrl) {
        URL.revokeObjectURL(target.originalUrl)
      }
      if (target?.resultUrl) {
        URL.revokeObjectURL(target.resultUrl)
      }
      const updated = prev.filter((i) => i.id !== id)
      itemsRef.current = updated
      return updated
    })
  }, [])

  const clearQueue = useCallback(() => {
    itemsRef.current.forEach((item) => {
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl)
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
    })
    itemsRef.current = []
    setItems([])
  }, [])

  const cancelActiveProcess = useCallback(() => {
    isCancelledRef.current = true
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const retryItem = useCallback(
    async (id: string) => {
      updateItem(id, {
        status: 'pending',
        progressText: isProcessingRef.current ? 'Menunggu giliran...' : 'Siap (tekan Mulai)',
        errorMessage: undefined,
        errorType: undefined,
      })
      if (!isProcessingRef.current) {
        void startQueue()
      }
    },
    [updateItem, startQueue]
  )

  const counts = {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    processing: items.filter((i) => i.status === 'processing').length,
    done: items.filter((i) => i.status === 'done').length,
    error: items.filter((i) => i.status === 'error').length,
    cancelled: items.filter((i) => i.status === 'cancelled').length,
  }

  return {
    items,
    isProcessingQueue,
    activeItemId,
    isServerOnline,
    counts,
    addFiles,
    removeItem,
    clearQueue,
    startQueue,
    cancelActiveProcess,
    retryItem,
    checkStatus,
  }
}
