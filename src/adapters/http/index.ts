export * from './types'
export * from './webHttpClient'
export * from './tauriHttpClient'

import { isTauriEnvironment } from '../runtime'
import { webHttpClient } from './webHttpClient'
import { tauriHttpClient } from './tauriHttpClient'
import type { HttpClientAdapter, HttpRequestOptions, HttpResponse } from './types'

export const httpClient: HttpClientAdapter = {
  fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    const isTauriEnv = isTauriEnvironment()
    const active = isTauriEnv ? tauriHttpClient : webHttpClient
    return active.fetch(url, options)
  },
}

