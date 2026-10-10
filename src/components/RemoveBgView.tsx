import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles,
  UploadCloud,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  FolderCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useRemoveBgQueue,
  type RembgQueueItem,
  MAX_SAFE_MEGAPIXELS,
} from '@/hooks/useRemoveBgQueue'
import { ImageCompareSlider } from '@/components/ImageCompareSlider'
import {
  RemoveBgOptions,
  type DimensionOption,
} from '@/components/RemoveBgOptions'
import { DEFAULT_REMBG_MODEL } from '@/services/removeBg'
import {
  generateRembgFileName,
  saveRembgOutputToFolder,
  writeBlobSafelyToDirectory,
  saveFallbackFile,
  getStoredRembgFolder,
  selectNewRembgFolder,
} from '@/services/removeBgStorage'
import type { DirectoryReference } from '@/adapters/storage'
import { isTauriEnvironment } from '@/adapters/runtime'
import { tauriServerLauncher } from '@/adapters/server'
import type { RembgLauncherStatus } from '@/adapters/server/types'


export interface RemoveBgViewProps {
  onBackToChat: () => void
  workingFolderHandle?: DirectoryReference | null
  rembgFolderHandle?: DirectoryReference | null
  onRequestChangeRembgFolder?: () => void
}

export interface SaveNotification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  locationDesc: string
  fileName?: string
  totalCount?: number
}

