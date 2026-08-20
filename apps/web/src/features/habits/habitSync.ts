type HabitChangeReason =
  | 'create'
  | 'update'
  | 'archive'
  | 'restore'
  | 'complete'
  | 'undo'
  | 'reorder'

type HabitChangedDetail = {
  reason: HabitChangeReason
}

const HABITS_CHANGED_EVENT = 'focusgo:habits:changed'

export const emitHabitsChanged = (reason: HabitChangeReason) => {
  window.dispatchEvent(new CustomEvent<HabitChangedDetail>(HABITS_CHANGED_EVENT, { detail: { reason } }))
}

export const subscribeHabitsChanged = (listener: (detail: HabitChangedDetail) => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<HabitChangedDetail>
    listener(customEvent.detail)
  }
  window.addEventListener(HABITS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(HABITS_CHANGED_EVENT, handler)
}
