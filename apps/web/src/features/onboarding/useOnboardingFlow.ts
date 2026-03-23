import { useSyncExternalStore } from 'react'
import {
  completeOnboarding,
  getOnboardingSnapshot,
  markFeatureSeen,
  resetOnboarding,
  setOnboardingStep,
  setPendingCoachmark,
  skipOnboarding,
  startOnboarding,
  subscribeOnboardingRuntime,
} from './onboarding.runtime'
import type { FeatureSeenKey, OnboardingStep } from './onboarding.types'

export const useOnboardingFlow = () => {
  const state = useSyncExternalStore(subscribeOnboardingRuntime, getOnboardingSnapshot, getOnboardingSnapshot)

  return {
    status: state.status,
    currentStep: state.step,
    featureSeen: state.featureSeen,
    pendingCoachmark: state.pendingCoachmark,
    start: () => startOnboarding(),
    next: (step?: OnboardingStep) => setOnboardingStep(step ?? 'done'),
    complete: () => completeOnboarding(),
    skip: () => skipOnboarding(),
    restart: () => resetOnboarding(),
    markFeatureSeen: (feature: FeatureSeenKey) => markFeatureSeen(feature),
    setPendingCoachmark: (coachmark: 'focus' | 'diary' | null) => setPendingCoachmark(coachmark),
  }
}