export const RemoveBgView: React.FC<RemoveBgViewProps> = ({
  onBackToChat,
  workingFolderHandle,
  rembgFolderHandle,
  onRequestChangeRembgFolder,
}) => {
  const selectedModel = DEFAULT_REMBG_MODEL
  const [dimensionOption, setDimensionOption] = useState<DimensionOption>('original')
  const [customDimension, setCustomDimension] = useState<number>(1920)
  const [useWorkingFolderSubdir, setUseWorkingFolderSubdir] = useState(Boolean(workingFolderHandle))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [saveNotification, setSaveNotification] = useState<SaveNotification | null>(null)
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set())
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [dedicatedRembgFolder, setDedicatedRembgFolder] = useState<DirectoryReference | null>(
    rembgFolderHandle || null
  )
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (rembgFolderHandle !== undefined) {
      setDedicatedRembgFolder(rembgFolderHandle)
    } else {
      void getStoredRembgFolder().then((folder) => {
        if (folder) setDedicatedRembgFolder(folder)
      })
    }
  }, [rembgFolderHandle])

  const activeRembgFolder = dedicatedRembgFolder

  const handleChangeRembgFolder = async () => {
    if (onRequestChangeRembgFolder) {
      onRequestChangeRembgFolder()
      return
    }
    try {
      const selected = await selectNewRembgFolder()
      if (selected) {
        setDedicatedRembgFolder(selected)
        setUseWorkingFolderSubdir(false)
      }
    } catch (err) {
      console.error('Failed to change rembg folder:', err)
    }
  }

  const {
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
  } = useRemoveBgQueue({
    model: selectedModel,
    dimensionOption,
    customDim: customDimension,
    workingFolderHandle,
    rembgFolderHandle: activeRembgFolder,
    useWorkingFolderSubdir,
  })

  const isTauri = isTauriEnvironment()
  const [launcherStatus, setLauncherStatus] = useState<RembgLauncherStatus>(() =>
    tauriServerLauncher.getRembgStatus ? tauriServerLauncher.getRembgStatus() : { state: 'idle' }
  )


  useEffect(() => {
    if (!isTauri || !tauriServerLauncher.onRembgStatusChange) return
    const unsubscribe = tauriServerLauncher.onRembgStatusChange((st) => {
      setLauncherStatus(st)
      if (st.state === 'berjalan') {
        void checkStatus()
      }
    })
    return unsubscribe
  }, [isTauri, checkStatus])

  const handleStartRembgServer = useCallback(async () => {
    if (tauriServerLauncher.startRembgServer) {
      await tauriServerLauncher.startRembgServer()
      await checkStatus()
    }
  }, [checkStatus])


  // Selected item untuk pratinjau di panel detail
  const selectedItem =
    items.find((i) => i.id === selectedItemId) ||
    items.find((i) => i.status === 'done') ||
    items[0] ||
    null

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith('image/')
        )
        if (files.length > 0) void addFiles(files)
      }
    },
    [addFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      void addFiles(files)
      e.target.value = ''
    }
  }

  const showNotification = useCallback((notif: Omit<SaveNotification, 'id'>) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }
    setSaveNotification({
      id: String(Date.now()),
      ...notif,
    })
    notificationTimeoutRef.current = setTimeout(() => {
      setSaveNotification(null)
      notificationTimeoutRef.current = null
    }, 4500)
  }, [])

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])

  const getStorageLocationDesc = useCallback(() => {
    if (useWorkingFolderSubdir && workingFolderHandle) {
      return {
        type: 'working_folder',
        label: 'Folder Kerja',
        desc: `Disimpan ke subfolder rembg/ pada Folder Kerja (${workingFolderHandle.name})`,
        shortPath: isTauri && workingFolderHandle.id ? `${workingFolderHandle.id}\\rembg\\` : 'rembg/',
      }
    }
    if (activeRembgFolder) {
      return {
        type: 'custom_folder',
        label: activeRembgFolder.name,
        desc: `Disimpan ke folder "${activeRembgFolder.name}"`,
        shortPath: isTauri && activeRembgFolder.id ? `${activeRembgFolder.id}\\` : `${activeRembgFolder.name}/`,
      }
    }
    return {
      type: 'download',
      label: isTauri ? 'Penyimpanan Mandiri' : 'Unduhan Browser',
      desc: isTauri ? 'Disimpan melalui dialog berkas native' : 'Diunduh langsung melalui peramban ke folder Unduhan (Downloads)',
      shortPath: isTauri ? '' : 'Downloads/',
    }
  }, [useWorkingFolderSubdir, workingFolderHandle, activeRembgFolder, isTauri])

  // Simpan hasil item individual
  const handleSaveItem = async (item: RembgQueueItem) => {
    if (!item.resultBlob || savingItemIds.has(item.id)) return
    const outFileName = generateRembgFileName(item.fileName, selectedModel, dimensionOption)
    const loc = getStorageLocationDesc()

    setSavingItemIds((prev) => new Set(prev).add(item.id))
    try {
      if (useWorkingFolderSubdir && workingFolderHandle) {
        const saved = await saveRembgOutputToFolder(workingFolderHandle, outFileName, item.resultBlob)
        const fullDisplayPath = saved.fullPath || `${loc.shortPath}${outFileName}`
        showNotification({
          type: 'success',
          title: 'Gambar Berhasil Disimpan ke Disk',
          locationDesc: loc.desc,
          fileName: fullDisplayPath,
        })
      } else if (activeRembgFolder) {
        const saved = await writeBlobSafelyToDirectory(activeRembgFolder, outFileName, item.resultBlob)
        const fullDisplayPath = saved.fullPath || `${loc.shortPath}${outFileName}`
        showNotification({
          type: 'success',
          title: 'Gambar Berhasil Disimpan ke Disk',
          locationDesc: loc.desc,
          fileName: fullDisplayPath,
        })
      } else {
        const res = await saveFallbackFile(outFileName, item.resultBlob)
        if (res.status === 'cancelled') {
          // Pengguna membatalkan dialog simpan native -> tidak menampilkan toast sukses
          return
        }
        showNotification({
          type: 'success',
          title: 'Gambar Berhasil Disimpan',
          locationDesc: isTauri ? 'Disimpan ke lokasi pilihan Anda' : loc.desc,
          fileName: res.fullPath || res.fileName || outFileName,
        })
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err)
      let title = 'Gagal Menyimpan Gambar'
      let desc = rawMsg
      if (/forbidden|scope|permission/i.test(rawMsg)) {
        title = 'Akses Folder Ditolak'
        desc = 'Izin akses folder tidak tersedia atau kedaluwarsa. Silakan pilih kembali folder tujuan.'
      } else if (/not found|os error 3|enoent/i.test(rawMsg)) {
        title = 'Folder Tidak Ditemukan'
        desc = 'Folder penyimpanan telah dipindahkan atau dihapus dari disk. Silakan tentukan folder tujuan baru.'
      }

      showNotification({
        type: 'error',
        title,
        locationDesc: desc,
        fileName: outFileName,
      })
    } finally {
      setSavingItemIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  // Simpan semua item yang sudah selesai
  const handleSaveAllDone = async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBlob)
    if (doneItems.length === 0 || isSavingAll) return

    setIsSavingAll(true)
    let savedCount = 0
    let failedCount = 0
    let effectiveFolder = activeRembgFolder

    try {
      // Jika Skenario C di Desktop (tanpa folder kerja & tanpa folder khusus):
      // Munculkan 1 kali dialog pilih folder penampung
      if (isTauri && !useWorkingFolderSubdir && !effectiveFolder) {
        try {
          const selected = await selectNewRembgFolder()
          if (!selected) {
            // Pengguna membatalkan dialog pemilihan folder batch
            return
          }
          setDedicatedRembgFolder(selected)
          effectiveFolder = selected
        } catch (err) {
          console.error('Gagal memilih folder batch:', err)
          showNotification({
            type: 'error',
            title: 'Gagal Membuka Dialog Folder',
            locationDesc: 'Tidak dapat membuka folder penampung untuk menyimpan semua gambar.',
          })
          return
        }
      }

      const loc = getStorageLocationDesc()
      const targetPrefix = effectiveFolder
        ? (isTauri && effectiveFolder.id ? `${effectiveFolder.id}\\` : `${effectiveFolder.name}/`)
        : loc.shortPath

      for (const it of doneItems) {
        if (!it.resultBlob) continue
        const outFileName = generateRembgFileName(it.fileName, selectedModel, dimensionOption)
        try {
          if (useWorkingFolderSubdir && workingFolderHandle) {
            await saveRembgOutputToFolder(workingFolderHandle, outFileName, it.resultBlob)
          } else if (effectiveFolder) {
            await writeBlobSafelyToDirectory(effectiveFolder, outFileName, it.resultBlob)
          } else {
            const res = await saveFallbackFile(outFileName, it.resultBlob)
            if (res.status === 'cancelled') {
              failedCount++
              continue
            }
          }
          savedCount++
        } catch (err) {
          console.error('Gagal menyimpan item:', it.fileName, err)
          failedCount++
        }
      }

      if (savedCount > 0 && failedCount === 0) {
        showNotification({
          type: 'success',
          title: `${savedCount} Gambar Berhasil Disimpan ke Disk`,
          locationDesc: effectiveFolder ? `Disimpan ke folder "${effectiveFolder.name}"` : loc.desc,
          totalCount: savedCount,
          fileName: `${targetPrefix}* (${savedCount} berkas)`,
        })
      } else if (savedCount > 0 && failedCount > 0) {
        showNotification({
          type: 'warning',
          title: `${savedCount} Berhasil, ${failedCount} Gagal Disimpan`,
          locationDesc: `Penyimpanan batch sebagian selesai. ${failedCount} gambar mengalami kegagalan.`,
          totalCount: savedCount,
          fileName: `${targetPrefix}* (${savedCount} tersimpan, ${failedCount} gagal)`,
        })
      } else if (failedCount > 0) {
        showNotification({
          type: 'error',
          title: 'Gagal Menyimpan Gambar',
          locationDesc: `Semua ${failedCount} gambar gagal disimpan ke disk. Periksa izin akses folder.`,
        })
      }
    } finally {
      setIsSavingAll(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-stone-950/90 text-stone-100 overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToChat}
            className="rounded-full text-white/80 hover:text-white hover:bg-white/10 gap-1.5 px-3 h-8 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Chat</span>
          </Button>

          <div className="h-4 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Studio Hapus Background (rembg v3)
            </h1>
          </div>
        </div>

        {/* Server & Status Badges */}
        <div className="flex items-center gap-2 text-xs">
          {launcherStatus.state === 'memulai' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Memulai server rembg...</span>
            </div>
          ) : launcherStatus.state === 'memeriksa' || (isServerOnline === null && launcherStatus.state !== 'gagal') ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Memeriksa server...</span>
            </div>
          ) : isServerOnline === true || launcherStatus.state === 'berjalan' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Server Online (:7000 CUDA)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>
                  {launcherStatus.state === 'gagal'
                    ? launcherStatus.exitCode !== undefined && launcherStatus.exitCode !== null
                      ? `Server Gagal (Exit ${launcherStatus.exitCode})`
                      : 'Server Gagal (:7000)'
                    : 'Server Offline (:7000)'}
                </span>
                <button
                  type="button"
                  onClick={() => void checkStatus()}
                  className="ml-1 hover:text-white"
                  title="Coba Hubungkan Ulang"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {isTauri && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartRembgServer}
                  className="h-7 px-2.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 hover:text-orange-200 border-orange-500/40"
                  title="Jalankan server rembg lokal di background"
                >
                  <Play className="w-3 h-3 mr-1 fill-current" />
                  Nyalakan Server rembg
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Error alert banner jika spawn / exit server gagal */}
      {launcherStatus.state === 'gagal' && launcherStatus.errorMessage && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{launcherStatus.errorMessage}</span>
          </div>
          {isTauri && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStartRembgServer}
              className="h-6 text-xs text-red-200 hover:text-white hover:bg-red-500/20"
            >
              Coba Lagi
            </Button>
          )}
        </div>
      )}


      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* If queue is empty: Show Hero Drag & Drop Area */}
        {items.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="max-w-md w-full p-8 rounded-3xl border-2 border-dashed border-white/20 bg-white/[0.02] flex flex-col items-center gap-4 hover:border-orange-500/50 hover:bg-orange-500/[0.03] transition-all">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center shadow-lg border border-orange-500/30">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-white">
                  Tarik & Lepas Gambar ke Sini
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Mendukung pemrosesan multi-gambar sekaligus (Batch Studio). Format PNG, JPG,
                  WebP hingga 20 MB per berkas.
                </p>
                <p className="text-[11px] text-white/40 pt-1">
                  Proteksi memori aktif: Gambar &gt; 25 Megapiksel disesuaikan otomatis agar aman
                  bagi RAM & GPU.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />

              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-orange-600 hover:bg-orange-500 text-white rounded-full px-6 h-10 text-xs font-semibold shadow-lg shadow-orange-600/30"
              >
                Pilih Berkas Gambar
              </Button>
            </div>
          </div>
        ) : (
          /* If queue has items: 2-Column Layout (Queue List & Detail Viewer) */
          <div className="flex-1 flex overflow-hidden">
            {/* Column 1: Queue & Gallery Sidebar (340px) */}
            <div className="w-80 md:w-96 border-r border-white/10 flex flex-col bg-black/25 shrink-0">
              {/* Toolbar Actions */}
              <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.02]">
                <div className="text-xs font-semibold text-white/80">
                  Antrean ({counts.done}/{counts.total} Selesai)
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-[11px] px-2.5 rounded-full border-white/20 text-white hover:bg-white/10"
                  >
                    + Tambah
                  </Button>

                  {isProcessingQueue ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={cancelActiveProcess}
                      className="h-7 text-[11px] px-2.5 rounded-full flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Batal</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={counts.pending === 0}
                      onClick={() => void startQueue()}
                      className="h-7 text-[11px] px-3 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Mulai ({counts.pending})</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearQueue}
                    disabled={isProcessingQueue}
                    className="h-7 w-7 p-0 rounded-full text-white/50 hover:text-red-400 hover:bg-red-500/10"
                    title="Kosongkan Antrean"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Items List */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex-1 overflow-y-auto p-2 space-y-1.5"
              >
                {items.map((item) => {
                  const isSelected = selectedItem?.id === item.id
                  const isProcessingThis = activeItemId === item.id

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`group p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-orange-500/15 border-orange-500/60 shadow-sm'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                        <img
                          src={item.resultUrl || item.originalUrl}
                          alt={item.fileName}
                          className="w-full h-full object-cover"
                        />
                        {item.status === 'done' && (
                          <div className="absolute bottom-0 right-0 p-0.5 bg-emerald-500 text-white rounded-tl-md">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="absolute bottom-0 right-0 p-0.5 bg-red-500 text-white rounded-tl-md">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Info & Status */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {item.fileName}
                        </div>
                        <div className="text-[11px] text-white/50 truncate flex items-center gap-1.5">
                          {isProcessingThis && (
                            <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                          )}
                          <span>
                            {item.status === 'pending'
                              ? isProcessingQueue
                                ? 'Menunggu giliran...'
                                : 'Siap (tekan Mulai)'
                              : item.progressText}
                          </span>
                        </div>
                        {item.isExceedingMp && (
                          <div className="text-[10px] text-amber-300">
                            &gt; {MAX_SAFE_MEGAPIXELS} MP (Auto-scaled)
                          </div>
                        )}
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        {item.status === 'done' && (
                          <button
                            type="button"
                            disabled={savingItemIds.has(item.id) || isSavingAll}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleSaveItem(item)
                            }}
                            className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Simpan Hasil"
                          >
                            {savingItemIds.has(item.id) ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {item.status === 'error' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void retryItem(item.id)
                            }}
                            className="p-1 rounded-md text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            title="Coba Lagi"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(item.id)
                          }}
                          disabled={isProcessingThis}
                          className="p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-white/10"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom Batch Actions */}
              {counts.done > 0 && (
                <div className="p-3 border-t border-white/10 bg-black/40">
                  <Button
                    type="button"
                    disabled={isSavingAll}
                    onClick={() => void handleSaveAllDone()}
                    className="w-full h-8 text-xs bg-white/15 hover:bg-white/25 text-white rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingAll ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSavingAll
                        ? 'Menyimpan...'
                        : `Simpan Semua Hasil Selesai (${counts.done})`}
                    </span>
                  </Button>
                </div>
              )}
            </div>

            {/* Column 2: Detail Editor & Options Panel */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-black/40">
              {/* Viewer Canvas Area */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden relative">
                {selectedItem ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    {selectedItem.resultUrl ? (
                      <ImageCompareSlider
                        originalUrl={selectedItem.originalUrl}
                        resultUrl={selectedItem.resultUrl}
                        className="w-full h-full max-w-4xl"
                      />
                    ) : (
                      <div className="relative w-full h-full max-w-4xl max-h-[560px] rounded-2xl overflow-hidden border border-white/10 bg-black/50 flex flex-col items-center justify-center p-6 text-center">
                        <img
                          src={selectedItem.originalUrl}
                          alt={selectedItem.fileName}
                          className="max-w-full max-h-[400px] object-contain opacity-80 rounded-lg"
                        />
                        <div className="mt-4 space-y-1 w-full max-w-lg">
                          <p className="text-sm font-medium text-white truncate">
                            {selectedItem.fileName}
                          </p>
                          {selectedItem.status === 'error' ? (
                            <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-left max-w-md mx-auto mt-2 space-y-1.5 shadow-sm">
                              <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>Gagal Memproses Gambar</span>
                              </div>
                              <p className="text-xs text-white/80 leading-relaxed">
                                {selectedItem.errorMessage}
                              </p>
                              {selectedItem.errorType === 'oom' && (
                                <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 leading-relaxed mt-2">
                                  💡 <strong>Saran:</strong> Tutup model Ollama yang sedang aktif dan restart server rembg di terminal (tekan <code>Ctrl+C</code> lalu jalankan ulang <code>rembg s --host 127.0.0.1 --port 7000 --no-ui</code>) untuk membebaskan VRAM GPU.
                                </p>
                              )}
                              <div className="pt-1.5 flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void retryItem(selectedItem.id)}
                                  className="h-7 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-lg gap-1.5"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Coba Lagi</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-white/60">
                              {selectedItem.status === 'processing'
                                ? selectedItem.progressText
                                : isProcessingQueue
                                ? 'Menunggu giliran di antrean...'
                                : 'Klik tombol Mulai untuk memproses gambar ini.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-white/40 text-xs">Pilih gambar dari antrean untuk melihat pratinjau.</div>
                )}
              </div>

              {/* Right Options Sidebar (300px) */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 p-4 overflow-y-auto bg-stone-950/80 shrink-0 space-y-4">
                <RemoveBgOptions
                  dimensionOption={dimensionOption}
                  onDimensionChange={setDimensionOption}
                  customDimension={customDimension}
                  onCustomDimensionChange={setCustomDimension}
                  hasWorkingFolder={Boolean(workingFolderHandle)}
                  useWorkingFolderSubdir={useWorkingFolderSubdir}
                  onToggleWorkingFolderSubdir={setUseWorkingFolderSubdir}
                  rembgFolderName={activeRembgFolder?.name}
                  onChangeRembgFolder={handleChangeRembgFolder}
                  disabled={isProcessingQueue}
                />

                {selectedItem && selectedItem.resultBlob && (
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-white/90">
                      Tindakan untuk Berkas Ini
                    </div>
                    <Button
                      type="button"
                      disabled={savingItemIds.has(selectedItem.id) || isSavingAll}
                      onClick={() => void handleSaveItem(selectedItem)}
                      className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {savingItemIds.has(selectedItem.id) ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {savingItemIds.has(selectedItem.id)
                          ? 'Menyimpan ke Disk...'
                          : 'Simpan Hasil ke Disk'}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Save Notification Toast */}
      {saveNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out"
        >
          <div
            className={`glass-panel p-3.5 sm:p-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all ${
              saveNotification.type === 'success'
                ? 'border-emerald-500/30 bg-[#1f1614]/95 shadow-black/80'
                : saveNotification.type === 'warning'
                ? 'border-amber-500/40 bg-[#1f1614]/95 shadow-black/80'
                : saveNotification.type === 'info'
                ? 'border-blue-500/30 bg-[#1f1614]/95 shadow-black/80'
                : 'border-red-500/40 bg-[#1f1614]/95 shadow-black/80'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  saveNotification.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : saveNotification.type === 'warning'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : saveNotification.type === 'info'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : 'bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                }`}
              >
                {saveNotification.type === 'success' ? (
                  <FolderCheck className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-white tracking-wide">
                    {saveNotification.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSaveNotification(null)}
                    className="text-white/40 hover:text-white p-1 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Tutup notifikasi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-white/70 leading-relaxed">
                  {saveNotification.locationDesc}
                </p>

                {saveNotification.fileName && (
                  <div className="pt-0.5">
                    <div className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-[11px] font-mono text-emerald-300/90 truncate">
                      <span className="text-white/40 shrink-0 select-none">Path:</span>
                      <span className="truncate">{saveNotification.fileName}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
