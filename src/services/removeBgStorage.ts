import { fileStorage, type DirectoryReference, type WriteFileResult, type SaveFileResult } from '../adapters/storage'

const REMBG_FOLDER_KEY = 'rembg_folder'

export function sanitizeFileName(originalName: string): string {
  // Remove extension
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
  // Replace illegal Windows characters \ / : * ? " < > | and spaces with _
  const sanitized = nameWithoutExt
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
  return sanitized || 'image'
}

export function generateRembgFileName(
  originalName: string,
  model: string = 'birefnet-general',
  dimension: number | string = 'original'
): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const cleanName = sanitizeFileName(originalName)
  const cleanModel = model.replace(/[^a-zA-Z0-9-_]/g, '_')
  const dimStr = typeof dimension === 'number' ? `${dimension}px` : String(dimension)

  return `${dateStr}_${timeStr}_${cleanName}_${cleanModel}_${dimStr}.png`
}

export async function getStoredRembgFolder(): Promise<DirectoryReference | null> {
  try {
    return await fileStorage.getDirectory(REMBG_FOLDER_KEY)
  } catch (err) {
    console.error('Failed to get stored rembg folder:', err)
    return null
  }
}

export async function checkHandlePermission(
  dir: DirectoryReference,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    return await fileStorage.checkPermission(dir, mode)
  } catch {
    return 'denied'
  }
}

export async function requestHandlePermission(
  dir: DirectoryReference,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
  try {
    return await fileStorage.requestPermission(dir, mode)
  } catch {
    return 'denied'
  }
}

export async function selectNewRembgFolder(): Promise<DirectoryReference | null> {
  if (!fileStorage.isSupported()) {
    throw new Error('Platform/browser tidak mendukung pemilihan direktori langsung.')
  }
  try {
    return await fileStorage.pickDirectory(REMBG_FOLDER_KEY)
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null
    }
    throw err
  }
}

export async function saveRembgOutputToFolder(
  parentDir: DirectoryReference,
  fileName: string,
  blob: Blob
): Promise<WriteFileResult> {
  return await fileStorage.writeSafeFile(parentDir, `rembg/${fileName}`, blob)
}

export async function writeBlobSafelyToDirectory(
  dir: DirectoryReference,
  fileName: string,
  blob: Blob
): Promise<WriteFileResult> {
  return await fileStorage.writeSafeFile(dir, fileName, blob)
}

export async function saveFallbackFile(
  fileName: string,
  blob: Blob
): Promise<SaveFileResult> {
  if (fileStorage.saveFileDialog) {
    return await fileStorage.saveFileDialog(fileName, blob)
  }
  return { status: 'cancelled' }
}

/**
 * @deprecated Gunakan saveFallbackFile() untuk mendukung desktop native dialog.
 */
export function downloadBlobFallback(blob: Blob, fileName: string): void {
  void saveFallbackFile(fileName, blob)
}
