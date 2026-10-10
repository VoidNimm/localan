import { useState, useEffect } from 'react'
import { VideoBackground } from './components/VideoBackground'
import type { AppPhase } from './components/VideoBackground'
import { Sidebar } from './components/Sidebar'
import { GlassInputBar } from './components/GlassInputBar'
import { ChatFeed } from './components/ChatFeed'
import { ProjectView } from './components/ProjectView'
import { AppHeader } from './components/AppHeader'
import { LandingHero } from './components/LandingHero'
import { AppModals } from './components/AppModals'
import { RemoveBgView } from './components/RemoveBgView'
import type { RemoveBgSourceImage } from './components/RemoveBgModal'
import { SidebarProvider } from './components/ui/sidebar'
import type { ChatProfile } from './types/profile'
import type { FileAttachment } from './services/ollama'
import { useFolder } from './hooks/useFolder'
import { useOllamaModels } from './hooks/useOllamaModels'
import { useProjects } from './hooks/useProjects'
import { useSessions } from './hooks/useSessions'
import { useAgentChat } from './hooks/useAgentChat'

const GREETINGS = [
  "Mandi dulu sebelum chat sama gua",
  "Bedul kok nanya AI",
  "Mau bikin gebrakan apa hari ini, King? Minimal jangan bikin pusing.",
  "Ambunyoo tanya something lah",
  "Donttttttt gilaaa",
  "AI : 1, gua : 0",
  "Ngerjain apa ini kita dul?",
  "Paswingi kowe mblenjani janji...",
  "Kite ga pernah tau ayam lagi sehat apa sakit, tapi die tetep keluar cari makan",
  "Tarik nafassss... input... ketebak",
  "Sung tanya baeee bray",
  "Semoga yang ketik afgansyah"
]

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('landing')
  const [greeting, setGreeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
  const [viewMode, setViewMode] = useState<'chat' | 'project_overview' | 'remove_bg'>('chat')
  const [landingUiReady, setLandingUiReady] = useState(false)

  // 1. Models hook
  const {
    models,
    selectedModel,
    capabilities,
    effort,
    isOllamaConnected,
    isModelLoading,
    setIsModelLoading,
    errorMessage,
    setErrorMessage,
    loadModels,
    handleSelectModel,
    handleEffortChange,
  } = useOllamaModels()

  // 2. Profiles state
  const [profiles, setProfiles] = useState<ChatProfile[]>(() => {
    try {
      const saved = localStorage.getItem('local_chat_profiles_v1')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ChatProfile | null>(null)

  // 3. Projects hook
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    editingProject,
    setEditingProject,
    handleSaveProject,
    handleDeleteProject: deleteProject,
    handleUpdateProjectFiles,
  } = useProjects()

  // 4. Folder hook
  const {
    handle: folderHandle,
    selectFolder,
    clearFolder,
    permissionState,
    requestWritePermission,
  } = useFolder(activeProjectId || undefined)

  useEffect(() => {
    const handlePermEvent = async () => {
      if (requestWritePermission) {
        await requestWritePermission()
      }
    }
    window.addEventListener('request-write-permission', handlePermEvent)
    return () => window.removeEventListener('request-write-permission', handlePermEvent)
  }, [requestWritePermission])

  // 5. Sessions hook
  const {
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
  } = useSessions()

  // 6. Agent Chat hook
  const {
    isGenerating,
    sendMessage,
    stopGeneration,
    handleTransitionReadyForChat,
    handleTransitionComplete,
  } = useAgentChat({
    selectedModel,
    models,
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
    onBeforeSend: () => {
      if (viewMode === 'project_overview') {
        setViewMode('chat')
      }
    },
  })

  // 7. Rembg state
  const [removeBgSource, setRemoveBgSource] = useState<RemoveBgSourceImage | null>(null)
  const [isRemoveBgOpen, setIsRemoveBgOpen] = useState(false)
  const [onApplyRemoveBgCallback, setOnApplyRemoveBgCallback] = useState<
    ((attachment: FileAttachment) => void) | null
  >(null)

  // Handlers
  const handleNewChat = (projectId?: string | null) => {
    stopGeneration()
    setCurrentSessionId(null)
    setMessages([])
    setActiveProjectId(projectId ?? null)
    setViewMode('chat')
    setPhase('landing')
  }

  const handleSelectSession = (id: string) => {
    if (currentSessionId === id && phase === 'chat' && viewMode === 'chat') return
    const s = sessions.find((item) => item.id === id)
    if (!s) return

    stopGeneration()
    setCurrentSessionId(id)
    setActiveProjectId(s.projectId || null)
    setViewMode('chat')

    if (s.model && models.some((m) => m.name === s.model)) {
      handleSelectModel(s.model)
    }

    if (s.messages && s.messages.length > 0) {
      setMessages(s.messages)
    } else {
      setMessages([
        {
          id: 'msg_user_' + s.timestamp,
          role: 'user',
          content: s.title,
          timestamp: s.timestamp,
        },
        {
          id: 'msg_ai_' + (s.timestamp + 1),
          role: 'assistant',
          content: `Sesi percakapan **${s.title}** dibuka kembali dengan model **${s.model || selectedModel}**.\n\nSemua data obrolan berada di browser lokal Anda. Anda dapat melanjutkan percakapan kapan saja.`,
          timestamp: s.timestamp + 1,
          model: s.model || selectedModel,
        },
      ])
    }
    setPhase('chat')
  }

  const handleSelectProject = (projectId: string) => {
    stopGeneration()
    setActiveProjectId(projectId)
    setCurrentSessionId(null)
    setMessages([])
    setViewMode('project_overview')
  }

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
    setSessions((prev) =>
      prev.map((s) => (s.projectId === projectId ? { ...s, projectId: undefined } : s))
    )
    if (activeProjectId === projectId) {
      handleNewChat(null)
    }
  }

  const handleConfirmDeleteSessionWithReset = () => {
    const deletedId = sessionToDelete?.id
    handleConfirmDeleteSession(() => {
      if (currentSessionId === deletedId) {
        handleNewChat(activeProjectId)
      }
    })
  }

  const handleOpenRemoveBg = (
    attachment: FileAttachment,
    onApply?: (newAttachment: FileAttachment) => void
  ) => {
    setRemoveBgSource({
      previewUrl:
        attachment.previewUrl ||
        (attachment.base64 ? `data:${attachment.type || 'image/png'};base64,${attachment.base64}` : ''),
      name: attachment.name,
    })
    setOnApplyRemoveBgCallback(() => onApply || null)
    setIsRemoveBgOpen(true)
  }

  const handleVideo1Ready = () => {
    setTimeout(() => {
      setLandingUiReady(true)
    }, 200)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setLandingUiReady(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    if (phase === 'landing') {
      timeoutId = setTimeout(() => {
        setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
      }, 0)
    }
    return () => clearTimeout(timeoutId)
  }, [phase])

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
    }, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="relative h-dvh w-full bg-[#140a07] text-[#f5f5f7] flex overflow-hidden font-sans">
        {/* 1. Cinematic Video / Poster Background */}
        <VideoBackground
          phase={phase}
          isModalOpen={isCreateProjectOpen || isProfileDialogOpen || !!sessionToDelete}
          onVideo1Ready={handleVideo1Ready}
          onTransitionReadyForChat={handleTransitionReadyForChat}
          onTransitionComplete={handleTransitionComplete}
        />

        {/* 2. Shadcn-based Dark Sidebar with Minimization & Projects */}
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onTogglePinSession={handleTogglePinSession}
          onExportSession={(id) => handleExportSession(id, folderHandle)}
          onExportAllSessions={handleExportAllSessions}
          isOllamaConnected={isOllamaConnected}
          onRetryConnection={loadModels}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onCreateProjectClick={() => {
            setEditingProject(null)
            setIsCreateProjectOpen(true)
          }}
          onEditProjectClick={(proj) => {
            setEditingProject(proj)
            setIsCreateProjectOpen(true)
          }}
          onDeleteProject={handleDeleteProject}
          onOpenRemoveBgStudio={() => setViewMode('remove_bg')}
          isRemoveBgActive={viewMode === 'remove_bg'}
        />

        {/* 3. Main Workspace Area */}
        <main className="relative flex-1 flex flex-col min-h-0 min-w-0 z-20">
          <AppHeader
            activeProject={activeProject}
            folderHandle={folderHandle}
            viewMode={viewMode}
            setViewMode={setViewMode}
            currentSessionId={currentSessionId}
            sessions={sessions}
            permissionState={permissionState}
            requestWritePermission={requestWritePermission}
            selectFolder={selectFolder}
            clearFolder={clearFolder}
            storageWarning={storageWarning}
            setStorageWarning={setStorageWarning}
          />

          {/* Dynamic Center Content */}
          <div className="flex-1 min-h-0 flex flex-col relative w-full overflow-y-auto">
            {/* Mode A: Project Workspace Overview */}
            {viewMode === 'project_overview' && activeProject && (
              <ProjectView
                project={activeProject}
                sessions={sessions}
                onStartNewChat={() => handleNewChat(activeProject.id)}
                onSelectSession={handleSelectSession}
                onEditProject={() => {
                  setEditingProject(activeProject)
                  setIsCreateProjectOpen(true)
                }}
                onDeleteProject={() => handleDeleteProject(activeProject.id)}
                onDeleteSession={(sessionId, e) => handleDeleteSession(sessionId, e)}
                onUpdateFiles={(newFiles) => handleUpdateProjectFiles(activeProject.id, newFiles)}
                folderHandle={folderHandle}
                onSelectFolder={selectFolder}
                onClearFolder={clearFolder}
                permissionState={permissionState}
                onRequestPermission={requestWritePermission}
              />
            )}

            {/* Mode B: Studio Hapus Background (rembg v3) */}
            {viewMode === 'remove_bg' && (
              <RemoveBgView
                onBackToChat={() => setViewMode('chat')}
                workingFolderHandle={folderHandle}
              />
            )}

            {/* Mode C: Landing / Sky Hero Greeting */}
            {viewMode === 'chat' && phase === 'landing' && (
              <LandingHero
                landingUiReady={landingUiReady}
                activeProject={activeProject}
                greeting={greeting}
              />
            )}

            {/* Mode C: Active Chat Feed */}
            {viewMode === 'chat' && (phase === 'chat' || phase === 'transitioning') && (
              <div className="flex-1 flex flex-col w-full">
                <ChatFeed
                  messages={messages}
                  isGenerating={isGenerating}
                  isModelLoading={isModelLoading}
                  currentModelName={selectedModel}
                  errorMessage={errorMessage}
                  onRetry={loadModels}
                  onOpenRemoveBg={handleOpenRemoveBg}
                />
              </div>
            )}
          </div>

          {/* 4. Input island: selalu di dasar area utama */}
          {viewMode === 'chat' && (
            <div
              className={`z-30 transition-opacity duration-[var(--dur-base)] ${
                phase === 'landing' && !landingUiReady ? 'opacity-0' : 'opacity-100'
              } ${
                phase === 'landing'
                  ? 'shrink-0'
                  : 'absolute bottom-0 inset-x-0 pointer-events-none pb-6 pt-16 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent'
              }`}
            >
              <GlassInputBar
                phase={phase}
                models={models}
                profiles={profiles}
                selectedModel={selectedModel}
                onSelectModel={handleSelectModel}
                isConnected={isOllamaConnected}
                isModelLoading={isModelLoading}
                isGenerating={isGenerating}
                onSendMessage={sendMessage}
                onStopGeneration={stopGeneration}
                onRefreshModels={loadModels}
                capabilities={capabilities}
                effort={effort}
                onEffortChange={handleEffortChange}
                onOpenRemoveBg={handleOpenRemoveBg}
                onCreateProfile={() => {
                  setEditingProfile(null)
                  setIsProfileDialogOpen(true)
                }}
                onEditProfile={(p) => {
                  setEditingProfile(p)
                  setIsProfileDialogOpen(true)
                }}
                onDeleteProfile={(id) => {
                  if (confirm('Yakin ingin menghapus profil ini?')) {
                    setProfiles((prev) => prev.filter((p) => p.id !== id))
                    if (selectedModel === id) {
                      handleSelectModel(models.length > 0 ? models[0].name : 'gemma4:e2b')
                    }
                  }
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* 5. Modals & Dialogs */}
      <AppModals
        isCreateProjectOpen={isCreateProjectOpen}
        setIsCreateProjectOpen={setIsCreateProjectOpen}
        handleSaveProject={handleSaveProject}
        editingProject={editingProject}
        isProfileDialogOpen={isProfileDialogOpen}
        setIsProfileDialogOpen={setIsProfileDialogOpen}
        models={models}
        editingProfile={editingProfile}
        onSaveProfile={(data, id) => {
          if (id) {
            setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
          } else {
            setProfiles((prev) => [{ ...data, id: 'profile-' + Date.now() }, ...prev])
          }
        }}
        sessionToDelete={sessionToDelete}
        setSessionToDelete={setSessionToDelete}
        handleConfirmDeleteSession={handleConfirmDeleteSessionWithReset}
        isRemoveBgOpen={isRemoveBgOpen}
        setIsRemoveBgOpen={setIsRemoveBgOpen}
        removeBgSource={removeBgSource}
        folderHandle={folderHandle}
        onApplyRemoveBgCallback={onApplyRemoveBgCallback}
      />
    </SidebarProvider>
  )
}
