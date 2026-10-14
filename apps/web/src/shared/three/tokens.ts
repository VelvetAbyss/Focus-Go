import { hex, type Rgb } from './surface'

let probe: CanvasRenderingContext2D | null | undefined

/**
 * Any CSS colour as display-space floats, by painting one pixel: hex, rgb(),
 * hsl() (the ambient scenes define their tokens as hsl(var(...))), oklch() and
 * the rest, or a bare "h s% l%" / "r g b" triple. Null when it isn't a colour
 * or there's no canvas to paint on.
 */
const resolveColor = (value: string): Rgb | null => {
  const canCheck = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
  const bare = value.includes('%') ? `hsl(${value})` : `rgb(${value})`
  const color = canCheck ? [value, bare].find((candidate) => CSS.supports('color', candidate)) : value
  if (!color) return null
  if (probe === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    try {
      probe = canvas.getContext('2d', { willReadFrequently: true })
    } catch {
      probe = null
    }
  }
  if (!probe) return null
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return a === 0 ? null : [r / 255, g / 255, b / 255]
}

/** Reads a design token from :root as display-space floats, or the fallback (a hex colour). */
export const readTokenRgb = (name: string, fallback: string): Rgb => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(raw)) {
    return hex(raw.length === 4 ? `#${raw.slice(1).split('').map((c) => c + c).join('')}` : raw)
  }
  return (raw && resolveColor(raw)) || hex(fallback)
}
