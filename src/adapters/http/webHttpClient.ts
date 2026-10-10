import type { HttpClientAdapter, HttpRequestOptions, HttpResponse } from './types'
import { logDiagnostic } from '../../utils/diagnostic'

export class WebHttpClient implements HttpClientAdapter {
  async fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    logDiagnostic('WEB_HTTP:fetch:start', { url, method: options?.method || 'GET' })
    let response
    try {
      response = await window.fetch(url, {
        method: options?.method,
        headers: options?.headers,
        body: options?.body,
        signal: options?.signal,
      })
      logDiagnostic('WEB_HTTP:fetch:success', { url, status: response.status, ok: response.ok })
    } catch (err: any) {
      logDiagnostic('WEB_HTTP:fetch:error', {
        url,
        errName: err?.name,
        errMsg: err?.message,
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

export const webHttpClient = new WebHttpClient()
