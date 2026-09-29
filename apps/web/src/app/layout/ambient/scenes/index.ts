import { createThreeStrategy } from '../three/threeStrategy'
import type { AmbientThreeModule } from '../three/types'
import { createCozyFiresideScene } from './cozy-fireside'
import { createIdleScene } from './idle'
import { createOceanBreezeScene } from './ocean-breeze'
import { createRainyCafeScene } from './rainy-cafe'
import { createStormyNightScene } from './stormy-night'
import type { SceneId, SceneStrategy } from './types'

// The four sound scenes are three.js paintings, loaded on first use so the
// renderer never ships in the entry chunk. Their original 2D canvas versions
// stay as the fallback when WebGL can't start. With no sound scene playing
// the desk gets window light (three.js too, the 2D paper wash as fallback);
// 'idle' is the plain paper wash when that option is off.
const load = (importer: () => Promise<AmbientThreeModule>) => importer

export const createSceneStrategy = (scene: SceneId): SceneStrategy => {
  switch (scene) {
    case 'rainy-cafe':
      return createThreeStrategy(load(() => import('../three/rainyCafe')), createRainyCafeScene)
    case 'stormy-night':
      return createThreeStrategy(load(() => import('../three/stormyNight')), createStormyNightScene)
    case 'ocean-breeze':
      return createThreeStrategy(load(() => import('../three/oceanBreeze')), createOceanBreezeScene)
    case 'cozy-fireside':
      return createThreeStrategy(load(() => import('../three/cozyFireside')), createCozyFiresideScene)
    case 'window-light':
      return createThreeStrategy(load(() => import('../three/windowLight')), createIdleScene)
    case 'idle':
    default:
      return createIdleScene()
  }
}

export type { SceneId, SceneStrategy } from './types'
