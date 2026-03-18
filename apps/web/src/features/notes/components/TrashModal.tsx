import { RotateCcw, Trash2, X } from 'lucide-react'
import type { NoteItem } from '../../../data/models/types'

type Props = {
  open: boolean
  trashedNotes: NoteItem[]
  onClose: () => void
  onRestore: (id: string) => void
  onDeletePermanently: (id: string) => void
}

const formatTrashDate = (value?: number | null) => {
  if (!value) return ''
  const diff = Math.floor((Date.now() - value) / 86400000)
  if (diff < 1) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

export default function TrashModal({ open, trashedNotes, onClose, onRestore, onDeletePermanently }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#3a3733]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <div>
            <h2 className="text-[16px] font-semibold">Recently Deleted</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Items are automatically removed after 7 days</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto px-4 pb-4">
          {trashedNotes.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              <Trash2 size={32} className="mx-auto mb-2 opacity-30" />
              Trash is empty
            </div>
          ) : (
            <div className="space-y-1">
              {trashedNotes.map((note) => (
                <div key={note.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">{note.title.trim() || 'Untitled'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Deleted {formatTrashDate(note.deletedAt)}
                      {note.tags[0] ? ` · ${note.tags[0]}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onRestore(note.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <RotateCcw size={12} />
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(`Delete "${note.title.trim() || 'Untitled'}" permanently?`)
                        if (confirmed) onDeletePermanently(note.id)
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
