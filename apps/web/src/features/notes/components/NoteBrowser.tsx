import { useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronDown, Pin, PinOff, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { NoteItem } from '../../../data/models/types'

export type NoteSortOption = 'edited' | 'created' | 'title'
export type NoteBrowserMode = 'notes' | 'trash'

const stripMarkdown = (text: string): string =>
  text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/~~(.+?)~~/gs, '$1')
    .replace(/`(.+?)`/gs, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

type Props = {
  notes: NoteItem[]
  selectedNoteId: string | null
  collectionLabel: string
  mode?: NoteBrowserMode
  onSelectNote: (id: string) => void
  onNewNote: () => void
  onTogglePin: (id: string) => void
  onTrashNote: (id: string) => void
  onRestoreNote?: (id: string) => void
  onDeleteNote?: (id: string) => void
  sortBy: NoteSortOption
  onSortChange: (value: NoteSortOption) => void
  search: string
  onSearchChange: (value: string) => void
  className?: string
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

const formatTime = (time: number) => {
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NoteBrowser({
  notes,
  selectedNoteId,
  collectionLabel,
  mode = 'notes',
  onSelectNote,
  onNewNote,
  onTogglePin,
  onTrashNote,
  onRestoreNote,
  onDeleteNote,
  sortBy,
  onSortChange,
  search,
  onSearchChange,
  className,
  scrollContainerRef,
}: Props) {
  const { language, t } = useI18n()
  const sortLabels: Record<NoteSortOption, string> = {
    edited: t('modules.note.sort.edited'),
    created: t('tasks.sort.created'),
    title: language === 'zh' ? '标题' : 'Title',
  }
  const [showSortMenu, setShowSortMenu] = useState(false)
  const filtered = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.title.toLowerCase().includes(search.toLowerCase()) ||
          note.excerpt.toLowerCase().includes(search.toLowerCase()) ||
          note.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())),
      ),
    [notes, search],
  )
  const pinnedNotes = filtered.filter((note) => note.pinned)
  const otherNotes = filtered.filter((note) => !note.pinned)

  return (
    <section
      className={cn(
        'flex h-full min-h-0 w-[300px] min-w-[300px] flex-col overflow-hidden border-r border-[#e5e2dd] bg-[#f5f3f0] dark:border-[#f5f3f0]/15 dark:bg-[#3a3733]',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-md bg-[#f0eeeb] px-2.5 py-1 text-[0.75rem] font-medium text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100">{collectionLabel}</span>
          <span className="text-[0.75rem] tabular-nums text-[#8d867f] dark:text-slate-400">{notes.length}</span>
        </div>
        <button
          type="button"
          onClick={onNewNote}
          className="rounded-lg p-1.5 text-[#3a3733] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#ede9e2] hover:shadow-[0_8px_18px_rgba(58,55,51,0.08)] active:translate-y-0 dark:text-[#f5f3f0] dark:hover:bg-[#f5f3f0]/10"
          title={t('modules.note.new')}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu((current) => !current)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.75rem] text-[#66615b] transition-colors hover:bg-[#ede9e2] dark:text-[#f5f3f0]/80 dark:hover:bg-[#f5f3f0]/10"
          >
            {sortLabels[sortBy]}
            <ChevronDown size={12} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-[#e5e2dd] bg-[#f5f3f0] p-1 shadow-[0_18px_42px_rgba(58,55,51,0.14)] dark:border-[#f5f3f0]/15 dark:bg-[#3a3733]">
              {(['edited', 'created', 'title'] as NoteSortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSortChange(option)
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-[0.75rem] text-[#3a3733] hover:bg-[#ede9e2] dark:text-[#f5f3f0] dark:hover:bg-[#f5f3f0]/10',
                    sortBy === option && 'bg-[#ede9e2] dark:bg-[#f5f3f0]/15',
                  )}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8d867f] dark:text-[#f5f3f0]/55" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="w-full rounded-md border-0 bg-[#ede9e2]/80 py-1 pl-7 pr-2 text-[0.75rem] text-[#3a3733] outline-none transition-[background-color,box-shadow] placeholder:text-[#8d867f]/70 focus:bg-[#f8f6f2] focus:shadow-[0_0_0_1px_rgba(58,55,51,0.08)] dark:bg-[#f5f3f0]/10 dark:text-[#f5f3f0] dark:placeholder:text-[#f5f3f0]/45 dark:focus:bg-[#f5f3f0]/15"
          />
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {pinnedNotes.length > 0 ? <SectionLabel>{t('notes.pinned')}</SectionLabel> : null}
        {pinnedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            mode={mode}
            selected={note.id === selectedNoteId}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
            onRestore={() => onRestoreNote?.(note.id)}
            onDelete={() => onDeleteNote?.(note.id)}
          />
        ))}
        {otherNotes.length > 0 && pinnedNotes.length > 0 ? <SectionLabel>{t('notes.recent')}</SectionLabel> : null}
        {otherNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            mode={mode}
            selected={note.id === selectedNoteId}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
            onRestore={() => onRestoreNote?.(note.id)}
            onDelete={() => onDeleteNote?.(note.id)}
          />
        ))}
        {filtered.length === 0 ? <div className="mx-2 rounded-xl border border-dashed border-[#d8d2ca] px-4 py-10 text-center text-[13px] text-[#8d867f] dark:border-[#f5f3f0]/15 dark:text-[#f5f3f0]/55">{t('notes.noNotesFound')}</div> : null}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#8d867f] dark:text-[#f5f3f0]/55">{children}</div>
}

function NoteCard({
  note,
  mode,
  selected,
  onSelect,
  onTogglePin,
  onTrash,
  onRestore,
  onDelete,
}: {
  note: NoteItem
  mode: NoteBrowserMode
  selected: boolean
  onSelect: () => void
  onTogglePin: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const dragImageRef = useRef<HTMLElement | null>(null)

  return (
    <div
      draggable={mode === 'notes'}
      onDragStart={(event) => {
        if (mode !== 'notes') return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', note.id)
        event.dataTransfer.setData('application/x-focus-note-id', note.id)
        const source = event.currentTarget as HTMLDivElement
        const rect = source.getBoundingClientRect()
        const clone = source.cloneNode(true) as HTMLDivElement
        clone.style.position = 'fixed'
        clone.style.top = '-10000px'
        clone.style.left = '-10000px'
        clone.style.width = `${rect.width}px`
        clone.style.height = `${rect.height}px`
        clone.style.maxWidth = `${rect.width}px`
        clone.style.boxSizing = 'border-box'
        clone.style.opacity = '0.4'
        clone.style.pointerEvents = 'none'
        clone.style.margin = '0'
        document.body.appendChild(clone)
        dragImageRef.current = clone
        event.dataTransfer.setDragImage(clone, 24, 16)
      }}
      onDragEnd={() => {
        const node = dragImageRef.current
        if (node) {
          node.remove()
          dragImageRef.current = null
        }
      }}
      onClick={onSelect}
      className={cn(
        'group relative mb-1 cursor-pointer rounded-xl border border-transparent px-3 py-2.5 pb-7 transition-[background-color,border-color,box-shadow,transform,opacity] duration-200',
        selected ? 'translate-x-0.5 border-[#d8d2ca] bg-[#ede9e2] shadow-[0_12px_28px_rgba(58,55,51,0.08)] dark:border-[#f5f3f0]/15 dark:bg-[#f5f3f0]/10 dark:shadow-none' : 'hover:-translate-y-0.5 hover:bg-[#ede9e2]/60 hover:shadow-[0_10px_22px_rgba(58,55,51,0.05)] dark:hover:bg-[#f5f3f0]/10',
      )}
      style={{ minHeight: '101.1875px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 truncate text-[0.875rem] leading-[1.45] text-[#3a3733] dark:text-[#f5f3f0]" style={{ fontWeight: 500 }}>
          {note.pinned ? <Pin size={10} className="mr-1 inline text-muted-foreground" /> : null}
          {stripMarkdown(note.title) || 'Untitled'}
        </h4>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-[1.55] text-[#7a7570] dark:text-[#f5f3f0]/72">{note.excerpt ? stripMarkdown(note.excerpt) : 'This note does not have a preview yet.'}</p>
      <span className="absolute bottom-2 right-3 text-[0.6875rem] tabular-nums text-[#8d867f] dark:text-[#f5f3f0]/55">{formatTime(note.updatedAt)}</span>

      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {mode === 'notes' ? (
          <button type="button" onClick={(event) => { event.stopPropagation(); onTogglePin() }} className="rounded p-1 hover:bg-[#3a3733]/5 dark:hover:bg-white/10" title={note.pinned ? 'Unpin' : 'Pin'}>
            {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
        ) : null}
        {mode === 'trash' ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRestore()
            }}
            className="rounded p-1 text-[#3a3733] hover:bg-[#3a3733]/5 dark:text-slate-200 dark:hover:bg-white/10"
            title="Restore"
          >
            <RotateCcw size={12} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (mode === 'trash') {
              onDelete()
              return
            }
            onTrash()
          }}
          className="rounded p-1 text-destructive hover:bg-destructive/10"
          title={mode === 'trash' ? 'Delete permanently' : 'Move to trash'}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
