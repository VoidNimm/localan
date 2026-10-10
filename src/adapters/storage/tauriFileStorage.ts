import { open, save } from '@tauri-apps/plugin-dialog'
import {
  readTextFile,
  writeTextFile,
  writeFile,
  exists,
  mkdir,
  remove,
  rename,
  readDir,
  type DirEntry,
} from '@tauri-apps/plugin-fs'
import type { DirectoryReference, FileSnapshot, FileStorageAdapter, StorageEntry, WriteFileResult, SaveFileResult } from './types.ts'
import {
  saveSnapshot,
  getSnapshot,
  clearSnapshots,
} from '../../services/folderDb.ts'

export class TauriFileStorage implements FileStorageAdapter {
  isSupported(): boolean {
    return true
  }

  private extractName(path: string): string {
    const parts = path.split(/[\\/]/).filter((p) => p.length > 0)
    return parts[parts.length - 1] || 'folder'
  }

  private resolveFullPath(dir: DirectoryReference, relativePath: string): string {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (cleanRel.split('/').includes('..')) {
      throw new Error(`Path traversal ("..") tidak diizinkan: "${relativePath}"`)
    }
    const sep = dir.id.includes('\\') ? '\\' : '/'
    return `${dir.id}${sep}${cleanRel.replace(/\//g, sep)}`
  }

  private async ensureParentDir(fullPath: string): Promise<void> {
    const lastSlash = Math.max(fullPath.lastIndexOf('\\'), fullPath.lastIndexOf('/'))
    if (lastSlash > 0) {
      const parent = fullPath.substring(0, lastSlash)
      const parentExists = await exists(parent)
      if (!parentExists) {
        await mkdir(parent, { recursive: true })
      }
    }
  }

