import { Clock, FileText, Image, Paperclip, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { NoteItem } from '../../../data/models/types'
import { countCharactersInMarkdown, countCharactersNoSpacesInMarkdown, countWordsInMarkdown } from '../model/noteStats'

type InfoTab = 'stats' | 'toc' | 'backlinks'

type Props = {
  open: boolean
  note: NoteItem | null
  onClose: () => void
  onNavigateToHeading: (headingId: string, headingText: string) => void
  onNavigateToNote: (id: string) => void
}

export default function InfoPopover({ open, note, onClose, onNavigateToHeading, onNavigateToNote }: Props) {
  const [tab, setTab] = useState<InfoTab>('stats')
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

  if (!rendered || !note) return null

  const words = countWordsInMarkdown(note.contentMd)
  const paragraphs = note.contentMd.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const imageCount = (note.contentMd.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length
  const fileCount = (note.contentMd.match(/\battachment:\b/gi) ?? []).length
  const characterCount = countCharactersInMarkdown(note.contentMd)
  const charsNoSpaces = countCharactersNoSpacesInMarkdown(note.contentMd)

  return (
    <div data-note-floating-panel="info" data-state={visible ? 'open' : 'closed'} className="note-page__panel">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h3 className="text-[13px] font-semibold">Info</h3>
        <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-accent">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-0.5 border-b border-border px-4">
        {([
          { id: 'stats', label: 'Statistics' },
          { id: 'toc', label: 'Contents' },
          { id: 'backlinks', label: 'Backlinks' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'border-b-2 px-2.5 py-2 text-[11px] font-medium transition-colors',
              tab === item.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="max-h-[300px] overflow-y-auto px-4 py-3">
        {tab === 'stats' ? (
          <div className="space-y-2">
            <StatRow label="Words" value={words.toLocaleString()} />
            <StatRow label="Characters" value={characterCount.toLocaleString()} />
            <StatRow label="Chars (no spaces)" value={charsNoSpaces.toLocaleString()} />
            <StatRow label="Paragraphs" value={paragraphs.length.toString()} />
            <StatRow label="Read time" value={`${Math.max(1, Math.ceil(words / 200))} min`} />
            <div className="my-2 border-t border-border" />
            <StatRow label="Images" value={imageCount.toString()} icon={Image} />
            <StatRow label="Files" value={fileCount.toString()} icon={Paperclip} />
            <div className="my-2 border-t border-border" />
            <StatRow label="Modified" value={new Date(note.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} icon={Clock} />
            <StatRow label="Created" value={new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </div>
        ) : null}

        {tab === 'toc' ? (
          note.headings.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No headings found</p>
          ) : (
            <div className="space-y-0.5">
              {note.headings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  onClick={() => onNavigateToHeading(heading.id, heading.text)}
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-accent"
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px`, fontWeight: heading.level === 1 ? 500 : 400 }}
                >
                  {heading.text}
                </button>
              ))}
            </div>
          )
        ) : null}

        {tab === 'backlinks' ? (
          note.backlinks.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No backlinks yet</p>
          ) : (
            <div className="space-y-0.5">
              {note.backlinks.map((backlink) => (
                <button
                  key={backlink.noteId}
                  type="button"
                  onClick={() => onNavigateToNote(backlink.noteId)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] transition-colors hover:bg-accent"
                >
                  <FileText size={13} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{backlink.noteTitle}</span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

function StatRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {Icon ? <Icon size={12} /> : null}
        {label}
      </span>
      <span className="text-[12px] text-foreground">{value}</span>
    </div>
  )
}
