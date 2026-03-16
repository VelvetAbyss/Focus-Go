import { useMemo, useState, type RefObject } from 'react'
import { ChevronDown, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteItem } from '../../../data/models/types'

export type NoteSortOption = 'edited' | 'created' | 'title'

type Props = {
  notes: NoteItem[]
  selectedNoteId: string | null
  collectionLabel: string
  onSelectNote: (id: string) => void
  onNewNote: () => void
  onTogglePin: (id: string) => void
  onTrashNote: (id: string) => void
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
  onSelectNote,
  onNewNote,
  onTogglePin,
  onTrashNote,
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
      className={cn('flex h-full w-[300px] min-w-[300px] flex-col overflow-y-auto overscroll-contain border-r border-[#e5e2dd] bg-[#faf9f7]', className)}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-md bg-[#f0eeeb] px-2.5 py-1 text-[12px] font-medium text-[#3a3733]">{collectionLabel}</span>
          <span className="text-[12px] text-[#8d867f]">{notes.length}</span>
        </div>
        <button type="button" onClick={onNewNote} className="rounded-lg p-1.5 text-[#3a3733] transition-colors hover:bg-[#f0eeeb]" title="New note">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu((current) => !current)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[#66615b] transition-colors hover:bg-[#f0eeeb]"
          >
            {sortLabels[sortBy]}
            <ChevronDown size={12} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-[#e5e2dd] bg-[#faf9f7] p-1 shadow-lg">
              {(['edited', 'created', 'title'] as NoteSortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSortChange(option)
                    setShowSortMenu(false)
                  }}
                  className={cn('w-full rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-[#f0eeeb]', sortBy === option && 'bg-[#f0eeeb]')}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8d867f]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, content, or tag"
            className="w-full rounded-md border-0 bg-[#f0eeeb]/80 py-1 pl-7 pr-2 text-[12px] outline-none placeholder:text-[#8d867f]/70"
          />
        </div>
      </div>

      <div className="px-2 pb-4">
        {pinnedNotes.length > 0 ? <SectionLabel>Pinned</SectionLabel> : null}
        {pinnedNotes.map((note) => (
          <NoteCard key={note.id} note={note} selected={note.id === selectedNoteId} onSelect={() => onSelectNote(note.id)} onTogglePin={() => onTogglePin(note.id)} onTrash={() => onTrashNote(note.id)} />
        ))}
        {otherNotes.length > 0 && pinnedNotes.length > 0 ? <SectionLabel>Recent</SectionLabel> : null}
        {otherNotes.map((note) => (
          <NoteCard key={note.id} note={note} selected={note.id === selectedNoteId} onSelect={() => onSelectNote(note.id)} onTogglePin={() => onTogglePin(note.id)} onTrash={() => onTrashNote(note.id)} />
        ))}
        {filtered.length === 0 ? <div className="py-12 text-center text-[13px] text-muted-foreground">No notes found</div> : null}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d867f]">{children}</div>
}

function NoteCard({
  note,
  selected,
  onSelect,
  onTogglePin,
  onTrash,
}: {
  note: NoteItem
  selected: boolean
  onSelect: () => void
  onTogglePin: () => void
  onTrash: () => void
}) {
  const displayTags = note.tags.slice(0, 2)
  const overflowCount = note.tags.length - displayTags.length

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative mb-0.5 cursor-pointer rounded-lg px-3 py-2.5 transition-all',
        selected ? 'bg-[#f0eeeb] shadow-[0_0_0_1px_rgba(58, 55, 51, 0.04)]' : 'hover:bg-[#f0eeeb]/60',
      )}
      style={{ minHeight: '101.1875px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 truncate text-[13px] leading-[1.4] text-foreground" style={{ fontWeight: 500 }}>
          {note.pinned ? <Pin size={10} className="mr-1 inline text-muted-foreground" /> : null}
          {note.title.trim() || 'Untitled'}
        </h4>
        <span className="mt-0.5 shrink-0 text-[10px] text-[#8d867f]">{formatTime(note.updatedAt)}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.5] text-[#7a7570]">{note.excerpt || 'This note does not have a preview yet.'}</p>
      {displayTags.length > 0 ? (
        <div className="mt-1.5 flex items-center gap-1">
          {displayTags.map((tag) => (
            <span key={tag} className="rounded bg-[#f0eeeb] px-1.5 py-0.5 text-[10px] text-[#8d867f]">
              {tag}
            </span>
          ))}
          {overflowCount > 0 ? <span className="text-[10px] text-[#8d867f]">+{overflowCount}</span> : null}
        </div>
      ) : null}

      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={(event) => { event.stopPropagation(); onTogglePin() }} className="rounded p-1 hover:bg-[#3a3733]/5 dark:hover:bg-white/10" title={note.pinned ? 'Unpin' : 'Pin'}>
          {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onTrash() }} className="rounded p-1 text-destructive hover:bg-destructive/10" title="Move to trash">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
