/** Convert viewport measurements to an absolutely positioned editor child's CSS units. */
export const noteLocalRect = (owner: HTMLElement, rect: DOMRect) => {
  const bounds = owner.getBoundingClientRect()
  const scaleX = owner.offsetWidth ? bounds.width / owner.offsetWidth : 1
  const scaleY = owner.offsetHeight ? bounds.height / owner.offsetHeight : 1
  return { left: (rect.left - bounds.left) / scaleX, top: (rect.top - bounds.top) / scaleY,
    width: rect.width / scaleX, height: rect.height / scaleY }
}
