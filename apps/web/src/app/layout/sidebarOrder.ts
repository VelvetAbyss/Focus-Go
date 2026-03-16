import { arrayMove } from '@dnd-kit/sortable'

export const SIDEBAR_ORDER_STORAGE_KEY = 'focusgo.sidebar.order.v1'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)

export const readSidebarOrder = () => {
  if (typeof window === 'undefined') return [] as string[]

  try {
    const raw = window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY)
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw) as unknown
    return isStringArray(parsed) ? parsed : []
  } catch {
    return [] as string[]
  }
}

export const writeSidebarOrder = (order: string[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(order))
}

export const mergeSidebarOrder = (savedOrder: string[], knownIds: string[]) => {
  const knownSet = new Set(knownIds)
  const merged = savedOrder.filter((id) => knownSet.has(id))
  knownIds.forEach((id) => {
    if (!merged.includes(id)) merged.push(id)
  })
  return merged
}

export const moveSidebarOrder = (order: string[], activeId: string, overId: string) => {
  const activeIndex = order.indexOf(activeId)
  const overIndex = order.indexOf(overId)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return order
  return arrayMove(order, activeIndex, overIndex)
}
