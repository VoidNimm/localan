import { httpClient, type HttpRequestOptions, type HttpResponse } from '../adapters/http'
import { isTauriEnvironment } from '../adapters/runtime'
import { modelAvailabilityService } from './removeBgModels'


export interface RembgModelOption {
  id: string
  label: string
  description: string
  vramTag: string
}

export const REMBG_MODELS: RembgModelOption[] = [
  {
    id: 'birefnet-general',
    label: 'BiRefNet General (Standar)',
    description: 'Seimbang & presisi untuk objek umum (~928 MB)',
    vramTag: 'Standar (~1 GB)',
  },
  {
    id: 'isnet-general-use',
    label: 'IS-Net General Use (DIS)',
    description: 'Spesialis detail rambut & tepi transparan (~175 MB)',
    vramTag: 'Ringan (~175 MB)',
  },
  {
    id: 'birefnet-general-lite',
    label: 'BiRefNet General Lite (Cepat & Ringan)',
    description: 'Bobot lebih hemat, ramah konsumsi VRAM',
    vramTag: 'Hemat VRAM',
  },
  {
    id: 'birefnet-portrait',
    label: 'BiRefNet Portrait (Spesialis Manusia)',
    description: 'Fokus optimal untuk subjek orang & potret wajah',
    vramTag: 'Standar',
  },
]

export const DEFAULT_REMBG_MODEL = 'birefnet-general'

export class RembgError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RembgError'
  }
}

export class RembgModelNotDownloadedError extends RembgError {
  constructor(modelId: string) {
    super(
      `Model "${modelId}" belum ditandai sebagai model yang sudah diunduh. Pengiriman request dicegah untuk menghindari unduhan otomatis dari internet.`
    )
    this.name = 'RembgModelNotDownloadedError'
  }
}

export class RembgServerOfflineError extends RembgError {
  constructor(message = 'Server rembg offline di http://127.0.0.1:7000') {
    super(message)
    this.name = 'RembgServerOfflineError'
  }
}

export class RembgOOMError extends RembgError {
  constructor(
    message = 'Server rembg gagal memproses gambar (HTTP 500). Kemungkinan memori GPU (VRAM) penuh atau model bermasalah. Silakan restart server rembg di terminal Anda dan tutup model Ollama yang sedang berjalan untuk membebaskan VRAM.'
  ) {
    super(message)
    this.name = 'RembgOOMError'
  }
}

export class RembgTimeoutError extends RembgError {
  constructor(message = 'Waktu pemrosesan melebihi batas (timeout 180 detik / 3 menit).') {
    super(message)
    this.name = 'RembgTimeoutError'
  }
}

export class RembgAbortError extends RembgError {
  constructor(message = 'Pemrosesan hapus background dibatalkan oleh pengguna.') {
    super(message)
    this.name = 'RembgAbortError'
  }
}

import { logDiagnostic } from '../utils/diagnostic'

const PRIMARY_API_ENDPOINT = '/api/rembg'
const FALLBACK_API_ENDPOINT = 'http://127.0.0.1:7000/api'

