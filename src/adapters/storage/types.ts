/**
 * Referensi buram (opaque reference) ke direktori folder kerja.
 * TIDAK mengekspos handle mentah DOM (rawHandle) atau path fisik OS secara terbuka.
 * Adapter yang menyimpan dan memetakan referensi ini secara internal.
 */
export interface DirectoryReference {
  id: string         // ID unik internal (misal: "global_folder", "proj_123")
  name: string       // Nama folder untuk tampilan UI (misal: "my-project")
}

export interface FileSnapshot {
  id?: number
  path: string
  content: string | null // null jika berkas sebelumnya belum ada
  timestamp: number
}

export interface StorageEntry {
  name: string
  kind: 'file' | 'directory'
}

export interface WriteFileResult {
  fileName: string
  fullPath?: string
}

export interface SaveFileResult {
  status: 'saved' | 'cancelled'
  fileName?: string
  fullPath?: string
}

export interface FileStorageAdapter {
  isSupported(): boolean
  pickDirectory(idHint?: string): Promise<DirectoryReference | null>
  getDirectory(id: string): Promise<DirectoryReference | null>
  removeDirectory(id: string): Promise<void>
  checkPermission(dir: DirectoryReference, mode?: 'read' | 'readwrite'): Promise<'granted' | 'prompt' | 'denied'>
  requestPermission(dir: DirectoryReference, mode?: 'read' | 'readwrite'): Promise<'granted' | 'denied'>

  listFiles(dir: DirectoryReference, subpath?: string): Promise<string[]>
  listEntries(dir: DirectoryReference, subpath?: string): Promise<StorageEntry[]>
  readFile(dir: DirectoryReference, relativePath: string): Promise<string>
  writeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<void>
  writeSafeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<WriteFileResult>
  saveFileDialog?(defaultFileName: string, content: Blob): Promise<SaveFileResult>
  deleteFile(dir: DirectoryReference, relativePath: string): Promise<void>
  fileExists(dir: DirectoryReference, relativePath: string): Promise<boolean>

  // Snapshot & Undo Management
  saveSnapshot(dir: DirectoryReference, path: string, content: string | null): Promise<number>
  getSnapshot(id: number): Promise<FileSnapshot | null>
  clearSnapshots?(): Promise<void>
}

