import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, AlertTriangle } from 'lucide-react'

interface DeleteChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatTitle?: string
  onConfirm: () => void
}

export const DeleteChatDialog: React.FC<DeleteChatDialogProps> = ({
  open,
  onOpenChange,
  chatTitle,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-panel text-[#f5f5f7] p-6 border border-white/10 rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold text-white tracking-wide">
                Hapus Percakapan?
              </DialogTitle>
              <DialogDescription className="text-xs text-white/60 leading-relaxed">
                Percakapan ini akan dihapus secara permanen dari penyimpanan lokal perangkat Anda.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Judul chat target */}
          <div className="glass-well p-3 rounded-xl border border-white/5 flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            <span className="text-xs font-medium text-white/90 truncate flex-1">
              {chatTitle || 'Percakapan Tanpa Judul'}
            </span>
          </div>

          {/* Kotak peringatan bahwa data tidak bisa dikembalikan */}
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-300/90 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-200">Tidak dapat dikembalikan</p>
              <p className="text-[11px] text-red-300/80 mt-0.5">
                Riwayat pesan yang tersimpan di browser Anda akan langsung dihapus sepenuhnya dan tidak dapat dipulihkan lagi.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 flex sm:justify-end gap-2 bg-transparent border-0 -mx-0 -mb-0 p-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white text-xs h-9 px-4 rounded-full"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-medium h-9 px-4 rounded-full flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Permanen</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
