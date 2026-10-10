import { useState, useRef, useEffect, useCallback } from 'react'
import type React from 'react'
import {
  streamOllamaChatWithEvents,
  type OllamaChatMessage,
  type ChatMessage,
  type FileAttachment,
  type OllamaModelInfo,
  type ModelCapabilities,
} from '../services/ollama'
import { FolderManager, type ToolResult } from '../services/folderTools'
import { fileStorage, type DirectoryReference } from '../adapters/storage'
import { getToolDefinitions, executeReadOnlyTool } from '../services/toolDefinitions'
import type { StoredSession } from '../services/chatStorage'
import type { Project } from '../types/project'
import type { ChatProfile } from '../types/profile'
import type { EffortLevel } from '../components/EffortPill'
import type { AppPhase } from '../components/VideoBackground'

export const getFolderSystemInstruction = (folderName: string, initialFiles?: string) => `PANDUAN & KEMAMPUAN AKSES FOLDER KERJA:
1. Pengguna telah melampirkan folder kerja "${folderName}" ke dalam percakapan/project ini.
2. Ketika pengguna bertanya tentang berkas, struktur direktori, atau isi/data/kode di dalam folder kerja atau project, SEGERA gunakan tool "list_dir" untuk menjelajahi folder atau "read_file" untuk membaca berkas yang relevan.
3. JANGAN PERNAH berasumsi bahwa folder kerja kosong atau tidak dapat diakses sebelum mencoba memanggil tool.
${initialFiles ? `\nStruktur berkas saat ini di root folder "${folderName}":\n${initialFiles}\n` : ''}
ATURAN KEJUJURAN & PELAPORAN ALAT (WAJIB DIPATUHI SECARA KETAT):
1. Laporkan kegagalan atau penolakan APA ADANYA sesuai respon tool (ok: false). DILARANG KERAS mengarang alasan palsu (seperti "state cached error", "cache issue", "memory error", dll) dan DILARANG MENGKLAIM perubahan telah berhasil jika respon tool mengembalikan ok: false.
2. Jika pengguna menolak perubahan (error_code: "user_rejected") atau operasi tool gagal, JANGAN PERNAH mengulang aksi yang sama dengan argumen yang identik. Maksimal HANYA 1 (satu) kali percobaan perbaikan jika ada pesan kesalahan spesifik atau petunjuk baris terdekat (hint).
3. Jika hasil tool menunjukkan ok: false, akui kegagalan secara transparan kepada pengguna dan sebutkan pesan kesalahan resmi dari tool.
4. Jangan membuat tool call berturut-turut dengan argumen yang sama jika pemanggilan sebelumnya gagal.`

export interface UseAgentChatOptions {
  selectedModel: string
  models: OllamaModelInfo[]
  profiles: ChatProfile[]
  capabilities: ModelCapabilities | null
  effort: EffortLevel
  sessions: StoredSession[]
  setSessions: React.Dispatch<React.SetStateAction<StoredSession[]>>
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  activeProjectId: string | null
  projects: Project[]
  folderHandle: DirectoryReference | null
  phase: AppPhase
  setPhase: (phase: AppPhase) => void
  setIsModelLoading: (loading: boolean) => void
  setErrorMessage: (msg: string | null) => void
  onBeforeSend?: () => void
}

