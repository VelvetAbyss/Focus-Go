import { createCozyFiresideScene } from './cozy-fireside'
import { createIdleScene } from './idle'
import { createOceanBreezeScene } from './ocean-breeze'
import { createRainyCafeScene } from './rainy-cafe'
import { createStormyNightScene } from './stormy-night'
import type { SceneId, SceneStrategy } from './types'

export const createSceneStrategy = (scene: SceneId): SceneStrategy => {
  switch (scene) {
    case 'rainy-cafe':
      return createRainyCafeScene()
    case 'stormy-night':
      return createStormyNightScene()
    case 'ocean-breeze':
      return createOceanBreezeScene()
    case 'cozy-fireside':
      return createCozyFiresideScene()
    case 'idle':
    default:
      return createIdleScene()
  }
}

export type { SceneId, SceneStrategy } from './types'
