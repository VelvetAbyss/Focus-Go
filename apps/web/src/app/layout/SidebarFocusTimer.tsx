import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { useSharedFocusTimer } from '../../features/focus/useSharedFocusTimer'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'
import { useAuthGate } from '../../features/auth/AuthGateContext'
import SidebarControlIcon from './SidebarControlIcon'

type Props = { collapsed: boolean }

const FOCUS_MODES = [
  { id: 'pomodoro', labelKey: 'focus.pomodoro' as TranslationKey, minutes: 25 },
  { id: 'deep-work', labelKey: 'focus.deepWork' as TranslationKey, minutes: 50 },
  { id: 'sprint', labelKey: 'focus.sprint' as TranslationKey, minutes: 15 },
  { id: 'flow', labelKey: 'focus.flow' as TranslationKey, minutes: 90 },
] as const

type FocusModeId = (typeof FOCUS_MODES)[number]['id']

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const closestModeId = (minutes: number): FocusModeId => {
  return FOCUS_MODES.reduce((best, mode) =>
    Math.abs(mode.minutes - minutes) < Math.abs(best.minutes - minutes) ? mode : best
  , FOCUS_MODES[0]).id
}

const SidebarFocusTimer = ({ collapsed }: Props) => {
  const { t } = useI18n()
  const { requireAuth } = useAuthGate()
  const { state, start, pause, resume, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: 25 })
  const [activeMode, setActiveMode] = useState<FocusModeId>(() => closestModeId(state.durationMinutes))

  useEffect(() => {
    setActiveMode(closestModeId(state.durationMinutes))
  }, [state.durationMinutes])

  const minutes = Math.floor(state.remainingSeconds / 60)
  const seconds = state.remainingSeconds % 60
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const totalSeconds = Math.max(1, state.durationMinutes * 60)
  const progress = Math.max(0, Math.min(1, 1 - state.remainingSeconds / totalSeconds))
  const isRunning = state.running
  const isPaused = state.status === 'paused'

  const handlePrimary = () => {
    requireAuth(() => {
      if (isRunning) { void pause(); return }
      if (isPaused) { void resume(); return }
      void start(clampDuration(state.durationMinutes))
    })
  }

  const handleModeChange = (id: FocusModeId) => {
    const mode = FOCUS_MODES.find((m) => m.id === id)
    if (!mode) return
    requireAuth(() => {
      setActiveMode(mode.id)
      void setDuration(clampDuration(mode.minutes))
    })
  }

  const primaryAriaLabel = isRunning ? t('focus.pause') : isPaused ? t('focus.resume') : t('focus.startFocus')

  const circumference = 2 * Math.PI * 12
  const ring = (size: number) => (
    <svg className="sidebar-timer-mini__ring" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" className="sidebar-timer-mini__ring-track" />
      <circle cx="14" cy="14" r="12" className="sidebar-timer-mini__ring-fill"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        transform="rotate(-90 14 14)" />
    </svg>
  )
  const active = isRunning || isPaused

  // Expanded: a timer icon (a progress ring once started) in the nav's icon
  // column, the time on the label line, the mode as a picker, play at the end.
  return (
    <div className={`sidebar-timer-mini${isRunning ? ' is-running' : ''}${isPaused ? ' is-paused' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar-tool__row">
        {collapsed ? (
          <button type="button" className="sidebar-timer-mini__toggle" onClick={handlePrimary}
            aria-label={primaryAriaLabel} aria-pressed={isRunning} title={primaryAriaLabel}>
            {ring(32)}
            <SidebarControlIcon active={isRunning} size={13} />
          </button>
        ) : (
          <>
            <span className="sidebar-tool__icon" aria-hidden="true">{active ? ring(17) : <Timer />}</span>
            <span className="sidebar-timer-mini__time-text sidebar-reveal">{timeText}</span>
            <select
              className="sidebar-tool__select sidebar-timer-mini__mode-select sidebar-reveal"
              value={activeMode}
              aria-label={t('focus.modes')}
              title={t('focus.modes')}
              onChange={(event) => handleModeChange(event.target.value as FocusModeId)}
            >
              {FOCUS_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>{t(mode.labelKey)}</option>
              ))}
            </select>
            <button type="button" className="sidebar-tool__play" onClick={handlePrimary}
              aria-label={primaryAriaLabel} aria-pressed={isRunning} title={primaryAriaLabel}>
              <SidebarControlIcon active={isRunning} size={15} />
            </button>
          </>
        )}
      </div>
      {collapsed ? <span className="sidebar-timer-mini__compact-time" aria-hidden="true">{timeText}</span> : null}
    </div>
  )
}

export default SidebarFocusTimer
