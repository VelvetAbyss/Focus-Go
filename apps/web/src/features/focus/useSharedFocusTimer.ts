import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusTimerSnapshot, FocusTimerStatus } from '../../data/models/types'
import { focusRepo } from '../../data/repositories/focusRepo'

const FOCUS_TIMER_EVENT = 'focus:timer-updated'
const SESSION_KEY = 'focusgo.timer.sessionId'

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const clampRemaining = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

const randomSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const getOrCreateSessionId = () => {
  const existing = window.sessionStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const next = randomSessionId()
  window.sessionStorage.setItem(SESSION_KEY, next)
  return next
}

const buildIdleSnapshot = (durationMinutes: number, sessionId: string): FocusTimerSnapshot => ({
  status: 'idle',
  durationMinutes,
  remainingSeconds: durationMinutes * 60,
  activeSessionId: null,
  sessionId,
})

const deriveRemainingSeconds = (snapshot: FocusTimerSnapshot, now: number) => {
  if (snapshot.status !== 'running' || !snapshot.endsAt) return clampRemaining(snapshot.remainingSeconds)
  return Math.max(0, Math.ceil((snapshot.endsAt - now) / 1000))
}

const normalizeSnapshot = (
  timer: FocusTimerSnapshot | null | undefined,
  fallbackDurationMinutes: number,
  sessionId: string,
  now: number
): FocusTimerSnapshot => {
  const fallbackDuration = clampDuration(fallbackDurationMinutes)
  if (!timer) return buildIdleSnapshot(fallbackDuration, sessionId)

  const durationMinutes = clampDuration(timer.durationMinutes || fallbackDuration)
  const base: FocusTimerSnapshot = {
    ...timer,
    durationMinutes,
    sessionId: timer.sessionId ?? sessionId,
  }

  if (base.status === 'running') {
    if (base.sessionId !== sessionId) {
      return buildIdleSnapshot(durationMinutes, sessionId)
    }
    const remainingSeconds = deriveRemainingSeconds(base, now)
    return {
      ...base,
      remainingSeconds,
      activeSessionId: base.activeSessionId ?? null,
    }
  }

  if (base.status === 'paused' || base.status === 'completed' || base.status === 'idle') {
    return {
      ...base,
      remainingSeconds: clampRemaining(base.remainingSeconds || durationMinutes * 60),
      activeSessionId: base.activeSessionId ?? null,
    }
  }

  return buildIdleSnapshot(durationMinutes, sessionId)
}

export type SharedFocusTimerState = {
  status: FocusTimerStatus
  durationMinutes: number
  remainingSeconds: number
  activeSessionId: string | null
  lastCompletedAt?: number
  running: boolean
}

type UseSharedFocusTimerOptions = {
  defaultDurationMinutes: number
}

