import { Code, FileDown, FileText, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  noteTitle: string
  onClose: () => void
  onExportMarkdown: () => void
}

export default function ExportModal({ open, noteTitle, onClose, onExportMarkdown }: Props) {
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setRendered(true)
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setRendered(false), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!rendered) return null

  const formats = [
    { id: 'markdown', label: 'Markdown', ext: '.md', desc: 'Plain text with formatting', action: onExportMarkdown, icon: FileText, disabled: false },
    { id: 'html', label: 'HTML', ext: '.html', desc: 'Web-ready document', action: onClose, icon: Code, disabled: true },
    { id: 'pdf', label: 'PDF', ext: '.pdf', desc: 'Print-ready format', action: onClose, icon: FileDown, disabled: true },
  ] as const

  return (
    <div data-note-floating-panel="export" data-state={visible ? 'open' : 'closed'} className="note-page__panel">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div>
          <h2 className="text-[16px] font-semibold">Export</h2>
          <p className="mt-0.5 max-w-[200px] truncate text-[12px] text-muted-foreground">{noteTitle}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-1.5 px-3 pb-4">
        {formats.map((format) => (
          <button
            key={format.id}
            type="button"
            disabled={format.disabled}
            onClick={() => {
              format.action()
              if (!format.disabled) onClose()
            }}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent transition-colors group-hover:bg-background">
              <format.icon size={16} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-foreground">{format.label}</div>
              <div className="text-[11px] text-muted-foreground">{format.disabled ? `${format.desc} · Soon` : format.desc}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">{format.ext}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
