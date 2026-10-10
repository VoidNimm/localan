import type { DirectoryReference, FileSnapshot, FileStorageAdapter, StorageEntry, WriteFileResult, SaveFileResult } from './types.ts'
import {
  setHandle,
  getHandle,
  removeHandle,
  saveSnapshot,
  getSnapshot,
  clearSnapshots,
} from '../../services/folderDb.ts'

export class WebFileStorage implements FileStorageAdapter {
  private handles = new Map<string, FileSystemDirectoryHandle>()

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  }

  async getRawDirectoryHandle(id: string): Promise<FileSystemDirectoryHandle> {
    let handle = this.handles.get(id)
    if (!handle) {
      const fromDb = await getHandle(id)
      if (fromDb) {
        handle = fromDb
        this.handles.set(id, handle)
      }
    }
    if (!handle) {
      throw new Error(`Directory handle tidak ditemukan untuk id: "${id}"`)
    }
    return handle
  }

  registerDirectoryHandle(id: string, handle: FileSystemDirectoryHandle): DirectoryReference {
    this.handles.set(id, handle)
    void setHandle(id, handle)
    return { id, name: handle.name }
  }

  async getSubdirectoryRawHandle(
    dir: DirectoryReference,
    subpath: string,
    create = false
  ): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = this.normalizeSegments(subpath)
    let currentDir = root
    for (const seg of segments) {
      currentDir = await currentDir.getDirectoryHandle(seg, { create })
    }
    return currentDir
  }

  async removeDirectory(id: string): Promise<void> {
    this.handles.delete(id)
    await removeHandle(id)
  }

  async pickDirectory(idHint?: string): Promise<DirectoryReference | null> {
    if (!this.isSupported()) return null
    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })
      const id = idHint || `dir_${Date.now()}`
      return this.registerDirectoryHandle(id, handle)
    } catch (err: any) {
      if (err?.name === 'AbortError') return null
      throw err
    }
  }

  async getDirectory(id: string): Promise<DirectoryReference | null> {
    try {
      const handle = await this.getRawDirectoryHandle(id)
      return { id, name: handle.name }
    } catch {
      return null
    }
  }

  async checkPermission(
    dir: DirectoryReference,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<'granted' | 'prompt' | 'denied'> {
    const handle = await this.getRawDirectoryHandle(dir.id)
    if ((handle as any).queryPermission) {
      return await (handle as any).queryPermission({ mode })
    }
    return 'granted'
  }

  async requestPermission(
    dir: DirectoryReference,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<'granted' | 'denied'> {
    const handle = await this.getRawDirectoryHandle(dir.id)
    if ((handle as any).requestPermission) {
      const res = await (handle as any).requestPermission({ mode })
      return res === 'granted' ? 'granted' : 'denied'
    }
    return 'granted'
  }

  private normalizeSegments(path: string): string[] {
    const normalized = path.replace(/\\/g, '/')
    const segments = normalized.split('/').filter((s) => s.length > 0 && s !== '.')
    if (segments.some((s) => s === '..')) {
      throw new Error(`Path traversal ("..") tidak diizinkan: "${path}"`)
    }
    return segments
  }

  private async resolveParentDir(
    root: FileSystemDirectoryHandle,
    segments: string[],
    create = false
  ): Promise<FileSystemDirectoryHandle> {
    let current = root
    for (let i = 0; i < segments.length - 1; i++) {
      current = await current.getDirectoryHandle(segments[i], { create })
    }
    return current
  }

  async listFiles(dir: DirectoryReference, subpath: string = ''): Promise<string[]> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = subpath ? this.normalizeSegments(subpath) : []
    let currentDir = root
    for (const seg of segments) {
      currentDir = await currentDir.getDirectoryHandle(seg)
    }
    const result: string[] = []
    for await (const entry of (currentDir as any).values()) {
      result.push(entry.name)
    }
    return result
  }

  async listEntries(dir: DirectoryReference, subpath: string = ''): Promise<StorageEntry[]> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = subpath ? this.normalizeSegments(subpath) : []
    let currentDir = root
    for (const seg of segments) {
      currentDir = await currentDir.getDirectoryHandle(seg)
    }
    const result: StorageEntry[] = []
    for await (const entry of (currentDir as any).values()) {
      result.push({
        name: entry.name,
        kind: entry.kind === 'directory' ? 'directory' : 'file',
      })
    }
    return result
  }

  async readFile(dir: DirectoryReference, relativePath: string): Promise<string> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = this.normalizeSegments(relativePath)
    if (segments.length === 0) throw new Error('Path tidak boleh kosong')
    const parent = await this.resolveParentDir(root, segments, false)
    const fileName = segments[segments.length - 1]
    const fileHandle = await parent.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    return await file.text()
  }

  async writeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<void> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = this.normalizeSegments(relativePath)
    if (segments.length === 0) throw new Error('Path tidak boleh kosong')
    const parent = await this.resolveParentDir(root, segments, true)
    const fileName = segments[segments.length - 1]
    const fileHandle = await parent.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async writeSafeFile(
    dir: DirectoryReference,
    relativePath: string,
    content: string | Blob
  ): Promise<WriteFileResult> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = this.normalizeSegments(relativePath)
    if (segments.length === 0) throw new Error('Path tidak boleh kosong')
    const parent = await this.resolveParentDir(root, segments, true)
    const fileName = segments[segments.length - 1]
    const tmpName = `.${fileName}.tmp`

    try {
      // 1. Write to temporary file
      const tmpHandle = await parent.getFileHandle(tmpName, { create: true })
      const tmpWritable = await tmpHandle.createWritable()
      await tmpWritable.write(content)
      await tmpWritable.close()

      // Verify temp file written
      if (content instanceof Blob) {
        const tmpFile = await tmpHandle.getFile()
        if (tmpFile.size !== content.size) {
          throw new Error('Ukuran file sementara tidak sesuai dengan output.')
        }
      }

      // 2. Write to final file
      const finalHandle = await parent.getFileHandle(fileName, { create: true })
      const finalWritable = await finalHandle.createWritable()
      await finalWritable.write(content)
      await finalWritable.close()

      // 3. Remove temp file
      try {
        await parent.removeEntry(tmpName)
      } catch {
        // ignore
      }

      return { fileName, fullPath: `${dir.name}/${relativePath}` }
    } catch (err) {
      try {
        await parent.removeEntry(tmpName)
      } catch {
        // ignore
      }
      throw err
    }
  }

  async saveFileDialog(
    defaultFileName: string,
    content: Blob
  ): Promise<SaveFileResult> {
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return { status: 'saved', fileName: defaultFileName, fullPath: `Downloads/${defaultFileName}` }
  }

  async deleteFile(dir: DirectoryReference, relativePath: string): Promise<void> {
    const root = await this.getRawDirectoryHandle(dir.id)
    const segments = this.normalizeSegments(relativePath)
    if (segments.length === 0) throw new Error('Path tidak boleh kosong')
    const parent = await this.resolveParentDir(root, segments, false)
    const fileName = segments[segments.length - 1]
    await parent.removeEntry(fileName)
  }

  async fileExists(dir: DirectoryReference, relativePath: string): Promise<boolean> {
    try {
      const root = await this.getRawDirectoryHandle(dir.id)
      const segments = this.normalizeSegments(relativePath)
      if (segments.length === 0) return false
      const parent = await this.resolveParentDir(root, segments, false)
      const fileName = segments[segments.length - 1]
      await parent.getFileHandle(fileName, { create: false })
      return true
    } catch {
      return false
    }
  }

  async saveSnapshot(
    _dir: DirectoryReference,
    path: string,
    content: string | null
  ): Promise<number> {
    return await saveSnapshot({
      path,
      content,
      timestamp: Date.now(),
    })
  }

  async getSnapshot(id: number): Promise<FileSnapshot | null> {
    return await getSnapshot(id)
  }

  async clearSnapshots(): Promise<void> {
    await clearSnapshots()
  }
}

export const webFileStorage = new WebFileStorage()
