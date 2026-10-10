import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderKanban, Upload, FileText, Trash2, Sparkles, AlertCircle } from 'lucide-react'
import type { Project, ProjectFile } from '@/types/project'
import { readFileAsAttachment, formatFileSize } from '@/utils/fileReader'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (projectData: {
    name: string
    description?: string
    customInstructions?: string
    files: ProjectFile[]
  }) => void
  initialProject?: Project | null
}

interface ProjectFormProps {
  initialProject?: Project | null
  onSave: (projectData: {
    name: string
    description?: string
    customInstructions?: string
    files: ProjectFile[]
  }) => void
  onCancel: () => void
}

function ProjectForm({ initialProject, onSave, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(() => initialProject?.name || '')
  const [description, setDescription] = useState(() => initialProject?.description || '')
  const [customInstructions, setCustomInstructions] = useState(
    () => initialProject?.customInstructions || ''
  )
  const [files, setFiles] = useState<ProjectFile[]>(() => initialProject?.files || [])
  const [isReadingFiles, setIsReadingFiles] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setIsReadingFiles(true)
    setError(null)

    try {
      const newFiles: ProjectFile[] = []
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
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
      setFiles((prev) => [...prev, ...newFiles])
    } catch {
      setError('Gagal membaca beberapa berkas yang dipilih.')
    } finally {
      setIsReadingFiles(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Nama project harus diisi.')
      return
    }

    onSave({
      name: trimmedName,
      description: description.trim(),
      customInstructions: customInstructions.trim(),
      files,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Project Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/80">
          Nama Project <span className="text-orange-400">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Analisis Finansial, Belajar Python, dll."
          className="glass-well border-white/10 text-white placeholder:text-white/30 text-sm focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/40 outline-none"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/80">
          Deskripsi Singkat (Opsional)
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tujuan atau cakupan dari project ini..."
          className="glass-well border-white/10 text-white placeholder:text-white/30 text-sm focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/40 outline-none"
        />
      </div>

      {/* Custom Instructions (System Prompt) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            Instruksi Khusus (System Prompt)
          </label>
          <span className="text-[11px] text-white/40">Diterapkan ke semua chat di project ini</span>
        </div>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Instruksikan model cara berpikir dan merespons. Contoh: 'Kamu adalah software engineer senior. Berikan jawaban dalam bahasa Indonesia, sertakan penanganan edge case dan type hints TypeScript.'"
          rows={4}
          className="w-full glass-well border border-white/10 rounded-lg p-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/40 outline-none resize-y"
        />
      </div>

      {/* Knowledge Files */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-orange-400" />
            Project Knowledge (Berkas Pengetahuan)
          </label>
          <span className="text-[11px] text-white/40">{files.length} file ditambahkan</span>
        </div>

        <div className="border border-dashed border-white/15 rounded-xl p-4 glass-well text-center hover:border-orange-500/40 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept=".txt,.md,.json,.pdf,.csv,.tsv,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yaml,.yml"
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-xs text-white/70">
              Tarik atau pilih file untuk dijadikan memori konteks project
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingFiles}
              className="mt-1 bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs"
            >
              {isReadingFiles ? 'Membaca berkas...' : 'Pilih Berkas'}
            </Button>
            <p className="text-[10px] text-white/40">
              Mendukung Dokumen Markdown, Teks, PDF, Kode Program, JSON, dan CSV
            </p>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg glass-well border border-white/5 text-xs text-white/80"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
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

      <DialogFooter className="pt-3 border-t border-white/10">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="text-white/60 hover:text-white text-xs"
        >
          Batal
        </Button>
        <Button
          type="submit"
          className="bg-[var(--color-primary)] hover:brightness-110 text-[var(--color-on-primary)] font-medium text-xs shadow-sm"
        >
          {initialProject ? 'Simpan Perubahan' : 'Buat Project'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  initialProject,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl glass-panel text-[#f5f5f7] p-6 max-h-[85vh] overflow-y-auto border-0">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl glass-well flex items-center justify-center text-orange-400 shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                {initialProject ? 'Edit Project' : 'Buat Project Baru'}
              </DialogTitle>
              <DialogDescription className="text-xs text-white/60 mt-0.5">
                Atur konteks, instruksi khusus, dan dokumen pengetahuan bersama.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open && (
          <ProjectForm
            key={initialProject?.id ?? 'create'}
            initialProject={initialProject}
            onSave={(data) => {
              onSave(data)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
