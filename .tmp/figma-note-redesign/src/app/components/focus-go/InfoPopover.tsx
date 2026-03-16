import { useState } from "react";
import { X, FileText, Clock, Type, Image, Paperclip } from "lucide-react";
import type { Note } from "./types";

interface InfoPopoverProps {
  open: boolean;
  onClose: () => void;
  note: Note;
  onNavigateToNote: (noteId: string) => void;
}

type InfoTab = "stats" | "toc" | "backlinks";

export function InfoPopover({
  open,
  onClose,
  note,
  onNavigateToNote,
}: InfoPopoverProps) {
  const [tab, setTab] = useState<InfoTab>("stats");

  if (!open) return null;

  const readTime = Math.max(1, Math.ceil(note.wordCount / 200));
  const charsNoSpaces = Math.floor(note.charCount * 0.82);

  return (
    <div className="absolute right-4 top-12 z-40 w-72 bg-popover rounded-xl shadow-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 style={{ fontSize: "13px", fontWeight: 600 }}>Info</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-0.5 border-b border-border">
        {([
          { id: "stats", label: "Statistics" },
          { id: "toc", label: "Contents" },
          { id: "backlinks", label: "Backlinks" },
        ] as { id: InfoTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-2 border-b-2 transition-colors ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontSize: "11px", fontWeight: 500 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-3 max-h-[300px] overflow-y-auto">
        {tab === "stats" && (
          <div className="space-y-2">
            <StatRow label="Words" value={note.wordCount.toLocaleString()} />
            <StatRow label="Characters" value={note.charCount.toLocaleString()} />
            <StatRow label="Chars (no spaces)" value={charsNoSpaces.toLocaleString()} />
            <StatRow label="Paragraphs" value={note.paragraphCount.toString()} />
            <StatRow label="Read time" value={`${readTime} min`} />
            <div className="border-t border-border my-2" />
            <StatRow label="Images" value={note.imageCount.toString()} icon={Image} />
            <StatRow label="Files" value={note.fileCount.toString()} icon={Paperclip} />
            <div className="border-t border-border my-2" />
            <StatRow
              label="Modified"
              value={note.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              icon={Clock}
            />
            <StatRow
              label="Created"
              value={note.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          </div>
        )}

        {tab === "toc" && (
          <div className="space-y-0.5">
            {note.headings.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center" style={{ fontSize: "12px" }}>
                No headings found
              </p>
            ) : (
              note.headings.map((h) => (
                <button
                  key={h.id}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors truncate"
                  style={{
                    fontSize: "12px",
                    paddingLeft: `${8 + (h.level - 1) * 12}px`,
                    fontWeight: h.level === 1 ? 500 : 400,
                    color: h.level === 1 ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {h.text}
                </button>
              ))
            )}
          </div>
        )}

        {tab === "backlinks" && (
          <div className="space-y-0.5">
            {note.backlinks.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center" style={{ fontSize: "12px" }}>
                No backlinks yet
              </p>
            ) : (
              note.backlinks.map((bl) => (
                <button
                  key={bl.noteId}
                  onClick={() => onNavigateToNote(bl.noteId)}
                  className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-md hover:bg-accent transition-colors"
                  style={{ fontSize: "12px" }}
                >
                  <FileText size={13} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{bl.noteTitle}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1.5" style={{ fontSize: "12px" }}>
        {Icon && <Icon size={12} />}
        {label}
      </span>
      <span className="text-foreground" style={{ fontSize: "12px" }}>
        {value}
      </span>
    </div>
  );
}
