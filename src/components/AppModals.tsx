import { CreateProjectDialog } from './CreateProjectDialog'
import { ProfileDialog } from './ProfileDialog'
import { DeleteChatDialog } from './DeleteChatDialog'
import { RemoveBgModal, type RemoveBgSourceImage } from './RemoveBgModal'
import type { Project } from '../types/project'
import type { ChatProfile } from '../types/profile'
import type { OllamaModelInfo, FileAttachment } from '../services/ollama'
import type { StoredSession } from '../services/chatStorage'
import type { DirectoryReference } from '../adapters/storage'

export interface AppModalsProps {
  isCreateProjectOpen: boolean
  setIsCreateProjectOpen: (open: boolean) => void
  handleSaveProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void
  editingProject: Project | null

  isProfileDialogOpen: boolean
  setIsProfileDialogOpen: (open: boolean) => void
  models: OllamaModelInfo[]
  editingProfile: ChatProfile | null
  onSaveProfile: (data: Omit<ChatProfile, 'id'>, id?: string) => void

  sessionToDelete: StoredSession | null
  setSessionToDelete: (session: StoredSession | null) => void
  handleConfirmDeleteSession: () => void

  isRemoveBgOpen: boolean
  setIsRemoveBgOpen: (open: boolean) => void
  removeBgSource: RemoveBgSourceImage | null
  folderHandle: DirectoryReference | null
  onApplyRemoveBgCallback?: ((attachment: FileAttachment) => void) | null
}

export function AppModals({
  isCreateProjectOpen,
  setIsCreateProjectOpen,
  handleSaveProject,
  editingProject,
  isProfileDialogOpen,
  setIsProfileDialogOpen,
  models,
  editingProfile,
  onSaveProfile,
  sessionToDelete,
  setSessionToDelete,
  handleConfirmDeleteSession,
  isRemoveBgOpen,
  setIsRemoveBgOpen,
  removeBgSource,
  folderHandle,
  onApplyRemoveBgCallback,
}: AppModalsProps) {
  return (
    <>
      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onSave={handleSaveProject}
        initialProject={editingProject}
      />
      <ProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        models={models}
        editingProfile={editingProfile}
        onSave={onSaveProfile}
      />
      <DeleteChatDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null)
        }}
        chatTitle={sessionToDelete?.title}
        onConfirm={handleConfirmDeleteSession}
      />
      <RemoveBgModal
        open={isRemoveBgOpen}
        onOpenChange={setIsRemoveBgOpen}
        sourceImage={removeBgSource}
        workingFolderHandle={folderHandle}
        onApplyToChat={onApplyRemoveBgCallback || undefined}
      />
    </>
  )
}
