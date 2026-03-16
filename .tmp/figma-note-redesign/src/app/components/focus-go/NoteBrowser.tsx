import { useState } from "react";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  ChevronDown,
} from "lucide-react";
import type { Note, SortOption } from "./types";

interface NoteBrowserProps {
  notes: Note[];
  selectedNoteId: string | null;
  collectionLabel: string;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onTogglePin: (id: string) => void;
  onTrashNote: (id: string) => void;
}

function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NoteBrowser({
  notes,
  selectedNoteId,
  collectionLabel,
  onSelectNote,
  onNewNote,
  onTogglePin,
  onTrashNote,
}: NoteBrowserProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("edited");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortLabels: Record<SortOption, string> = {
    edited: "Edited",
    created: "Created",
    title: "Title",
  };

  const filtered = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.preview.toLowerCase().includes(search.toLowerCase()) ||
        n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "edited") return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sortBy === "created") return b.createdAt.getTime() - a.createdAt.getTime();
      return a.title.localeCompare(b.title);
    });

  const pinnedNotes = filtered.filter((n) => n.pinned);
  const unpinnedNotes = filtered.filter((n) => !n.pinned);

  return (
    <div className="w-[300px] min-w-[300px] h-full flex flex-col border-r border-border bg-background">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground"
            style={{ fontSize: "12px", fontWeight: 500 }}
          >
            {collectionLabel}
          </span>
          <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
            {notes.length}
          </span>
        </div>
        <button
          onClick={onNewNote}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          title="New note"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Filter row */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent transition-colors text-muted-foreground"
            style={{ fontSize: "12px" }}
          >
            {sortLabels[sortBy]}
            <ChevronDown size={12} />
          </button>
          {showSortMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-lg border bg-popover p-1 shadow-lg">
              {(["edited", "created", "title"] as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md hover:bg-accent ${sortBy === opt ? "bg-accent" : ""}`}
                  style={{ fontSize: "12px" }}
                >
                  {sortLabels[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-7 pr-2 py-1 rounded-md bg-accent/50 border-0 outline-none placeholder:text-muted-foreground/60"
            style={{ fontSize: "12px" }}
          />
        </div>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {pinnedNotes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-muted-foreground uppercase tracking-widest" style={{ fontSize: "10px", fontWeight: 600 }}>
              Pinned
            </div>
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onSelect={() => onSelectNote(note.id)}
                onTogglePin={() => onTogglePin(note.id)}
                onTrash={() => onTrashNote(note.id)}
              />
            ))}
          </>
        )}
        {unpinnedNotes.length > 0 && pinnedNotes.length > 0 && (
          <div className="px-2 py-1.5 mt-2 text-muted-foreground uppercase tracking-widest" style={{ fontSize: "10px", fontWeight: 600 }}>
            Recent
          </div>
        )}
        {unpinnedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isSelected={selectedNoteId === note.id}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12" style={{ fontSize: "13px" }}>
            No notes found
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  isSelected,
  onSelect,
  onTogglePin,
  onTrash,
}: {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onTrash: () => void;
}) {
  const displayTags = note.tags.slice(0, 2);
  const overflowCount = note.tags.length - 2;

  return (
    <div
      onClick={onSelect}
      className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-0.5 ${
        isSelected
          ? "bg-accent shadow-[0_0_0_1px_var(--border)]"
          : "hover:bg-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 truncate text-foreground" style={{ fontSize: "13px", fontWeight: 500, lineHeight: "1.4" }}>
          {note.pinned && <Pin size={10} className="inline mr-1 text-muted-foreground" />}
          {note.title}
        </h4>
        <span className="text-muted-foreground shrink-0 mt-0.5" style={{ fontSize: "10px" }}>
          {formatTime(note.updatedAt)}
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5 line-clamp-2" style={{ fontSize: "12px", lineHeight: "1.5" }}>
        {note.preview}
      </p>
      {note.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          {displayTags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground"
              style={{ fontSize: "10px" }}
            >
              {tag}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-muted-foreground" style={{ fontSize: "10px" }}>
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
          title={note.pinned ? "Unpin" : "Pin"}
        >
          {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onTrash(); }}
          className="p-1 rounded hover:bg-destructive/10 text-destructive"
          title="Move to trash"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
