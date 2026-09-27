import { useLayoutEffect, useRef } from 'react'
import './ActiveIndicator.css'

type ActiveIndicatorProps = {
  /** Selector (relative to the parent element) for the currently selected item. */
  selector?: string
  className?: string
}

const DEFAULT_SELECTOR =
  ':scope > .is-active, :scope > [aria-selected="true"], :scope > [data-state="active"], :scope > [data-state="on"], :scope > [aria-current="page"], :scope > [aria-pressed="true"]'

/** Layout offset of `el` inside `container`, ignoring transforms (a pressed
 *  tab mid-scale must not shrink the pill). */
const offsetWithin = (el: HTMLElement, container: HTMLElement) => {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return node === container ? { x, y } : null
}

/**
 * A pill that glides behind the selected item of a tab bar, segmented control
 * or nav list. Drop it in as the first child of the control's container; it
 * measures the selected sibling and follows it (selection changes, resizes,
 * items added or reordered), so existing markup doesn't need restructuring.
 *
 * The container gets `data-active-indicator`, which lifts siblings above the
 * pill; each control's own stylesheet makes its selected item's background
 * transparent so the pill shows through (see ActiveIndicator.css).
 */
const ActiveIndicator = ({ selector = DEFAULT_SELECTOR, className }: ActiveIndicatorProps) => {
  const ref = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const indicator = ref.current
    const container = indicator?.parentElement
    if (!indicator || !container) return

    // An attribute, not a class: React rewrites className on re-render but
    // leaves attributes it doesn't own alone.
    container.setAttribute('data-active-indicator', '')
    let frame = 0
    let placed = false
    let observedTarget: Element | null = null

    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())

    const place = () => {
      frame = 0
      let target: HTMLElement | null = null
      try {
        target = container.querySelector<HTMLElement>(selector)
      } catch {
        target = null
      }
      if (target === indicator) target = null

      if (observedTarget !== target) {
        if (observedTarget) resize?.unobserve(observedTarget)
        if (target) resize?.observe(target)
        observedTarget = target
      }

      if (!target || target.offsetWidth === 0) {
        indicator.style.opacity = '0'
        return
      }

      const offset = offsetWithin(target, container)
      if (!offset) {
        indicator.style.opacity = '0'
        return
      }
      const { x, y } = offset
      const style = indicator.style
      if (!placed) {
        // First placement: appear in place, don't slide in from the corner.
        style.transition = 'none'
      }
      style.width = `${target.offsetWidth}px`
      style.height = `${target.offsetHeight}px`
      style.transform = `translate3d(${x}px, ${y}px, 0)`
      style.opacity = '1'
      if (!placed) {
        placed = true
        void indicator.offsetWidth
        style.transition = ''
      }
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(place)
    }

    // Selection changes are placed synchronously (MutationObserver runs right
    // after the DOM commit), so the pill starts moving in the same frame the
    // labels change colour — even when the commit also mounts a heavy page.
    const mutations = new MutationObserver(() => {
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      place()
    })
    mutations.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'data-state', 'aria-current', 'aria-pressed', 'hidden'],
    })
    resize?.observe(container)
    place()

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      mutations.disconnect()
      resize?.disconnect()
      container.removeAttribute('data-active-indicator')
    }
  }, [selector])

  return <span ref={ref} aria-hidden="true" className={`ui-active-indicator${className ? ` ${className}` : ''}`} />
}

export default ActiveIndicator
