export interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

export interface ToolResult {
  ok: boolean;
  action: string;
  path?: string;
  message: string;
  error_code?:
    | 'permission_denied'
    | 'file_not_found'
    | 'file_exists'
    | 'old_str_not_found'
    | 'ambiguous_match'
    | 'no_change'
    | 'invalid_json_syntax'
    | 'file_too_large'
    | 'user_rejected'
    | 'duplicate_tool_call'
    | 'write_error'
    | 'invalid_path';
  hint?: string;
  undo_id?: number;
}

export interface ToolDiff {
  type: 'edit' | 'create' | 'write' | 'delete';
  path: string;
  oldContent?: string;
  newContent?: string;
  oldLines?: string[];
  newLines?: string[];
}

export function detectEol(text: string): '\r\n' | '\n' {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/[^\r]\n/g) || []).length;
  return crlfCount > lfCount ? '\r\n' : '\n';
}

export function normalizeToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function restoreEol(text: string, eol: '\r\n' | '\n'): string {
  if (eol === '\r\n') {
    return text.replace(/\r?\n/g, '\r\n');
  }
  return text.replace(/\r\n/g, '\n');
}

export function findClosestSnippet(fileText: string, targetStr: string): string {
  const normFile = normalizeToLf(fileText);
  const fileLines = normFile.split('\n');
  const targetLines = normalizeToLf(targetStr)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (targetLines.length === 0 || fileLines.length === 0) {
    return fileLines.slice(0, 3).map((l, i) => `${i + 1}: ${l}`).join('\n');
  }

  const searchToken = targetLines[0];
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < fileLines.length; i++) {
    const lineTrim = fileLines[i].trim();
    if (!lineTrim) continue;

    if (lineTrim === searchToken) {
      bestIdx = i;
      break;
    }

    if (lineTrim.includes(searchToken) || searchToken.includes(lineTrim)) {
      bestIdx = i;
      bestScore = 100;
    } else {
      const lineWords = new Set(lineTrim.split(/\W+/).filter(Boolean));
      const targetWords = searchToken.split(/\W+/).filter(Boolean);
      let matchCount = 0;
      for (const w of targetWords) {
        if (lineWords.has(w)) matchCount++;
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestIdx = i;
      }
    }
  }

  if (bestIdx === -1) {
    return fileLines.slice(0, 3).map((l, i) => `${i + 1}: ${l}`).join('\n');
  }

  const start = Math.max(0, bestIdx - 2);
  const end = Math.min(fileLines.length, bestIdx + 3);
  return fileLines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
}

export function computeLineDiff(
  oldText: string,
  newText: string,
  path: string,
  type: 'edit' | 'create' | 'write' | 'delete'
): ToolDiff {
  const oldLines = oldText ? normalizeToLf(oldText).split('\n') : [];
  const newLines = newText ? normalizeToLf(newText).split('\n') : [];

  return {
    type,
    path,
    oldContent: oldText,
    newContent: newText,
    oldLines,
    newLines,
  };
}

import { fileStorage, webFileStorage } from '../adapters/storage/index.ts';
import type { DirectoryReference } from '../adapters/storage/types.ts';

export class FolderManager {
  dirRef: DirectoryReference;

  constructor(target: FileSystemDirectoryHandle | DirectoryReference) {
    if ('id' in target && 'name' in target) {
      this.dirRef = target;
    } else {
      this.dirRef = webFileStorage.registerDirectoryHandle(
        'folder_' + (target.name || 'root'),
        target
      );
    }
  }

  get handle(): FileSystemDirectoryHandle {
    try {
      return (webFileStorage as any).handles.get(this.dirRef.id) as FileSystemDirectoryHandle;
    } catch {
      return null as any;
    }
  }

  async queryPermission(mode: 'read' | 'readwrite' = 'read'): Promise<PermissionState> {
    try {
      const res = await fileStorage.checkPermission(this.dirRef, mode);
      return res as PermissionState;
    } catch {
      return 'denied';
    }
  }