  async pickDirectory(idHint?: string): Promise<DirectoryReference | null> {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
      })
      if (!selected || typeof selected !== 'string') {
        return null
      }

      const dirRef: DirectoryReference = {
        id: selected,
        name: this.extractName(selected),
      }

      if (idHint) {
        try {
          localStorage.setItem(`tauri_dir_${idHint}`, selected)
        } catch {
          // ignore localStorage error
        }
      }

      return dirRef
    } catch (err: unknown) {
      console.warn('Tauri open directory cancelled or failed:', err)
      return null
    }
  }

  async getDirectory(id: string): Promise<DirectoryReference | null> {
    try {
      // Check if id is a hint stored in localStorage
      let resolvedPath = id
      try {
        const stored = localStorage.getItem(`tauri_dir_${id}`)
        if (stored) {
          resolvedPath = stored
        }
      } catch {
        // ignore
      }

      const dirExists = await exists(resolvedPath)
      if (dirExists) {
        return {
          id: resolvedPath,
          name: this.extractName(resolvedPath),
        }
      }
      return null
    } catch {
      return null
    }
  }

  async removeDirectory(id: string): Promise<void> {
    try {
      localStorage.removeItem(`tauri_dir_${id}`)
    } catch {
      // ignore
    }
  }

  async checkPermission(dir: DirectoryReference, _mode?: 'read' | 'readwrite'): Promise<'granted' | 'prompt' | 'denied'> {
    try {
      const dirExists = await exists(dir.id)
      return dirExists ? 'granted' : 'denied'
    } catch {
      return 'denied'
    }
  }

  async requestPermission(dir: DirectoryReference, _mode?: 'read' | 'readwrite'): Promise<'granted' | 'denied'> {
    try {
      const dirExists = await exists(dir.id)
      return dirExists ? 'granted' : 'denied'
    } catch {
      return 'denied'
    }
  }

  async readFile(dir: DirectoryReference, relativePath: string): Promise<string> {
    const fullPath = this.resolveFullPath(dir, relativePath)
    return await readTextFile(fullPath)
  }

  async writeFile(dir: DirectoryReference, relativePath: string, content: string | Blob): Promise<void> {
    const fullPath = this.resolveFullPath(dir, relativePath)
    await this.ensureParentDir(fullPath)

    if (typeof content === 'string') {
      await writeTextFile(fullPath, content)
    } else {
      const buffer = await content.arrayBuffer()
      await writeFile(fullPath, new Uint8Array(buffer))
    }
  }

  async writeSafeFile(
    dir: DirectoryReference,
    relativePath: string,
    content: string | Blob
  ): Promise<WriteFileResult> {
    const fullPath = this.resolveFullPath(dir, relativePath)
    await this.ensureParentDir(fullPath)

    const tmpPath = `${fullPath}.${Date.now()}.tmp`
    if (typeof content === 'string') {
      await writeTextFile(tmpPath, content)
    } else {
      const buffer = await content.arrayBuffer()
      await writeFile(tmpPath, new Uint8Array(buffer))
    }

    try {
      await rename(tmpPath, fullPath)
    } catch {
      // Fallback: write directly if rename fails
      if (typeof content === 'string') {
        await writeTextFile(fullPath, content)
      } else {
        const buffer = await content.arrayBuffer()
        await writeFile(fullPath, new Uint8Array(buffer))
      }
      try {
        await remove(tmpPath)
      } catch {
        // ignore tmp removal failure
      }
    }

    const fileName = relativePath.split(/[\\/]/).pop() || relativePath
    return { fileName, fullPath }
  }

  async saveFileDialog(
    defaultFileName: string,
    content: Blob
  ): Promise<SaveFileResult> {
    try {
      const ext = defaultFileName.split('.').pop() || 'png'
      const selected = await save({
        defaultPath: defaultFileName,
        filters: [{ name: 'Image', extensions: [ext] }],
      })
      if (!selected || typeof selected !== 'string') {
        return { status: 'cancelled' }
      }

      await this.ensureParentDir(selected)
      const buffer = await content.arrayBuffer()
      await writeFile(selected, new Uint8Array(buffer))
      const fileName = selected.split(/[\\/]/).pop() || defaultFileName
      return { status: 'saved', fullPath: selected, fileName }
    } catch (err) {
      console.error('Tauri saveFileDialog failed:', err)
      throw err
    }
  }

  async deleteFile(dir: DirectoryReference, relativePath: string): Promise<void> {
    const fullPath = this.resolveFullPath(dir, relativePath)
    if (await exists(fullPath)) {
      await remove(fullPath)
    }
  }

  async fileExists(dir: DirectoryReference, relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolveFullPath(dir, relativePath)
      return await exists(fullPath)
    } catch {
      return false
    }
  }

  async listEntries(dir: DirectoryReference, subpath: string = ''): Promise<StorageEntry[]> {
    const targetPath = subpath ? this.resolveFullPath(dir, subpath) : dir.id
    if (!(await exists(targetPath))) {
      return []
    }
    const entries: DirEntry[] = await readDir(targetPath)
    return entries.map((e) => ({
      name: e.name,
      kind: e.isDirectory ? 'directory' : 'file',
    }))
  }

  async listFiles(dir: DirectoryReference, subpath: string = ''): Promise<string[]> {
    const results: string[] = []
    const targetPath = subpath ? this.resolveFullPath(dir, subpath) : dir.id
    if (!(await exists(targetPath))) {
      return []
    }

    const traverse = async (currentPath: string, prefix: string) => {
      const entries: DirEntry[] = await readDir(currentPath)
      for (const entry of entries) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build'
          ) {
            continue
          }
          const sep = currentPath.includes('\\') ? '\\' : '/'
          await traverse(`${currentPath}${sep}${entry.name}`, relPath)
        } else if (entry.isFile) {
          results.push(relPath)
        }
      }
    }

    await traverse(targetPath, subpath ? subpath.replace(/\\/g, '/').replace(/^\/+/, '') : '')
    return results
  }

  async saveSnapshot(_dir: DirectoryReference, path: string, content: string | null): Promise<number> {
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

export const tauriFileStorage = new TauriFileStorage()
