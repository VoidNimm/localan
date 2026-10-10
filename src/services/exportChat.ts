import { zipSync, strToU8 } from 'fflate'
import type { ChatSession } from '../components/Sidebar'
import type { ChatMessage, FileAttachment } from './ollama'
import { getBlob } from './chatStorage'
import { sanitizeFileName } from './removeBgStorage'
import { fileStorage, type DirectoryReference } from '../adapters/storage'
import { resolveBlobFromSource, blobToUint8Array } from '../utils/blob'
import { isTauriEnvironment } from '../adapters/runtime'

export interface SessionWithMessages extends ChatSession {
  messages?: ChatMessage[]
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getTimestampSlug(timestamp = Date.now()): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function attachmentToUint8Array(att: FileAttachment): Promise<Uint8Array | null> {
  // 1. Try from IndexedDB blobs
  try {
    const blob = await getBlob(att.id)
    if (blob) {
      const buffer = await blob.arrayBuffer()
      return new Uint8Array(buffer)
    }
  } catch (err) {
    console.warn('Failed to load blob from db for attachment:', att.id, err)
  }

  // 2. Try from previewUrl (blob: or data:)
  if (att.previewUrl) {
    try {
      const blob = await resolveBlobFromSource(att.previewUrl)
      return await blobToUint8Array(blob)
    } catch (err) {
      console.warn('Failed to resolve previewUrl for attachment:', att.id, err)
    }
  }

  // 3. Try from base64
  if (att.base64) {
    try {
      const clean = att.base64.includes(',') ? att.base64.split(',')[1] : att.base64
      const binaryStr = atob(clean)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      return bytes
    } catch (err) {
      console.warn('Failed to decode base64 for attachment:', att.id, err)
    }
  }

  return null
}

export async function generateSessionMarkdownAndImages(
  session: SessionWithMessages,
  imagesPathPrefix = 'images/'
): Promise<{ markdown: string; images: { fileName: string; data: Uint8Array }[] }> {
  const lines: string[] = []
  const images: { fileName: string; data: Uint8Array }[] = []

  // Header
  lines.push(`# ${session.title || 'Percakapan Tanpa Judul'}`)
  lines.push('')
  lines.push(`- **Tanggal Percakapan:** ${formatDate(session.timestamp)}`)
  lines.push(`- **Model Utama:** \`${session.model || 'Default'}\``)
  lines.push(`- **ID Sesi:** \`${session.id}\``)
  lines.push('')
  lines.push('---')
  lines.push('')

  const msgs = session.messages || []

  let imageCounter = 1

  for (const msg of msgs) {
    const isUser = msg.role === 'user'
    const roleTitle = isUser ? '👤 **User**' : `🤖 **Asisten (${msg.model || session.model || 'AI'})**`
    lines.push(`### ${roleTitle}`)
    lines.push('')

    // Render attachments if user message
    if (msg.attachments && msg.attachments.length > 0) {
      lines.push('**Lampiran:**')
      lines.push('')
      for (const att of msg.attachments) {
        if (att.isImage) {
          const rawBytes = await attachmentToUint8Array(att)
          if (rawBytes) {
            const extMatch = att.name.match(/\.(png|jpe?g|webp|gif|bmp)$/i)
            const ext = extMatch ? extMatch[1].toLowerCase() : 'png'
            const cleanBaseName = sanitizeFileName(att.name)
            const exportFileName = `${getTimestampSlug(session.timestamp)}_${imageCounter++}_${cleanBaseName}.${ext}`
            images.push({ fileName: exportFileName, data: rawBytes })
            lines.push(`![${att.name}](${imagesPathPrefix}${exportFileName})`)
          } else {
            lines.push(`- 🖼️ *[Gambar: ${att.name}]*`)
          }
        } else if (att.textContent) {
          lines.push(`\`\`\`\n// File: ${att.name}\n${att.textContent.slice(0, 5000)}\n\`\`\``)
        } else {
          lines.push(`- 📄 *${att.name}*`)
        }
      }
      lines.push('')
    }

    // Thinking process if present
    if (msg.thinking) {
      lines.push('<details>')
      lines.push('<summary>🧠 <em>Proses Berpikir (Reasoning)</em></summary>')
      lines.push('')
      lines.push(msg.thinking.trim())
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }

    // Content
    if (msg.content) {
      lines.push(msg.content.trim())
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return {
    markdown: lines.join('\n'),
    images,
  }
}

/**
 * Write directly to an existing working folder directory handle
 */
export async function exportSessionToDirectory(
  session: SessionWithMessages,
  dir: DirectoryReference
): Promise<{ success: boolean; imageCount: number }> {
  const { markdown, images } = await generateSessionMarkdownAndImages(session, 'images/')

  // 1. Write README.md via adapter
  await fileStorage.writeFile(dir, 'README.md', markdown)

  // 2. Write images via adapter
  if (images.length > 0) {
    for (const img of images) {
      const imgBlob = new Blob([img.data as unknown as BlobPart])
      await fileStorage.writeFile(dir, `images/${img.fileName}`, imgBlob)
    }
  }

  return { success: true, imageCount: images.length }
}

/**
 * Tulis byte ZIP langsung ke path target di environment Tauri
 */
export async function writeExportZipFile(targetPath: string, zipped: Uint8Array): Promise<void> {
  if (isTauriEnvironment()) {
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(targetPath, zipped)
    return
  }
  throw new Error('writeExportZipFile hanya didukung di environment Tauri')
}

/**
 * Susun byte ZIP dan nama file untuk satu sesi percakapan
 */
export async function buildSessionZip(
  session: SessionWithMessages
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const { markdown, images } = await generateSessionMarkdownAndImages(session, 'images/')

  const zipFiles: Record<string, Uint8Array> = {}
  zipFiles['README.md'] = strToU8(markdown)

  for (const img of images) {
    zipFiles[`images/${img.fileName}`] = img.data
  }

  const zipped = zipSync(zipFiles)
  const cleanTitle = sanitizeFileName(session.title || 'chat')
  const zipFileName = `chat-export-${getTimestampSlug()}_${cleanTitle}.zip`

  return { fileName: zipFileName, bytes: zipped }
}

/**
 * Ekspor sesi langsung ke path file tertentu (dapat diuji otomatis tanpa dialog GUI)
 */
export async function exportSessionToPath(
  session: SessionWithMessages,
  targetPath: string
): Promise<{ targetPath: string; size: number }> {
  const { bytes } = await buildSessionZip(session)
  await writeExportZipFile(targetPath, bytes)
  return { targetPath, size: bytes.length }
}

async function saveZipBytes(zipped: Uint8Array, defaultFileName: string): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const targetPath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      })
      if (targetPath) {
        await writeExportZipFile(targetPath, zipped)
      }
      return
    } catch (err) {
      console.warn('Gagal menyimpan file ZIP via dialog Tauri, mencoba fallback DOM:', err)
    }
  }

  // Fallback Web Browser DOM download
  const blob = new Blob([zipped as unknown as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Export a single session as a ZIP file download
 */
export async function exportSessionAsZip(session: SessionWithMessages): Promise<void> {
  const { fileName, bytes } = await buildSessionZip(session)
  await saveZipBytes(bytes, fileName)
}

if (typeof window !== 'undefined') {
  ;(window as any).__exportChat = {
    exportSessionToPath,
    buildSessionZip,
    writeExportZipFile,
    exportSessionAsZip,
  }
}

/**
 * Export all sessions as a structured ZIP archive
 */
export async function exportAllSessionsAsZip(sessions: SessionWithMessages[]): Promise<void> {
  const zipFiles: Record<string, Uint8Array> = {}

  // Master index.md
  const indexLines: string[] = []
  indexLines.push('# Arsip Percakapan Local Chat')
  indexLines.push('')
  indexLines.push(`- **Waktu Ekspor:** ${formatDate(Date.now())}`)
  indexLines.push(`- **Jumlah Percakapan:** ${sessions.length}`)
  indexLines.push('')
  indexLines.push('## Daftar Percakapan')
  indexLines.push('')

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    const cleanTitle = sanitizeFileName(session.title || `chat-${i + 1}`)
    const folderName = `${String(i + 1).padStart(2, '0')}_${cleanTitle}`

    indexLines.push(`- [${session.title || 'Percakapan Tanpa Judul'}](./${folderName}/README.md) — *${formatDate(session.timestamp)}* (\`${session.model}\`)`)

    const { markdown, images } = await generateSessionMarkdownAndImages(session, 'images/')
    zipFiles[`${folderName}/README.md`] = strToU8(markdown)

    for (const img of images) {
      zipFiles[`${folderName}/images/${img.fileName}`] = img.data
    }
  }

  zipFiles['README.md'] = strToU8(indexLines.join('\n'))

  const zipped = zipSync(zipFiles)
  const zipFileName = `all-chats-export-${getTimestampSlug()}.zip`

  await saveZipBytes(zipped, zipFileName)
}
