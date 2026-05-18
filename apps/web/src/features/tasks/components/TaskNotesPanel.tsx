import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  LayoutGrid,
  Link2Off,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { cn } from '@/lib/utils'
import type { NoteItem, TaskNoteLink } from '../../../data/models/types'
import { taskNoteLinksRepo } from '../../../data/repositories/taskNoteLinksRepo'
import { notesRepo } from '../../../data/repositories/notesRepo'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'

type TaskNotesPanelProps = {
  taskId: string
  taskTitle: string
}

type ViewMode = 'stack' | 'cards' | 'focus'
type LinkedNote = { link: TaskNoteLink; note: NoteItem }

const VIEW_STORAGE_KEY = 'task_notes_view_v1'

const readStoredView = (): ViewMode => {
  if (typeof window === 'undefined') return 'stack'
  const stored = window.sessionStorage.getItem(VIEW_STORAGE_KEY)
  if (stored === 'stack' || stored === 'cards' || stored === 'focus') return stored
  return 'stack'
}

const truncate = (input: string, max: number) =>
  input.length <= max ? input : `${input.slice(0, max)}…`

const previewOf = (note: NoteItem) => {
  const source = note.excerpt?.trim() || note.contentMd?.trim() || ''
  return source.replace(/\n+/g, ' ')
}

