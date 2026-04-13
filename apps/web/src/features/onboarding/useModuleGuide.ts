import { useSyncExternalStore } from 'react'
import type { ModuleGuideKey } from './moduleGuide.types'
import {
  completeModuleGuide,
  dismissModuleGuide,
  getModuleGuideSnapshot,
  markModuleGuideSeen,
  shouldShowModuleGuide,
  subscribeModuleGuideRuntime,
} from './moduleGuide.runtime'

export const useModuleGuide = () => {
  const state = useSyncExternalStore(subscribeModuleGuideRuntime, getModuleGuideSnapshot, getModuleGuideSnapshot)

  return {
    modules: state.modules,
    shouldShow: (module: ModuleGuideKey) => shouldShowModuleGuide(module),
    markSeen: (module: ModuleGuideKey) => markModuleGuideSeen(module),
    dismiss: (module: ModuleGuideKey) => dismissModuleGuide(module),
    complete: (module: ModuleGuideKey) => completeModuleGuide(module),
  }
}
