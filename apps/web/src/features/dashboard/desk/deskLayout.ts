// Where things stand on the masthead desk (world units, the desk at y = 0) and
// how big the scene may be drawn. Shared by the host, which sizes the canvas,
// and the scene, which builds the props; no three.js here.
import type { DeskFloor } from './lampKinematics'
import type { DeskDrink } from './deskTypes'

export const DESK_LAYOUT = {
  /** The cup and saucer (or the glass), left of the book. */
  drinkX: -1.8,
  /** The open book (or the laptop), in the middle under the lamp. */
  itemX: 0,
  /** The lamp's base, right of the book. */
  lampX: 1.95,
  /** The composition spans this much of the desk, x from -2.4 to 2.5. */
  width: 5,
  /** Room above the desk: the lamp's elbow stands about 1.6 high. */
  height: 2.45,
} as const

/** CSS px between the canvas bottom and the desk line, so outlines resting
 *  on the toolbar rule aren't clipped. */
export const DESK_LINE_INSET = 3.5

/** CSS px per world unit: at most this, and the desk hides below the minimum. */
export const DESK_UNIT_MAX = 60
export const DESK_UNIT_MIN = 42

export const deskFloor = (drink: DeskDrink): DeskFloor => (x) => {
  if (Math.abs(x - DESK_LAYOUT.itemX) < 1.0) return 0.34
  if (Math.abs(x - DESK_LAYOUT.drinkX) < 0.55) return drink === 'coffee' ? 0.62 : 0.8
  if (Math.abs(x - DESK_LAYOUT.lampX) < 0.45) return 0.16
  return 0.04
}
