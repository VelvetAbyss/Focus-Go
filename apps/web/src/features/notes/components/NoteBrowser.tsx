import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckSquare2, ChevronDown, Pin, PinOff, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatRelativeTime } from '../../../shared/i18n/format'
import type { NoteItem } from '../../../data/models/types'
import { markdownToPreview } from '../../../shared/utils/markdownPreview'

export type NoteSortOption = 'edited' | 'created' | 'title'
export type NoteBrowserMode = 'notes' | 'trash'


type Props = {
  notes: NoteItem[]
  selectedNoteId: string | null
  collectionLabel: string
  mode?: NoteBrowserMode
  tagLabelMap?: Map<string, string>
  linkedTaskTitles?: Map<string, string>
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

const VIRTUALIZE_NOTE_COUNT = 40

type NoteBrowserRow =
  | { type: 'label'; key: string; label: string }
  | { type: 'note'; key: string; note: NoteItem }

export default function NoteBrowser({
  notes,
  selectedNoteId,
  collectionLabel,
  mode = 'notes',
  tagLabelMap,
  linkedTaskTitles,
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
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null)
  const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search])
  const filtered = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.title.toLowerCase().includes(normalizedSearch) ||
          note.excerpt.toLowerCase().includes(normalizedSearch) ||
          note.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch)),
      ),
    [notes, normalizedSearch],
  )
  const { pinnedNotes, otherNotes } = useMemo(() => ({
    pinnedNotes: filtered.filter((note) => note.pinned),
    otherNotes: filtered.filter((note) => !note.pinned),
  }), [filtered])
  const rows = useMemo<NoteBrowserRow[]>(() => {
    const next: NoteBrowserRow[] = []
    if (pinnedNotes.length > 0) next.push({ type: 'label', key: 'label:pinned', label: t('notes.pinned') })
    for (const note of pinnedNotes) next.push({ type: 'note', key: `note:${note.id}`, note })
    if (otherNotes.length > 0 && pinnedNotes.length > 0) next.push({ type: 'label', key: 'label:recent', label: t('notes.recent') })
    for (const note of otherNotes) next.push({ type: 'note', key: `note:${note.id}`, note })
    return next
  }, [otherNotes, pinnedNotes, t])
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollNode,
    estimateSize: (index) => rows[index]?.type === 'label' ? 34 : 118,
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 8,
  })
  const shouldVirtualize = filtered.length > VIRTUALIZE_NOTE_COUNT
  const assignScrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollNode(node)
    if (scrollContainerRef) {
      ;(scrollContainerRef as { current: HTMLDivElement | null }).current = node
    }
  }, [scrollContainerRef])
  const renderRow = (row: NoteBrowserRow) => {
    if (row.type === 'label') return <SectionLabel>{row.label}</SectionLabel>
    return (
      <NoteCard
        note={row.note}
        mode={mode}
        tagLabelMap={tagLabelMap}
        linkedTaskTitle={linkedTaskTitles?.get(row.note.id)}
        selected={row.note.id === selectedNoteId}
        onSelect={() => onSelectNote(row.note.id)}
        onTogglePin={() => onTogglePin(row.note.id)}
        onTrash={() => onTrashNote(row.note.id)}
        onRestore={() => onRestoreNote?.(row.note.id)}
        onDelete={() => onDeleteNote?.(row.note.id)}
      />
    )
  }

  return (
    <section
      className={cn(
        'flex h-full min-h-0 w-[300px] min-w-[300px] flex-col overflow-hidden border-r border-rule bg-paper-sunken',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-md bg-[color-mix(in_srgb,var(--ink-1)_5.5%,transparent)] px-2.5 py-[3px] text-label font-[500] tracking-[-0.01em] text-ink-1 dark:bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] dark:text-[var(--text-primary)]">{collectionLabel}</span>
          <span className="text-meta tabular-nums text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{notes.length}</span>
        </div>
        <button
          type="button"
          onClick={onNewNote}
          className="rounded-lg p-1.5 text-ink-1 transition-[background-color,transform,box-shadow] [transition-duration:160ms] hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--ink-1)_6%,transparent)] hover:shadow-[var(--shadow-pop)] active:translate-y-0"
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
            className="flex items-center gap-1 rounded-md px-2 py-1 text-meta font-medium text-ink-2 transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_5%,transparent)]"
          >
            {sortLabels[sortBy]}
            <ChevronDown size={11} strokeWidth={2.4} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-[color-mix(in_srgb,var(--ink-1)_10%,transparent)] bg-paper-raised p-1 shadow-[var(--elev-2)]">
              {(['edited', 'created', 'title'] as NoteSortOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSortChange(option)
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-meta font-medium text-ink-1 transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_6%,transparent)]',
                    sortBy === option && 'bg-[color-mix(in_srgb,var(--ink-1)_6%,transparent)]',
                  )}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="w-full rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--ink-1)_4%,transparent)] py-[5px] pl-7 pr-2.5 text-meta text-ink-1 outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus:border-[color-mix(in_srgb,var(--ink-1)_10%,transparent)] focus:bg-white/72 focus:shadow-[var(--shadow-pop)]"
          />
        </div>
      </div>

      <div ref={assignScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {filtered.length > 0 && !shouldVirtualize ? rows.map((row) => (
          <div key={row.key}>{renderRow(row)}</div>
        )) : null}
        {filtered.length > 0 && shouldVirtualize ? (
          <div
            className="relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 right-0 top-0"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {renderRow(row)}
                </div>
              )
            })}
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <div className="mx-2 mt-4 px-2 py-2 text-left">
            <p className="text-ui font-medium text-[var(--text-tertiary)]">{t('notes.noNotesFound')}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-0.5 flex items-center gap-2 px-2 py-1.5">
      <span className="text-meta font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--ink-1)_7%,transparent)]" />
    </div>
  )
}

