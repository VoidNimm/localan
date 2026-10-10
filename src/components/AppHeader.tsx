import { SidebarTrigger } from './ui/sidebar'
import {
  FolderKanban,
  FolderOpen,
  ChevronDown,
  FolderSync,
  Unlink,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import type { Project } from '../types/project'
import type { StoredSession } from '../services/chatStorage'
import type { DirectoryReference } from '../adapters/storage'

export interface AppHeaderProps {
  activeProject: Project | null
  folderHandle: DirectoryReference | null
  viewMode: 'chat' | 'project_overview' | 'remove_bg'
  setViewMode: (mode: 'chat' | 'project_overview' | 'remove_bg') => void
  currentSessionId: string | null
  sessions: StoredSession[]
  permissionState: 'granted' | 'prompt' | 'denied' | 'unknown'
  requestWritePermission: () => Promise<boolean>
  selectFolder: () => Promise<void>
  clearFolder: () => Promise<void>
  storageWarning: string | null
  setStorageWarning: (warning: string | null) => void
}

export function AppHeader({
  activeProject,
  folderHandle,
  viewMode,
  setViewMode,
  currentSessionId,
  sessions,
  permissionState,
  requestWritePermission,
  selectFolder,
  clearFolder,
  storageWarning,
  setStorageWarning,
}: AppHeaderProps) {
  return (
    <>
      {/* Universal Header Bar (Supports Sidebar toggle in minimized/expanded mode & breadcrumb) */}
      <header className="flex items-center justify-between px-4 py-3 z-30 select-none border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger className="w-11 h-11 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-transform glass-effect shrink-0" />

          {/* Breadcrumbs or Active Project Indicator */}
          {activeProject ? (
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('project_overview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                  viewMode === 'project_overview'
                    ? 'bg-orange-600/30 border-orange-500/40 text-orange-200 font-medium'
                    : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-orange-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {activeProject.name}
                </span>
              </button>

              {folderHandle && (
                <>
                  <span className="text-white/30 hidden sm:inline">/</span>
                  <span
                    className="hidden sm:flex items-center gap-1.5 text-orange-300 font-mono text-[11px] truncate max-w-[160px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md"
                    title={`Folder Kerja: ${folderHandle.name}`}
                  >
                    <FolderOpen className="w-3 h-3 text-orange-400 shrink-0" />
                    <span className="truncate">{folderHandle.name}</span>
                  </span>
                </>
              )}

              {viewMode === 'chat' && currentSessionId && (
                <span className="text-white/40 hidden sm:inline truncate max-w-[160px]">
                  / {sessions.find((s) => s.id === currentSessionId)?.title || 'Chat'}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="text-xs font-semibold tracking-wider uppercase text-white/70 shrink-0">
                Everthing is local and private
              </span>

              {folderHandle && (
                <>
                  <span className="text-white/30">/</span>
                  <span
                    className="flex items-center gap-1.5 text-orange-300 font-mono text-xs truncate max-w-[160px] sm:max-w-[240px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md"
                    title={`Folder Kerja Terhubung: ${folderHandle.name}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">{folderHandle.name}</span>
                  </span>
                </>
              )}

              {viewMode === 'chat' && currentSessionId && (
                <span className="text-white/40 hidden sm:inline truncate max-w-[160px]">
                  / {sessions.find((s) => s.id === currentSessionId)?.title || 'Chat'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side header actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Working Folder Pill Indicator (Sesuai peraturan design.md) */}
          {folderHandle && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-orange-500/30 text-xs font-medium text-white transition-all shadow-sm glass-pill cursor-pointer"
                    title={`Folder Kerja Terhubung: ${folderHandle.name}`}
                  />
                }
              >
                {permissionState === 'granted' ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : (
                  <span className="relative flex h-2 w-2 shrink-0" title="Izin akses folder diperlukan">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                )}
                <FolderOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="font-mono text-xs text-orange-200/90 truncate max-w-[110px] sm:max-w-[180px]">
                  {folderHandle.name}
                </span>
                <ChevronDown className="w-3 h-3 text-white/50 shrink-0" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="bottom"
                align="end"
                className="w-56 bg-[#1f1f23] border-[#2f2f35] text-white p-1.5 shadow-xl rounded-xl z-50"
              >
                <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                    <FolderOpen className="w-3 h-3 text-orange-400" />
                    <span>Folder Kerja Terhubung</span>
                  </div>
                  <p className="text-xs font-mono font-medium text-white/90 truncate mt-1" title={folderHandle.name}>
                    {folderHandle.name}
                  </p>
                  {permissionState !== 'granted' && (
                    <p className="text-[10px] text-amber-400 mt-1">Izin akses belum aktif</p>
                  )}
                </div>

                {permissionState !== 'granted' && (
                  <DropdownMenuItem
                    onClick={requestWritePermission}
                    className="text-xs cursor-pointer gap-2 text-amber-300 focus:bg-amber-500/20 px-2 py-1.5 rounded-md flex items-center font-medium"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Berikan Izin Akses...</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={selectFolder}
                  className="text-xs cursor-pointer gap-2 focus:bg-white/10 px-2 py-1.5 rounded-md flex items-center"
                >
                  <FolderSync className="w-3.5 h-3.5 text-sky-400" />
                  <span>Ganti Folder...</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/10 my-1" />

                <DropdownMenuItem
                  onClick={clearFolder}
                  className="text-xs cursor-pointer gap-2 text-red-400 focus:bg-red-500/20 focus:text-red-300 px-2 py-1.5 rounded-md flex items-center"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Putuskan Folder</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {activeProject && viewMode === 'chat' && (
            <button
              type="button"
              onClick={() => setViewMode('project_overview')}
              className="px-2.5 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
              title="Buka Workspace Project"
            >
              <FolderKanban className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Workspace Project</span>
            </button>
          )}


          {/* Studio rembg Toggle Button */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'remove_bg' ? 'chat' : 'remove_bg')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-xs font-medium ${
              viewMode === 'remove_bg'
                ? 'bg-orange-500/25 border-orange-500/50 text-orange-200 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
            }`}
            title="Studio Hapus Background (rembg v3)"
            aria-label="Studio Hapus Background"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Studio rembg</span>
          </button>
        </div>
      </header>

      {/* Quota Warning Banner */}
      {storageWarning && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{storageWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setStorageWarning(null)}
            className="text-amber-300 hover:text-white p-1 cursor-pointer"
            aria-label="Tutup peringatan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
