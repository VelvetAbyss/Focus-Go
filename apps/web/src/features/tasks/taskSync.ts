export const TASKS_CHANGED_EVENT = 'focusgo:tasks-changed'

type TasksChangedDetail = {
  source: string
}

export const emitTasksChanged = (source: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<TasksChangedDetail>(TASKS_CHANGED_EVENT, { detail: { source } }))
}

export const subscribeTasksChanged = (handler: () => void) => {
  if (typeof window === 'undefined') return () => undefined
  const listener = () => handler()
  window.addEventListener(TASKS_CHANGED_EVENT, listener as EventListener)
  return () => window.removeEventListener(TASKS_CHANGED_EVENT, listener as EventListener)
}