function NoteCard({
  note,
  mode,
  tagLabelMap,
  linkedTaskTitle,
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
  linkedTaskTitle?: string
  selected: boolean
  onSelect: () => void
  onTogglePin: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const dragImageRef = useRef<HTMLElement | null>(null)
  const { language, t } = useI18n()
  const preview = note.excerpt ? markdownToPreview(note.excerpt, note.title) : ''

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
        'group relative mb-1 cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2.5 transition-[background-color,border-color,box-shadow,transform] [transition-duration:180ms]',
        selected
          ? 'translate-x-[1px] border-[color-mix(in_srgb,var(--ink-1)_10%,transparent)] bg-[color-mix(in_srgb,var(--ink-1)_5.5%,transparent)] shadow-[inset_2.5px_0_0_var(--accent),var(--shadow-card)] dark:shadow-none'
          : 'border-transparent hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--ink-1)_6%,transparent)] hover:bg-[color-mix(in_srgb,var(--ink-1)_3.8%,transparent)] hover:shadow-[var(--shadow-pop)]',
      )}
      style={{ minHeight: '101px' }}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5 pr-12">
        {note.pinned ? <Pin size={9} className="mt-[3px] shrink-0 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]" /> : null}
        <h4 className="line-clamp-2 font-body text-ui font-semibold leading-[1.42] text-ink-1">
          {markdownToPreview(note.title) || <span className="text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{t('notes.trash.untitled')}</span>}
        </h4>
      </div>

      {/* Excerpt */}
      {preview ? (
        <p className="mt-0.5 line-clamp-2 text-label leading-[1.58] text-ink-3">
          {preview}
        </p>
      ) : null}

      {/* Footer: tags + time */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {note.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex h-[18px] items-center rounded-[var(--radius-xs)] border border-[color-mix(in_srgb,var(--ink-1)_7%,transparent)] bg-[color-mix(in_srgb,var(--ink-1)_4.5%,transparent)] px-[7px] text-meta font-medium leading-none tracking-[0.015em] text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]"
            >
              {tagLabelMap?.get(tag) ?? tag}
            </span>
          ))}
          {note.tags.length > 2 ? (
            <span className="inline-flex h-[18px] items-center text-meta text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">
              +{note.tags.length - 2}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-meta tabular-nums text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{formatRelativeTime(note.updatedAt, language)}</span>
      </div>

      {linkedTaskTitle ? (
        <div className="mt-1.5 flex items-center gap-1 text-meta text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">
          <CheckSquare2 size={10} className="shrink-0" />
          <span className="truncate">{linkedTaskTitle}</span>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
        {mode === 'notes' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onTogglePin() }}
            className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)] hover:text-ink-1 dark:text-[var(--text-tertiary)] dark:hover:bg-white/10"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
        ) : null}
        {mode === 'trash' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRestore() }}
            className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)] hover:text-ink-1 dark:text-[var(--text-primary)] dark:hover:bg-white/10"
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
          className="rounded-md p-1.5 text-tone-urgent transition-colors hover:bg-tone-urgent-wash"
          title={mode === 'trash' ? 'Delete permanently' : 'Move to trash'}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
