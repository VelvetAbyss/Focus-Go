import { useLayoutEffect, useRef } from 'react'

/** Keep page panels in the viewport while retaining their editor theme/zoom context. */
export const useNotePanelBounds = (open: boolean, id: string) => {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const panel = ref.current
    const parent = panel?.offsetParent instanceof HTMLElement ? panel.offsetParent : null
    if (!open || !panel || !parent) return
    const place = () => {
      const owner = parent.getBoundingClientRect()
      const sx = parent.offsetWidth ? owner.width / parent.offsetWidth : 1
      const sy = parent.offsetHeight ? owner.height / parent.offsetHeight : 1
      const trigger = document.querySelector<HTMLElement>(`.note-editor [data-note-panel-trigger="${id}"]`)
      const top = Math.max(12, Math.min(trigger?.getBoundingClientRect().bottom ?? owner.top + 56 * sy, window.innerHeight - 120)) + 8
      panel.style.top = `${(top - owner.top) / sy}px`
      panel.style.right = `${Math.max(12, (owner.right - window.innerWidth + 12) / sx)}px`
      panel.style.maxWidth = `${Math.max(0, Math.min(owner.width - 24 * sx, window.innerWidth - 24) / sx)}px`
      panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - 12) / sy}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(parent)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [id, open])
  return ref
}
