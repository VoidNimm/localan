import { isTauri } from '@tauri-apps/api/core'
import { logDiagnostic } from '../utils/diagnostic.ts'

/**
 * Mendeteksi apakah aplikasi sedang berjalan di lingkungan desktop Tauri v2 (WebView2).
 * Menggunakan fungsi resmi isTauri() dari @tauri-apps/api/core.
 */
export function isTauriEnvironment(): boolean {
  try {
    const detected = isTauri()
    const win = typeof window !== 'undefined' ? (window as any) : {}
    logDiagnostic('RUNTIME:isTauriEnvironment', {
      isTauri: detected,
      window_isTauri: win.isTauri,
      has_TAURI_INTERNALS: !!win.__TAURI_INTERNALS__,
      origin: typeof window !== 'undefined' ? window.location?.origin : 'no-window'
    })
    return detected
  } catch (err: any) {
    logDiagnostic('RUNTIME:isTauriEnvironment:error', { errMsg: err?.message })
    return false
  }
}

export { isTauri }

