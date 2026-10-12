import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Dialog from '../../../shared/ui/Dialog'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaskTrashEntry } from '../../../data/models/types'
import { TASK_TRASH_RETENTION_MS } from '../../../data/repositories/taskTrashRepo'
import { TASK_STATUS_CONFIG } from './taskPresentation'

const DAY_MS = 24 * 60 * 60 * 1000

type Props = {
  open: boolean
  entries: TaskTrashEntry[]
  onClose: () => void
  onRestore: (entry: TaskTrashEntry) => void
  onDiscard: (entry: TaskTrashEntry) => void
  onEmpty: () => void
}

/** Recently deleted tasks: restore one, delete one for good, or empty the lot. Deleting asks twice. */
const TaskTrashDialog = ({ open, entries, onClose, onRestore, onDiscard, onEmpty }: Props) => {
  const { t } = useI18n()
  // The id whose delete button is waiting for its second click; 'all' for emptying.
  const [arming, setArming] = useState<string | null>(null)
  // Ages are read as of opening; a dialog left open doesn't need to tick.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (open) setNow(Date.now())
    else setArming(null)
  }, [open])

  const deletedLabel = (deletedAt: number) => {
    const days = Math.floor((now - deletedAt) / DAY_MS)
    if (days < 1) return t('tasks.trash.deletedToday')
    if (days === 1) return t('tasks.trash.deletedYesterday')
    return t('tasks.trash.deletedDaysAgo', { count: days })
  }

  return (
    <Dialog open={open} title={t('tasks.trash.title')} onClose={onClose} contentClassName="task-trash">
      <p className="task-trash__note">{t('tasks.trash.description')}</p>
      {entries.length === 0 ? (
        <p className="task-trash__empty">{t('tasks.trash.empty')}</p>
      ) : (
        <ul className="task-trash__list">
          {entries.map((entry) => {
            const daysLeft = Math.ceil((entry.deletedAt + TASK_TRASH_RETENTION_MS - now) / DAY_MS)
            const status = TASK_STATUS_CONFIG[entry.task.status]
            return (
              <li key={entry.id} className="task-trash__row">
                <div className="task-trash__text">
                  <span className="task-trash__title">{entry.task.title.trim() || t('tasks.untitled')}</span>
                  <span className="task-trash__meta">
                    {deletedLabel(entry.deletedAt)}
                    {status ? ` · ${t(status.labelKey)}` : ''}
                    {daysLeft <= 3 ? ` · ${t('tasks.trash.daysLeft', { count: Math.max(daysLeft, 1) })}` : ''}
                  </span>
                </div>
                <button type="button" className="task-trash__action" onClick={() => onRestore(entry)}>
                  <RotateCcw className="size-3" aria-hidden />
                  {t('tasks.trash.restore')}
                </button>
                <button
                  type="button"
                  className="task-trash__action task-trash__action--danger"
                  onClick={() => {
                    if (arming !== entry.id) return setArming(entry.id)
                    setArming(null)
                    onDiscard(entry)
                  }}
                  onBlur={() => setArming((current) => (current === entry.id ? null : current))}
                >
                  <Trash2 className="size-3" aria-hidden />
                  {arming === entry.id ? t('tasks.trash.confirmDiscard') : t('tasks.trash.discard')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="dialog__actions">
        {entries.length > 0 ? (
          <Button
            variant="ghost"
            type="button"
            className="task-trash__empty-all"
            onClick={() => {
              if (arming !== 'all') return setArming('all')
              setArming(null)
              onEmpty()
            }}
            onBlur={() => setArming((current) => (current === 'all' ? null : current))}
          >
            {arming === 'all' ? t('tasks.trash.confirmEmpty', { count: entries.length }) : t('tasks.trash.emptyAll')}
          </Button>
        ) : null}
        <Button variant="outline" type="button" onClick={onClose}>
          {t('tasks.trash.close')}
        </Button>
      </div>
    </Dialog>
  )
}

export default TaskTrashDialog
