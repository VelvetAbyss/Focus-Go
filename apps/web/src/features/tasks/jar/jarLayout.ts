/**
 * Where each jar stands on the canvas. Shared by the three.js scene (to draw)
 * and the React host (to lay its hover/click targets over the shelf), so both
 * agree to the pixel. Pure; no three.js.
 *
 * World units are CSS pixels with the origin at the canvas's bottom-left and y
 * up. A jar is modelled in "jar units" (inner radius 1) and drawn at `scale`
 * pixels per unit, tipped back by JAR_TILT so the mouth reads as an ellipse.
 */

/** How far the jars are tipped towards the viewer, in radians (~15°). */
export const JAR_TILT = 0.26
/** Shoulder and neck above the body, in jar units. */
export const JAR_NECK = 0.46
/** Glass wall: outer radius in jar units. */
export const JAR_OUTER = 1.08
/** Space above the pile in the open (current) jar, in jar units. */
export const JAR_HEADROOM = 0.5
/** The shelf's jars are drawn at this fraction of the main jar. */
export const SHELF_SCALE = 0.5

export type JarSlot = {
  key: string
  /** Centre of the jar's base, canvas px from the left. */
  x: number
  /** Top of the plank the jar stands on, canvas px from the bottom. */
  baseY: number
  /** Pixels per jar unit. */
  scale: number
  /** Tallest the pile may grow, in jar units. */
  maxPile: number
  sealed: boolean
  /** Hover/click target in CSS px from the canvas's top-left. */
  hit: { left: number; top: number; width: number; height: number }
}

export type JarLayout = {
  width: number
  height: number
  main: JarSlot
  shelf: JarSlot[]
  plank: { left: number; right: number; y: number }
}

const PLANK_Y = 9
const TOP_MARGIN = 6
const SHELF_GAP = 12

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Screen height (px) of a jar `units` tall at `scale`, tilt included. */
export const jarScreenHeight = (units: number, scale: number) =>
  units * scale * Math.cos(JAR_TILT) + 2 * JAR_OUTER * scale * Math.sin(JAR_TILT)

const hitFor = (x: number, baseY: number, scale: number, units: number, height: number) => {
  const w = 2 * JAR_OUTER * scale + 6
  const h = jarScreenHeight(units, scale) + 6
  const bottom = baseY - JAR_OUTER * scale * Math.sin(JAR_TILT) - 3
  return { left: x - w / 2, top: height - bottom - h, width: w, height: h }
}

/**
 * Lays out the open jar for `mainKey` on the left and as many of `shelfKeys`
 * (newest first) as fit to its right. `mainSealed` is true when the week on
 * show is already over.
 */
export const layoutJars = (
  width: number,
  height: number,
  mainKey: string,
  mainSealed: boolean,
  shelfKeys: readonly string[],
): JarLayout => {
  const scale = clamp(Math.min(width * 0.1, height * 0.25), 14, 26)
  const x = 6 + JAR_OUTER * scale
  const lip = scale * Math.sin(JAR_TILT) * JAR_OUTER
  // Everything the jar adds above its pile: headroom, neck, lid, the mouth's ellipse.
  const available = height - PLANK_Y - TOP_MARGIN - lip * 2
  const maxPile = Math.max(1, available / (scale * Math.cos(JAR_TILT)) - JAR_HEADROOM - JAR_NECK - 0.2)
  const mainUnits = maxPile + JAR_HEADROOM + JAR_NECK
  const main: JarSlot = {
    key: mainKey,
    x,
    baseY: PLANK_Y,
    scale,
    maxPile,
    sealed: mainSealed,
    hit: hitFor(x, PLANK_Y, scale, mainUnits, height),
  }

  const shelfScale = scale * SHELF_SCALE
  const slot = 2 * JAR_OUTER * shelfScale + SHELF_GAP * 0.75
  const start = x + JAR_OUTER * scale + SHELF_GAP + JAR_OUTER * shelfScale
  const fit = Math.max(0, Math.floor((width - 4 - (start - JAR_OUTER * shelfScale)) / slot))
  const shelf = shelfKeys.slice(0, fit).map((key, index): JarSlot => {
    const sx = start + index * slot
    return {
      key,
      x: sx,
      baseY: PLANK_Y,
      scale: shelfScale,
      maxPile,
      sealed: true,
      hit: hitFor(sx, PLANK_Y, shelfScale, maxPile + JAR_NECK + 0.3, height),
    }
  })

  return { width, height, main, shelf, plank: { left: 2, right: width - 2, y: PLANK_Y } }
}
