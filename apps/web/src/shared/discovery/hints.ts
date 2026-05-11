import type { TranslationKey } from '../i18n/types'

export type HintRegion = 'tasks' | 'projects' | 'dashboard' | 'focus' | 'sidebar'

export interface HintDef {
  /** Unique stable ID — also used as localStorage key suffix */
  readonly id: string
  /** Higher number = shown first when stacking */
  readonly priority: number
  readonly region: HintRegion
  readonly i18nKey: TranslationKey
}

export const HINTS = {
  'task-detail': {
    id: 'task-detail',
    priority: 100,
    region: 'tasks',
    i18nKey: 'discovery.hint.taskDetail',
  },
  'focus-noise': {
    id: 'focus-noise',
    priority: 80,
    region: 'focus',
    i18nKey: 'discovery.hint.focusNoise',
  },
  'analytics-tab': {
    id: 'analytics-tab',
    priority: 60,
    region: 'tasks',
    i18nKey: 'discovery.hint.analyticsTab',
  },
} as const satisfies Record<string, HintDef>

export type HintId = keyof typeof HINTS

export const HINT_IDS = Object.keys(HINTS) as HintId[]
