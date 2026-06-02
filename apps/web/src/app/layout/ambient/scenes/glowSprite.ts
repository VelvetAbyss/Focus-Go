/**
 * Pre-render a soft radial-alpha glow to an offscreen canvas once, so hot loops
 * can `drawImage` it instead of calling `createRadialGradient` + `arc` + `fill`
 * every frame.
 *
 * The sprite encodes the glow's colour at full alpha in the centre fading to
 * transparent at the edge — identical to the live gradient `rgba(rgb, A) →
 * rgba(rgb, 0)`. Drawing it with `globalAlpha = A` reproduces the original
 * pixels exactly (a square sprite is fine: the gradient already reaches 0 alpha
 * at the mid-edge, so the corners are transparent like the circle fill).
 */
export const makeRadialGlowSprite = (rgb: string, size = 256): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) return null
  const half = size / 2
  const grad = g.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, `rgba(${rgb}, 1)`)
  grad.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return canvas
}

/**
 * Draw a cached glow sprite centred at (x, y) with visual radius r and the given
 * alpha. Equivalent to filling a radial gradient of radius r. No-op if sprite
 * is null (SSR / context failure → caller should fall back).
 */
export const drawGlow = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement | null,
  x: number,
  y: number,
  r: number,
  alpha: number,
): boolean => {
  if (!sprite || alpha <= 0 || r <= 0) return sprite != null
  const prev = ctx.globalAlpha
  ctx.globalAlpha = alpha
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = prev
  return true
}