export const useSharedFocusTimer = ({ defaultDurationMinutes }: UseSharedFocusTimerOptions) => {
  const sessionIdRef = useRef<string | null>(null)
  const completingRef = useRef(false)
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot>(() => ({
    status: 'idle',
    durationMinutes: clampDuration(defaultDurationMinutes),
    remainingSeconds: clampDuration(defaultDurationMinutes) * 60,
    activeSessionId: null,
  }))
  const snapshotRef = useRef(snapshot)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const emitTimerUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent(FOCUS_TIMER_EVENT))
  }, [])

  const persistSnapshot = useCallback(async (next: FocusTimerSnapshot) => {
    await focusRepo.updateTimer(next)
  }, [])

  const loadFromStorage = useCallback(async () => {
    const sessionId = sessionIdRef.current ?? getOrCreateSessionId()
    sessionIdRef.current = sessionId
    const settings = await focusRepo.get()
    const next = normalizeSnapshot(settings?.timer, settings?.focusMinutes ?? defaultDurationMinutes, sessionId, Date.now())
    setSnapshot(next)
    if (!settings?.timer || JSON.stringify(settings.timer) !== JSON.stringify(next)) {
      await persistSnapshot(next)
      emitTimerUpdate()
    }
  }, [defaultDurationMinutes, emitTimerUpdate, persistSnapshot])

  const completeIfNeeded = useCallback(async () => {
    const current = snapshotRef.current
    if (completingRef.current) return
    if (current.status !== 'running') return
    const remaining = deriveRemainingSeconds(current, Date.now())
    if (remaining > 0) return

    completingRef.current = true
    try {
      if (current.activeSessionId) {
        await focusRepo.completeSession(current.activeSessionId, {
          actualMinutes: current.durationMinutes,
        })
      }
      const finishedAt = Date.now()
      const next: FocusTimerSnapshot = {
        ...current,
        status: 'completed',
        remainingSeconds: 0,
        activeSessionId: null,
        endsAt: undefined,
        startedAt: undefined,
        pausedAt: finishedAt,
        lastCompletedAt: finishedAt,
        sessionId: sessionIdRef.current ?? current.sessionId,
      }
      setSnapshot(next)
      await persistSnapshot(next)
      emitTimerUpdate()
    } finally {
      completingRef.current = false
    }
  }, [emitTimerUpdate, persistSnapshot])

  useEffect(() => {
    void loadFromStorage()
  }, [loadFromStorage])

  useEffect(() => {
    const onExternalUpdate = () => {
      void loadFromStorage()
    }
    window.addEventListener(FOCUS_TIMER_EVENT, onExternalUpdate)
    return () => window.removeEventListener(FOCUS_TIMER_EVENT, onExternalUpdate)
  }, [loadFromStorage])

  useEffect(() => {
    if (snapshot.status !== 'running') return
    const timer = window.setInterval(() => {
      const current = snapshotRef.current
      const nextRemaining = deriveRemainingSeconds(current, Date.now())
      setSnapshot((prev) => {
        if (prev.status !== 'running') return prev
        if (prev.remainingSeconds === nextRemaining) return prev
        return { ...prev, remainingSeconds: nextRemaining }
      })
      if (nextRemaining <= 0) {
        void completeIfNeeded()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [completeIfNeeded, snapshot.status])

  const start = useCallback(async (durationMinutes: number) => {
    const sessionId = sessionIdRef.current ?? getOrCreateSessionId()
    sessionIdRef.current = sessionId
    const normalizedDuration = clampDuration(durationMinutes)
    const now = Date.now()
    const endsAt = now + normalizedDuration * 60 * 1000
    const existingActiveSessionId = snapshotRef.current.activeSessionId ?? null
    let activeSessionId = existingActiveSessionId
    if (!activeSessionId) {
      const startedSession = await focusRepo.startSession({
        plannedMinutes: normalizedDuration,
      })
      activeSessionId = startedSession.id
    }
    const next: FocusTimerSnapshot = {
      status: 'running',
      durationMinutes: normalizedDuration,
      remainingSeconds: normalizedDuration * 60,
      startedAt: now,
      endsAt,
      pausedAt: undefined,
      activeSessionId,
      sessionId,
      lastCompletedAt: snapshotRef.current.lastCompletedAt,
    }
    setSnapshot(next)
    await persistSnapshot(next)
    emitTimerUpdate()
  }, [emitTimerUpdate, persistSnapshot])

  const pause = useCallback(async () => {
    const current = snapshotRef.current
    if (current.status !== 'running') return
    const now = Date.now()
    const remainingSeconds = deriveRemainingSeconds(current, now)
    const next: FocusTimerSnapshot = {
      ...current,
      status: 'paused',
      remainingSeconds,
      pausedAt: now,
      endsAt: undefined,
      sessionId: sessionIdRef.current ?? current.sessionId,
    }
    setSnapshot(next)
    await persistSnapshot(next)
    emitTimerUpdate()
  }, [emitTimerUpdate, persistSnapshot])

  const resume = useCallback(async () => {
    const current = snapshotRef.current
    const now = Date.now()
    const sessionId = sessionIdRef.current ?? getOrCreateSessionId()
    sessionIdRef.current = sessionId
    const targetDuration = clampDuration(current.durationMinutes || defaultDurationMinutes)
    const resumeSeconds = current.status === 'paused' ? Math.max(1, current.remainingSeconds) : targetDuration * 60
    let activeSessionId = current.activeSessionId ?? null
    if (!activeSessionId) {
      const startedSession = await focusRepo.startSession({
        plannedMinutes: targetDuration,
      })
      activeSessionId = startedSession.id
    }
    const next: FocusTimerSnapshot = {
      ...current,
      status: 'running',
      durationMinutes: targetDuration,
      remainingSeconds: resumeSeconds,
      startedAt: now,
      endsAt: now + resumeSeconds * 1000,
      pausedAt: undefined,
      activeSessionId,
      sessionId,
    }
    setSnapshot(next)
    await persistSnapshot(next)
    emitTimerUpdate()
  }, [defaultDurationMinutes, emitTimerUpdate, persistSnapshot])

  const reset = useCallback(async () => {
    const current = snapshotRef.current
    const sessionId = sessionIdRef.current ?? getOrCreateSessionId()
    sessionIdRef.current = sessionId
    const targetDuration = clampDuration(current.durationMinutes || defaultDurationMinutes)
    const next = buildIdleSnapshot(targetDuration, sessionId)
    setSnapshot(next)
    await persistSnapshot(next)
    emitTimerUpdate()
  }, [defaultDurationMinutes, emitTimerUpdate, persistSnapshot])

  const setDuration = useCallback(async (minutes: number) => {
    const current = snapshotRef.current
    const durationMinutes = clampDuration(minutes)
    const next: FocusTimerSnapshot = {
      ...current,
      durationMinutes,
      remainingSeconds:
        current.status === 'running' ? current.remainingSeconds : durationMinutes * 60,
      sessionId: sessionIdRef.current ?? current.sessionId,
    }
    setSnapshot(next)
    await persistSnapshot(next)
    emitTimerUpdate()
  }, [emitTimerUpdate, persistSnapshot])

  const state = useMemo<SharedFocusTimerState>(() => ({
    status: snapshot.status,
    durationMinutes: snapshot.durationMinutes,
    remainingSeconds: snapshot.remainingSeconds,
    activeSessionId: snapshot.activeSessionId ?? null,
    lastCompletedAt: snapshot.lastCompletedAt,
    running: snapshot.status === 'running',
  }), [snapshot])

  return {
    state,
    start,
    pause,
    resume,
    reset,
    setDuration,
    reload: loadFromStorage,
  }
}