export function useAgentChat({
  selectedModel,
  models: _models,
  profiles,
  capabilities,
  effort,
  sessions,
  setSessions,
  currentSessionId,
  setCurrentSessionId,
  messages,
  setMessages,
  activeProjectId,
  projects,
  folderHandle,
  phase,
  setPhase,
  setIsModelLoading,
  setErrorMessage,
  onBeforeSend,
}: UseAgentChatOptions) {
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const bufferedChunksRef = useRef<string[]>([])
  const isTransitioningRef = useRef(false)

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
    setIsModelLoading(false)
    isTransitioningRef.current = false
  }, [setIsModelLoading])

  // Unified loop function used by both sendMessage and resumeAfterTool
  const executeChatLoop = useCallback(
    async (
      initialLoopMessages: ChatMessage[],
      targetProjectId: string | null,
      existingPlaceholderId?: string
    ) => {
      let currentLoopMessages = [...initialLoopMessages]
      let loopCount = 0
      const executedToolSignatures = new Set<string>()
      const maxLoops = 8

      const targetProject = targetProjectId
        ? projects.find((p) => p.id === targetProjectId) || null
        : null

      // Inject Project Knowledge files if chatting inside a project
      let projectContextMsg: OllamaChatMessage | null = null
      if (targetProject && targetProject.files.length > 0) {
        const projectDocs = targetProject.files
          .filter((f) => f.textContent)
          .map((f) => `--- [Project Knowledge: ${f.name}] ---\n${f.textContent}`)
          .join('\n\n')

        if (projectDocs) {
          projectContextMsg = {
            role: 'system',
            content: `[Konteks Dokumen Project: "${targetProject.name}"]\n${projectDocs}`,
          }
        }
      }

      while (loopCount < maxLoops && !abortControllerRef.current?.signal.aborted) {
        loopCount++

        const historyPayload: OllamaChatMessage[] = []
        const currentProfile = profiles.find((p) => p.id === selectedModel)
        const targetModel = currentProfile ? currentProfile.baseModel : selectedModel

        if (currentProfile && currentProfile.systemPrompt) {
          historyPayload.push({
            role: 'system',
            content: currentProfile.systemPrompt,
          })
        }

        if (targetProject?.customInstructions) {
          historyPayload.push({
            role: 'system',
            content: targetProject.customInstructions,
          })
        }

        if (projectContextMsg) {
          historyPayload.push(projectContextMsg)
        }

        const folderMode =
          localStorage.getItem(`folderMode_${targetProjectId || 'global'}`) || 'ask'
        let currentFolder = folderHandle
        if (!currentFolder && targetProjectId) {
          currentFolder = await fileStorage.getDirectory(`folder_${targetProjectId}`)
        }
        if (!currentFolder) {
          currentFolder = await fileStorage.getDirectory('global_folder')
        }

        if (currentFolder) {
          let initialFiles = ''
          try {
            const manager = new FolderManager(currentFolder)
            const perm = await manager.queryPermission('read')
            if (perm === 'granted') {
              initialFiles = await manager.listDir('')
            }
          } catch {
            // ignore
          }

          historyPayload.push({
            role: 'system',
            content: getFolderSystemInstruction(currentFolder.name, initialFiles),
          })
        }

        historyPayload.push(
          ...currentLoopMessages.map((m) => {
            const msgImages = m.attachments
              ?.filter((a) => a.isImage && a.base64)
              .map((a) => a.base64!)

            let payloadContent = m.content
            if (m.attachments) {
              const textAttachments = m.attachments.filter(
                (a) => !a.isImage && a.textContent
              )
              if (textAttachments.length > 0) {
                const docsBlock = textAttachments
                  .map((a) => {
                    const ext = a.name.split('.').pop() || 'text'
                    return `--- [File Lampiran: ${a.name}] ---\n\`\`\`${ext}\n${a.textContent}\n\`\`\``
                  })
                  .join('\n\n')
                payloadContent = `${docsBlock}\n\n${payloadContent}`
              }
            }

            return {
              role: m.role as any,
              content: payloadContent,
              images: msgImages && msgImages.length > 0 ? msgImages : undefined,
              tool_calls: m.tool_calls,
              tool_name: m.tool_name,
            }
          })
        )

        // Setup assistant message placeholder
        const assistantPlaceholderId =
          loopCount === 1 && existingPlaceholderId
            ? existingPlaceholderId
            : 'msg_ai_' + Date.now() + '_' + loopCount

        const assistantMessage: ChatMessage = {
          id: assistantPlaceholderId,
          role: 'assistant',
          content: '',
          thinking: '',
          thinkingDurationMs: 0,
          timestamp: Date.now(),
          model: selectedModel,
        }

        currentLoopMessages.push(assistantMessage)
        setMessages([...currentLoopMessages])

        let accumulatedText = ''
        let accumulatedThinking = ''
        let accumulatedToolCalls: any[] = []
        let thinkingStartTime = 0
        let finalThinkingDurationMs = 0
        let isFrameScheduled = false

        let thinkOption: boolean | 'low' | 'medium' | 'high' | undefined = undefined
        if (capabilities?.hasThinking) {
          if (capabilities.isGptOss) {
            thinkOption = effort === 'none' ? 'medium' : (effort as 'low' | 'medium' | 'high')
          } else {
            thinkOption =
              effort === 'low' || effort === 'medium' || effort === 'high' ? true : false
          }
        }

        let tools: any[] | undefined = undefined
        const canUseTools = capabilities ? capabilities.hasTools : true
        if (canUseTools && currentFolder) {
          tools = getToolDefinitions(folderMode as any)
        }

        try {
          const stream = streamOllamaChatWithEvents(
            targetModel,
            historyPayload,
            { think: thinkOption, tools },
            abortControllerRef.current?.signal
          )

          for await (const event of stream) {
            setIsModelLoading(false)

            if (event.type === 'thinking') {
              if (thinkingStartTime === 0) thinkingStartTime = performance.now()
              accumulatedThinking += event.content
            } else if (event.type === 'content') {
              if (thinkingStartTime > 0 && finalThinkingDurationMs === 0) {
                finalThinkingDurationMs = performance.now() - thinkingStartTime
              }
              if (isTransitioningRef.current) {
                bufferedChunksRef.current.push(event.content)
                accumulatedText += event.content
              } else {
                if (bufferedChunksRef.current.length > 0) {
                  accumulatedText += bufferedChunksRef.current.join('')
                  bufferedChunksRef.current = []
                }
                accumulatedText += event.content
              }
            } else if (event.type === 'tool_calls') {
              accumulatedToolCalls = event.tool_calls
            }

            if (!isFrameScheduled) {
              isFrameScheduled = true
              requestAnimationFrame(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? {
                          ...m,
                          content: accumulatedText,
                          thinking: accumulatedThinking || undefined,
                          thinkingDurationMs:
                            finalThinkingDurationMs > 0 ? finalThinkingDurationMs : undefined,
                          tool_calls:
                            accumulatedToolCalls.length > 0
                              ? accumulatedToolCalls
                              : undefined,
                        }
                      : m
                  )
                )
                isFrameScheduled = false
              })
            }
          }

          if (bufferedChunksRef.current.length > 0) {
            accumulatedText += bufferedChunksRef.current.join('')
            bufferedChunksRef.current = []
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            let errorDetail =
              e.message || 'Terjadi kendala saat menghubungkan ke model lokal.'
            if (e.body) {
              try {
                const parsed = JSON.parse(e.body)
                if (parsed.error) errorDetail += `\nDetail: ${parsed.error}`
              } catch {
                errorDetail += `\nDetail: ${e.body}`
              }
            }
            accumulatedText += `\n\n**[Error]** ${errorDetail}`
          }
        }

        // Finalize assistant message in current loop
        const finalAssistantMsg: ChatMessage = {
          ...assistantMessage,
          content: accumulatedText,
          thinking: accumulatedThinking || undefined,
          thinkingDurationMs:
            finalThinkingDurationMs > 0 ? finalThinkingDurationMs : undefined,
          tool_calls:
            accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
        }
        const finalIdx = currentLoopMessages.findIndex((m) => m.id === assistantPlaceholderId)
        if (finalIdx !== -1) {
          currentLoopMessages[finalIdx] = finalAssistantMsg
        } else {
          currentLoopMessages.push(finalAssistantMsg)
        }
        setMessages([...currentLoopMessages])

        if (
          accumulatedToolCalls.length === 0 ||
          !currentFolder ||
          abortControllerRef.current?.signal.aborted
        ) {
          break
        }

        let hasPendingWrite = false
        let isLoopBroken = false
        const manager = new FolderManager(currentFolder)

        for (const tc of accumulatedToolCalls) {
          const fnName = tc.function.name
          const isWrite = [
            'edit_file',
            'write_file',
            'create_file',
            'delete_file',
          ].includes(fnName)
          const sig = `${fnName}:${JSON.stringify(tc.function.arguments)}`

          if (executedToolSignatures.has(sig)) {
            const duplicateResult: ToolResult = {
              ok: false,
              action: fnName,
              path: tc.function.arguments?.path,
              error_code: 'duplicate_tool_call',
              message:
                'Terdeteksi pemanggilan berulang dengan argumen yang sama. Operasi dihentikan untuk mencegah loop.',
            }
            currentLoopMessages.push({
              id: 'msg_tool_' + Date.now() + Math.random(),
              role: 'tool',
              content: JSON.stringify(duplicateResult),
              timestamp: Date.now(),
              tool_name: fnName,
            })
            setMessages([...currentLoopMessages])
            isLoopBroken = true
            break
          }
          executedToolSignatures.add(sig)

          if (isWrite) {
            const validation = await manager.validateWriteProposal(tc)
            if (!validation.ok) {
              currentLoopMessages.push({
                id: 'msg_tool_' + Date.now() + Math.random(),
                role: 'tool',
                content: JSON.stringify(validation.error),
                timestamp: Date.now(),
                tool_name: fnName,
              })
            } else {
              hasPendingWrite = true
              finalAssistantMsg.tool_status = 'pending'
              finalAssistantMsg.tool_diff = validation.diff
              ;(tc as any)._validatedContent = validation.newContent
            }
          } else {
            const result = await executeReadOnlyTool(tc, manager)
            currentLoopMessages.push({
              id: 'msg_tool_' + Date.now() + Math.random(),
              role: 'tool',
              content: result,
              timestamp: Date.now(),
              tool_name: fnName,
            })
          }
        }

        if (isLoopBroken) {
          break
        }

        if (hasPendingWrite) {
          setMessages([...currentLoopMessages])
          break
        }
      }

      setIsGenerating(false)
      setIsModelLoading(false)
      isTransitioningRef.current = false
    },
    [
      projects,
      profiles,
      selectedModel,
      folderHandle,
      capabilities,
      effort,
      setIsModelLoading,
      setMessages,
    ]
  )

  const handleSendMessage = useCallback(
    async (text: string, attachments?: FileAttachment[]) => {
      const hasAttachments = Boolean(attachments && attachments.length > 0)
      const trimmed = text.trim()
      if (!trimmed && !hasAttachments) return
      if (isGenerating) return

      const defaultPrompt = hasAttachments
        ? attachments!.some((a) => a.isImage)
          ? 'Tolong analisis dan jelaskan gambar yang saya lampirkan ini.'
          : 'Tolong analisis dan jelaskan isi file yang saya lampirkan ini.'
        : ''
      const effectiveContent = trimmed || defaultPrompt

      onBeforeSend?.()

      let sessionId = currentSessionId
      if (!sessionId) {
        sessionId = 'session_' + Date.now()
        setCurrentSessionId(sessionId)
        const sessionTitle = trimmed
          ? trimmed.slice(0, 36) + (trimmed.length > 36 ? '...' : '')
          : hasAttachments
            ? `File: ${attachments![0].name}`
            : 'Percakapan Baru'

        const newSession: StoredSession = {
          id: sessionId,
          title: sessionTitle,
          timestamp: Date.now(),
          model: selectedModel,
          messages: [],
          projectId: activeProjectId,
          isPinned: false,
        }
        setSessions((prev) => [newSession, ...prev])
      }

      const userMessage: ChatMessage = {
        id: 'msg_user_' + Date.now(),
        role: 'user',
        content: effectiveContent,
        timestamp: Date.now(),
        attachments: hasAttachments ? attachments : undefined,
      }

      const assistantPlaceholderId = 'msg_ai_' + (Date.now() + 1)
      const assistantMessage: ChatMessage = {
        id: assistantPlaceholderId,
        role: 'assistant',
        content: '',
        thinking: '',
        thinkingDurationMs: 0,
        timestamp: Date.now() + 1,
        model: selectedModel,
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsGenerating(true)
      setErrorMessage(null)

      const isLargeModel =
        selectedModel.includes('12b') ||
        selectedModel.includes('14b') ||
        selectedModel.includes('70b')
      if (isLargeModel) {
        setIsModelLoading(true)
      }

      if (phase === 'landing') {
        isTransitioningRef.current = true
        bufferedChunksRef.current = []
        setPhase('transitioning')
      }

      const currentSession = sessions.find((s) => s.id === sessionId)
      const targetProjectId = currentSession?.projectId || activeProjectId

      abortControllerRef.current = new AbortController()

      executeChatLoop(
        [...messages, userMessage],
        targetProjectId,
        assistantPlaceholderId
      )
    },
    [
      isGenerating,
      onBeforeSend,
      currentSessionId,
      setCurrentSessionId,
      selectedModel,
      activeProjectId,
      setSessions,
      setMessages,
      setErrorMessage,
      phase,
      setPhase,
      setIsModelLoading,
      sessions,
      messages,
      executeChatLoop,
    ]
  )

  const handleResumeGeneration = useCallback(
    async (toolMessages: ChatMessage[], baseMessages?: ChatMessage[]) => {
      if (isGenerating) return
      setIsGenerating(true)
      setErrorMessage(null)
      abortControllerRef.current = new AbortController()

      const currentLoopMessages = [...(baseMessages || messages), ...toolMessages]
      setMessages(currentLoopMessages)

      executeChatLoop(currentLoopMessages, activeProjectId)
    },
    [
      isGenerating,
      setErrorMessage,
      messages,
      setMessages,
      executeChatLoop,
      activeProjectId,
    ]
  )

  // Global event listeners for tool approval and tool undo
  useEffect(() => {
    const handleToolApproval = async (e: any) => {
      const { msgId, action, tc } = e.detail
      const newMessages = [...messages]
      const msgIndex = newMessages.findIndex((m) => m.id === msgId)
      if (msgIndex === -1) return

      const msg = { ...newMessages[msgIndex] }
      msg.tool_status = action === 'approve' ? 'applying' : 'rejected'
      newMessages[msgIndex] = msg
      setMessages([...newMessages])

      let toolResult: ToolResult

      if (action === 'approve') {
        try {
          let effectiveFolder = folderHandle
          if (!effectiveFolder && activeProjectId) {
            effectiveFolder = await fileStorage.getDirectory(`folder_${activeProjectId}`)
          }
          if (!effectiveFolder) {
            effectiveFolder = await fileStorage.getDirectory('global_folder')
          }
          if (!effectiveFolder) {
            throw new Error('Folder kerja belum terhubung atau akses tidak tersedia.')
          }
          const manager = new FolderManager(effectiveFolder)

          let permState = await manager.queryPermission('readwrite')
          if (permState !== 'granted') {
            permState = await manager.requestPermission('readwrite')
          }

          if (permState !== 'granted') {
            toolResult = {
              ok: false,
              action: tc.function.name,
              path: tc.function.arguments?.path,
              error_code: 'permission_denied',
              message: 'Izin tulis belum diberikan oleh pengguna untuk folder kerja.',
            }
            msg.tool_status = 'failed:permission_denied'
            msg.tool_error = toolResult.message
            newMessages[msgIndex] = { ...msg }
            setMessages([...newMessages])

            const toolMsg: ChatMessage = {
              id: 'msg_tool_' + Date.now(),
              role: 'tool',
              content: JSON.stringify(toolResult),
              timestamp: Date.now(),
              tool_name: tc.function.name,
            }
            handleResumeGeneration([toolMsg], newMessages)
            return
          }

          let undoId: number | undefined = undefined
          const fnName = tc.function.name
          const path = tc.function.arguments.path

          if (fnName === 'delete_file') {
            const segments = manager.normalizePath(path)
            const relPath = segments ? segments.join('/') : path
            let prevContent: string | null = null
            if (await manager.fileExists(path)) {
              try {
                prevContent = await fileStorage.readFile(manager.dirRef, relPath)
              } catch {
                prevContent = ''
              }
            }
            undoId = await fileStorage.saveSnapshot(manager.dirRef, relPath, prevContent)
            await fileStorage.deleteFile(manager.dirRef, relPath)

            toolResult = {
              ok: true,
              action: 'delete_file',
              path,
              message: `File "${path}" berhasil dihapus.`,
              undo_id: undoId,
            }
          } else {
            let contentToWrite = (tc as any)._validatedContent
            if (contentToWrite === undefined) {
              const val = await manager.validateWriteProposal(tc)
              if (!val.ok) {
                msg.tool_status = 'failed:' + (val.error?.error_code || 'error')
                msg.tool_error = val.error?.message
                newMessages[msgIndex] = { ...msg }
                setMessages([...newMessages])
                const toolMsg: ChatMessage = {
                  id: 'msg_tool_' + Date.now(),
                  role: 'tool',
                  content: JSON.stringify(val.error),
                  timestamp: Date.now(),
                  tool_name: fnName,
                }
                handleResumeGeneration([toolMsg], newMessages)
                return
              }
              contentToWrite = val.newContent
            }

            const segments = manager.normalizePath(path)
            const relPath = segments ? segments.join('/') : path
            const exists = await manager.fileExists(path)
            let prevContent: string | null = null
            if (exists) {
              try {
                prevContent = await fileStorage.readFile(manager.dirRef, relPath)
              } catch {
                prevContent = ''
              }
            }

            undoId = await fileStorage.saveSnapshot(manager.dirRef, relPath, prevContent)
            await fileStorage.writeFile(manager.dirRef, relPath, contentToWrite)

            toolResult = {
              ok: true,
              action: fnName,
              path,
              message: `Perubahan berhasil diterapkan ke file "${path}".`,
              undo_id: undoId,
            }
          }

          msg.tool_status = `approved:${undoId}`
          msg.tool_error = undefined
          newMessages[msgIndex] = { ...msg }
          setMessages([...newMessages])
        } catch (e: any) {
          console.error('[Tool Execution Error]', e)
          const errCode =
            e.name === 'NotAllowedError' ? 'permission_denied' : 'write_error'
          const errMsg =
            e.name === 'NotAllowedError'
              ? 'Izin tulis belum diberikan oleh pengguna untuk folder kerja (NotAllowedError).'
              : `Gagal menerapkan perubahan: ${e.name ? e.name + ': ' : ''}${e.message}`

          toolResult = {
            ok: false,
            action: tc.function.name,
            path: tc.function.arguments?.path,
            error_code: errCode,
            message: errMsg,
          }
          msg.tool_status = `failed:${errCode}`
          msg.tool_error = errMsg
          newMessages[msgIndex] = { ...msg }
          setMessages([...newMessages])
        }
      } else {
        toolResult = {
          ok: false,
          action: tc.function.name,
          path: tc.function.arguments?.path,
          error_code: 'user_rejected',
          message:
            'Pengguna menolak usulan perubahan ini. Jangan ulangi usulan yang sama.',
        }
        msg.tool_status = 'rejected'
        msg.tool_error = undefined
        newMessages[msgIndex] = { ...msg }
        setMessages([...newMessages])
      }

      const toolMsg: ChatMessage = {
        id: 'msg_tool_' + Date.now(),
        role: 'tool',
        content: JSON.stringify(toolResult),
        timestamp: Date.now(),
        tool_name: tc.function.name,
      }

      handleResumeGeneration([toolMsg], newMessages)
    }

    const handleToolUndo = async (e: any) => {
      const { msgId, tc, undoId } = e.detail

      try {
        let effectiveFolder = folderHandle
        if (!effectiveFolder && activeProjectId) {
          effectiveFolder = await fileStorage.getDirectory(`folder_${activeProjectId}`)
        }
        if (!effectiveFolder) {
          effectiveFolder = await fileStorage.getDirectory('global_folder')
        }
        if (!effectiveFolder) throw new Error('Folder kerja belum terhubung.')
        const manager = new FolderManager(effectiveFolder)
        let perm = await manager.queryPermission('readwrite')
        if (perm !== 'granted') {
          perm = await manager.requestPermission('readwrite')
        }
        if (perm !== 'granted') {
          alert('Izin tulis diperlukan untuk mengurungkan perubahan.')
          return
        }

        const snapshot = await fileStorage.getSnapshot(undoId)
        if (!snapshot) throw new Error('Snapshot tidak ditemukan')

        const path = snapshot.path
        const segments = manager.normalizePath(path)
        const relPath = segments ? segments.join('/') : path
        if (snapshot.content === null) {
          await fileStorage.deleteFile(manager.dirRef, relPath)
        } else {
          await fileStorage.writeFile(manager.dirRef, relPath, snapshot.content)
        }

        const newMessages = [...messages]
        for (let i = 0; i < newMessages.length; i++) {
          if (newMessages[i].id === msgId) {
            newMessages[i] = { ...newMessages[i], tool_status: 'undone' }
            break
          }
        }
        setMessages([...newMessages])

        const undoResult: ToolResult = {
          ok: true,
          action: 'undo',
          path,
          message: `Pengguna telah membatalkan (Urungkan) perubahan pada "${path}". File dikembalikan ke versi sebelumnya.`,
        }

        const toolMsg: ChatMessage = {
          id: 'msg_tool_' + Date.now(),
          role: 'tool',
          content: JSON.stringify(undoResult),
          timestamp: Date.now(),
          tool_name: tc.function.name,
        }
        handleResumeGeneration([toolMsg], newMessages)
      } catch (err: any) {
        console.error('Undo failed', err)
      }
    }

    window.addEventListener('tool-approval', handleToolApproval)
    window.addEventListener('tool-undo', handleToolUndo)

    return () => {
      window.removeEventListener('tool-approval', handleToolApproval)
      window.removeEventListener('tool-undo', handleToolUndo)
    }
  }, [messages, folderHandle, activeProjectId, setMessages, handleResumeGeneration])

  const handleTransitionReadyForChat = useCallback(() => {
    isTransitioningRef.current = false
    setPhase('chat')

    if (bufferedChunksRef.current.length > 0) {
      const flushed = bufferedChunksRef.current.join('')
      bufferedChunksRef.current = []
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + flushed },
          ]
        }
        return prev
      })
    }
  }, [setPhase, setMessages])

  const handleTransitionComplete = useCallback(() => {
    // Videos are unmounted from DOM
  }, [])

  return {
    isGenerating,
    sendMessage: handleSendMessage,
    resumeAfterTool: handleResumeGeneration,
    stopGeneration,
    handleTransitionReadyForChat,
    handleTransitionComplete,
  }
}