const formatRelative = (timestamp: number) => {
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

const TaskNotesPanel = ({ taskId, taskTitle }: TaskNotesPanelProps) => {
  const { t } = useI18n()
  const toast = useToast()
  const [items, setItems] = useState<LinkedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>(() => readStoredView())
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null)
  const [expandedStackIds, setExpandedStackIds] = useState<Set<string>>(new Set())
  const saveTimerRef = useRef<number | null>(null)
  const pendingSaveRef = useRef<Map<string, { title?: string; contentMd?: string }>>(new Map())

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const fetched = await taskNoteLinksRepo.listByTask(taskId)
      setItems(fetched)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, view)
    }
  }, [view])

  const flushSaves = useCallback(async () => {
    if (pendingSaveRef.current.size === 0) return
    const pending = pendingSaveRef.current
    pendingSaveRef.current = new Map()
    for (const [noteId, patch] of pending) {
      try {
        await notesRepo.update(noteId, patch)
      } catch (error) {
        console.error('[TaskNotesPanel] save failed', noteId, error)
      }
    }
  }, [])

  useEffect(() => () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      void flushSaves()
    }
  }, [flushSaves])

  const scheduleSave = useCallback((noteId: string, patch: { title?: string; contentMd?: string }) => {
    const existing = pendingSaveRef.current.get(noteId) ?? {}
    pendingSaveRef.current.set(noteId, { ...existing, ...patch })
    setItems((prev) =>
      prev.map((entry) =>
        entry.note.id === noteId
          ? { ...entry, note: { ...entry.note, ...patch, updatedAt: Date.now() } }
          : entry,
      ),
    )
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushSaves()
    }, 250)
  }, [flushSaves])

  const handleCreate = useCallback(async () => {
    try {
      const { link, note } = await taskNoteLinksRepo.createForTask(taskId, taskTitle)
      setItems((prev) => [...prev, { link, note }])
      setFocusedNoteId(note.id)
      setView('focus')
    } catch (error) {
      console.error('[TaskNotesPanel] create failed', error)
      toast.push({ variant: 'error', title: t('tasks.notes.createNote'), message: '' })
    }
  }, [t, taskId, taskTitle, toast])

  const handleUnlink = useCallback(async (noteId: string) => {
    try {
      await taskNoteLinksRepo.removeLink(taskId, noteId)
      setItems((prev) => prev.filter((entry) => entry.note.id !== noteId))
      if (focusedNoteId === noteId) setFocusedNoteId(null)
    } catch (error) {
      console.error('[TaskNotesPanel] unlink failed', error)
    }
  }, [focusedNoteId, taskId])

  const handleDelete = useCallback(async (noteId: string) => {
    if (!window.confirm(t('tasks.notes.confirmDelete'))) return
    try {
      await taskNoteLinksRepo.removeLink(taskId, noteId)
      await notesRepo.softDelete(noteId)
      setItems((prev) => prev.filter((entry) => entry.note.id !== noteId))
      if (focusedNoteId === noteId) setFocusedNoteId(null)
    } catch (error) {
      console.error('[TaskNotesPanel] delete failed', error)
    }
  }, [focusedNoteId, t, taskId])

  const toggleStackExpanded = (noteId: string) => {
    setExpandedStackIds((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  const focusedItem = useMemo(
    () => items.find((entry) => entry.note.id === focusedNoteId) ?? items[0] ?? null,
    [focusedNoteId, items],
  )

  useEffect(() => {
    if (view === 'focus' && !focusedNoteId && items.length > 0) {
      setFocusedNoteId(items[0].note.id)
    }
  }, [focusedNoteId, items, view])

  return (
    <section
      className="task-detail-card task-detail-card--side tdv2-section-enter rounded-[24px] border border-[#3a3733]/6 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
      style={{ animationDelay: '100ms' }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="task-detail-kicker">{t('tasks.notes.title')}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <h2 className="task-detail-title">{t('tasks.notes.title')}</h2>
            {items.length > 0 ? (
              <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[color:var(--text-secondary)]">
                {items.length}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => void handleCreate()}
          className="h-8 shrink-0 rounded-full bg-[#3a3733] px-3 text-[11px] font-semibold text-[#f5f3f0] hover:bg-[#2a2724]"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('tasks.notes.createNote')}
        </Button>
      </div>

      <div className="mb-3 inline-flex items-center gap-0.5 rounded-full border border-[#3a3733]/8 bg-[color:var(--bg-muted)] p-0.5">
        {([
          { key: 'stack', label: t('tasks.notes.viewStack'), Icon: List },
          { key: 'cards', label: t('tasks.notes.viewCards'), Icon: LayoutGrid },
          { key: 'focus', label: t('tasks.notes.viewFocus'), Icon: Maximize2 },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-200',
              view === key
                ? 'bg-[#3a3733] text-[#f5f3f0] shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
            )}
            title={label}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-[14px] border border-dashed border-[#3a3733]/10 bg-[color:var(--bg-muted)] px-4 py-6 text-center text-[12px] text-[color:var(--text-secondary)]">
          …
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#3a3733]/10 bg-[color:var(--bg-muted)] px-4 py-6 text-center">
          <FileText className="mx-auto h-6 w-6 text-[color:var(--text-secondary)]" />
          <p className="mt-2 text-[13px] font-semibold text-[color:var(--text-primary)]">
            {t('tasks.notes.empty')}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
            {t('tasks.notes.emptyHint')}
          </p>
        </div>
      ) : view === 'stack' ? (
        <StackView
          items={items}
          expandedIds={expandedStackIds}
          onToggleExpand={toggleStackExpanded}
          onChange={scheduleSave}
          onUnlink={handleUnlink}
          onDelete={handleDelete}
          onFocus={(noteId) => {
            setFocusedNoteId(noteId)
            setView('focus')
          }}
        />
      ) : view === 'cards' ? (
        <CardsView
          items={items}
          onOpen={(noteId) => {
            setFocusedNoteId(noteId)
            setView('focus')
          }}
          onUnlink={handleUnlink}
          onDelete={handleDelete}
        />
      ) : (
        <FocusView
          items={items}
          activeNoteId={focusedItem?.note.id ?? null}
          onSelect={setFocusedNoteId}
          onBack={() => setView('stack')}
          onChange={scheduleSave}
          onUnlink={handleUnlink}
          onDelete={handleDelete}
        />
      )}
    </section>
  )
}

// ─── STACK VIEW ───
type StackViewProps = {
  items: LinkedNote[]
  expandedIds: Set<string>
  onToggleExpand: (noteId: string) => void
  onChange: (noteId: string, patch: { title?: string; contentMd?: string }) => void
  onUnlink: (noteId: string) => void
  onDelete: (noteId: string) => void
  onFocus: (noteId: string) => void
}

const StackView = ({
  items,
  expandedIds,
  onToggleExpand,
  onChange,
  onUnlink,
  onDelete,
  onFocus,
}: StackViewProps) => {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      {items.map(({ note }) => {
        const expanded = expandedIds.has(note.id)
        const preview = previewOf(note)
        return (
          <div
            key={note.id}
            className="rounded-[16px] border border-[#3a3733]/6 bg-[color:var(--bg-muted)] p-3 transition-colors hover:border-[#3a3733]/12"
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onToggleExpand(note.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13px] font-semibold text-[color:var(--text-primary)]">
                  {note.title?.trim() || t('tasks.notes.untitled')}
                </p>
                {!expanded ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                    {preview || ' '}
                  </p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[color:var(--text-secondary)]">
                  <span>{formatRelative(note.updatedAt)}</span>
                  {note.wordCount ? <span>· {note.wordCount}w</span> : null}
                </div>
              </button>
              <NoteCardMenu
                onOpenFocus={() => onFocus(note.id)}
                onUnlink={() => onUnlink(note.id)}
                onDelete={() => onDelete(note.id)}
              />
            </div>
            {expanded ? (
              <div className="mt-3 space-y-2">
                <Input
                  value={note.title}
                  onChange={(event) => onChange(note.id, { title: event.target.value })}
                  placeholder={t('tasks.notes.untitled')}
                  className="h-8 rounded-[10px] border-[#3a3733]/8 bg-white text-[13px]"
                />
                <ClickToContinueTextarea
                  value={note.contentMd}
                  onChange={(next) => onChange(note.id, { contentMd: next })}
                  minRows={6}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ─── CARDS VIEW ───
type CardsViewProps = {
  items: LinkedNote[]
  onOpen: (noteId: string) => void
  onUnlink: (noteId: string) => void
  onDelete: (noteId: string) => void
}

const CardsView = ({ items, onOpen, onUnlink, onDelete }: CardsViewProps) => {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map(({ note }) => (
        <div
          key={note.id}
          className="group relative rounded-[16px] border border-[#3a3733]/6 bg-[color:var(--bg-muted)] p-3 transition-all hover:border-[#3a3733]/15 hover:shadow-sm"
        >
          <button type="button" onClick={() => onOpen(note.id)} className="block w-full text-left">
            <p className="truncate text-[13px] font-semibold text-[color:var(--text-primary)]">
              {note.title?.trim() || t('tasks.notes.untitled')}
            </p>
            <p className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              {truncate(previewOf(note), 200) || ' '}
            </p>
            <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
              {formatRelative(note.updatedAt)}
            </p>
          </button>
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <NoteCardMenu
              onOpenFocus={() => onOpen(note.id)}
              onUnlink={() => onUnlink(note.id)}
              onDelete={() => onDelete(note.id)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── FOCUS VIEW ───
type FocusViewProps = {
  items: LinkedNote[]
  activeNoteId: string | null
  onSelect: (noteId: string) => void
  onBack: () => void
  onChange: (noteId: string, patch: { title?: string; contentMd?: string }) => void
  onUnlink: (noteId: string) => void
  onDelete: (noteId: string) => void
}

const FocusView = ({
  items,
  activeNoteId,
  onSelect,
  onBack,
  onChange,
  onUnlink,
  onDelete,
}: FocusViewProps) => {
  const { t } = useI18n()
  const active = items.find((entry) => entry.note.id === activeNoteId) ?? items[0]

  return (
    <div className="rounded-[16px] border border-[#3a3733]/6 bg-[color:var(--bg-muted)] p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('tasks.notes.backToList')}
        </button>
        {active ? (
          <NoteCardMenu
            onOpenFocus={() => {}}
            onUnlink={() => onUnlink(active.note.id)}
            onDelete={() => onDelete(active.note.id)}
            hideOpenFocus
          />
        ) : null}
      </div>

      <div className="flex gap-2">
        <div className="flex w-14 shrink-0 flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
          {items.map(({ note }) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note.id)}
              title={note.title || t('tasks.notes.untitled')}
              className={cn(
                'rounded-[10px] border px-1.5 py-2 text-center text-[10px] font-semibold leading-tight transition-colors',
                active?.note.id === note.id
                  ? 'border-[#3a3733]/20 bg-white text-[color:var(--text-primary)]'
                  : 'border-transparent text-[color:var(--text-secondary)] hover:bg-white/60',
              )}
            >
              <FileText className="mx-auto h-3 w-3" />
              <span className="mt-1 block truncate">
                {(note.title || t('tasks.notes.untitled')).slice(0, 6)}
              </span>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {active ? (
            <div className="flex flex-col gap-2">
              <Input
                value={active.note.title}
                onChange={(event) => onChange(active.note.id, { title: event.target.value })}
                placeholder={t('tasks.notes.untitled')}
                className="h-9 rounded-[10px] border-[#3a3733]/8 bg-white text-[14px] font-semibold"
              />
              <ClickToContinueTextarea
                value={active.note.contentMd}
                onChange={(next) => onChange(active.note.id, { contentMd: next })}
                minRows={16}
                fillHeight
              />
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-[12px] text-[color:var(--text-secondary)]">
              {t('tasks.notes.noNoteSelected')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CLICK-TO-CONTINUE TEXTAREA ───
// Wraps a textarea so that clicking the blank space below the content focuses
// the textarea and moves the caret to the end — same UX as Notion / Bear / Word.
type ClickToContinueTextareaProps = {
  value: string
  onChange: (next: string) => void
  minRows: number
  fillHeight?: boolean
}

const ClickToContinueTextarea = ({ value, onChange, minRows, fillHeight }: ClickToContinueTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  return (
    <div
      className={cn(
        'group/wrap relative cursor-text rounded-[12px] border border-[#3a3733]/8 bg-white p-0 transition-colors focus-within:ring-1 focus-within:ring-slate-300',
        fillHeight && 'flex min-h-[360px] flex-1',
      )}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement | null
        // If user clicked directly on the textarea, let the native handler put
        // the caret where they clicked. Only act when they clicked the wrapper.
        if (target && target.tagName === 'TEXTAREA') return
        event.preventDefault()
        const node = textareaRef.current
        if (!node) return
        node.focus()
        const end = node.value.length
        node.setSelectionRange(end, end)
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className={cn(
          'block w-full resize-none rounded-[12px] border-0 bg-transparent px-3 py-2 text-[13px] leading-6 text-slate-700 outline-none focus-visible:ring-0',
          fillHeight && 'flex-1',
        )}
      />
    </div>
  )
}

// ─── SHARED MENU ───
type NoteCardMenuProps = {
  onOpenFocus: () => void
  onUnlink: () => void
  onDelete: () => void
  hideOpenFocus?: boolean
}

const NoteCardMenu = ({ onOpenFocus, onUnlink, onDelete, hideOpenFocus }: NoteCardMenuProps) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('tasks.notes.menu')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="w-[200px] rounded-[14px] border border-[#3a3733]/8 p-1 shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
      >
        {!hideOpenFocus ? (
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenFocus() }}
            className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] hover:bg-[color:var(--surface-hover)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('tasks.notes.openInNotes')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => { setOpen(false); onUnlink() }}
          className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] hover:bg-[color:var(--surface-hover)]"
        >
          <Link2Off className="h-3.5 w-3.5" />
          {t('tasks.notes.unlink')}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); onDelete() }}
          className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('tasks.notes.deleteNote')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

export default TaskNotesPanel
