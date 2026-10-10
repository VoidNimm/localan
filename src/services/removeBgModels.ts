/**
 * Layanan Ketersediaan Model rembg
 *
 * Mengelola daftar model AI yang sudah diunduh secara lokal oleh pengguna.
 * Mencegah pengiriman request ke model yang belum ada di disk, sehingga
 * server rembg tidak memicu pengunduhan file .onnx besar (~200MB - ~1GB)
 * secara diam-diam melalui internet.
 *
 * Arsitektur ini dirancang modular agar saat porting ke Tauri v2,
 * fungsi pengecekan dapat diganti atau diperkaya dengan pembacaan file
 * filesystem langsung via `@tauri-apps/plugin-fs` di path:
 * `~/.rembg/models/<model_name>/<model_name>.onnx`
 */

export const DEFAULT_DOWNLOADED_MODELS = ['birefnet-general']
const STORAGE_KEY = 'localchat_rembg_downloaded_models'

export interface ModelAvailabilityService {
  getDownloadedModels(): string[]
  setDownloadedModels(models: string[]): void
  isModelDownloaded(modelId: string): boolean
  toggleDownloadedModel(modelId: string, isDownloaded: boolean): string[]
}

export const modelAvailabilityService: ModelAvailabilityService = {
  getDownloadedModels(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_DOWNLOADED_MODELS
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {
      // Fallback ke default jika JSON gagal diparse
    }
    return DEFAULT_DOWNLOADED_MODELS
  },

  setDownloadedModels(models: string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
    } catch {
      // ignore
    }
  },

  isModelDownloaded(modelId: string): boolean {
    const list = this.getDownloadedModels()
    return list.includes(modelId)
  },

  toggleDownloadedModel(modelId: string, isDownloaded: boolean): string[] {
    const current = this.getDownloadedModels()
    const next = isDownloaded
      ? Array.from(new Set([...current, modelId]))
      : current.filter((id) => id !== modelId)
    this.setDownloadedModels(next)
    return next
  },
}
