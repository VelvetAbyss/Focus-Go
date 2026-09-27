import { useEffect, useRef } from 'react'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { emitTasksChanged, subscribeTasksChanged } from './taskSync'
import { reminderQueueStore } from './reminderQueueStore'
import type { TaskItem } from './tasks.types'

const POLL_INTERVAL_MS = 30_000
// setTimeout overflows past ~24.8 days; far-off reminders re-arm from a shorter wait.
const MAX_TIMEOUT_MS = 6 * 60 * 60 * 1000

const sortByReminderAt = (tasks: TaskItem[]) =>
  tasks
    .slice()
    .filter((task) => typeof task.reminderAt === 'number')
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0))

/** When the next unfired reminder is due (lead time applied), or null if none. */
export const getNextReminderDueAt = (tasks: TaskItem[], leadMs: number): number | null => {
  let next: number | null = null
  for (const task of tasks) {
    if (typeof task.reminderAt !== 'number' || typeof task.reminderFiredAt === 'number') continue
    const dueAt = task.reminderAt - leadMs
    if (next === null || dueAt < next) next = dueAt
  }
  return next
}

const fireDesktopNotification = (task: TaskItem) => {
  if (typeof window === 'undefined') return
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  // The in-app reminder covers a focused window; anything else (hidden tab, window behind
  // another app) needs the system notification or the reminder goes unseen.
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  try {
    const notification = new Notification(task.title.trim() || 'Task reminder', {
      body: task.progressNote?.trim() || task.description?.trim() || 'Task reminder',
      tag: `task-reminder-${task.id}`,
      requireInteraction: true,
    })
    notification.onclick = () => {
      try {
        window.focus()
      } catch {
        // ignore
      }
      notification.close()
    }
  } catch (error) {
    console.warn('[useTaskReminderEngine] notification failed', error)
  }
}

export const useTaskReminderEngine = () => {
  const pageActivity = usePageActivity()
  const { taskReminderEnabled, taskReminderLeadMinutes } = usePreferences()
  const tasksRef = useRef<TaskItem[]>([])
  const loadTokenRef = useRef(0)

  useEffect(() => {
    const leadMs = Math.max(1, taskReminderLeadMinutes) * 60 * 1000
    let nextTimeoutId: number | null = null

    // One timeout aimed at the next due reminder, armed whether or not the page is
    // visible: the interval below only runs while the window is focused, and a reminder
    // that waits for you to come back defeats its purpose.
    const scheduleNext = () => {
      if (nextTimeoutId !== null) window.clearTimeout(nextTimeoutId)
      nextTimeoutId = null
      if (!taskReminderEnabled) return
      const dueAt = getNextReminderDueAt(tasksRef.current, leadMs)
      if (dueAt === null) return
      const wait = Math.min(MAX_TIMEOUT_MS, Math.max(0, dueAt - Date.now()) + 50)
      nextTimeoutId = window.setTimeout(() => {
        nextTimeoutId = null
        void runTick().then(scheduleNext)
      }, wait)
    }

    const loadTasks = async () => {
      const token = loadTokenRef.current + 1
      loadTokenRef.current = token
      const items = await tasksRepo.list()
      if (loadTokenRef.current !== token) return
      tasksRef.current = sortByReminderAt(items)
      scheduleNext()
    }

    const runTick = async () => {
      if (!taskReminderEnabled) return

      const now = Date.now()
      const dueTasks = tasksRef.current.filter((task) => {
        if (typeof task.reminderAt !== 'number') return false
        if (typeof task.reminderFiredAt === 'number') return false
        return now >= task.reminderAt - leadMs
      })
      if (dueTasks.length === 0) return

      let firedCount = 0
      for (const task of dueTasks) {
        const updatedTask: TaskItem = { ...task, reminderFiredAt: now }
        await tasksRepo.update(updatedTask)
        firedCount += 1
        reminderQueueStore.enqueue(updatedTask)
        fireDesktopNotification(updatedTask)
      }

      if (firedCount > 0) {
        tasksRef.current = tasksRef.current.map((task) =>
          dueTasks.some((due) => due.id === task.id) ? { ...task, reminderFiredAt: now } : task
        )
        emitTasksChanged('task-reminder-fired')
      }
    }

    void loadTasks().then(() => {
      if (pageActivity === 'visible') void runTick()
    })
    const intervalId = pageActivity === 'visible'
      ? window.setInterval(() => {
        void runTick()
      }, POLL_INTERVAL_MS)
      : null
    const unsubscribe = subscribeTasksChanged(() => {
      void loadTasks()
    })

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId)
      if (nextTimeoutId !== null) window.clearTimeout(nextTimeoutId)
      unsubscribe()
    }
  }, [pageActivity, taskReminderEnabled, taskReminderLeadMinutes])
}
