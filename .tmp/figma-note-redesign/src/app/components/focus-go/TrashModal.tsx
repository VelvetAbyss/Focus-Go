import { useState } from "react";
import { X, RotateCcw, Trash2 } from "lucide-react";
import type { Note } from "./types";

interface TrashModalProps {
  open: boolean;
  onClose: () => void;
  trashedNotes: Note[];
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string) => void;
}

function formatTrashDate(date?: Date) {
  if (!date) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff < 1) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

export function TrashModal({
  open,
  onClose,
  trashedNotes,
  onRestore,
  onDeletePermanently,
}: TrashModalProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-popover rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Recently Deleted</h2>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: "12px" }}>
              Items are automatically removed after 7 days
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
          {trashedNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" style={{ fontSize: "13px" }}>
              <Trash2 size={32} className="mx-auto mb-2 opacity-30" />
              Trash is empty
            </div>
          ) : (
            <div className="space-y-1">
              {trashedNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                      {note.title}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: "11px" }}>
                      Deleted {formatTrashDate(note.trashedAt)}
                      {note.tags.length > 0 && ` \u00b7 ${note.tags[0]}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRestore(note.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: "11px" }}
                    >
                      <RotateCcw size={12} />
                      Restore
                    </button>
                    {confirmDeleteId === note.id ? (
                      <button
                        onClick={() => { onDeletePermanently(note.id); setConfirmDeleteId(null); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground transition-colors"
                        style={{ fontSize: "11px" }}
                      >
                        <Trash2 size={12} />
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(note.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        style={{ fontSize: "11px" }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
