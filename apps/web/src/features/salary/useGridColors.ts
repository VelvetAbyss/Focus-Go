import { useMemo } from 'react'
import { useThemeMode } from '../../shared/theme/useThemeMode'
import type { GridColors } from './three/gridTypes'

const toHex = (rgb: string, fallback: string) => {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb)
  if (!match) return fallback
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
}

/** A token resolved through the cascade, as '#rrggbb' for the shader. */
const readToken = (name: string, fallback: string) => {
  const probe = document.createElement('span')
  probe.style.color = `var(${name}, ${fallback})`
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return toHex(color, fallback)
}

/** Ink, pencil and pen for the time grid, re-read when the theme changes. */
export const useGridColors = () => {
  const dark = useThemeMode() === 'dark'
  return useMemo<GridColors>(
    () => ({
      ink: readToken('--ink-2', dark ? '#c8c1b7' : '#5e5a54'),
      pencil: readToken('--pencil-line', dark ? '#8a847a' : '#948e84'),
      pen: readToken('--accent', dark ? '#7edbc7' : '#1b4f4a'),
    }),
    [dark],
  )
}
