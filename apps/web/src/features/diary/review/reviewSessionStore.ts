import { useCallback, useEffect, useMemo, useState } from 'react'
import { toDateKey } from '../../../shared/utils/time'

const REVIEW_SESSION_STORAGE_KEY = 'focusgo.review.session.v2'

export type ReviewAnswerValue = string | number | boolean | null
export type ReviewAnswers = Record<string, ReviewAnswerValue>

export type ReviewStepContext = {
  answers: ReviewAnswers
}

export type ReviewStepRule = {
  id: string
  canProceed?: (context: ReviewStepContext) => boolean
}

export type ReviewSessionState = {
  currentStep: number
  answers: ReviewAnswers
  isComplete: boolean
}

type PersistedReviewSession = {
  version: 2
  dateKey: string
  state: ReviewSessionState
}

const isLocalStorageAvailable = () => {
  if (typeof window === 'undefined') return false
  try {
    return typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

const clampStep = (step: number, totalSteps: number) => {
  if (totalSteps <= 0) return 0
  if (step < 0) return 0
  if (step > totalSteps - 1) return totalSteps - 1
  return step
}

const buildInitialSessionState = (): ReviewSessionState => ({
  currentStep: 0,
  answers: {},
  isComplete: false,
})

const normalizeAnswers = (value: unknown): ReviewAnswers => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const output: ReviewAnswers = {}
  Object.entries(source).forEach(([key, fieldValue]) => {
    if (
      typeof fieldValue === 'string' ||
      typeof fieldValue === 'number' ||
      typeof fieldValue === 'boolean' ||
      fieldValue === null
    ) {
      output[key] = fieldValue
    }
  })
  return output
}

const parsePersistedSession = (
  raw: string | null,
  dateKey: string,
  totalSteps: number
): ReviewSessionState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedReviewSession
    if (!parsed || parsed.version !== 2) return null
    if (parsed.dateKey !== dateKey) return null
    if (!parsed.state || typeof parsed.state !== 'object') return null

    return {
      currentStep: clampStep(
        typeof parsed.state.currentStep === 'number' ? parsed.state.currentStep : 0,
        totalSteps
      ),
      answers: normalizeAnswers(parsed.state.answers),
      isComplete: parsed.state.isComplete === true,
    }
  } catch {
    return null
  }
}

const readSession = (dateKey: string, totalSteps: number): ReviewSessionState => {
  if (!isLocalStorageAvailable()) return buildInitialSessionState()
  const raw = window.localStorage.getItem(REVIEW_SESSION_STORAGE_KEY)
  const parsed = parsePersistedSession(raw, dateKey, totalSteps)
  return parsed ?? buildInitialSessionState()
}

const writeSession = (dateKey: string, session: ReviewSessionState) => {
  if (!isLocalStorageAvailable()) return
  const payload: PersistedReviewSession = {
    version: 2,
    dateKey,
    state: session,
  }
  window.localStorage.setItem(REVIEW_SESSION_STORAGE_KEY, JSON.stringify(payload))
}

const canProceedForStep = (
  stepRules: ReviewStepRule[],
  stepIndex: number,
  answers: ReviewAnswers
) => {
  const safeIndex = clampStep(stepIndex, stepRules.length)
  const activeRule = stepRules[safeIndex]
  if (!activeRule) return true
  if (!activeRule.canProceed) return true
  return activeRule.canProceed({ answers })
}

export const useReviewSessionStore = (stepRules: ReviewStepRule[]) => {
  const totalSteps = stepRules.length
  const todayKey = useMemo(() => toDateKey(), [])
  const [state, setState] = useState<ReviewSessionState>(() => readSession(todayKey, totalSteps))

  useEffect(() => {
    writeSession(todayKey, {
      ...state,
      currentStep: clampStep(state.currentStep, totalSteps),
    })
  }, [state, todayKey, totalSteps])

  const canProceed = useMemo(
    () => canProceedForStep(stepRules, state.currentStep, state.answers),
    [state.answers, state.currentStep, stepRules]
  )

  const goNext = useCallback(() => {
    let moved = false
    setState((prev) => {
      if (!canProceedForStep(stepRules, prev.currentStep, prev.answers)) return prev
      const nextStep = clampStep(prev.currentStep + 1, totalSteps)
      moved = nextStep !== prev.currentStep
      return {
        ...prev,
        currentStep: nextStep,
      }
    })
    return moved
  }, [stepRules, totalSteps])

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: clampStep(prev.currentStep - 1, totalSteps),
    }))
  }, [totalSteps])

  const goToStep = useCallback(
    (targetIndex: number) => {
      setState((prev) => ({
        ...prev,
        currentStep: clampStep(targetIndex, totalSteps),
      }))
    },
    [totalSteps]
  )

  const updateAnswer = useCallback((key: string, value: ReviewAnswerValue) => {
    setState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [key]: value,
      },
    }))
  }, [])

  const patchAnswers = useCallback((nextValues: Partial<ReviewAnswers>) => {
    setState((prev) => {
      const sanitizedEntries = Object.entries(nextValues).filter(
        (entry): entry is [string, ReviewAnswerValue] => entry[1] !== undefined
      )
      return {
        ...prev,
        answers: {
          ...prev.answers,
          ...Object.fromEntries(sanitizedEntries),
        },
      }
    })
  }, [])

  const submitReview = useCallback(() => {
    let submitted = false
    setState((prev) => {
      if (!canProceedForStep(stepRules, prev.currentStep, prev.answers)) return prev
      submitted = true
      return {
        ...prev,
        isComplete: true,
      }
    })
    return submitted
  }, [stepRules])

  const restartReview = useCallback(() => {
    setState(buildInitialSessionState())
  }, [])

  return {
    state,
    totalSteps,
    canProceed,
    goNext,
    goBack,
    goToStep,
    updateAnswer,
    patchAnswers,
    submitReview,
    restartReview,
  }
}
