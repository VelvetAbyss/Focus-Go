export type ToggleWindowLike = {
  isVisible: () => boolean
  hide: () => void
  show: () => void
  focus: () => void
}

export const toggleWindowVisibility = (target: ToggleWindowLike) => {
  if (target.isVisible()) {
    target.hide()
    return
  }
  target.show()
  target.focus()
}
