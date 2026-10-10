export * from './types.ts'
export * from './webFileStorage.ts'
export * from './tauriFileStorage.ts'

import { isTauriEnvironment } from '../runtime.ts'
import { webFileStorage } from './webFileStorage.ts'
import { tauriFileStorage } from './tauriFileStorage.ts'
import type { DirectoryReference, FileSnapshot, FileStorageAdapter, StorageEntry } from './types.ts'

export const fileStorage: FileStorageAdapter = {
  isSupported(): boolean {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.isSupported()
  },
  pickDirectory(idHint?: string): Promise<DirectoryReference | null> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.pickDirectory(idHint)
  },
  getDirectory(id: string): Promise<DirectoryReference | null> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.getDirectory(id)
  },
  removeDirectory(id: string): Promise<void> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.removeDirectory(id)
  },
  checkPermission(dir: DirectoryReference, mode?: 'read' | 'readwrite'): Promise<'granted' | 'prompt' | 'denied'> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.checkPermission(dir, mode)
  },
  requestPermission(dir: DirectoryReference, mode?: 'read' | 'readwrite'): Promise<'granted' | 'denied'> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.requestPermission(dir, mode)
  },
  listFiles(dir: DirectoryReference, subpath?: string): Promise<string[]> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.listFiles(dir, subpath)
  },
  listEntries(dir: DirectoryReference, subpath?: string): Promise<StorageEntry[]> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.listEntries(dir, subpath)
  },
  readFile(dir: DirectoryReference, relativePath: string): Promise<string> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.readFile(dir, relativePath)
  },
  writeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<void> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.writeFile(dir, relativePath, content)
  },
  writeSafeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<import('./types.ts').WriteFileResult> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.writeSafeFile(dir, relativePath, content)
  },
  saveFileDialog(
    defaultFileName: string,
    content: Blob
  ): Promise<import('./types.ts').SaveFileResult> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    if (active.saveFileDialog) {
      return active.saveFileDialog(defaultFileName, content)
    }
    return Promise.resolve({ status: 'cancelled' })
  },
  deleteFile(dir: DirectoryReference, relativePath: string): Promise<void> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.deleteFile(dir, relativePath)
  },
  fileExists(dir: DirectoryReference, relativePath: string): Promise<boolean> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.fileExists(dir, relativePath)
  },
  saveSnapshot(dir: DirectoryReference, path: string, content: string | null): Promise<number> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.saveSnapshot(dir, path, content)
  },
  getSnapshot(id: number): Promise<FileSnapshot | null> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    return active.getSnapshot(id)
  },
  clearSnapshots(): Promise<void> {
    const active = isTauriEnvironment() ? tauriFileStorage : webFileStorage
    if (active.clearSnapshots) {
      return active.clearSnapshots()
    }
    return Promise.resolve()
  },
}

if (typeof window !== 'undefined') {
  ;(window as any).__fileStorage = fileStorage
}
