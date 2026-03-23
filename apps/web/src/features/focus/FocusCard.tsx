import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Brain, Infinity, Pause, Play, Rocket, RotateCcw, Timer } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Card from '../../shared/ui/Card'
import { useSharedFocusTimer } from './useSharedFocusTimer'
import { useSharedNoise } from './SharedNoiseProvider'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const FOCUS_MODES = [
  { id: 'pomodoro', label: 'Pomodoro', labelKey: 'focus.pomodoro' as TranslationKey, minutes: 25, icon: Timer },
  { id: 'deep-work', label: 'Deep Work', labelKey: 'focus.deepWork' as TranslationKey, minutes: 50, icon: Brain },
  { id: 'sprint', label: 'Sprint', labelKey: 'focus.sprint' as TranslationKey, minutes: 15, icon: Rocket },
  { id: 'flow', label: 'Flow', labelKey: 'focus.flow' as TranslationKey, minutes: 90, icon: Infinity },
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

const FocusCard = () => {
  const { t } = useI18n()
  const [activeMode, setActiveMode] = useState<FocusModeId>('pomodoro')
  const { noise, setNoiseMasterVolume, toggleNoisePlaying } = useSharedNoise()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: 25 })
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveMode(getClosestModeId(timerState.durationMinutes))
  }, [timerState.durationMinutes])

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

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

  const handlePrimaryAction = async () => {
    await withViewTransition(async () => {
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
  }

  const handleModeChange = async (modeId: FocusModeId) => {
    const mode = FOCUS_MODES.find((item) => item.id === modeId)
    if (!mode) return
    await withViewTransition(async () => {
      setActiveMode(mode.id)
      await setDuration(clampDuration(mode.minutes))
    })
  }

  const primaryActionLabel = timerState.running ? t('focus.pause') : timerState.status === 'paused' ? t('focus.resume') : t('focus.startFocus')
  const statusLabel =
    timerState.status === 'paused'
      ? t('focus.paused')
      : timerState.status === 'running'
        ? t('focus.focusing')
        : t('focus.readyToFocus')

  useEffect(() => {
    if (shouldReduceMotion()) return
    statusRef.current?.animate(
      [
        { opacity: 0.58, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
    timerRef.current?.animate(
      [
        { opacity: 0.82, transform: 'translateY(10px) scale(0.985)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
  }, [statusLabel, activeMode])

  const volumePercent = Math.round(noise.masterVolume * 100)
  const progress = Math.max(0, Math.min(1, 1 - timerState.remainingSeconds / (Math.max(1, timerState.durationMinutes) * 60)))
  const timerRingStyle = { '--focus-progress': `${progress}` } as CSSProperties

  return (
    <Card className="focus-card-figma-shell" title={t('focus.center')} eyebrow={t('focus.pomodoro')}>
      <div className="focus-card-lite focus-card-lite--misted">
        <div className="focus-card-lite__body">
          <section className="focus-card-lite__modes-band">
            <div className="focus-card-lite__modes" role="tablist" aria-label={t('focus.modes')}>
              {FOCUS_MODES.map((mode) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMode === mode.id}
                  key={mode.id}
                  className={`focus-card-lite__mode-pill ${activeMode === mode.id ? 'is-active' : ''}`}
                  onClick={() => void handleModeChange(mode.id)}
                >
                  <mode.icon size={12} className="focus-card-lite__mode-icon" aria-hidden />
                  <span>{t(mode.labelKey)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="focus-card-lite__timer-band">
            <div className="focus-card-lite__timer-ring" style={timerRingStyle} aria-hidden />
            <div ref={statusRef} className={`focus-card-lite__status ${timerState.status === 'running' ? 'is-running' : ''}`}>
              ◉ {statusLabel}
            </div>
            <div ref={timerRef} className="focus-card-lite__timer-raw">
              <TimerDisplay timeText={timeText} />
            </div>
          </section>

          <section className="focus-card-lite__actions-band">
            <div className="focus-card-lite__actions-raw">
              <button
                className="focus-card-lite__primary-raw"
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={() => void handlePrimaryAction()}
              >
                {timerState.running ? <Pause size={15} /> : <Play size={15} />}
                <span>{primaryActionLabel}</span>
              </button>
              <button
                className="focus-card-lite__reset-raw"
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={() => void reset()}
                aria-label={t('focus.reset')}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </section>

          <section className="focus-card-lite__sound-band">
            <div className="focus-card-lite__volume-cluster">
              <button
                className={`focus-card-lite__noise-play-raw ${noise.playing ? 'is-playing' : ''}`}
                onPointerDown={(event) => springPress(event.currentTarget)}
                onClick={toggleNoisePlaying}
                aria-label={noise.playing ? t('focus.pauseNoise') : t('focus.playNoise')}
              >
                {noise.playing ? <Pause size={14} /> : <Play size={14} />}
              </button>

              <div className="focus-card-lite__volume-raw">
                <div className="focus-card-lite__volume-row-raw">
                  <span>{t('focus.masterVolume')}</span>
                  <span>{volumePercent}%</span>
                </div>
                <div
                  ref={sliderRef}
                  className="focus-card-lite__volume-track-raw"
                  onMouseDown={(event) => {
                    draggingRef.current = true
                    if (!sliderRef.current) return
                    const rect = sliderRef.current.getBoundingClientRect()
                    const next = clamp01((event.clientX - rect.left) / rect.width)
                    setNoiseMasterVolume(next)
                  }}
                >
                  <div className="focus-card-lite__volume-fill-raw" style={{ width: `${noise.masterVolume * 100}%` }} />
                  <div className="focus-card-lite__volume-thumb-raw" style={{ left: `${noise.masterVolume * 100}%` }} />
                </div>
              </div>

              <div className={`focus-card-lite__eq ${noise.playing ? 'is-active' : ''}`} aria-hidden>
                {Array.from({ length: 8 }).map((_, index) => (
                  <span
                    key={index}
                    style={
                      {
                        '--eq-delay': `${index * 80}ms`,
                        '--eq-gain': `${0.42 + index * 0.07}`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            </div>

          </section>
        </div>
      </div>
    </Card>
  )
}

export default FocusCard
