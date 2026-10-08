import { useCallback } from 'react'
import type { TaskNoteLink } from '../../../data/models/types'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { emitTasksChanged } from '../taskSync'
import type { TaskItem } from '../tasks.types'

// Long enough to notice a mis-click and reach the button; hovering the toast pauses it.
const UNDO_DELETE_MS = 8000

type DeletedTask = { task: TaskItem; links: TaskNoteLink[] }

/**
 * Deletes tasks and offers an undo toast that writes them, and their note links, back.
 * Views pick the change up through `subscribeTasksChanged`.
 */
export const useTaskDeletion = () => {
  const { t } = useI18n()
  const toast = useToast()

  return useCallback(async (tasks: TaskItem[], source: string) => {
    if (tasks.length === 0) return
    const removed: DeletedTask[] = await Promise.all(
      tasks.map(async (task) => ({ task, links: await tasksRepo.remove(task.id) })),
    )
    emitTasksChanged(`${source}:delete`)
    toast.push({
      message: removed.length === 1
        ? t('tasks.deletedToast', { title: removed[0].task.title.trim() || t('tasks.untitled') })
        : t('tasks.deletedManyToast', { count: removed.length }),
      actionLabel: t('tasks.undo'),
      durationMs: UNDO_DELETE_MS,
      onAction: () => {
        void Promise.all(removed.map(({ task, links }) => tasksRepo.restore(task, links)))
          .then(() => emitTasksChanged(`${source}:undo-delete`))
          .catch((error) => {
            console.error('[useTaskDeletion] restore failed', error)
            toast.push({ variant: 'error', message: t('tasks.restoreFailed') })
          })
      },
    })
  }, [t, toast])
}
