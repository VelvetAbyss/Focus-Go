import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Brain,
  Infinity as InfinityIcon,
  Minus,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  Timer,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Card from '../../shared/ui/Card'
import { useSharedFocusTimer } from './useSharedFocusTimer'
import { useSharedNoise } from './SharedNoiseProvider'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'
import { usePremiumGate } from '../premium/PremiumProvider'
import { useAuthGate } from '../auth/AuthGateContext'
import PremiumMark from '../premium/PremiumMark'
import { useTodayFocusStats } from './useTodayFocusStats'
import { useMotionPreference } from '../../shared/prefs/useMotionPreference'
import { NOISE_TRACKS } from './noise'
import type { NoiseSettings, NoiseTrackId, NoiseTrackSettings } from '../../data/models/types'
import FocusSettingsDrawer from './FocusSettingsDrawer'
import { focusRepo } from '../../data/repositories/focusRepo'

const DAILY_TARGET = 4
const RING_RADIUS = 86
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const clampBreakMinutes = (value: number) => {
  if (!Number.isFinite(value)) return 5
  const stepped = Math.round(value / 5) * 5
  return Math.max(5, Math.min(120, stepped))
}

const FOCUS_MODES = [
  { id: 'pomodoro', labelKey: 'focus.pomodoro' as TranslationKey, minutes: 25, icon: Timer },
  { id: 'deep-work', labelKey: 'focus.deepWork' as TranslationKey, minutes: 50, icon: Brain },
  { id: 'sprint', labelKey: 'focus.sprint' as TranslationKey, minutes: 15, icon: Rocket },
  { id: 'flow', labelKey: 'focus.flow' as TranslationKey, minutes: 90, icon: InfinityIcon },
] as const

type FocusModeId = (typeof FOCUS_MODES)[number]['id']

