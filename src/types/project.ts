export interface ProjectFile {
  id: string
  name: string
  size: number
  type: string
  textContent?: string
  uploadedAt: number
}

export interface Project {
  id: string
  name: string
  description?: string
  customInstructions?: string
  files: ProjectFile[]
  createdAt: number
  updatedAt: number
  color?: string
}
