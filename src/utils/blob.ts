/**
 * Utilitas mandiri untuk konversi Blob dan Data URI di sisi klien browser/webview.
 * Tidak melewati HttpClientAdapter karena blob: URL dan data: URI berada di memori lokal perender.
 */

export function isBlobUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('blob:')
}

export function isDataUri(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:')
}

export async function blobUrlToBlob(blobUrl: string): Promise<Blob> {
  // window.fetch lokal browser valid untuk skema blob: jika connect-src 'self' blob: diizinkan
  const resp = await window.fetch(blobUrl)
  if (!resp.ok) {
    throw new Error(`Gagal membaca blob URL: ${resp.status} ${resp.statusText}`)
  }
  return await resp.blob()
}

export function dataUriToBlob(dataUri: string): Blob {
  // Parsing sinkronus murni tanpa HTTP fetch
  const commaIdx = dataUri.indexOf(',')
  if (commaIdx === -1) throw new Error('Format Data URI tidak valid')

  const meta = dataUri.slice(0, commaIdx)
  const base64Data = dataUri.slice(commaIdx + 1)
  const mimeMatch = meta.match(/data:([^;]+)/)
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream'

  const binaryStr = window.atob(base64Data)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function resolveBlobFromSource(source: string | Blob | File): Promise<Blob> {
  if (source instanceof Blob) return source
  if (isDataUri(source)) return dataUriToBlob(source)
  if (isBlobUrl(source)) return await blobUrlToBlob(source)
  throw new Error('Format sumber biner tidak didukung')
}

export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

export function dataUriToUint8Array(dataUri: string): Uint8Array {
  const commaIdx = dataUri.indexOf(',')
  const base64Data = commaIdx !== -1 ? dataUri.slice(commaIdx + 1) : dataUri
  const binaryStr = window.atob(base64Data)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}
