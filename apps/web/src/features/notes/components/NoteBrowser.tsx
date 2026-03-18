import { useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronDown, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteItem } from '../../../data/models/types'

export type NoteSortOption = 'edited' | 'created' | 'title'
export type NoteBrowserMode = 'notes' | 'trash'

type Props = {
  notes: NoteItem[]
  selectedNoteId: string | null
  collectionLabel: string
  mode?: NoteBrowserMode
  onSelectNote: (id: string) => void
  onNewNote: () => void
  onTogglePin: (id: string) => void
  onTrashNote: (id: string) => void
  onDeleteNote?: (id: string) => void
  sortBy: NoteSortOption
  onSortChange: (value: NoteSortOption) => void
  search: string
  onSearchChange: (value: string) => void
  className?: string
  scrollContainerRef?: RefObject<HTMLElement | null>
}

const sortLabels: Record<NoteSortOption, string> = {
  edited: 'Edited',
  created: 'Created',
  title: 'Title',
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
  onDeleteNote,
  sortBy,
  onSortChange,
  search,
  onSearchChange,
  className,
  scrollContainerRef,
}: Props) {
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
      ref={scrollContainerRef}
      className={cn(
        'flex h-full w-[300px] min-w-[300px] flex-col overflow-y-auto overscroll-contain border-r border-[#e5e2dd] bg-[#faf9f7] dark:border-slate-700/40 dark:bg-[#3a3733]',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-md bg-[#f0eeeb] px-2.5 py-1 text-[12px] font-medium text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100">{collectionLabel}</span>
          <span className="text-[12px] text-[#8d867f] dark:text-slate-400">{notes.length}</span>
        </div>
        <button
          type="button"
          onClick={onNewNote}
          className="rounded-lg p-1.5 text-[#3a3733] transition-colors hover:bg-[#f0eeeb] dark:text-slate-100 dark:hover:bg-slate-700/30"
          title="New note"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu((current) => !current)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[#66615b] transition-colors hover:bg-[#f0eeeb] dark:text-slate-300 dark:hover:bg-slate-700/30"
          >
            {sortLabels[sortBy]}
            <ChevronDown size={12} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-[#e5e2dd] bg-[#faf9f7] p-1 shadow-lg dark:border-slate-700/40 dark:bg-slate-800">
              {(['edited', 'created', 'title'] as NoteSortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSortChange(option)
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-[#f0eeeb] dark:text-slate-200 dark:hover:bg-slate-700/40',
                    sortBy === option && 'bg-[#f0eeeb] dark:bg-slate-700/50',
                  )}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8d867f] dark:text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, content, or tag"
            className="w-full rounded-md border-0 bg-[#f0eeeb]/80 py-1 pl-7 pr-2 text-[12px] outline-none placeholder:text-[#8d867f]/70 dark:bg-slate-700/35 dark:text-slate-200 dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="px-2 pb-4">
        {pinnedNotes.length > 0 ? <SectionLabel>Pinned</SectionLabel> : null}
        {pinnedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            mode={mode}
            selected={note.id === selectedNoteId}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
            onDelete={() => onDeleteNote?.(note.id)}
          />
        ))}
        {otherNotes.length > 0 && pinnedNotes.length > 0 ? <SectionLabel>Recent</SectionLabel> : null}
        {otherNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            mode={mode}
            selected={note.id === selectedNoteId}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
            onDelete={() => onDeleteNote?.(note.id)}
          />
        ))}
        {filtered.length === 0 ? <div className="py-12 text-center text-[13px] text-muted-foreground">No notes found</div> : null}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d867f] dark:text-slate-400">{children}</div>
}

function NoteCard({
  note,
  mode,
  selected,
  onSelect,
  onTogglePin,
  onTrash,
  onDelete,
}: {
  note: NoteItem
  mode: NoteBrowserMode
  selected: boolean
  onSelect: () => void
  onTogglePin: () => void
  onTrash: () => void
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
        'group relative mb-0.5 cursor-pointer rounded-lg px-3 py-2.5 pb-6 transition-all',
        selected ? 'bg-[#f0eeeb] shadow-[0_0_0_1px_rgba(58, 55, 51, 0.04)] dark:bg-slate-700/40 dark:shadow-none' : 'hover:bg-[#f0eeeb]/60 dark:hover:bg-slate-700/25',
      )}
      style={{ minHeight: '101.1875px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 truncate text-[13px] leading-[1.4] text-foreground" style={{ fontWeight: 500 }}>
          {note.pinned ? <Pin size={10} className="mr-1 inline text-muted-foreground" /> : null}
          {note.title.trim() || 'Untitled'}
        </h4>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.5] text-[#7a7570] dark:text-slate-300/80">{note.excerpt || 'This note does not have a preview yet.'}</p>
      <span className="absolute bottom-2 right-3 text-[10px] text-[#8d867f] dark:text-slate-400">{formatTime(note.updatedAt)}</span>

      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {mode === 'notes' ? (
          <button type="button" onClick={(event) => { event.stopPropagation(); onTogglePin() }} className="rounded p-1 hover:bg-[#3a3733]/5 dark:hover:bg-white/10" title={note.pinned ? 'Unpin' : 'Pin'}>
            {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
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
