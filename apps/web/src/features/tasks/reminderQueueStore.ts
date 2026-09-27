import { useSyncExternalStore } from 'react'
import type { TaskItem } from './tasks.types'

type QueuedReminder = {
  taskId: string
  task: TaskItem
  firedAt: number
}

type ReminderQueueState = {
  queue: QueuedReminder[]
}

const state: ReminderQueueState = { queue: [] }
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

export const reminderQueueStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): ReminderQueueState {
    return state
  },
  enqueue(task: TaskItem) {
    if (state.queue.some((entry) => entry.taskId === task.id)) {
      state.queue = state.queue.map((entry) =>
        entry.taskId === task.id ? { ...entry, task, firedAt: Date.now() } : entry,
      )
    } else {
      state.queue = [...state.queue, { taskId: task.id, task, firedAt: Date.now() }]
    }
    emit()
  },
  dismiss(taskId: string) {
    state.queue = state.queue.filter((entry) => entry.taskId !== taskId)
    emit()
  },
  clear() {
    state.queue = []
    emit()
  },
}

// Subscribe to the queue array itself: it is replaced on every change, whereas
// `state` is the same object forever — using it as the snapshot meant React
// never re-rendered on dismiss, so "Got it" left the reminder on screen.
const getQueueSnapshot = () => state.queue

export const useReminderQueue = () => useSyncExternalStore(reminderQueueStore.subscribe, getQueueSnapshot)
