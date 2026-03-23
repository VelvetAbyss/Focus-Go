import type {
  FeatureSeenKey,
  FeatureSeenState,
  OnboardingState,
  OnboardingStatus,
  OnboardingStep,
  PendingCoachmark,
} from './onboarding.types'

export const ONBOARDING_STATUS_KEY = 'focusgo.onboarding.status'
export const ONBOARDING_STEP_KEY = 'focusgo.onboarding.step'
export const ONBOARDING_FEATURE_SEEN_KEY = 'focusgo.onboarding.feature-seen'
export const ONBOARDING_PENDING_COACHMARK_KEY = 'focusgo.onboarding.pending-coachmark'
export const ONBOARDING_SESSION_KEY = 'focusgo.onboarding.session'
export const ONBOARDING_RUNTIME_EVENT = 'focusgo:onboarding-runtime-change'

const DEFAULT_FEATURE_SEEN: FeatureSeenState = {
  tasks: false,
  focus: false,
  diary: false,
}

let cachedStateString = ''
let cachedState: OnboardingState | null = null

const emitRuntimeChange = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ONBOARDING_RUNTIME_EVENT))
}

const readJson = <T>(key: string, fallback: T) => {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
  emitRuntimeChange()
}

const readStatus = (): OnboardingStatus => {
  if (typeof window === 'undefined') return 'not_started'
  const raw = window.localStorage.getItem(ONBOARDING_STATUS_KEY)
  return raw === 'not_started' || raw === 'in_progress' || raw === 'completed' || raw === 'skipped'
    ? raw
    : 'not_started'
}

const readStep = (): OnboardingStep => {
  if (typeof window === 'undefined') return 'welcome'
  const raw = window.localStorage.getItem(ONBOARDING_STEP_KEY)
  return raw === 'welcome' || raw === 'create_task' || raw === 'done' ? raw : 'welcome'
}

export const getFeatureSeen = (): FeatureSeenState => ({
  ...DEFAULT_FEATURE_SEEN,
  ...readJson<Partial<FeatureSeenState>>(ONBOARDING_FEATURE_SEEN_KEY, DEFAULT_FEATURE_SEEN),
})

export const getPendingCoachmark = (): PendingCoachmark => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(ONBOARDING_PENDING_COACHMARK_KEY)
  return raw === 'focus' || raw === 'diary' ? raw : null
}

export const getOnboardingState = (): OnboardingState => ({
  status: readStatus(),
  step: readStep(),
  featureSeen: getFeatureSeen(),
  pendingCoachmark: getPendingCoachmark(),
})

export const getOnboardingSnapshot = () => {
  const nextState = getOnboardingState()
  const nextString = JSON.stringify(nextState)
  if (cachedState && cachedStateString === nextString) return cachedState
  cachedStateString = nextString
  cachedState = nextState
  return nextState
}

export const setOnboardingStatus = (status: OnboardingStatus) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STATUS_KEY, status)
  emitRuntimeChange()
}

export const setOnboardingStep = (step: OnboardingStep) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STEP_KEY, step)
  emitRuntimeChange()
}

export const startOnboarding = () => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ONBOARDING_SESSION_KEY, '1')
  setOnboardingStatus('in_progress')
  setOnboardingStep('create_task')
}

export const completeOnboarding = () => {
  setOnboardingStep('done')
  setOnboardingStatus('completed')
}

export const skipOnboarding = () => {
  setOnboardingStep('welcome')
  setOnboardingStatus('skipped')
}

export const resetOnboarding = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ONBOARDING_SESSION_KEY)
  }
  setOnboardingStep('welcome')
  setOnboardingStatus('not_started')
  clearPendingCoachmark()
}

export const isFirstRunEligible = () => getOnboardingState().status === 'not_started'

export const markFeatureSeen = (feature: FeatureSeenKey, seen = true) => {
  writeJson(ONBOARDING_FEATURE_SEEN_KEY, {
    ...getFeatureSeen(),
    [feature]: seen,
  })
}

export const setPendingCoachmark = (coachmark: PendingCoachmark) => {
  if (typeof window === 'undefined') return
  if (coachmark) window.localStorage.setItem(ONBOARDING_PENDING_COACHMARK_KEY, coachmark)
  else window.localStorage.removeItem(ONBOARDING_PENDING_COACHMARK_KEY)
  emitRuntimeChange()
}

export const clearPendingCoachmark = () => setPendingCoachmark(null)

export const subscribeOnboardingRuntime = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback()
  window.addEventListener('storage', handler)
  window.addEventListener(ONBOARDING_RUNTIME_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(ONBOARDING_RUNTIME_EVENT, handler)
  }
}
