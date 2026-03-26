// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  completeOnboarding,
  getFeatureSeen,
  getOnboardingState,
  getPendingCoachmark,
  markFeatureSeen,
  resetOnboarding,
  setPendingCoachmark,
  skipOnboarding,
  startOnboarding,
} from './onboarding.runtime'

describe('onboarding runtime', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('starts with default state', () => {
    expect(getOnboardingState()).toEqual({
      status: 'not_started',
      step: 'welcome',
      featureSeen: { dashboard: false, tasks: false, focus: false, diary: false },
      pendingCoachmark: null,
    })
  })

  it('updates start skip complete and reset state', () => {
    startOnboarding()
    expect(getOnboardingState().status).toBe('in_progress')
    expect(getOnboardingState().step).toBe('dashboard_overview')

    skipOnboarding()
    expect(getOnboardingState().status).toBe('skipped')

    completeOnboarding()
    expect(getOnboardingState().status).toBe('completed')
    expect(getOnboardingState().step).toBe('done')

    resetOnboarding()
    expect(getOnboardingState().status).toBe('not_started')
    expect(getOnboardingState().step).toBe('welcome')
  })

  it('stores feature seen and pending coachmark', () => {
    markFeatureSeen('tasks')
    setPendingCoachmark('focus')

    expect(getFeatureSeen().tasks).toBe(true)
    expect(getPendingCoachmark()).toBe('focus')
  })
})
