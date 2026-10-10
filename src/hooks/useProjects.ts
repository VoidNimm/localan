import { useState, useEffect } from 'react'
import type { Project, ProjectFile } from '../types/project'

export const STORAGE_KEY_PROJECTS = 'local_chat_projects_v1'

export function useProjects(options?: {
  onSelectProject?: (projectId: string) => void
  onDeleteProject?: (projectId: string) => void
}) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const activeProject = activeProjectId
    ? projects.find((p) => p.id === activeProjectId) || null
    : null

  // Persist projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects))
    } catch {
      // quota or local storage disabled
    }
  }, [projects])

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId)
    options?.onSelectProject?.(projectId)
  }

  const handleSaveProject = (data: {
    name: string
    description?: string
    customInstructions?: string
    files: ProjectFile[]
  }) => {
    if (editingProject) {
      // Edit existing
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                ...data,
                updatedAt: Date.now(),
              }
            : p
        )
      )
      setEditingProject(null)
    } else {
      // Create new
      const newProj: Project = {
        id: 'proj_' + Date.now(),
        name: data.name,
        description: data.description,
        customInstructions: data.customInstructions,
        files: data.files,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setProjects((prev) => [newProj, ...prev])
      setActiveProjectId(newProj.id)
    }
  }

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    if (activeProjectId === projectId) {
      setActiveProjectId(null)
    }
    options?.onDeleteProject?.(projectId)
  }

  const handleUpdateProjectFiles = (projectId: string, files: ProjectFile[]) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, files, updatedAt: Date.now() } : p))
    )
  }

  return {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    editingProject,
    setEditingProject,
    handleSelectProject,
    handleSaveProject,
    handleDeleteProject,
    handleUpdateProjectFiles,
  }
}
