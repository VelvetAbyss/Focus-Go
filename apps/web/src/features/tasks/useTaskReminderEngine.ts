import { useEffect, useRef } from 'react'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { useToast } from '../../shared/ui/toast/toast'
import { emitTasksChanged, subscribeTasksChanged } from './taskSync'
import type { TaskItem } from './tasks.types'

const POLL_INTERVAL_MS = 30_000

const sortByReminderAt = (tasks: TaskItem[]) =>
  tasks
    .slice()
    .filter((task) => typeof task.reminderAt === 'number')
    .sort((a, b) => (a.reminderAt ?? 0) - (b.reminderAt ?? 0))

export const useTaskReminderEngine = () => {
  const toast = useToast()
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
        toast.push({
          variant: 'info',
          title: 'Task reminder',
          message: task.title.trim() || 'Untitled task',
        })
      }

      if (firedCount > 0) {
        tasksRef.current = tasksRef.current.map((task) =>
          dueTasks.some((due) => due.id === task.id) ? { ...task, reminderFiredAt: now } : task
        )
        emitTasksChanged('task-reminder-fired')
      }
    }

    void loadTasks().then(() => runTick())
    const intervalId = window.setInterval(() => {
      void runTick()
    }, POLL_INTERVAL_MS)
    const unsubscribe = subscribeTasksChanged(() => {
      void loadTasks()
    })

    return () => {
      window.clearInterval(intervalId)
      unsubscribe()
    }
  }, [taskReminderEnabled, taskReminderLeadMinutes, toast])
}
