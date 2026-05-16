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
  tagLabelMap?: Map<string, string>
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
  tagLabelMap,
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
          <span className="rounded-md bg-[rgba(30,28,24,0.055)] px-2.5 py-[3px] text-[0.75rem] font-[530] tracking-[-0.01em] text-[#3a3733] dark:bg-slate-700/40 dark:text-slate-100">{collectionLabel}</span>
          <span className="text-[0.6875rem] tabular-nums text-[#8d867f]/80 dark:text-slate-400">{notes.length}</span>
        </div>
        <button
          type="button"
          onClick={onNewNote}
          className="rounded-lg p-1.5 text-[#3a3733] transition-[background-color,transform,box-shadow] [transition-duration:160ms] hover:-translate-y-0.5 hover:bg-[rgba(30,28,24,0.06)] hover:shadow-[0_6px_14px_rgba(58,55,51,0.07)] active:translate-y-0 dark:text-[#f5f3f0] dark:hover:bg-[#f5f3f0]/10"
          title={t('modules.note.new')}
        >
          <Plus size={15} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu((current) => !current)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-[#66615b] transition-colors hover:bg-[rgba(30,28,24,0.05)] dark:text-[#f5f3f0]/80 dark:hover:bg-[#f5f3f0]/10"
          >
            {sortLabels[sortBy]}
            <ChevronDown size={11} strokeWidth={2.4} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-[rgba(58,55,51,0.1)] bg-[#f8f6f2] p-1 shadow-[0_16px_38px_rgba(58,55,51,0.12),0_2px_8px_rgba(58,55,51,0.06)] dark:border-[#f5f3f0]/15 dark:bg-[#3a3733]">
              {(['edited', 'created', 'title'] as NoteSortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSortChange(option)
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-[0.6875rem] font-medium text-[#3a3733] transition-colors hover:bg-[rgba(30,28,24,0.06)] dark:text-[#f5f3f0] dark:hover:bg-[#f5f3f0]/10',
                    sortBy === option && 'bg-[rgba(30,28,24,0.06)] dark:bg-[#f5f3f0]/15',
                  )}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8d867f]/70 dark:text-[#f5f3f0]/45" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="w-full rounded-lg border border-transparent bg-[rgba(30,28,24,0.04)] py-[5px] pl-7 pr-2.5 text-[0.6875rem] text-[#3a3733] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[#8d867f]/60 focus:border-[rgba(58,55,51,0.1)] focus:bg-white/72 focus:shadow-[0_2px_8px_rgba(58,55,51,0.06)] dark:bg-[#f5f3f0]/10 dark:text-[#f5f3f0] dark:placeholder:text-[#f5f3f0]/40 dark:focus:bg-[#f5f3f0]/15"
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
            tagLabelMap={tagLabelMap}
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
            tagLabelMap={tagLabelMap}
            selected={note.id === selectedNoteId}
            onSelect={() => onSelectNote(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onTrash={() => onTrashNote(note.id)}
            onRestore={() => onRestoreNote?.(note.id)}
            onDelete={() => onDeleteNote?.(note.id)}
          />
        ))}
        {filtered.length === 0 ? (
          <div className="mx-2 mt-4 rounded-xl border border-dashed border-[rgba(58,55,51,0.14)] px-4 py-10 text-center dark:border-[#f5f3f0]/12">
            <p className="text-[0.8125rem] font-medium text-[#8d867f] dark:text-[#f5f3f0]/50">{t('notes.noNotesFound')}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-0.5 flex items-center gap-2 px-2 py-1.5">
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[#8d867f]/90 dark:text-[#f5f3f0]/50">
        {children}
      </span>
      <span className="h-px flex-1 bg-[rgba(58,55,51,0.07)] dark:bg-[#f5f3f0]/8" />
    </div>
  )
}

function NoteCard({
  note,
  mode,
  tagLabelMap,
  selected,
  onSelect,
  onTogglePin,
  onTrash,
  onRestore,
  onDelete,
}: {
  note: NoteItem
  mode: NoteBrowserMode
  tagLabelMap?: Map<string, string>
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
        'group relative mb-1 cursor-pointer rounded-[11px] border px-3 py-2.5 transition-[background-color,border-color,box-shadow,transform] [transition-duration:180ms]',
        selected
          ? 'translate-x-[1px] border-[rgba(58,55,51,0.10)] bg-[rgba(30,28,24,0.055)] shadow-[inset_2.5px_0_0_rgba(58,55,51,0.22),0_10px_24px_rgba(58,55,51,0.07)] dark:border-[#f5f3f0]/15 dark:bg-[#f5f3f0]/10 dark:shadow-none'
          : 'border-transparent hover:-translate-y-[1px] hover:border-[rgba(58,55,51,0.06)] hover:bg-[rgba(30,28,24,0.038)] hover:shadow-[0_6px_16px_rgba(58,55,51,0.05)] dark:hover:bg-[#f5f3f0]/10 dark:hover:border-[#f5f3f0]/10',
      )}
      style={{ minHeight: '101px' }}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5 pr-12">
        {note.pinned ? <Pin size={9} className="mt-[3px] shrink-0 text-[#8d867f] dark:text-[#f5f3f0]/45" /> : null}
        <h4 className="line-clamp-2 text-[0.8125rem] font-[550] leading-[1.42] tracking-[-0.012em] text-[#2e2b27] dark:text-[#f5f3f0]">
          {stripMarkdown(note.title) || <span className="text-[#8d867f] dark:text-[#f5f3f0]/45">Untitled</span>}
        </h4>
      </div>

      {/* Excerpt */}
      {note.excerpt ? (
        <p className="mt-0.5 line-clamp-2 text-[0.75rem] leading-[1.58] text-[#7a7570] dark:text-[#f5f3f0]/65">
          {stripMarkdown(note.excerpt)}
        </p>
      ) : null}

      {/* Footer: tags + time */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {note.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex h-[18px] items-center rounded-[5px] border border-[rgba(58,55,51,0.07)] bg-[rgba(30,28,24,0.045)] px-[7px] text-[10px] font-medium leading-none tracking-[0.015em] text-[#8d867f] dark:border-[#f5f3f0]/10 dark:bg-[#f5f3f0]/8 dark:text-[#f5f3f0]/55"
            >
              {tagLabelMap?.get(tag) ?? tag}
            </span>
          ))}
          {note.tags.length > 2 ? (
            <span className="inline-flex h-[18px] items-center text-[10px] text-[#8d867f]/70 dark:text-[#f5f3f0]/35">
              +{note.tags.length - 2}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[0.625rem] tabular-nums text-[#8d867f] dark:text-[#f5f3f0]/45">{formatTime(note.updatedAt)}</span>
      </div>

      {/* Action buttons */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
        {mode === 'notes' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onTogglePin() }}
            className="rounded-md p-1.5 text-[#8d867f] transition-colors hover:bg-[#3a3733]/8 hover:text-[#3a3733] dark:text-[#f5f3f0]/50 dark:hover:bg-white/10 dark:hover:text-[#f5f3f0]"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
        ) : null}
        {mode === 'trash' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRestore() }}
            className="rounded-md p-1.5 text-[#8d867f] transition-colors hover:bg-[#3a3733]/8 hover:text-[#3a3733] dark:text-slate-200 dark:hover:bg-white/10"
            title="Restore"
          >
            <RotateCcw size={11} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (mode === 'trash') { onDelete(); return }
            onTrash()
          }}
          className="rounded-md p-1.5 text-[#b05050] transition-colors hover:bg-red-500/8 dark:text-red-400/80 dark:hover:bg-red-500/10"
          title={mode === 'trash' ? 'Delete permanently' : 'Move to trash'}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
