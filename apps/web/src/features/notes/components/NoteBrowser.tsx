import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckSquare2, ChevronDown, Pin, PinOff, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatRelativeTime } from '../../../shared/i18n/format'
import type { NoteItem } from '../../../data/models/types'

export type NoteSortOption = 'edited' | 'created' | 'title'
export type NoteBrowserMode = 'notes' | 'trash'
type NotePreview = { title: string; excerpt: string }

type Props = {
  notes: NoteItem[]
  totalCount: number
  previews: Map<string, NotePreview>
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
  totalCount,
  previews,
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
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pendingFocusId = useRef<string | null>(null)
  const searching = search.trim().length > 0
  const { pinnedNotes, otherNotes } = useMemo(() => ({
    pinnedNotes: notes.filter((note) => note.pinned),
    otherNotes: notes.filter((note) => !note.pinned),
  }), [notes])
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
  const shouldVirtualize = notes.length > VIRTUALIZE_NOTE_COUNT
  const assignScrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollNode(node)
    if (scrollContainerRef) {
      ;(scrollContainerRef as { current: HTMLDivElement | null }).current = node
    }
  }, [scrollContainerRef])
  const findNoteRow = (from: number, step: 1 | -1) => {
    for (let index = from; index >= 0 && index < rows.length; index += step) {
      if (rows[index]?.type === 'note') return index
    }
    return -1
  }

  const focusRow = (index: number) => {
    const row = rows[index]
    if (row?.type !== 'note') return
    const button = scrollNode?.querySelector<HTMLButtonElement>(`[data-note-open="${index}"]`)
    if (button) {
      pendingFocusId.current = null
      button.focus()
    } else if (shouldVirtualize) {
      pendingFocusId.current = row.note.id
      rowVirtualizer.scrollToIndex(index, { align: 'auto' })
    }
  }

  const clearSearch = () => {
    pendingFocusId.current = null
    onSearchChange('')
    searchRef.current?.focus()
  }

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape' && search) {
      event.preventDefault()
      clearSearch()
      return
    }
    const fromEnd = event.key === 'ArrowUp'
    if (!fromEnd && event.key !== 'ArrowDown' && event.key !== 'Enter') return
    const index = fromEnd ? findNoteRow(rows.length - 1, -1) : findNoteRow(0, 1)
    const row = rows[index]
    if (row?.type !== 'note') return
    event.preventDefault()
    if (event.key === 'Enter') onSelectNote(row.note.id)
    else focusRow(index)
  }

  const handleRowKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    let nextIndex: number
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = findNoteRow(index + 1, 1)
        break
      case 'ArrowUp':
        nextIndex = findNoteRow(index - 1, -1)
        break
      case 'Home':
        nextIndex = findNoteRow(0, 1)
        break
      case 'End':
        nextIndex = findNoteRow(rows.length - 1, -1)
        break
      default:
        return
    }
    event.preventDefault()
    focusRow(nextIndex)
  }

  const renderRow = (row: NoteBrowserRow, rowIndex: number) => {
    if (row.type === 'label') return <SectionLabel>{row.label}</SectionLabel>
    return (
      <NoteCard
        note={row.note}
        preview={previews.get(row.note.id)}
        rowIndex={rowIndex}
        onRowKeyDown={handleRowKey}
        registerOpenButton={(button) => {
          if (button && pendingFocusId.current === row.note.id) {
            pendingFocusId.current = null
            button.focus({ preventScroll: true })
          }
        }}
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
      aria-label={collectionLabel}
      className={cn(
        'flex h-full min-h-0 w-[300px] min-w-[300px] flex-col overflow-hidden border-r border-rule bg-paper-sunken',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded-md bg-[color-mix(in_srgb,var(--ink-1)_5.5%,transparent)] px-2.5 py-[3px] text-label font-[500] tracking-[-0.01em] text-ink-1 dark:bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] dark:text-[var(--text-primary)]">{collectionLabel}</span>
          <span aria-live="polite" className="text-meta tabular-nums text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{searching ? `${notes.length} / ${totalCount}` : totalCount}</span>
        </div>
        {mode !== 'trash' && (
          <button
            type="button"
            onClick={onNewNote}
            className="rounded-lg p-1.5 text-ink-1 transition-[background-color,transform,box-shadow] [transition-duration:160ms] hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--ink-1)_6%,transparent)] hover:shadow-[var(--shadow-pop)] active:translate-y-0"
            title={t('modules.note.new')}
          >
            <Plus size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`${t('tasks.sortBy')} · ${sortLabels[sortBy]}`}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-meta font-medium text-ink-2 transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_5%,transparent)]"
            >
              {sortLabels[sortBy]}
              <ChevronDown size={11} strokeWidth={2.4} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={4} className="z-50 w-32 rounded-lg border border-rule bg-paper-raised p-1 shadow-[var(--elev-2)]">
              <DropdownMenu.RadioGroup value={sortBy}>
                {(['edited', 'created', 'title'] as const).map((option) => (
                  <DropdownMenu.RadioItem
                    key={option}
                    value={option}
                    onSelect={() => onSortChange(option)}
                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-meta font-medium text-ink-1 outline-none data-[highlighted]:bg-paper-sunken data-[state=checked]:bg-paper-sunken"
                  >
                    {sortLabels[option]}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]" />
          {search && (
            <button
              type="button"
              aria-label={language === 'zh' ? '清除搜索' : 'Clear search'}
              onClick={clearSearch}
              className="absolute right-0.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-ink-2 hover:bg-paper-sunken"
            >
              <X size={13} />
            </button>
          )}
          <input
            ref={searchRef}
            aria-label={t('notes.searchPlaceholder')}
            onKeyDown={handleSearchKey}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="w-full rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--ink-1)_4%,transparent)] py-[5px] pl-7 pr-7 text-meta text-ink-1 outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus:border-[color-mix(in_srgb,var(--ink-1)_10%,transparent)] focus:bg-white/72 focus:shadow-[var(--shadow-pop)]"
          />
        </div>
      </div>

      <div ref={assignScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {notes.length > 0 && !shouldVirtualize ? rows.map((row, index) => (
          <div key={row.key}>{renderRow(row, index)}</div>
        )) : null}
        {notes.length > 0 && shouldVirtualize ? (
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
                  {renderRow(row, virtualRow.index)}
                </div>
              )
            })}
          </div>
        ) : null}
        {notes.length === 0 ? (
          <div className="mx-2 mt-4 px-2 py-2 text-left">
            <p className="text-ui font-medium text-[var(--text-tertiary)]">{t(mode === 'trash' && !searching ? 'notes.trash.empty' : 'notes.noNotesFound')}</p>
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
  preview,
  rowIndex,
  registerOpenButton,
  onRowKeyDown,
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
  preview?: NotePreview
  rowIndex: number
  registerOpenButton: (node: HTMLButtonElement | null) => void
  onRowKeyDown: (event: KeyboardEvent<HTMLButtonElement>, rowIndex: number) => void
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
  const title = preview?.title || t('notes.trash.untitled')
  const pinLabel = note.pinned ? (language === 'zh' ? '取消置顶' : 'Unpin') : (language === 'zh' ? '置顶' : 'Pin')
  const deleteLabel = mode === 'trash' ? (language === 'zh' ? '永久删除' : 'Delete permanently') : t('modules.note.moveToTrash')

  return (
    <div
      draggable={mode === 'notes'}
      onDragStart={(event) => {
        if (mode !== 'notes') return
        event.dataTransfer.effectAllowed = 'copy'
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
      className={cn(
        'note-card group relative mb-1 cursor-pointer rounded-[var(--radius-sm)] border px-3 py-2.5 transition-[background-color,border-color,box-shadow,transform] [transition-duration:180ms]',
        selected
          ? 'is-selected translate-x-[1px] border-[color-mix(in_srgb,var(--ink-1)_10%,transparent)] bg-[color-mix(in_srgb,var(--ink-1)_5.5%,transparent)] shadow-[inset_2.5px_0_0_var(--accent),var(--shadow-card)] dark:shadow-none'
          : 'border-transparent hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--ink-1)_6%,transparent)] hover:bg-[color-mix(in_srgb,var(--ink-1)_3.8%,transparent)] hover:shadow-[var(--shadow-pop)]',
      )}
      style={{ minHeight: '101px' }}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5 pr-12">
        {note.pinned ? <Pin size={9} className="mt-[3px] shrink-0 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]" /> : null}
        <h4 className="min-w-0 font-body text-ui font-semibold leading-[1.42] text-ink-1">
          <button
            type="button"
            ref={registerOpenButton}
            // A press transform would shrink the stretched hit area to the title.
            data-press="off"
            data-note-open={rowIndex}
            aria-current={selected ? 'true' : undefined}
            onClick={onSelect}
            onKeyDown={(event) => onRowKeyDown(event, rowIndex)}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-[var(--radius-sm)] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--accent)]"
          >
            <span className="line-clamp-2">{title}</span>
          </button>
        </h4>
      </div>

      {/* Excerpt */}
      {preview?.excerpt ? (
        <p className="mt-0.5 line-clamp-2 text-label leading-[1.58] text-ink-3">
          {preview.excerpt}
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
      <div className="note-card__actions z-10 flex items-center gap-0.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
        {mode === 'notes' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onTogglePin() }}
            className="relative z-10 rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)] hover:text-ink-1 dark:text-[var(--text-tertiary)] dark:hover:bg-white/10"
            title={pinLabel}
          >
            {note.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
        ) : null}
        {mode === 'trash' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRestore() }}
            className="relative z-10 rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)] hover:text-ink-1 dark:text-[var(--text-primary)] dark:hover:bg-white/10"
            title={t('notes.trash.restore')}
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
          className="relative z-10 rounded-md p-1.5 text-tone-urgent transition-colors hover:bg-tone-urgent-wash"
          title={deleteLabel}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
