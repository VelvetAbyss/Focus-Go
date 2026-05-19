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
      className="tdv2-section-enter rounded-[26px] border border-amber-300/40 bg-amber-50/40 p-5 shadow-[0_18px_50px_rgba(245,158,11,0.08)]"
      style={{ animationDelay: '20ms' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-amber-700">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-[15px] font-bold tracking-tight">{t('tasks.drawer.progressTitle')}</h2>
        </div>
        <div className="text-[11px] text-amber-700/70">
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
        className="mt-3 min-h-[88px] resize-y rounded-[16px] border-amber-300/50 bg-white/80 text-[14px] leading-6 shadow-none focus-visible:border-amber-400 focus-visible:ring-amber-200"
      />
      <p className="mt-1.5 px-1 text-[11px] text-amber-700/60">{t('tasks.drawer.progressSaveHint')}</p>

      {history.length > 0 ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen((value) => !value)}
            className="h-7 gap-1.5 px-2 text-[12px] font-semibold text-amber-700 hover:bg-amber-100/60"
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
                    'group rounded-[14px] border border-amber-200/60 bg-white/70 px-3 py-2 text-[13px] leading-6',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-[color:var(--text-primary)]">{entry.text}</p>
                    <button
                      type="button"
                      onClick={() => void handleRemoveEntry(entry.id)}
                      aria-label={t('tasks.drawer.progressRemoveEntry')}
                      className="text-amber-700/40 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700/60">{formatTaskDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
