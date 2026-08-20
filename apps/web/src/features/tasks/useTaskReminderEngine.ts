import { useEffect, useRef } from 'react'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { emitTasksChanged, subscribeTasksChanged } from './taskSync'
import { reminderQueueStore } from './reminderQueueStore'
import type { TaskItem } from './tasks.types'

const POLL_INTERVAL_MS = 30_000

const sortByReminderAt = (tasks: TaskItem[]) =>
  tasks
    .slice()
    .filter((task) => typeof task.reminderAt === 'number')
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0))

const fireDesktopNotification = (task: TaskItem) => {
  if (typeof window === 'undefined') return
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
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
    const loadTasks = async () => {
      const token = loadTokenRef.current + 1
      loadTokenRef.current = token
      const items = await tasksRepo.list()
      if (loadTokenRef.current !== token) return
      tasksRef.current = sortByReminderAt(items)
    }

    const runTick = async () => {
      if (!taskReminderEnabled) return

      const now = Date.now()
      const leadMs = Math.max(1, taskReminderLeadMinutes) * 60 * 1000
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
      unsubscribe()
    }
  }, [pageActivity, taskReminderEnabled, taskReminderLeadMinutes])
}
