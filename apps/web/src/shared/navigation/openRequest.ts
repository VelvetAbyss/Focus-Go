import { useEffect, useRef } from 'react'

/**
 * "Open this item" hand-off across routes (⌘K search → /tasks opens the task drawer).
 *
 * The requester stores the id and navigates; the page takes it once its data has
 * loaded. An event covers the case where the page is already mounted.
 */
export type OpenTarget = 'task' | 'note' | 'diary'

const OPEN_REQUEST_EVENT = 'focusgo:open-request'
const keyFor = (target: OpenTarget) => `focusgo.open.${target}`

export const requestOpen = (target: OpenTarget, id: string) => {
  try {
    window.sessionStorage.setItem(keyFor(target), id)
  } catch {
    return
  }
  window.dispatchEvent(new CustomEvent(OPEN_REQUEST_EVENT, { detail: { target } }))
}

export const takeOpenRequest = (target: OpenTarget): string | null => {
  try {
    const id = window.sessionStorage.getItem(keyFor(target))
    if (id) window.sessionStorage.removeItem(keyFor(target))
    return id
  } catch {
    return null
  }
}

/** Calls `onOpen(id)` for a pending request, as soon as `ready` (the page's data is loaded). */
export const useOpenRequest = (target: OpenTarget, ready: boolean, onOpen: (id: string) => void) => {
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    if (!ready) return
    const consume = () => {
      const id = takeOpenRequest(target)
      if (id) onOpenRef.current(id)
    }
    consume()
    const onRequest = (event: Event) => {
      if ((event as CustomEvent<{ target: OpenTarget }>).detail?.target === target) consume()
    }
    window.addEventListener(OPEN_REQUEST_EVENT, onRequest)
    return () => window.removeEventListener(OPEN_REQUEST_EVENT, onRequest)
  }, [ready, target])
}
