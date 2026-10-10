import React, { useRef, useState, useEffect } from 'react'
import {
  FolderKanban,
  Sparkles,
  FileText,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Clock,
  ArrowRight,
  FolderOpen,
  Pin
} from 'lucide-react'
import type { Project, ProjectFile } from '@/types/project'
import type { ChatSession } from './Sidebar'
import { formatFileSize, readFileAsAttachment } from '@/utils/fileReader'
import { Button } from '@/components/ui/button'
import { useFolder } from '@/hooks/useFolder'
import { FolderManager } from '@/services/folderTools'
import { fileStorage, type DirectoryReference } from '@/adapters/storage'

function FolderKerjaCard({
  projectId,
  folderHandle: propHandle,
  onSelectFolder,
  onClearFolder,
  permissionState: propPermState,
  onRequestPermission,
}: {
  projectId: string
  folderHandle?: DirectoryReference | null
  onSelectFolder?: () => void
  onClearFolder?: () => void
  permissionState?: 'granted' | 'prompt' | 'denied' | 'unknown'
  onRequestPermission?: () => Promise<boolean>
}) {
  const hookFolder = useFolder(projectId);
  const handle = propHandle !== undefined ? propHandle : hookFolder.handle;
  const selectFolder = onSelectFolder || hookFolder.selectFolder;
  const clearFolder = onClearFolder || hookFolder.clearFolder;
  const requestWritePermission = onRequestPermission || hookFolder.requestWritePermission;

  const [internalPermission, setInternalPermission] = useState(false);
  const [mode, setMode] = useState<'readonly' | 'ask'>(() => {
    const saved = localStorage.getItem(`folderMode_${projectId}`);
    return (saved === 'readonly' || saved === 'ask') ? saved : 'ask';
  });

  useEffect(() => {
    if (!handle) return;
    let isCancelled = false;
    const manager = new FolderManager(handle);
    manager.verifyPermission('read').then((granted) => {
      if (!isCancelled) setInternalPermission(granted);
    });
    return () => {
      isCancelled = true;
    };
  }, [handle]);

  const hasPermission = Boolean(handle && (propPermState === 'granted' || internalPermission));

  const toggleMode = () => {
    const newMode = mode === 'ask' ? 'readonly' : 'ask';
    setMode(newMode);
    localStorage.setItem(`folderMode_${projectId}`, newMode);
  };

  const handleGrantPermission = async () => {
    if (requestWritePermission) {
      const granted = await requestWritePermission();
      if (granted) setInternalPermission(true);
    } else if (handle) {
      const manager = new FolderManager(handle);
      if (await manager.verifyPermission('readwrite')) {
        setInternalPermission(true);
      }
    }
  };

  if (!fileStorage.isSupported()) {
    return (
      <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between opacity-50">
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <FolderOpen className="w-4 h-4 text-white/70" />
            <h2 className="text-sm font-semibold text-white">Folder Kerja</h2>
          </div>
          <div className="mt-3 text-xs text-white/40">
            Fitur ini tidak didukung di browser Anda. Gunakan browser berbasis Chromium (Chrome, Edge).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-white/70" />
            <h2 className="text-sm font-semibold text-white">Folder Kerja</h2>
          </div>
          {handle ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFolder}
              className="text-[10px] h-6 px-2 text-white/50 hover:text-red-400 glass-pill"
            >
              Putuskan
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectFolder}
              className="text-xs text-white/80 hover:text-white h-7 px-2 glass-pill"
            >
              Hubungkan
            </Button>
          )}
        </div>

        <div className="mt-3">
          {!handle ? (
            <div className="py-6 text-center text-xs text-white/40">
              Pilih folder lokal agar AI dapat membaca file.
            </div>
          ) : !hasPermission ? (
            <div className="py-4 text-center">
              <p className="text-xs text-orange-300/80 mb-3">Izin folder diperlukan.</p>
              <Button onClick={handleGrantPermission} size="sm" className="bg-orange-600 hover:bg-orange-500 text-white text-xs">
                Berikan Izin
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="glass-well p-3 rounded-xl flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-white/80 truncate font-medium">{handle.name}</p>
                </div>
                <Button size="sm" variant="outline" onClick={selectFolder} className="h-6 px-2 text-[10px] glass-pill text-white/60">Ganti</Button>
              </div>
              <div className="flex items-center justify-between glass-well p-2 rounded-xl">
                <span className="text-xs text-white/60 ml-2">Mode: {mode === 'ask' ? 'Tanya tiap edit' : 'Hanya baca'}</span>
                <Button size="sm" variant="ghost" onClick={toggleMode} className="h-6 px-2 text-[10px] text-orange-400 hover:text-orange-300">
                  Ubah
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProjectViewProps {
  project: Project
  sessions: ChatSession[]
  onStartNewChat: () => void
  onSelectSession: (sessionId: string) => void
  onEditProject: () => void
  onDeleteProject: () => void
  onDeleteSession?: (sessionId: string, e?: React.MouseEvent) => void
  onUpdateFiles: (files: ProjectFile[]) => void
  folderHandle?: DirectoryReference | null
  onSelectFolder?: () => void
  onClearFolder?: () => void
  permissionState?: 'granted' | 'prompt' | 'denied' | 'unknown'
  onRequestPermission?: () => Promise<boolean>
}

export const ProjectView: React.FC<ProjectViewProps> = ({
  project,
  sessions,
  onStartNewChat,
  onSelectSession,
  onEditProject,
  onDeleteProject,
  onDeleteSession,
  onUpdateFiles,
  folderHandle,
  onSelectFolder,
  onClearFolder,
  permissionState,
  onRequestPermission,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectSessions = React.useMemo(() => {
    return [...sessions]
      .filter((s) => s.projectId === project.id)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return b.timestamp - a.timestamp
      })
  }, [sessions, project.id])

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected || selected.length === 0) return

    try {
      const newFiles: ProjectFile[] = []
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i]
        const att = await readFileAsAttachment(file)
        newFiles.push({
          id: 'pfile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: att.name,
          size: att.size,
          type: att.type,
          textContent: att.textContent || (att.base64 ? `[Citra Gambar: ${att.name}]` : undefined),
          uploadedAt: Date.now(),
        })
      }
      onUpdateFiles([...project.files, ...newFiles])
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveFile = (fileId: string) => {
    onUpdateFiles(project.files.filter((f) => f.id !== fileId))
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 overflow-y-auto space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl glass-well flex items-center justify-center text-white/70 shrink-0">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-white/70">
                Project Workspace
              </span>
              <span className="text-xs text-white/30">•</span>
              <span className="text-xs text-white/40">
                Dibuat {new Date(project.createdAt).toLocaleDateString('id-ID')}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight mt-1">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-white/60 mt-1 max-w-2xl leading-relaxed">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onEditProject}
            title="Edit Pengaturan Project"
            className="glass-pill text-white/80 hover:text-white"
          >
            <Edit2 className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              if (window.confirm(`Hapus project "${project.name}" beserta chat di dalamnya?`)) {
                onDeleteProject()
              }
            }}
            title="Hapus Project"
            className="glass-pill hover:bg-red-500/20 hover:border-red-500/30 text-white/60 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid: Custom Instructions, Project Knowledge, & Folder Kerja */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Custom Instructions */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white/70" />
                <h2 className="text-sm font-semibold text-white">Custom Instructions</h2>
              </div>
              <button
                type="button"
                onClick={onEditProject}
                className="text-xs text-white/50 hover:text-white font-medium transition-colors"
              >
                Ubah
              </button>
            </div>

            <div className="mt-3">
              {project.customInstructions ? (
                <div className="text-xs text-white/80 glass-well p-3 rounded-xl whitespace-pre-wrap font-sans max-h-48 overflow-y-auto leading-relaxed">
                  {project.customInstructions}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-white/40">
                  Belum ada instruksi khusus. Klik Ubah untuk memberi aturan respon bagi model di project ini.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Project Knowledge */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-white/70" />
                <h2 className="text-sm font-semibold text-white">Project Knowledge</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] glass-well text-white/70">
                  {project.files.length}
                </span>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAddFiles}
                  accept=".txt,.md,.json,.pdf,.csv,.tsv,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yaml,.yml"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="glass-pill text-xs text-white/80 hover:text-white font-medium h-7 px-2"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Tambah Berkas
                </Button>
              </div>
            </div>

            <div className="mt-3">
              {project.files.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/40">
                  Belum ada berkas pengetahuan. Unggah file dokumen atau kode untuk dibaca oleh model AI saat berdiskusi.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {project.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl glass-well text-xs text-white/80"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-[10px] text-white/40 shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 text-white/30 hover:text-red-400 transition-colors"
                        title="Hapus file dari project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Folder Kerja */}
        <FolderKerjaCard
          projectId={project.id}
          folderHandle={folderHandle}
          onSelectFolder={onSelectFolder}
          onClearFolder={onClearFolder}
          permissionState={permissionState}
          onRequestPermission={onRequestPermission}
        />
      </div>

      {/* Project Chats Section */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white/70" />
            <h2 className="text-sm font-semibold text-white">Percakapan dalam Project ini</h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] glass-well text-white/70">
              {projectSessions.length}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartNewChat}
            className="glass-pill text-xs text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Mulai Percakapan Baru
          </Button>
        </div>

        {projectSessions.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full glass-well flex items-center justify-center text-white/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs text-white/50 max-w-sm">
              Belum ada percakapan di dalam project ini. Klik tombol di bawah untuk memulai sesi tanya-jawab dengan konteks project.
            </p>
            <Button
              type="button"
              onClick={onStartNewChat}
              className="mt-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium"
            >
              Mulai Chat Sekarang
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projectSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="group p-4 rounded-xl glass-well hover:border-white/20 cursor-pointer transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(session.timestamp).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {session.isPinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
                          <Pin className="w-2.5 h-2.5 rotate-45" />
                          Disematkan
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/50 font-mono">
                        {session.model}
                      </span>
                      {onDeleteSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(session.id, e)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 hover:bg-red-500/15 rounded-md transition-all cursor-pointer"
                          title="Hapus Chat"
                          aria-label="Hapus Chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                    {session.title || 'Percakapan Tanpa Judul'}
                  </h3>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-end text-xs text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1 font-medium text-[11px]">
                    Lanjutkan obrolan <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