  async requestPermission(mode: 'read' | 'readwrite' = 'read'): Promise<PermissionState> {
    try {
      const res = await fileStorage.requestPermission(this.dirRef, mode);
      return res as PermissionState;
    } catch {
      return 'denied';
    }
  }

  async verifyPermission(mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
    try {
      const current = await this.queryPermission(mode);
      if (current === 'granted') return true;
      const requested = await this.requestPermission(mode);
      return requested === 'granted';
    } catch {
      return false;
    }
  }

  normalizePath(path: string): string[] | null {
    if (typeof path !== 'string') return null;
    let clean = path.trim();
    if (clean.match(/^[a-zA-Z]:/)) {
      return null;
    }
    clean = clean.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (!clean || clean === '.') {
      return [];
    }
    const segments = clean.split(/[/\\]+/).filter(Boolean);
    const resolved: string[] = [];
    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') return null;
      resolved.push(seg);
    }
    if (
      resolved.length > 0 &&
      (resolved[0].toLowerCase() === 'workspace' ||
        (this.dirRef.name && resolved[0].toLowerCase() === this.dirRef.name.toLowerCase()))
    ) {
      if (resolved.length > 1) {
        resolved.shift();
      } else {
        return [];
      }
    }
    return resolved;
  }

  isBlocked(filename: string): boolean {
    const deniedPatterns = ['.env', '.pem', '.key', 'id_rsa'];
    for (const pat of deniedPatterns) {
      if (filename.includes(pat)) return true;
    }
    if (filename === '.git') return true;
    return false;
  }

  isDirSkipped(dirname: string): boolean {
    return (
      dirname === 'node_modules' ||
      dirname === 'dist' ||
      dirname === 'build' ||
      dirname === '.git'
    );
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const segments = this.normalizePath(path);
      if (!segments || segments.length === 0) return false;
      return await fileStorage.fileExists(this.dirRef, segments.join('/'));
    } catch {
      return false;
    }
  }

  async listDir(path: string = ''): Promise<string> {
    const segments = this.normalizePath(path);
    if (segments === null) throw new Error(`Jalur tidak valid: "${path}"`);
    for (const seg of segments) {
      if (this.isBlocked(seg) || this.isDirSkipped(seg)) {
        throw new Error(`Akses ke direktori "${seg}" ditolak`);
      }
    }

    const entries = await fileStorage.listEntries(this.dirRef, segments.join('/'));
    const formatted: string[] = [];
    for (const entry of entries) {
      if (this.isBlocked(entry.name)) continue;
      if (entry.kind === 'directory' && this.isDirSkipped(entry.name)) continue;
      formatted.push(`${entry.kind === 'directory' ? '[DIR] ' : '[FILE]'} ${entry.name}`);
    }
    return formatted.join('\n') || 'Direktori kosong';
  }

  async readFile(path: string, startLine?: number, endLine?: number): Promise<string> {
    const segments = this.normalizePath(path);
    if (!segments || segments.length === 0) throw new Error(`Jalur file tidak valid: "${path}"`);
    const filename = segments[segments.length - 1];
    if (this.isBlocked(filename)) {
      throw new Error(`Akses ke file "${filename}" ditolak`);
    }
    const relPath = segments.join('/');
    const exists = await fileStorage.fileExists(this.dirRef, relPath);
    if (!exists) throw new Error(`File "${path}" tidak ditemukan`);

    const content = await fileStorage.readFile(this.dirRef, relPath);
    if (content.length > 1024 * 1024) {
      return 'Error: Ukuran file terlalu besar (> 1MB).';
    }
    if (content.indexOf('\0') !== -1) {
      return 'Error: File terdeteksi sebagai biner. Tidak dapat dibaca sebagai teks.';
    }
    const lines = normalizeToLf(content).split('\n');
    const s = startLine ? Math.max(0, startLine - 1) : 0;
    let e = endLine ? Math.min(lines.length, endLine) : lines.length;

    if (e - s > 1000) {
      e = s + 1000;
      return (
        `--- FILE CONTENT START (BARIS ${s + 1}-${e}) ---\n` +
        lines.slice(s, e).join('\n') +
        `\n--- FILE DIBATASI 1000 BARIS. Gunakan startLine & endLine untuk membaca bagian lain ---`
      );
    }

    return `--- FILE CONTENT START ---\n${lines.slice(s, e).join('\n')}\n--- FILE CONTENT END ---`;
  }

  async search(query: string, maxResults: number = 50): Promise<string> {
    const results: string[] = [];
    const traverse = async (currentSubpath: string) => {
      if (results.length >= maxResults) return;
      const entries = await fileStorage.listEntries(this.dirRef, currentSubpath);
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (this.isBlocked(entry.name) || this.isDirSkipped(entry.name)) continue;
        const fullPath = currentSubpath ? `${currentSubpath}/${entry.name}` : entry.name;
        if (entry.kind === 'directory') {
          await traverse(fullPath);
        } else {
          try {
            const text = await fileStorage.readFile(this.dirRef, fullPath);
            if (text.length < 500 * 1024 && text.indexOf('\0') === -1) {
              const lines = normalizeToLf(text).split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(query)) {
                  results.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
                  if (results.length >= maxResults) return;
                }
              }
            }
          } catch {
            // skip inaccessible
          }
        }
      }
    };
    await traverse('');
    return results.length > 0 ? results.join('\n') : 'Tidak ada hasil yang cocok.';
  }

  /**
   * Dry-run simulation before presenting approval to the user.
   * Validates file existence, line matching, JSON syntax, etc.
   */
  async validateWriteProposal(tc: {
    function: { name: string; arguments: any };
  }): Promise<{ ok: boolean; newContent?: string; error?: ToolResult; diff?: ToolDiff }> {
    const fnName = tc.function.name;
    const args = tc.function.arguments || {};
    const path = args.path;

    if (!path || !this.normalizePath(path)) {
      return {
        ok: false,
        error: {
          ok: false,
          action: fnName,
          path,
          error_code: 'invalid_path',
          message: `Jalur file tidak valid: "${path}". Gunakan jalur relatif seperti "Data/tasks.json".`,
        },
      };
    }

    if (fnName === 'create_file') {
      const exists = await this.fileExists(path);
      if (exists) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'create_file',
            path,
            error_code: 'file_exists',
            message: `File "${path}" sudah ada di folder kerja. Gunakan edit_file atau write_file untuk mengubah file yang sudah ada.`,
          },
        };
      }

      const content = args.content ?? '';
      if (path.endsWith('.json')) {
        try {
          JSON.parse(content);
        } catch (err: any) {
          return {
            ok: false,
            error: {
              ok: false,
              action: 'create_file',
              path,
              error_code: 'invalid_json_syntax',
              message: `Isi file bukan JSON yang valid: ${err.message}. Harap perbaiki sintaks JSON.`,
            },
          };
        }
      }

      const diff = computeLineDiff('', content, path, 'create');
      return { ok: true, newContent: content, diff };
    }

    if (fnName === 'write_file') {
      const content = args.content ?? '';
      let oldContent = '';
      const exists = await this.fileExists(path);
      if (exists) {
        const segments = this.normalizePath(path);
        if (segments && segments.length > 0) {
          try {
            oldContent = await fileStorage.readFile(this.dirRef, segments.join('/'));
            if (oldContent.length > 100 * 1024) {
              return {
                ok: false,
                error: {
                  ok: false,
                  action: 'write_file',
                  path,
                  error_code: 'file_too_large',
                  message: `File "${path}" melebihi batas 100 KB untuk write_file. Gunakan edit_file untuk file besar.`,
                },
              };
            }
          } catch {
            // Abaikan jika berkas tidak bisa dibaca sebelum ditimpa
          }
        }
      }

      if (path.endsWith('.json')) {
        try {
          JSON.parse(content);
        } catch (err: any) {
          return {
            ok: false,
            error: {
              ok: false,
              action: 'write_file',
              path,
              error_code: 'invalid_json_syntax',
              message: `Isi file bukan JSON yang valid: ${err.message}. Harap perbaiki sintaks JSON.`,
            },
          };
        }
      }

      const diff = computeLineDiff(oldContent, content, path, 'write');
      return { ok: true, newContent: content, diff };
    }

    if (fnName === 'edit_file') {
      const exists = await this.fileExists(path);
      if (!exists) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'edit_file',
            path,
            error_code: 'file_not_found',
            message: `File "${path}" tidak ditemukan di folder kerja. Gunakan read_file atau list_dir untuk memastikan jalur file.`,
          },
        };
      }

      const segments = this.normalizePath(path)!;
      let rawText = '';
      try {
        rawText = await fileStorage.readFile(this.dirRef, segments.join('/'));
      } catch (err: any) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'edit_file',
            path,
            error_code: 'file_not_found',
            message: `Gagal membaca file "${path}": ${err.message}`,
          },
        };
      }
      const originalEol = detectEol(rawText);

      const oldStr = args.old_str ?? '';
      const newStr = args.new_str ?? '';

      const normText = normalizeToLf(rawText);
      const normOld = normalizeToLf(oldStr);
      const normNew = normalizeToLf(newStr);

      if (normOld === normNew) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'edit_file',
            path,
            error_code: 'no_change',
            message: 'old_str sama dengan new_str, tidak ada perubahan yang diusulkan.',
          },
        };
      }

      const parts = normText.split(normOld);
      const count = parts.length - 1;

      if (count === 0) {
        const hintSnippet = findClosestSnippet(normText, normOld);
        return {
          ok: false,
          error: {
            ok: false,
            action: 'edit_file',
            path,
            error_code: 'old_str_not_found',
            message: 'old_str tidak ditemukan dalam file. Periksa petunjuk baris terdekat di bawah.',
            hint: `Baris terdekat di sekitar target:\n${hintSnippet}`,
          },
        };
      }

      if (count > 1) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'edit_file',
            path,
            error_code: 'ambiguous_match',
            message: `old_str ditemukan sebanyak ${count} kali. Wajibkan old_str muncul tepat satu kali. Tambahkan baris konteks sebelum atau sesudah agar unik.`,
          },
        };
      }

      const replaced = parts.join(normNew);
      const finalContent = restoreEol(replaced, originalEol);

      if (path.endsWith('.json')) {
        try {
          JSON.parse(finalContent);
        } catch (err: any) {
          return {
            ok: false,
            error: {
              ok: false,
              action: 'edit_file',
              path,
              error_code: 'invalid_json_syntax',
              message: `Hasil penerapan bukan JSON yang valid: ${err.message}. Harap periksa tanda koma, kurung kurawal, atau struktur entri.`,
            },
          };
        }
      }

      const diff = computeLineDiff(rawText, finalContent, path, 'edit');
      return { ok: true, newContent: finalContent, diff };
    }

    if (fnName === 'delete_file') {
      const exists = await this.fileExists(path);
      if (!exists) {
        return {
          ok: false,
          error: {
            ok: false,
            action: 'delete_file',
            path,
            error_code: 'file_not_found',
            message: `File "${path}" tidak ditemukan.`,
          },
        };
      }

      const segments = this.normalizePath(path)!;
      let rawText = '';
      try {
        rawText = await fileStorage.readFile(this.dirRef, segments.join('/'));
      } catch {
        rawText = '';
      }
      const diff = computeLineDiff(rawText, '', path, 'delete');
      return { ok: true, newContent: '', diff };
    }

    return {
      ok: false,
      error: {
        ok: false,
        action: fnName,
        message: `Tool ${fnName} tidak dikenali sebagai operasi tulis.`,
      },
    };
  }
}
