export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'HEAD' | 'DELETE'
  headers?: Record<string, string>
  body?: string | FormData | Blob
  signal?: AbortSignal
}

export interface HttpResponse<T = any> {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  json(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  /**
   * Mengembalikan stream byte respons (ReadableStream atau AsyncIterable).
   * Parsing NDJSON / event framing dilakukan oleh pemanggil (misal: ollama.ts).
   */
  bodyStream(): ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null
}

export interface HttpClientAdapter {
  fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse>
}
