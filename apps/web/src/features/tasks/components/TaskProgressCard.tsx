import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { History, Sparkles, Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../../../data/models/types'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { emitTasksChanged } from '../taskSync'
import { formatTaskDateTime } from './taskPresentation'

type TaskProgressCardProps = {
  task: TaskItem
  onUpdated: (task: TaskItem) => void
}

export default function TaskProgressCard({ task, onUpdated }: TaskProgressCardProps) {
  const { t } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState<string>(task.progressNote ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const lastSavedRef = useRef<string>(task.progressNote ?? '')

  useEffect(() => {
    setDraft(task.progressNote ?? '')
    lastSavedRef.current = task.progressNote ?? ''
  }, [task.id, task.progressNote])

  // Saving is on blur, but Esc closes the drawer without blurring the textarea.
  // Whatever is still unsaved when this card goes away (or switches task) is kept.
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(() => {
    const taskId = task.id
    return () => {
      const pending = draftRef.current.trim()
      if (pending === lastSavedRef.current.trim()) return
      lastSavedRef.current = pending
      void (async () => {
        // Re-read so a stale copy can't overwrite edits made elsewhere in the drawer.
        const latest = (await tasksRepo.list()).find((item) => item.id === taskId)
        if (!latest) return
        await tasksRepo.setProgressNote(latest, pending)
        emitTasksChanged('task-progress:update')
      })().catch((error) => console.error('[TaskProgressCard] save on close failed', error))
    }
  }, [task.id])

  const history = useMemo(
    () => (task.progressHistory ?? []).slice().sort((a, b) => b.createdAt - a.createdAt),
    [task.progressHistory],
  )

  const commit = useCallback(async () => {
    const next = draft.trim()
    if (next === lastSavedRef.current.trim()) return
    try {
      setSaving(true)
      const updated = await tasksRepo.setProgressNote(task, next)
      lastSavedRef.current = updated.progressNote ?? ''
      onUpdated(updated)
      emitTasksChanged('task-progress:update')
    } catch (error) {
      console.error('[TaskProgressCard] save failed', error)
      toast.push({
        variant: 'error',
        title: t('tasks.drawer.saveFailed'),
        message: t('tasks.drawer.saveFailedHint'),
      })
    } finally {
      setSaving(false)
    }
  }, [draft, onUpdated, task, t, toast])

  const handleRemoveEntry = useCallback(
    async (entryId: string) => {
      try {
        const updated = await tasksRepo.removeProgressEntry(task, entryId)
        onUpdated(updated)
        emitTasksChanged('task-progress:remove')
      } catch (error) {
        console.error('[TaskProgressCard] remove entry failed', error)
      }
    },
    [onUpdated, task],
  )

  const updatedLabel = task.progressNoteUpdatedAt
    ? t('tasks.drawer.progressUpdatedAt', { when: formatTaskDateTime(task.progressNoteUpdatedAt) })
    : ''

  return (
    <section
      className="task-detail-progress tdv2-section-enter rounded-[var(--radius-lg)] border border-rule bg-paper-sunken p-5"
      style={{ animationDelay: '20ms' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-ink-2">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-body font-bold tracking-tight">{t('tasks.drawer.progressTitle')}</h2>
        </div>
        <div className="text-meta text-ink-3">
          {saving ? t('tasks.drawer.progressSaving') : updatedLabel}
        </div>
      </div>

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void commit()
          }
        }}
        placeholder={t('tasks.drawer.progressPlaceholder')}
        className="mt-3 min-h-[88px] resize-y rounded-[var(--radius-md)] border-rule bg-[color-mix(in_srgb,var(--bg-elevated)_80%,transparent)] text-body leading-6 shadow-none focus-visible:border-rule-strong focus-visible:ring-rule-strong"
      />
      <p className="mt-1.5 px-1 text-meta text-ink-3">{t('tasks.drawer.progressSaveHint')}</p>

      {history.length > 0 ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen((value) => !value)}
            className="h-7 gap-1.5 px-2 text-label font-semibold text-ink-2 hover:bg-paper-sunken"
          >
            <History className="h-3.5 w-3.5" />
            {t('tasks.drawer.progressHistoryToggle', { count: history.length })}
          </Button>
          {historyOpen ? (
            <ul className="mt-2 space-y-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    'group rounded-[var(--radius-md)] border border-rule bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-3 py-2 text-ui leading-6',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-[color:var(--text-primary)]">{entry.text}</p>
                    <button
                      type="button"
                      onClick={() => void handleRemoveEntry(entry.id)}
                      aria-label={t('tasks.drawer.progressRemoveEntry')}
                      className="text-ink-3 opacity-0 transition hover:text-tone-urgent group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-meta text-ink-3">{formatTaskDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
