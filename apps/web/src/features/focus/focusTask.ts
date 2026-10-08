import { useEffect, useState } from 'react'
import { tasksRepo } from '../../data/repositories/tasksRepo'

/**
 * The task the focus timer is working on ("专注于：写周报").
 *
 * Chosen from a task (drawer › 专注), shown on the focus page, and recorded on every
 * session started while it's set. It stays until cleared or the task is done, so
 * several pomodoros in a row count toward the same task.
 */
const FOCUS_TASK_KEY = 'focusgo.pendingTaskId'
const FOCUS_TASK_EVENT = 'focus:task-updated'

export const readFocusTaskId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage.getItem(FOCUS_TASK_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export const setFocusTaskId = (taskId: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (taskId) window.localStorage.setItem(FOCUS_TASK_KEY, taskId)
    else window.localStorage.removeItem(FOCUS_TASK_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(FOCUS_TASK_EVENT))
}

export type FocusTask = { id: string; title: string }

/** The current focus task with its title; clears itself when the task is gone or done. */
export const useFocusTask = (): FocusTask | null => {
  const [taskId, setTaskId] = useState(readFocusTaskId)
  const [task, setTask] = useState<FocusTask | null>(null)

  useEffect(() => {
    const sync = () => setTaskId(readFocusTaskId())
    window.addEventListener(FOCUS_TASK_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FOCUS_TASK_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    void tasksRepo.list().then((items) => {
      if (cancelled) return
      const found = items.find((item) => item.id === taskId)
      if (!found || found.status === 'done' || found.status === 'dropped') {
        setFocusTaskId(null)
        return
      }
      setTask({ id: found.id, title: found.title })
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  return taskId && task?.id === taskId ? task : null
}
