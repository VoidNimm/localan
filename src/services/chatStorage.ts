import type { ChatSession } from '../components/Sidebar'
import type { ChatMessage, FileAttachment } from './ollama'

export interface StoredSession extends ChatSession {
  messages?: ChatMessage[]
}

const DB_NAME = 'local-chat-store'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'
const BLOBS_STORE = 'blobs'
const METADATA_STORE = 'metadata'
const LEGACY_STORAGE_KEY_SESSIONS = 'local_chat_sessions_v1'

export interface StorageEstimateResult {
  usage: number
  quota: number
  percentage: number
  isWarning: boolean
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB tidak didukung pada browser ini.'))
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist()
      return isPersisted
    } catch (err) {
      console.warn('Failed to request persistent storage:', err)
      return false
    }
  }
  return false
}

export async function checkStorageEstimate(): Promise<StorageEstimateResult | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      const percentage = quota > 0 ? (usage / quota) * 100 : 0
      return {
        usage,
        quota,
        percentage,
        isWarning: percentage > 90,
      }
    } catch (err) {
      console.warn('Failed to get storage estimate:', err)
      return null
    }
  }
  return null
}

export async function saveBlob(id: string, blob: Blob, mimeType?: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readwrite')
    const store = tx.objectStore(BLOBS_STORE)
    const item = {
      id,
      blob,
      mimeType: mimeType || blob.type || 'application/octet-stream',
      createdAt: Date.now(),
    }
    const req = store.put(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readonly')
    const store = tx.objectStore(BLOBS_STORE)
    const req = store.get(id)
    req.onsuccess = () => {
      const res = req.result
      if (res && res.blob instanceof Blob) {
        resolve(res.blob)
      } else {
        resolve(null)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

function base64ToBlob(base64: string, mimeType = 'image/png'): Blob {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64
  const byteCharacters = atob(cleanBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

/**
 * Optimizes attachments before persisting:
 * Stashes heavy base64 strings into IndexedDB `blobs` store so `sessions` records remain compact.
 */
async function processAttachmentsForStorage(
  attachments: FileAttachment[] | undefined
): Promise<FileAttachment[] | undefined> {
  if (!attachments || attachments.length === 0) return attachments

  const processed: FileAttachment[] = []
  for (const att of attachments) {
    if (att.isImage && att.base64 && att.base64.length > 500) {
      try {
        const blob = base64ToBlob(att.base64, att.type || 'image/png')
        await saveBlob(att.id, blob, att.type)
        // Keep previewUrl or empty out massive base64 to save session space
        processed.push({
          ...att,
          // base64 omitted or truncated in session json to avoid quota bloat
          base64: undefined,
        })
      } catch (err) {
        console.warn('Failed to extract image to blob store:', err)
        processed.push(att)
      }
    } else {
      processed.push(att)
    }
  }
  return processed
}

export async function saveSession(session: StoredSession): Promise<void> {
  const db = await openDB()
  
  // Clone and sanitize messages
  let sanitizedMessages = session.messages
  if (session.messages && session.messages.length > 0) {
    sanitizedMessages = await Promise.all(
      session.messages.map(async (msg) => {
        if (msg.attachments && msg.attachments.length > 0) {
          const processedAtts = await processAttachmentsForStorage(msg.attachments)
          return { ...msg, attachments: processedAtts }
        }
        return msg
      })
    )
  }

  const sessionToSave: StoredSession = {
    ...session,
    messages: sanitizedMessages,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite')
    const store = tx.objectStore(SESSIONS_STORE)
    const req = store.put(sessionToSave)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function saveAllSessions(sessions: StoredSession[]): Promise<void> {
  for (const s of sessions) {
    await saveSession(s)
  }
}

export async function deleteSessionFromDb(sessionId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite')
    const store = tx.objectStore(SESSIONS_STORE)
    const req = store.delete(sessionId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function loadAllSessions(): Promise<StoredSession[]> {
  const db = await openDB()

  // 1. Fetch sessions from IndexedDB
  const storedSessions: StoredSession[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readonly')
    const store = tx.objectStore(SESSIONS_STORE)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })

  // 2. Migration check: If IndexedDB is empty, check localStorage
  if (storedSessions.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_SESSIONS)
      if (legacyRaw) {
        const legacySessions: StoredSession[] = JSON.parse(legacyRaw)
        if (Array.isArray(legacySessions) && legacySessions.length > 0) {
          console.info(
            `Migrating ${legacySessions.length} sessions from localStorage to IndexedDB...`
          )
          await saveAllSessions(legacySessions)
          return legacySessions
        }
      }
    } catch (e) {
      console.error('Failed to migrate legacy localStorage sessions:', e)
    }
  }

  // 3. Rehydrate previewUrls for attachments stored in blobs
  const rehydratedSessions: StoredSession[] = []
  for (const session of storedSessions) {
    if (!session.messages || session.messages.length === 0) {
      rehydratedSessions.push(session)
      continue
    }

    const rehydratedMessages = await Promise.all(
      session.messages.map(async (msg) => {
        if (!msg.attachments || msg.attachments.length === 0) return msg

        const rehydratedAtts = await Promise.all(
          msg.attachments.map(async (att) => {
            if (att.isImage && !att.previewUrl && !att.base64) {
              const blob = await getBlob(att.id)
              if (blob) {
                const previewUrl = URL.createObjectURL(blob)
                return { ...att, previewUrl }
              }
            }
            return att
          })
        )
        return { ...msg, attachments: rehydratedAtts }
      })
    )

    rehydratedSessions.push({
      ...session,
      messages: rehydratedMessages,
    })
  }

  return rehydratedSessions
}
