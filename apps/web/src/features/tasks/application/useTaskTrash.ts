import { useCallback, useEffect, useState } from 'react'
import type { TaskTrashEntry } from '../../../data/models/types'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { taskTrashRepo } from '../../../data/repositories/taskTrashRepo'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { emitTasksChanged, subscribeTasksChanged } from '../taskSync'

/** This device's recently deleted tasks, kept current as tasks are deleted and restored anywhere. */
export const useTaskTrash = (source: string) => {
  const { t } = useI18n()
  const toast = useToast()
  const [entries, setEntries] = useState<TaskTrashEntry[]>([])

  const refresh = useCallback(async () => {
    try {
      setEntries(await taskTrashRepo.list())
    } catch (error) {
      console.error('[useTaskTrash] list failed', error)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return subscribeTasksChanged(() => {
      void refresh()
    })
  }, [refresh])

  const restore = useCallback(async (entry: TaskTrashEntry) => {
    try {
      await tasksRepo.restoreFromTrash(entry.id)
      emitTasksChanged(`${source}:trash-restore`)
      toast.push({ variant: 'success', message: t('tasks.trash.restored', { title: entry.task.title.trim() || t('tasks.untitled') }) })
    } catch (error) {
      console.error('[useTaskTrash] restore failed', error)
      toast.push({ variant: 'error', message: t('tasks.restoreFailed') })
    }
  }, [source, t, toast])

  const discard = useCallback(async (entry: TaskTrashEntry) => {
    await taskTrashRepo.discard(entry.id)
    await refresh()
  }, [refresh])

  const empty = useCallback(async () => {
    await taskTrashRepo.clear()
    await refresh()
  }, [refresh])

  return { entries, restore, discard, empty }
}
