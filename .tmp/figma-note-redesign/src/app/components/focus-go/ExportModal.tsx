import { X, FileText, Code, FileDown } from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  noteTitle: string;
}

export function ExportModal({ open, onClose, noteTitle }: ExportModalProps) {
  if (!open) return null;

  const formats = [
    { id: "markdown", label: "Markdown", ext: ".md", icon: FileText, desc: "Plain text with formatting" },
    { id: "html", label: "HTML", ext: ".html", icon: Code, desc: "Web-ready document" },
    { id: "pdf", label: "PDF", ext: ".pdf", icon: FileDown, desc: "Print-ready format" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs bg-popover rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Export</h2>
            <p className="text-muted-foreground mt-0.5 truncate max-w-[200px]" style={{ fontSize: "12px" }}>
              {noteTitle}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-5 space-y-1.5">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center group-hover:bg-background transition-colors">
                <fmt.icon size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                  {fmt.label}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "11px" }}>
                  {fmt.desc}
                </div>
              </div>
              <span className="text-muted-foreground" style={{ fontSize: "11px" }}>
                {fmt.ext}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
