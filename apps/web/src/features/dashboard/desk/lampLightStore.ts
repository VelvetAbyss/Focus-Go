import type { LampBeam } from './deskTypes'

/** The lamp's current light, handed from the scene (every frame it changes) to
 *  the page overlay without going through React state. */
export type LampLightStore = {
  get: () => LampBeam | null
  set: (beam: LampBeam | null) => void
  subscribe: (listener: () => void) => () => void
}

export const createLampLightStore = (): LampLightStore => {
  let beam: LampBeam | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => beam,
    set: (next) => {
      beam = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