async function tryFetchWithFallback(
  path: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse> {
  const inTauri = isTauriEnvironment()
  const primaryUrl = inTauri ? `${FALLBACK_API_ENDPOINT}${path}` : `${PRIMARY_API_ENDPOINT}${path}`
  const fallbackUrl = inTauri ? `${PRIMARY_API_ENDPOINT}${path}` : `${FALLBACK_API_ENDPOINT}${path}`
  try {
    logDiagnostic('REMBG:tryFetchWithFallback:primary_trying', { primaryUrl })

    const res = await httpClient.fetch(primaryUrl, options)
    logDiagnostic('REMBG:tryFetchWithFallback:primary_success', { primaryUrl, ok: res.ok, status: res.status })
    return res
  } catch (primaryErr: any) {
    logDiagnostic('REMBG:tryFetchWithFallback:primary_failed', {
      primaryUrl,
      errName: primaryErr?.name,
      errMsg: primaryErr?.message,
    })
    // If running in preview/standalone where proxy might not route, try direct URL
    try {
      logDiagnostic('REMBG:tryFetchWithFallback:fallback_trying', { fallbackUrl })
      const fallbackRes = await httpClient.fetch(fallbackUrl, options)
      logDiagnostic('REMBG:tryFetchWithFallback:fallback_success', { fallbackUrl, ok: fallbackRes.ok, status: fallbackRes.status })
      return fallbackRes
    } catch (fallbackErr: any) {
      logDiagnostic('REMBG:tryFetchWithFallback:fallback_failed', {
        fallbackUrl,
        errName: fallbackErr?.name,
        errMsg: fallbackErr?.message,
      })
      throw primaryErr
    }
  }
}

export async function checkRembgHealth(): Promise<{ isOnline: boolean; error?: string }> {
  logDiagnostic('REMBG:checkRembgHealth:start', {})
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      logDiagnostic('REMBG:checkRembgHealth:timeout_fired', {})
      controller.abort()
    }, 3500)
    
    // HEAD /api/rembg or GET /api/rembg returns 200 (FastAPI Swagger UI or doc)
    const res = await tryFetchWithFallback('', {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timer)

    logDiagnostic('REMBG:checkRembgHealth:result', { ok: res.ok, status: res.status })
    if (res.ok || res.status === 200 || res.status === 307) {
      logDiagnostic('REMBG:checkRembgHealth:SUCCESS_ONLINE', {})
      return { isOnline: true }
    }
    logDiagnostic('REMBG:checkRembgHealth:FAILED_STATUS', { status: res.status })
    return { isOnline: false, error: `HTTP ${res.status}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logDiagnostic('REMBG:checkRembgHealth:catch_error', { errMsg: msg })
    return { isOnline: false, error: msg }
  }
}


export interface RemoveBackgroundOptions {
  model?: string
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

export async function removeBackground(
  imageBlobOrFile: Blob | File,
  options: RemoveBackgroundOptions = {}
): Promise<Blob> {
  const model = options.model || DEFAULT_REMBG_MODEL
  const userSignal = options.signal

  // Cegah pengiriman request jika model belum ditandai sebagai terunduh lokal
  if (!modelAvailabilityService.isModelDownloaded(model)) {
    throw new RembgModelNotDownloadedError(model)
  }

  const formData = new FormData()
  // rembg expects file and optional model in form-data
  formData.append('file', imageBlobOrFile, 'image.png')
  formData.append('model', model)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new RembgTimeoutError())
  }, 180000)

  // Listen to user cancel
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timeoutId)
      throw new RembgAbortError()
    }
    userSignal.addEventListener('abort', () => {
      controller.abort(new RembgAbortError())
    })
  }

  let slowNoticeTimer: ReturnType<typeof setTimeout> | null = null

  try {
    options.onProgress?.('Mengirim gambar ke server rembg...')

    // Tampilkan catatan jika setelah 15 detik server masih belum merespons
    slowNoticeTimer = setTimeout(() => {
      options.onProgress?.('Memuat model atau server sedang sibuk... (menunggu respons)')
    }, 15000)

    const res = await tryFetchWithFallback('/remove', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (slowNoticeTimer) {
      clearTimeout(slowNoticeTimer)
      slowNoticeTimer = null
    }
    clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // Jangan bergantung pada kata kunci body karena FastAPI hanya merespons "Internal Server Error"
      if (res.status === 500) {
        throw new RembgOOMError()
      }
      throw new RembgError(
        `Server rembg mengembalikan status ${res.status}: ${errText || res.statusText}`
      )
    }

    const outputBlob = await res.blob()
    return outputBlob
  } catch (err: unknown) {
    if (slowNoticeTimer) {
      clearTimeout(slowNoticeTimer)
    }
    clearTimeout(timeoutId)

    if (err instanceof RembgError) {
      throw err
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      if (userSignal?.aborted) {
        throw new RembgAbortError()
      }
      throw new RembgTimeoutError()
    }

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        if (userSignal?.aborted) {
          throw new RembgAbortError()
        }
        throw new RembgTimeoutError()
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new RembgServerOfflineError()
      }
      throw new RembgError(err.message)
    }

    throw new RembgError('Terjadi kesalahan yang tidak diketahui saat memproses gambar.')
  }
}