const getClosestModeId = (minutes: number): FocusModeId => {
  const matched = FOCUS_MODES.reduce((best, current) => {
    const currentDistance = Math.abs(current.minutes - minutes)
    const bestDistance = Math.abs(best.minutes - minutes)
    return currentDistance < bestDistance ? current : best
  }, FOCUS_MODES[0])
  return matched.id
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const shouldReduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const withViewTransition = async (action: () => Promise<void>) => {
  if (typeof document === 'undefined' || shouldReduceMotion()) {
    await action()
    return
  }
  const viewTransitionDocument = document as Document & {
    startViewTransition?: (callback: () => Promise<void>) => { finished: Promise<void> }
  }
  if (!viewTransitionDocument.startViewTransition) {
    await action()
    return
  }
  await viewTransitionDocument.startViewTransition(action).finished
}

const springPress = (element: HTMLElement | null) => {
  if (!element || shouldReduceMotion()) return
  element.animate(
    [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(1px) scale(0.965)' },
      { transform: 'translateY(0) scale(1)' },
    ],
    { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  )
}

function RollingDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const moveDown = digit > prevDigit
  return (
    <div className="focus-card-lite__digit-shell">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: moveDown ? '100%' : '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: moveDown ? '-100%' : '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="focus-card-lite__digit-char"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

function TimerDisplay({ timeText }: { timeText: string }) {
  const prevRef = useRef(timeText)
  const prev = prevRef.current
  const chars = timeText.split('')
  const prevChars = prev.split('')

  useEffect(() => {
    prevRef.current = timeText
  }, [timeText])

  return (
    <div className="focus-card-lite__digits">
      {chars.map((char, index) =>
        char === ':' ? (
          <motion.span
            key={`colon-${index}`}
            className="focus-card-lite__colon"
            animate={{ opacity: [0.2, 0.45, 0.2] }}
            transition={{ repeat: 9999, duration: 2, ease: 'easeInOut' }}
          >
            :
          </motion.span>
        ) : (
          <RollingDigit key={`digit-${index}`} digit={char} prevDigit={prevChars[index] || char} />
        )
      )}
    </div>
  )
}

function CircularProgressRing({
  progress,
  status,
  reduceMotion,
  children,
}: {
  progress: number
  status: 'idle' | 'running' | 'paused' | 'completed'
  reduceMotion: boolean
  children: ReactNode
}) {
  const offset = RING_CIRCUMFERENCE * (1 - progress)
  const stateClass =
    status === 'paused' ? ' is-paused' : status === 'completed' ? ' is-complete' : ''
  return (
    <div className={`focus-card-lite__ring-wrap${stateClass}`}>
      <svg
        className="focus-card-lite__ring"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${Math.round(progress * 100)}%`}
      >
        <circle className="focus-card-lite__ring-track" cx="100" cy="100" r={RING_RADIUS} />
        <motion.circle
          className="focus-card-lite__ring-progress"
          cx="100"
          cy="100"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
          }
        />
      </svg>
      <div className="focus-card-lite__ring-center">{children}</div>
    </div>
  )
}

type TopStatsStripProps = {
  sessionsToday: number
  focusMinutesToday: number
  streakDays: number
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

function TopStatsStrip({ sessionsToday, focusMinutesToday, streakDays, t }: TopStatsStripProps) {
  return (
    <div className="focus-card-lite__stats">
      <span className="focus-card-lite__stats-label">{t('focus.todayLabel')}</span>
      <span className="focus-card-lite__stats-divider" aria-hidden />
      <span className="focus-card-lite__stat">
        {t('focus.sessionsToday', { count: sessionsToday })}
      </span>
      <span className="focus-card-lite__stats-divider" aria-hidden />
      <span className="focus-card-lite__stat">
        {t('focus.minutesFocusedShort', { count: focusMinutesToday })}
      </span>
      {streakDays > 0 ? (
        <>
          <span className="focus-card-lite__stats-divider" aria-hidden />
          <span
            className="focus-card-lite__stat focus-card-lite__stat--streak"
            aria-label={t('focus.streakShort', { n: streakDays })}
          >
            <span className="focus-card-lite__stat-flame" aria-hidden>
              ✦
            </span>
            {t('focus.streakShort', { n: streakDays })}
          </span>
        </>
      ) : null}
    </div>
  )
}

type EndsAtReadoutProps = {
  statusLabel: string
  status: 'idle' | 'running' | 'paused' | 'completed'
  mode: 'ends-at' | 'remaining'
  endsAtText: string
  remainingText: string
  onToggle: () => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

function EndsAtReadout({
  statusLabel,
  status,
  mode,
  endsAtText,
  remainingText,
  onToggle,
  t,
}: EndsAtReadoutProps) {
  const showProjection = status === 'running'
  const statusClass =
    status === 'running'
      ? ' is-running'
      : status === 'paused'
        ? ' is-paused'
        : status === 'completed'
          ? ' is-complete'
          : ''
  return (
    <button
      type="button"
      className="focus-card-lite__endsat"
      onClick={showProjection ? onToggle : undefined}
      disabled={!showProjection}
      aria-label={
        showProjection
          ? mode === 'ends-at'
            ? t('focus.endsAt', { time: endsAtText })
            : t('focus.remainingLong', { time: remainingText })
          : statusLabel
      }
    >
      <span className={`focus-card-lite__endsat-status${statusClass}`}>
        <span className="focus-card-lite__status-dot" aria-hidden />
        {statusLabel}
      </span>
      {showProjection ? (
        <span className="focus-card-lite__endsat-time">
          {mode === 'ends-at'
            ? t('focus.endsAt', { time: endsAtText })
            : t('focus.remainingLong', { time: remainingText })}
        </span>
      ) : null}
    </button>
  )
}

type QuickAdjustChipsProps = {
  disabled: boolean
  onAdjust: (delta: number) => void
  t: (key: TranslationKey) => string
}

function QuickAdjustChips({ disabled, onAdjust, t }: QuickAdjustChipsProps) {
  return (
    <div className="focus-card-lite__adjust">
      <button
        type="button"
        className="focus-card-lite__adjust-chip"
        onClick={() => onAdjust(5)}
        disabled={disabled}
        aria-label={t('focus.addFive')}
      >
        <Plus size={10} aria-hidden />
        <span>5</span>
      </button>
      <button
        type="button"
        className="focus-card-lite__adjust-chip"
        onClick={() => onAdjust(-5)}
        disabled={disabled}
        aria-label={t('focus.subtractFive')}
      >
        <Minus size={10} aria-hidden />
        <span>5</span>
      </button>
    </div>
  )
}

type SessionTimelineProps = {
  completed: number
  target: number
  completedTimes: number[]
  bloomKey: number | null
  reduceMotion: boolean
  t: (key: TranslationKey) => string
}

function SessionTimeline({
  completed,
  target,
  completedTimes,
  bloomKey,
  reduceMotion,
  t,
}: SessionTimelineProps) {
  const totalDots = Math.max(target, completed, 1)
  const dots = Array.from({ length: totalDots }, (_, index) => index < completed)
  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div
      className="focus-card-lite__timeline"
      role="group"
      aria-label={t('focus.sessionTimeline')}
    >
      {dots.map((isDone, index) => (
        <span
          key={index}
          className="focus-card-lite__timeline-dot"
          data-state={isDone ? 'done' : 'pending'}
          title={isDone && completedTimes[index] ? formatTime(completedTimes[index]) : undefined}
        >
          {isDone && index === completed - 1 && bloomKey !== null && !reduceMotion ? (
            <AnimatePresence>
              <motion.span
                key={bloomKey}
                className="focus-card-lite__timeline-bloom"
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden
              />
            </AnimatePresence>
          ) : null}
        </span>
      ))}
    </div>
  )
}

type SoundStripProps = {
  noise: NoiseSettings
  enabledTrackLabels: string[]
  whiteNoiseLocked: boolean
  onToggle: () => void
  sliderRef: React.RefObject<HTMLDivElement | null>
  onSliderMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

function SoundStrip({
  noise,
  enabledTrackLabels,
  whiteNoiseLocked,
  onToggle,
  sliderRef,
  onSliderMouseDown,
  t,
}: SoundStripProps) {
  const volumePercent = Math.round(noise.masterVolume * 100)
  return (
    <div className="focus-card-lite__sound-band--dense">
      <button
        type="button"
        className={`focus-card-lite__noise-play-raw${noise.playing ? ' is-playing' : ''}`}
        onPointerDown={(event) => springPress(event.currentTarget)}
        onClick={onToggle}
        aria-label={noise.playing ? t('focus.pauseNoise') : t('focus.playNoise')}
      >
        {noise.playing ? <Pause size={13} /> : <Play size={13} />}
        {whiteNoiseLocked ? (
          <PremiumMark variant="dot" className="focus-card-lite__premium-dot" />
        ) : null}
      </button>

      <div className={`focus-card-lite__eq focus-card-lite__eq--mini ${noise.playing ? 'is-active' : ''}`} aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            style={
              {
                '--eq-delay': `${index * 100}ms`,
                '--eq-gain': `${0.5 + index * 0.12}`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <span
        className="focus-card-lite__nowplaying"
        title={
          enabledTrackLabels.length
            ? t('focus.nowPlaying', { tracks: enabledTrackLabels.join(' · ') })
            : undefined
        }
      >
        {enabledTrackLabels.length ? enabledTrackLabels.join(' · ') : t('focus.volume')}
      </span>

      <div
        ref={sliderRef}
        className="focus-card-lite__volume-track-raw focus-card-lite__volume-track-raw--thin"
        onMouseDown={onSliderMouseDown}
        role="slider"
        aria-label={t('focus.masterVolume')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volumePercent}
      >
        <div
          className="focus-card-lite__volume-fill-raw"
          style={{ width: `${noise.masterVolume * 100}%` }}
        />
        <div
          className="focus-card-lite__volume-thumb-raw"
          style={{ left: `${noise.masterVolume * 100}%` }}
        />
      </div>

      <span className="focus-card-lite__volume-percent">{volumePercent}%</span>
    </div>
  )
}

const FocusCardAlmanac = () => {
  const { t } = useI18n()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const { requireAuth } = useAuthGate()
  const { reduceMotion } = useMotionPreference()
  const [activeMode, setActiveMode] = useState<FocusModeId>('pomodoro')
  const [readoutMode, setReadoutMode] = useState<'ends-at' | 'remaining'>('ends-at')
  const [editingDuration, setEditingDuration] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [breakMinutes, setBreakMinutesState] = useState(5)
  const [longBreakMinutes, setLongBreakMinutesState] = useState(15)
  const [bloomKey, setBloomKey] = useState<number | null>(null)
  const {
    noise,
    setNoise,
    setNoiseMasterVolume,
    toggleNoisePlaying,
    setNoiseTrackEnabled,
    setNoiseTrackVolume,
  } = useSharedNoise()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({
    defaultDurationMinutes: 25,
  })
  const todayStats = useTodayFocusStats()
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const editorInputRef = useRef<HTMLInputElement | null>(null)
  const lastCompletedRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveMode(getClosestModeId(timerState.durationMinutes))
  }, [timerState.durationMinutes])

  useEffect(() => {
    let cancelled = false
    const loadBreaks = async () => {
      const settings = await focusRepo.get()
      if (cancelled) return
      setBreakMinutesState(settings?.breakMinutes ?? 5)
      setLongBreakMinutesState(settings?.longBreakMinutes ?? 15)
    }
    void loadBreaks()
    return () => {
      cancelled = true
    }
  }, [])

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const [endsAtBaseMs, setEndsAtBaseMs] = useState(0)

  useEffect(() => {
    if (timerState.status === 'running') {
      setEndsAtBaseMs(Date.now())
    }
  }, [timerState.status, timerState.remainingSeconds])

  const endsAtText = useMemo(() => {
    if (timerState.status !== 'running' || !endsAtBaseMs) return ''
    const at = endsAtBaseMs + timerState.remainingSeconds * 1000
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }, [endsAtBaseMs, timerState.status, timerState.remainingSeconds])

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!draggingRef.current || !sliderRef.current) return
      const rect = sliderRef.current.getBoundingClientRect()
      const next = clamp01((event.clientX - rect.left) / rect.width)
      setNoiseMasterVolume(next)
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setNoiseMasterVolume])

  useEffect(() => {
    if (!todayStats.lastCompletedAt) return
    if (lastCompletedRef.current === todayStats.lastCompletedAt) return
    if (lastCompletedRef.current !== null) {
      setBloomKey(todayStats.lastCompletedAt)
    }
    lastCompletedRef.current = todayStats.lastCompletedAt
  }, [todayStats.lastCompletedAt])

  const handlePrimaryAction = useCallback(() => {
    requireAuth(() => {
      void withViewTransition(async () => {
        if (timerState.running) {
          await pause()
          return
        }
        if (timerState.status === 'paused') {
          await resume()
          return
        }
        await start(clampDuration(timerState.durationMinutes))
      })
    })
  }, [pause, requireAuth, resume, start, timerState.durationMinutes, timerState.running, timerState.status])

  const handleModeChange = useCallback(
    (modeId: FocusModeId) => {
      const mode = FOCUS_MODES.find((item) => item.id === modeId)
      if (!mode) return
      requireAuth(() => {
        void withViewTransition(async () => {
          setActiveMode(mode.id)
          await setDuration(clampDuration(mode.minutes))
        })
      })
    },
    [requireAuth, setDuration]
  )

  const handleAdjustDuration = useCallback(
    (delta: number) => {
      if (timerState.running) return
      requireAuth(() => {
        void setDuration(clampDuration(timerState.durationMinutes + delta))
      })
    },
    [requireAuth, setDuration, timerState.durationMinutes, timerState.running]
  )

  const handleBeginEdit = useCallback(() => {
    if (timerState.running) return
    setEditValue(String(timerState.durationMinutes))
    setEditingDuration(true)
  }, [timerState.durationMinutes, timerState.running])

  const handleCommitEdit = useCallback(() => {
    const parsed = Number.parseInt(editValue, 10)
    if (Number.isFinite(parsed)) {
      requireAuth(() => {
        void setDuration(clampDuration(parsed))
      })
    }
    setEditingDuration(false)
  }, [editValue, requireAuth, setDuration])

  useEffect(() => {
    if (editingDuration && editorInputRef.current) {
      editorInputRef.current.focus()
      editorInputRef.current.select()
    }
  }, [editingDuration])

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return
      const key = event.key
      if (key === ' ') {
        event.preventDefault()
        handlePrimaryAction()
        return
      }
      if (key === 'r' || key === 'R') {
        requireAuth(() => {
          void reset()
        })
        return
      }
      if (key >= '1' && key <= '4') {
        const idx = Number.parseInt(key, 10) - 1
        handleModeChange(FOCUS_MODES[idx].id)
        return
      }
      if (key === '+' || key === '=') {
        handleAdjustDuration(5)
        return
      }
      if (key === '-' || key === '_') {
        handleAdjustDuration(-5)
      }
    },
    [handleAdjustDuration, handleModeChange, handlePrimaryAction, requireAuth, reset]
  )

  const primaryActionLabel = timerState.running
    ? t('focus.pause')
    : timerState.status === 'paused'
      ? t('focus.resume')
      : t('focus.startFocus')

  const statusLabel =
    timerState.status === 'paused'
      ? t('focus.paused')
      : timerState.status === 'running'
        ? t('focus.focusing')
        : timerState.status === 'completed'
          ? t('focus.sessionComplete')
          : t('focus.readyToFocus')

  const progress = Math.max(
    0,
    Math.min(1, 1 - timerState.remainingSeconds / (Math.max(1, timerState.durationMinutes) * 60))
  )
  const whiteNoiseLocked = !canUse('focus.white-noise').allowed

  const enabledTrackLabels = useMemo(
    () =>
      NOISE_TRACKS.filter((track) => noise.tracks[track.id]?.enabled).map((track) => track.label),
    [noise.tracks]
  )

  const handleSliderMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!canUse('focus.white-noise').allowed) {
        openUpgradeModal('button', 'focus.white-noise')
        return
      }
      requireAuth(() => {
        draggingRef.current = true
        if (!sliderRef.current) return
        const rect = sliderRef.current.getBoundingClientRect()
        const next = clamp01((event.clientX - rect.left) / rect.width)
        setNoiseMasterVolume(next)
      })
    },
    [canUse, openUpgradeModal, requireAuth, setNoiseMasterVolume]
  )

  const handleNoiseToggle = useCallback(() => {
    if (!canUse('focus.white-noise').allowed) {
      openUpgradeModal('button', 'focus.white-noise')
      return
    }
    requireAuth(() => toggleNoisePlaying())
  }, [canUse, openUpgradeModal, requireAuth, toggleNoisePlaying])

  const persistBreaks = useCallback(async (next: { breakMinutes?: number; longBreakMinutes?: number }) => {
    const existing = await focusRepo.get()
    await focusRepo.upsert({
      focusMinutes: existing?.focusMinutes ?? timerState.durationMinutes,
      breakMinutes: next.breakMinutes ?? existing?.breakMinutes ?? 5,
      longBreakMinutes: next.longBreakMinutes ?? existing?.longBreakMinutes ?? 15,
      noise: existing?.noise,
      noisePreset: existing?.noisePreset,
      volume: existing?.volume,
      timer: existing?.timer,
    })
  }, [timerState.durationMinutes])

  const setBreakMinutes = useCallback(
    (value: number) => {
      const next = clampBreakMinutes(value)
      setBreakMinutesState(next)
      void persistBreaks({ breakMinutes: next })
    },
    [persistBreaks]
  )

  const setLongBreakMinutes = useCallback(
    (value: number) => {
      const next = clampBreakMinutes(value)
      setLongBreakMinutesState(next)
      void persistBreaks({ longBreakMinutes: next })
    },
    [persistBreaks]
  )

  const setFocusMinutesDrawer = useCallback(
    (value: number) => {
      void setDuration(clampDuration(value))
    },
    [setDuration]
  )

  const setNoiseTrack = useCallback(
    (trackId: NoiseTrackId, patch: Partial<NoiseTrackSettings>) => {
      if (patch.enabled !== undefined) setNoiseTrackEnabled(trackId, patch.enabled)
      if (patch.volume !== undefined) setNoiseTrackVolume(trackId, patch.volume)
    },
    [setNoiseTrackEnabled, setNoiseTrackVolume]
  )

  const containerVariants = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 1 },
        show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
      }

  const itemVariants = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const } },
      }

  return (
    <Card className="focus-card-figma-shell" title={t('focus.center')} eyebrow={t('focus.pomodoro')}>
      <div
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={handleCardKeyDown}
        className="focus-card-lite focus-card-lite--misted focus-card-lite--dense"
      >
        <motion.div
          className="focus-card-lite__body focus-card-lite__body--dense"
          variants={containerVariants}
          initial={reduceMotion ? false : 'hidden'}
          animate={reduceMotion ? undefined : 'show'}
        >
          <motion.div variants={itemVariants}>
            <TopStatsStrip
              sessionsToday={todayStats.sessionsToday}
              focusMinutesToday={todayStats.focusMinutesToday}
              streakDays={todayStats.streakDays}
              t={t}
            />
          </motion.div>
          <hr className="focus-card-lite__hairline" aria-hidden />

          <motion.section className="focus-card-lite__modes-band" variants={itemVariants}>
            <div
              className="focus-card-lite__modes focus-card-lite__modes--dense"
              role="tablist"
              aria-label={t('focus.modes')}
            >
              {FOCUS_MODES.map((mode) => {
                const isActive = activeMode === mode.id
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    key={mode.id}
                    className={`focus-card-lite__mode-pill${isActive ? ' is-active' : ''}`}
                    data-running={isActive && timerState.running ? 'true' : 'false'}
                    onClick={() => handleModeChange(mode.id)}
                  >
                    <mode.icon size={12} className="focus-card-lite__mode-icon" aria-hidden />
                    <span>{t(mode.labelKey)}</span>
                    <sub className="focus-card-lite__mode-dur">{mode.minutes}m</sub>
                  </button>
                )
              })}
            </div>
          </motion.section>

          <motion.section className="focus-card-lite__hero" variants={itemVariants}>
            <EndsAtReadout
              statusLabel={statusLabel}
              status={timerState.status}
              mode={readoutMode}
              endsAtText={endsAtText}
              remainingText={timeText}
              onToggle={() =>
                setReadoutMode((prev) => (prev === 'ends-at' ? 'remaining' : 'ends-at'))
              }
              t={t}
            />
            <CircularProgressRing
              progress={progress}
              status={timerState.status}
              reduceMotion={reduceMotion}
            >
              {editingDuration ? (
                <input
                  ref={editorInputRef}
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  className="focus-card-lite__duration-input"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onBlur={handleCommitEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleCommitEdit()
                    } else if (event.key === 'Escape') {
                      setEditingDuration(false)
                    }
                  }}
                  aria-label={t('focus.editDuration')}
                />
              ) : (
                <button
                  type="button"
                  className="focus-card-lite__timer-raw focus-card-lite__timer-button"
                  onClick={handleBeginEdit}
                  disabled={timerState.running}
                  aria-label={t('focus.editDuration')}
                >
                  <TimerDisplay timeText={timeText} />
                </button>
              )}
            </CircularProgressRing>
            <QuickAdjustChips
              disabled={timerState.running}
              onAdjust={handleAdjustDuration}
              t={t}
            />
          </motion.section>

          <motion.div variants={itemVariants}>
            <SessionTimeline
              completed={todayStats.completedToday}
              target={DAILY_TARGET}
              completedTimes={todayStats.recentCompletedTimes}
              bloomKey={bloomKey}
              reduceMotion={reduceMotion}
              t={t}
            />
          </motion.div>

          <motion.section className="focus-card-lite__actions-band" variants={itemVariants}>
            <div className="focus-card-lite__actions-raw">
              <button
                type="button"
                className={`focus-card-lite__primary-raw${timerState.running ? ' is-running' : ''}`}
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={handlePrimaryAction}
                aria-label={primaryActionLabel}
              >
                {timerState.running ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                type="button"
                className="focus-card-lite__reset-raw"
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={() =>
                  requireAuth(() => {
                    void reset()
                  })
                }
                aria-label={t('focus.reset')}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className="focus-card-lite__cog-raw"
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={() => setSettingsOpen(true)}
                aria-label={t('focus.settings')}
              >
                <Settings size={14} />
              </button>
            </div>
          </motion.section>

          <motion.div variants={itemVariants}>
            <SoundStrip
              noise={noise}
              enabledTrackLabels={enabledTrackLabels}
              whiteNoiseLocked={whiteNoiseLocked}
              onToggle={handleNoiseToggle}
              sliderRef={sliderRef}
              onSliderMouseDown={handleSliderMouseDown}
              t={t}
            />
          </motion.div>
        </motion.div>
      </div>

      <FocusSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        focusMinutes={timerState.durationMinutes}
        breakMinutes={breakMinutes}
        longBreakMinutes={longBreakMinutes}
        setFocusMinutes={setFocusMinutesDrawer}
        setBreakMinutes={setBreakMinutes}
        setLongBreakMinutes={setLongBreakMinutes}
        noise={noise}
        setNoise={setNoise}
        setNoiseTrack={setNoiseTrack}
        setNoiseMasterVolume={setNoiseMasterVolume}
      />
    </Card>
  )
}

export default FocusCardAlmanac
