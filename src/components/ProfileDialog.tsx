import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import type { OllamaModelInfo } from '../services/ollama'
import type { ChatProfile } from '../types/profile'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: OllamaModelInfo[]
  onSave: (profile: Omit<ChatProfile, 'id'>, id?: string) => void
  editingProfile?: ChatProfile | null
}

export function ProfileDialog({
  open,
  onOpenChange,
  models,
  onSave,
  editingProfile,
}: ProfileDialogProps) {
  const [name, setName] = useState('')
  const [baseModel, setBaseModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  useEffect(() => {
    if (open) {
      if (editingProfile) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName(editingProfile.name)
         
        setBaseModel(editingProfile.baseModel)
         
        setSystemPrompt(editingProfile.systemPrompt)
      } else {
         
        setName('')
         
        setBaseModel(models.length > 0 ? models[0].name : '')
         
        setSystemPrompt('')
      }
    }
  }, [open, editingProfile, models])

  const handleSave = () => {
    if (!name.trim() || !baseModel) return
    onSave({ name: name.trim(), baseModel, systemPrompt: systemPrompt.trim() }, editingProfile?.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-stone-900 border-stone-800 text-stone-100">
        <DialogHeader>
          <DialogTitle className="text-stone-100">
            {editingProfile ? 'Edit Profile' : 'Create Profile'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium text-stone-300">
              Name
            </label>
            <Input
              id="name"
              placeholder="e.g. Guru Sejarah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-stone-950 border-stone-800 text-stone-100 placeholder:text-stone-600"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="baseModel" className="text-sm font-medium text-stone-300">
              Base Model
            </label>
            <select
              id="baseModel"
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-1 text-sm text-stone-100 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="systemPrompt" className="text-sm font-medium text-stone-300">
              System Prompt (Instructions)
            </label>
            <textarea
              id="systemPrompt"
              placeholder="e.g. Kamu adalah guru sejarah Indonesia yang galak tapi pintar..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="flex min-h-[120px] w-full rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-100 shadow-sm placeholder:text-stone-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-stone-800 text-stone-300 hover:text-stone-100">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !baseModel} className="bg-orange-600 text-white hover:bg-orange-700">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
