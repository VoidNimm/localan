import React, { useState, useRef } from 'react'
import { GlassLens } from './GlassLens'

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Trash2,
  Edit2,
  FolderKanban,
  MoreHorizontal,
  FolderPlus,
  Check,
  RotateCw,
  Pin,
  PinOff,
  FileDown,
  Sparkles,
} from 'lucide-react'
import type { Project } from '@/types/project'

export interface ChatSession {
  id: string
  title: string
  timestamp: number
  model: string
  projectId?: string | null
  isPinned?: boolean
}

interface SidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: (projectId?: string | null) => void
  onDeleteSession: (id: string, e: React.MouseEvent) => void
  onRenameSession?: (id: string, newTitle: string) => void
  onTogglePinSession?: (id: string) => void
  onExportSession?: (id: string) => void
  onExportAllSessions?: () => void
  isOllamaConnected: boolean
  onRetryConnection?: () => void
  // Claude-style Project Props
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (projectId: string) => void
  onCreateProjectClick: () => void
  onEditProjectClick: (project: Project) => void
  onDeleteProject: (projectId: string) => void
  // Batch Studio v3 Props
  onOpenRemoveBgStudio?: () => void
  isRemoveBgActive?: boolean
}

const groupSessions = (sessions: ChatSession[]) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const pinned: ChatSession[] = [];
  const groups: Record<string, ChatSession[]> = {
    'Hari Ini': [],
    'Kemarin': [],
    '7 Hari Terakhir': [],
    'Lebih Lama': []
  };
  
  sessions.forEach(s => {
    if (s.isPinned) {
      pinned.push(s);
    } else {
      const diff = now - s.timestamp;
      if (diff < day) groups['Hari Ini'].push(s);
      else if (diff < 2 * day) groups['Kemarin'].push(s);
      else if (diff < 7 * day) groups['7 Hari Terakhir'].push(s);
      else groups['Lebih Lama'].push(s);
    }
  });

  const result: [string, ChatSession[]][] = [];
  if (pinned.length > 0) {
    result.push(['Disematkan', pinned]);
  }
  Object.entries(groups).forEach(([label, items]) => {
    if (items.length > 0) {
      result.push([label, items]);
    }
  });

  return result;
};

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onExportSession,
  onExportAllSessions,
  isOllamaConnected,
  onRetryConnection,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProjectClick,
  onEditProjectClick,
  onDeleteProject,
  onOpenRemoveBgStudio,
  isRemoveBgActive,
}) => {
  const { isMobile, setOpenMobile, state } = useSidebar()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const groupedSessions = React.useMemo(() => groupSessions(sessions), [sessions]);

  const handleStartRename = (session: ChatSession, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(session.id)
    setEditingTitle(session.title)
  }

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (editingTitle.trim() && onRenameSession) {
      onRenameSession(id, editingTitle.trim())
    }
    setEditingId(null)
  }

  const handleItemClick = (action: () => void) => {
    action()
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <ShadcnSidebar
      collapsible="icon"
      className={`z-30 border-r border-[#27272a] transition-colors duration-300 ${
        'bg-[var(--color-sidebar-bg)] bg-gradient-to-b from-white/[0.01] to-black/20'
      }`}
    >
      {/* 1. Header: Brand & Chat Baru */}
      <SidebarHeader className="p-3 border-b border-[#27272a] space-y-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center justify-between min-h-8 group-data-[collapsible=icon]:justify-center px-1">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src="/assets/logo.png"
              alt="Local Chat"
              className="w-5 h-5 object-contain rounded-md shrink-0 shadow-sm"
            />
            <span className="font-semibold text-sm tracking-wide text-white truncate group-data-[collapsible=icon]:hidden">
              Local Chat
            </span>
          </div>
        </div>

        {/* Chat Baru & Studio Buttons */}
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip="Percakapan Baru"
              onClick={() => handleItemClick(() => onNewChat(null))}
              className="w-full flex items-center justify-center gap-2 h-[44px] rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white font-medium text-sm transition-all shadow-sm hover:scale-[1.01] glass-effect"
            >
              <Plus className="w-4 h-4 text-white/70 shrink-0 group-hover:text-white" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Chat Baru</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {onOpenRemoveBgStudio && (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="default"
                tooltip="Studio Hapus Background (rembg v3)"
                isActive={isRemoveBgActive}
                data-active={isRemoveBgActive}
                onClick={() => handleItemClick(() => onOpenRemoveBgStudio())}
                className={`w-full flex items-center justify-center gap-2 h-[38px] rounded-full transition-all text-xs font-medium ${
                  isRemoveBgActive
                    ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40 shadow-sm'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">Studio rembg</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. Content: PROYEK & CHAT TERAKHIR */}
      <SidebarContent ref={contentRef} className="px-2 py-2 space-y-4 relative">
        <GlassLens
          containerRef={contentRef}
          itemSelector=".lens-item"
          activeItemSelector=".lens-item[data-active='true']"
          activeKey={currentSessionId || activeProjectId}
          enabled={state !== 'collapsed'}
          className="group-data-[collapsible=icon]:hidden"
        />
        {/* SECTION: PROYEK (Claude-style) */}
        <SidebarGroup className="p-0">
          <div className="flex items-center justify-between px-2 pb-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
            <SidebarGroupLabel className="text-[11px] font-semibold text-white/50 uppercase tracking-wider p-0 pt-0.5 group-data-[collapsible=icon]:hidden">
              PROYEK
            </SidebarGroupLabel>

            <SidebarGroupAction
              title="Buat Project Baru"
              onClick={onCreateProjectClick}
              className="text-white/50 hover:text-orange-400 hover:bg-white/5 rounded-md p-1 group-data-[collapsible=icon]:size-8"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span className="sr-only">Buat Project</span>
            </SidebarGroupAction>
          </div>

          <SidebarMenu>
            {projects.length === 0 ? (
              <div className="px-2 py-3 text-center rounded-lg bg-white/[0.02] border border-dashed border-white/10 group-data-[collapsible=icon]:hidden">
                <p className="text-[11px] text-white/40 mb-2">
                  Belum ada project
                </p>
                <button
                  type="button"
                  onClick={onCreateProjectClick}
                  className="px-2.5 py-1 text-[11px] rounded-md bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 transition-colors inline-flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  Buat Project
                </button>
              </div>
            ) : (
              projects.map((proj) => {
                const isActive = activeProjectId === proj.id && !currentSessionId
                const projectChatsCount = sessions.filter(
                  (s) => s.projectId === proj.id
                ).length

                return (
                  <SidebarMenuItem key={proj.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      data-active={isActive}
                      tooltip={`Project: ${proj.name} (${projectChatsCount} chat)`}
                      onClick={() => handleItemClick(() => onSelectProject(proj.id))}
                      className={`lens-item text-sm h-9 rounded-full px-3 transition-colors relative z-10 hover:bg-transparent active:bg-transparent data-active:bg-transparent ${
                        isActive
                          ? 'text-white font-medium'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <FolderKanban
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-orange-400' : 'text-white/50'
                        }`}
                      />
                      <span className="truncate flex-1">{proj.name}</span>
                    </SidebarMenuButton>

                    {projectChatsCount > 0 && (
                      <SidebarMenuBadge className="text-[10px] text-white/50 bg-white/5 border border-white/10 rounded-full px-2 right-2.5 group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 transition-opacity">
                        {projectChatsCount}
                      </SidebarMenuBadge>
                    )}

                    {/* Dropdown Menu for Project Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <SidebarMenuAction
                            showOnHover
                            title="Menu Project"
                            className="top-2 right-2 text-white/40 hover:text-white rounded-full hover:bg-white/10"
                          />
                        }
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="sr-only">Menu Project</span>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        side={isMobile ? 'bottom' : 'right'}
                        align="start"
                        className="w-48 bg-[#1f1f23] border-[#2f2f35] text-white"
                      >
                        <DropdownMenuItem
                          onClick={() => handleItemClick(() => onSelectProject(proj.id))}
                          className="text-xs cursor-pointer gap-2 focus:bg-white/10"
                        >
                          <FolderKanban className="w-3.5 h-3.5 text-orange-400" />
                          <span>Buka Workspace Project</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleItemClick(() => onNewChat(proj.id))}
                          className="text-xs cursor-pointer gap-2 focus:bg-white/10"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Mulai Chat di Project</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onEditProjectClick(proj)}
                          className="text-xs cursor-pointer gap-2 focus:bg-white/10"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>Ubah Detail & Berkas</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-white/10" />

                        <DropdownMenuItem
                          onClick={() => {
                            if (window.confirm(`Hapus project "${proj.name}"?`)) {
                              onDeleteProject(proj.id)
                            }
                          }}
                          className="text-xs cursor-pointer gap-2 text-red-400 focus:bg-red-500/20 focus:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Project</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* SECTION: CHAT TERAKHIR */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] font-semibold text-white/50 uppercase tracking-wider px-2 pb-1.5 group-data-[collapsible=icon]:hidden">
            CHAT TERAKHIR
          </SidebarGroupLabel>

          <SidebarMenu>
            {sessions.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-white/40 group-data-[collapsible=icon]:hidden">
                Belum ada percakapan.
              </div>
            ) : (
              groupedSessions.map(([label, items]) => (
                  <div key={label} className="mb-4 last:mb-0">
                    <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-2 pb-1.5 group-data-[collapsible=icon]:hidden flex items-center gap-1.5">
                      {label === 'Disematkan' && <Pin className="w-2.5 h-2.5 text-amber-400 rotate-45" />}
                      <span>{label}</span>
                    </div>
                    {items.map(s => {
                      const isActive = s.id === currentSessionId;
                      const isEditing = editingId === s.id;
                      const parentProject = s.projectId ? projects.find(p => p.id === s.projectId) : null;
                      
                      return (
                        <SidebarMenuItem key={s.id}>
                          <SidebarMenuButton
                            isActive={isActive}
                            data-active={isActive}
                            tooltip={s.isPinned ? `📌 ${s.title || 'Percakapan Tanpa Judul'}` : (s.title || 'Percakapan Tanpa Judul')}
                            onClick={() => {
                              if (!isEditing) handleItemClick(() => onSelectSession(s.id));
                            }}
                            className={`lens-item text-sm h-9 rounded-full pl-3 pr-9 transition-colors relative z-10 hover:bg-transparent active:bg-transparent data-active:bg-transparent ${
                              isActive
                                ? 'text-white font-medium'
                                : 'text-white/70 hover:text-white'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 group-data-[collapsible=icon]:mx-auto ${
                                isActive
                                  ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)] scale-110'
                                  : s.isPinned
                                    ? 'bg-amber-400'
                                    : 'bg-white/30 group-hover:bg-white/70'
                              }`}
                            />
                            {isEditing ? (
                              <form onSubmit={(e) => handleSaveRename(s.id, e)} className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                <input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} autoFocus onBlur={() => handleSaveRename(s.id)} className="w-full bg-[#202024] px-2 py-0.5 rounded-full text-white text-sm border border-orange-500/50 focus:outline-none" />
                                <button type="submit" className="p-0.5 text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                              </form>
                            ) : (
                              <div className="flex flex-col min-w-0 flex-1 py-0.5 justify-center group-data-[collapsible=icon]:hidden">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {s.isPinned && (
                                    <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/20 rotate-45" />
                                  )}
                                  <span className="truncate flex-1 leading-tight">{s.title || 'Percakapan Tanpa Judul'}</span>
                                </div>
                                {parentProject && (
                                  <span className="text-[10px] text-white/40 truncate leading-tight group-data-[collapsible=icon]:hidden">
                                    Project: {parentProject.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </SidebarMenuButton>
                          {!isEditing && (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 right-2 flex items-center z-20 group-data-[collapsible=icon]:hidden transition-opacity ${
                                isActive || isMobile
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100'
                              }`}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button
                                      type="button"
                                      className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                      title="Opsi Chat"
                                      aria-label="Opsi Chat"
                                    />
                                  }
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="start" className="w-44 bg-[#1f1f23] border-[#2f2f35] text-white">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onTogglePinSession?.(s.id)
                                    }}
                                    className="text-xs cursor-pointer gap-2 focus:bg-white/10"
                                  >
                                    {s.isPinned ? (
                                      <>
                                        <PinOff className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Lepas Pin</span>
                                      </>
                                    ) : (
                                      <>
                                        <Pin className="w-3.5 h-3.5 text-white/70" />
                                        <span>Pin Chat</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStartRename(s)} className="text-xs cursor-pointer gap-2 focus:bg-white/10">
                                    <Edit2 className="w-3.5 h-3.5 text-white/70" />
                                    <span>Ubah Judul</span>
                                  </DropdownMenuItem>
                                  {onExportSession && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onExportSession(s.id)
                                      }}
                                      className="text-xs cursor-pointer gap-2 focus:bg-white/10"
                                    >
                                      <FileDown className="w-3.5 h-3.5 text-orange-400" />
                                      <span>Ekspor ke README (.md)</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem
                                    onClick={(e) => onDeleteSession(s.id, e)}
                                    className="text-xs cursor-pointer gap-2 text-red-400 focus:bg-red-500/20 focus:text-red-300"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Chat</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* 3. Footer: Ollama Server Status & Export All */}
      <SidebarFooter className="p-3 border-t border-[#27272a] bg-[#161618] group-data-[collapsible=icon]:p-2 space-y-1.5">
        {onExportAllSessions && sessions.length > 0 && (
          <button
            type="button"
            onClick={onExportAllSessions}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer group-data-[collapsible=icon]:hidden"
            title="Ekspor seluruh percakapan ke berkas arsip ZIP"
          >
            <FileDown className="w-3.5 h-3.5 text-orange-400" />
            <span>Ekspor Semua Chat (ZIP)</span>
          </button>
        )}
        <div className="flex items-center justify-between p-1.5 rounded-xl transition-colors group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOllamaConnected
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-[12px] text-white/50 truncate group-data-[collapsible=icon]:hidden">
              {isOllamaConnected ? 'Ollama Tersambung' : 'Ollama Offline'}
            </span>
          </div>

          {!isOllamaConnected && onRetryConnection && (
            <button
              type="button"
              onClick={onRetryConnection}
              className="p-1 rounded-md text-orange-300 hover:text-white bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500/30 transition-colors shrink-0 group-data-[collapsible=icon]:hidden text-[10px] px-2 py-0.5 flex items-center gap-1"
              title="Coba hubungkan ulang ke Ollama"
            >
              <RotateCw className="w-2.5 h-2.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </SidebarFooter>

      {/* 4. Rail for mouse resize / edge click toggle */}
      <SidebarRail />
    </ShadcnSidebar>
  )
}
