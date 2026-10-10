import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import type { HttpClientAdapter, HttpRequestOptions, HttpResponse } from './types'
import { logDiagnostic } from '../../utils/diagnostic'

export class TauriHttpClient implements HttpClientAdapter {
  async fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    logDiagnostic('TAURI_HTTP:fetch:start', { url, method: options?.method || 'GET' })
    let response
    const headersMap: Record<string, string> = { ...(options?.headers || {}) }
    // Hapus header Origin pada permintaan lokal ke Ollama atau rembg agar tauri-plugin-http
    // (dengan fitur unsafe-headers) tidak menyuntikkan "http://tauri.localhost" yang ditolak oleh Ollama (403 Forbidden).
    if (!headersMap['Origin'] && !headersMap['origin']) {
      headersMap['Origin'] = ''
    }

    try {
      response = await tauriFetch(url, {
        method: options?.method,
        headers: headersMap,
        body: options?.body,
        signal: options?.signal,
      })

      logDiagnostic('TAURI_HTTP:fetch:success', { url, status: response.status, ok: response.ok })
    } catch (err: any) {
      logDiagnostic('TAURI_HTTP:fetch:error', {
        url,
        errName: err?.name,
        errMsg: err?.message,
        stack: err?.stack,
      })
      throw err
    }

    const headersRecord: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headersRecord[key] = value
    })

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: headersRecord,
      json: () => response.json(),
      text: () => response.text(),
      blob: () => response.blob(),
      arrayBuffer: () => response.arrayBuffer(),
      bodyStream: () => response.body,
    }
  }
}


export const tauriHttpClient = new TauriHttpClient()
