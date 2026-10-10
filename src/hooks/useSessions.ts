import { useState, useEffect } from 'react'
import type React from 'react'
import {
  loadAllSessions,
  saveAllSessions,
  deleteSessionFromDb,
  requestStoragePersistence,
  checkStorageEstimate,
  type StoredSession,
} from '../services/chatStorage'
import {
  exportSessionAsZip,
  exportSessionToDirectory,
  exportAllSessionsAsZip,
} from '../services/exportChat'
import type { ChatMessage } from '../services/ollama'
import type { DirectoryReference } from '../adapters/storage'

export const STORAGE_KEY_SESSIONS = 'local_chat_sessions_v1'

export function useSessions() {
  const [sessions, setSessions] = useState<StoredSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<StoredSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Initialize persistent storage and load IndexedDB sessions
  useEffect(() => {
    requestStoragePersistence().then((persisted) => {
      if (persisted) console.info('Persistent storage granted by browser.')
    })
    checkStorageEstimate().then((est) => {
      if (est?.isWarning) {
        setStorageWarning(
          `Penyimpanan lokal browser hampir penuh (${est.percentage.toFixed(0)}%). Disarankan mengekspor percakapan penting.`
        )
      }
    })
    loadAllSessions()
      .then((loaded) => {
        if (loaded && loaded.length > 0) {
          setSessions(loaded)
        }
      })
      .catch((err) => {
        console.warn('Failed to load sessions from IndexedDB:', err)
      })
  }, [])

  // Persist sessions to localStorage and IndexedDB
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions))
    } catch {
      // quota or local storage disabled, safely handled by IndexedDB
    }
    saveAllSessions(sessions).catch((err) => {
      console.warn('Gagal menyimpan sesi ke IndexedDB:', err)
    })
  }, [sessions])

  // Sync messages into the current session object
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const timer = setTimeout(() => {
        setSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, messages } : s))
        )
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [messages, currentSessionId])

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    )
  }

  const handleTogglePinSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    )
  }

  const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = sessions.find((s) => s.id === id)
    if (target) {
      setSessionToDelete(target)
    }
  }

  const handleConfirmDeleteSession = (onAfterDelete?: (deletedId: string) => void) => {
    if (!sessionToDelete) return
    const id = sessionToDelete.id
    setSessions((prev) => prev.filter((s) => s.id !== id))
    deleteSessionFromDb(id).catch((err) => {
      console.warn('Gagal menghapus sesi dari IndexedDB:', err)
    })
    setSessionToDelete(null)
    onAfterDelete?.(id)
  }

  const handleExportSession = async (
    sessionId: string,
    folderHandle?: DirectoryReference | null
  ) => {
    const targetSession = sessions.find((s) => s.id === sessionId)
    if (!targetSession) return

    if (folderHandle) {
      try {
        await exportSessionToDirectory(targetSession, folderHandle)
        alert(
          `Percakapan "${targetSession.title}" berhasil diekspor langsung ke Folder Kerja (README.md & images/).`
        )
        return
      } catch (err) {
        console.warn('Gagal mengekspor langsung ke Folder Kerja, beralih ke ZIP:', err)
      }
    }

    await exportSessionAsZip(targetSession)
  }

  const handleExportAllSessions = async () => {
    if (sessions.length === 0) return
    await exportAllSessionsAsZip(sessions)
  }

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    sessionToDelete,
    setSessionToDelete,
    messages,
    setMessages,
    storageWarning,
    setStorageWarning,
    handleRenameSession,
    handleTogglePinSession,
    handleDeleteSession,
    handleConfirmDeleteSession,
    handleExportSession,
    handleExportAllSessions,
  }
}
