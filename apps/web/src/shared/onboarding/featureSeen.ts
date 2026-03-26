import type { FeatureSeenKey } from '../../features/onboarding/onboarding.types'

export const FEATURE_SEEN_KEYS: FeatureSeenKey[] = ['dashboard', 'tasks', 'focus', 'diary']

export const FEATURE_COACHMARK_ANCHORS: Record<'focus' | 'diary', string[]> = {
  focus: ['[data-coachmark-anchor="tasks-entry"]', '[data-coachmark-anchor="focus-page"]'],
  diary: ['[data-coachmark-anchor="dashboard-diary"]', '[data-coachmark-anchor="diary-page"]'],
}

export const isEveningHour = (date: Date = new Date()) => date.getHours() >= 18
