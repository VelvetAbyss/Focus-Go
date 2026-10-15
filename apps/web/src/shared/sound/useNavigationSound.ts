import type { MouseEvent } from 'react'
import { useLocation, useResolvedPath } from 'react-router-dom'
import { playInterfaceSound } from './interactionSounds'

export const useNavigationSound = (to: string) => {
  const current = useLocation()
  const target = useResolvedPath(to)
  return (event: MouseEvent<HTMLAnchorElement>, dragging = false) => {
    if (dragging || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
        (event.currentTarget.target && event.currentTarget.target !== '_self')) return
    if (current.pathname === target.pathname && current.search === target.search && current.hash === target.hash) return
    playInterfaceSound()
  }
}
