export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  isImage: boolean
  previewUrl?: string
  base64?: string
  textContent?: string
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImageFile(file: File | { name: string; type?: string }): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name)
}

export function isCodeFile(fileName: string): boolean {
  return /\.(js|jsx|ts|tsx|py|html|css|scss|sass|less|java|c|cpp|h|hpp|cs|go|rs|php|rb|sql|sh|bash|zsh|bat|cmd|ps1|yaml|yml|xml|log|env|toml|ini|conf|diff|patch|dockerfile|prisma|graphql|gql)$/i.test(fileName)
}

export function isSpreadsheetFile(fileName: string): boolean {
  return /\.(csv|tsv)$/i.test(fileName)
}

export function isPdfFile(fileName: string): boolean {
  return /\.pdf$/i.test(fileName)
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const text = new TextDecoder('latin1').decode(bytes)

    const textBlocks: string[] = []
    const btRegex = /BT[\s\S]*?ET/g
    let match: RegExpExecArray | null

    while ((match = btRegex.exec(text)) !== null) {
      const block = match[0]
      const stringMatches = block.match(/\(([^)]+)\)\s*Tj/g)
      if (stringMatches) {
        for (const sm of stringMatches) {
          const str = sm.replace(/^\(/, '').replace(/\)\s*Tj$/, '')
          textBlocks.push(str)
        }
      }
      const tjMatches = block.match(/\[(.*?)\]\s*TJ/g)
      if (tjMatches) {
        for (const tj of tjMatches) {
          const innerStrings = tj.match(/\(([^)]+)\)/g)
          if (innerStrings) {
            textBlocks.push(innerStrings.map((s) => s.slice(1, -1)).join(''))
          }
        }
      }
    }

    if (textBlocks.length > 0) {
      const extracted = textBlocks.join(' ').replace(/\s+/g, ' ').trim()
      if (extracted.length > 20) {
        return `[Isi Dokumen PDF: ${file.name}]\n${extracted}`
      }
    }

    // Fallback: extract printable ASCII sequences >= 4 chars
    const printable = text.replace(/[^\x20-\x7E\r\n\t]/g, ' ')
    const words = printable.match(/[A-Za-z0-9_.,;:?!'"()[\]{}+=*/-]{3,}/g)
    if (words && words.length > 30) {
      return `[Teks terekstrak dari PDF: ${file.name}]\n${words.join(' ').slice(0, 8000)}`
    }

    return `[File PDF terlampir: ${file.name} (${formatFileSize(file.size)})]`
  } catch {
    return `[File PDF terlampir: ${file.name} (${formatFileSize(file.size)})]`
  }
}

export async function readFileAsAttachment(file: File): Promise<FileAttachment> {
  const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
  const isImage = isImageFile(file)

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        resolve({
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'image/png',
          isImage: true,
          previewUrl: dataUrl,
          base64,
        })
      }
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'))
      reader.readAsDataURL(file)
    })
  }

  if (isPdfFile(file.name)) {
    const textContent = await extractPdfText(file)
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      isImage: false,
      textContent,
    }
  }

  // Treat as text/code/data file
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = (reader.result as string) || ''
      resolve({
        id,
        name: file.name,
        size: file.size,
        type: file.type || 'text/plain',
        isImage: false,
        textContent: text,
      })
    }
    reader.onerror = () => {
      resolve({
        id,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        isImage: false,
        textContent: `[Lampiran file: ${file.name} (${formatFileSize(file.size)})]`,
      })
    }
    reader.readAsText(file)
  })
}

export interface ResizeImageResult {
  blob: Blob
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  wasResized: boolean
}

export async function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal membaca dimensi gambar'))
    }
    img.src = url
  })
}

export async function resizeImage(
  file: File | Blob,
  maxDimension: number | null
): Promise<ResizeImageResult> {
  const { width: origWidth, height: origHeight } = await getImageDimensions(file)

  if (maxDimension === null || Math.max(origWidth, origHeight) <= maxDimension) {
    return {
      blob: file,
      width: origWidth,
      height: origHeight,
      originalWidth: origWidth,
      originalHeight: origHeight,
      wasResized: false,
    }
  }

  const scale = maxDimension / Math.max(origWidth, origHeight)
  const targetWidth = Math.round(origWidth * scale)
  const targetHeight = Math.round(origHeight * scale)

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({
            blob: file,
            width: origWidth,
            height: origHeight,
            originalWidth: origWidth,
            originalHeight: origHeight,
            wasResized: false,
          })
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({
                blob: file,
                width: origWidth,
                height: origHeight,
                originalWidth: origWidth,
                originalHeight: origHeight,
                wasResized: false,
              })
              return
            }
            resolve({
              blob,
              width: targetWidth,
              height: targetHeight,
              originalWidth: origWidth,
              originalHeight: origHeight,
              wasResized: true,
            })
          },
          file.type || 'image/png',
          0.95
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal memuat gambar untuk diubah ukurannya'))
    }
    img.src = url
  })
}
