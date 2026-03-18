import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Card from '../../shared/ui/Card'
import { focusRepo } from '../../data/repositories/focusRepo'
import { DEFAULT_NOISE_PRESET } from './noise'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'
import { useMotionPreference } from '../../shared/prefs/useMotionPreference'
import { useSharedFocusTimer } from './useSharedFocusTimer'
import { useSharedNoise } from './SharedNoiseProvider'

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const FocusCard = () => {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [todayStats, setTodayStats] = useState({ minutes: 0, sessions: 0 })
  const { reduceMotion } = useMotionPreference()
  const { noise, toggleNoisePlaying } = useSharedNoise()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: focusMinutes })

  const loadTodayStats = useCallback(async () => {
    const sessions = await focusRepo.listSessions(120)
    const today = new Date().toDateString()
    const completed = sessions.filter((session) => {
      if (session.status !== 'completed') return false
      const stamp = session.completedAt ?? session.updatedAt
      return new Date(stamp).toDateString() === today
    })
    const minutes = completed.reduce((sum, session) => sum + (session.actualMinutes ?? session.plannedMinutes), 0)
    setTodayStats({ minutes, sessions: completed.length })
  }, [])

  useEffect(() => {
    void focusRepo.get().then((settings) => {
      if (!settings) return
      const nextFocusMinutes = clampDuration(settings.focusMinutes)
      setFocusMinutes(nextFocusMinutes)
      void setDuration(nextFocusMinutes)

      if (!settings.noisePreset) {
        void focusRepo.upsert({
          focusMinutes: nextFocusMinutes,
          breakMinutes: settings.breakMinutes,
          longBreakMinutes: settings.longBreakMinutes,
          noisePreset: DEFAULT_NOISE_PRESET,
          timer: settings.timer,
        })
      }
    })
    void loadTodayStats()
  }, [loadTodayStats, setDuration])

  useEffect(() => {
    void loadTodayStats()
  }, [loadTodayStats, timerState.lastCompletedAt])

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const timerTrend = useMemo(() => {
    return (oldValue: number, value: number) => (value >= oldValue ? 1 : -1)
  }, [])

  const handlePrimaryAction = async () => {
    if (timerState.running) {
      await pause()
      return
    }
    if (timerState.status === 'paused') {
      await resume()
      return
    }
    await start(clampDuration(timerState.durationMinutes))
  }

  return (
    <Card title="Focus Center" eyebrow="Pomodoro">
      <div className="focus-card-lite">
        <div className="focus-card-lite__header">
          <div className="focus__mode">Deep focus mode</div>
          <div className="focus-card-lite__stats">
            <span>{todayStats.sessions} sessions</span>
            <span>·</span>
            <span>{todayStats.minutes} min</span>
          </div>
        </div>
        <div className="focus__time focus-card-lite__time">
          <AppNumberGroup>
            <AppNumber value={minutes} trend={timerTrend} />
            <span aria-hidden>:</span>
            <AppNumber value={seconds} trend={timerTrend} format={{ minimumIntegerDigits: 2 }} />
          </AppNumberGroup>
        </div>
        <div className="focus__actions focus-card-lite__actions">
          <Button size="sm" onClick={() => void handlePrimaryAction()}>
            {timerState.running ? 'Pause' : timerState.status === 'paused' ? 'Resume' : 'Start'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void reset()}>
            Reset
          </Button>
        </div>

        <div className="focus__noise focus-card-lite__noise">
          <style>{`
            .noiseTitleRow {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .mini-equalizer {
              display: inline-flex;
              align-items: flex-end;
              gap: 2px;
              height: 10px;
              width: 14px;
            }
            .mini-equalizer span {
              width: 2px;
              background-color: var(--text-secondary);
              border-radius: 2px;
              opacity: 0.6;
              animation: mini-eq-bounce 900ms ease-in-out infinite;
            }
            .mini-equalizer span:nth-child(1) { animation-delay: 0ms; height: 4px; }
            .mini-equalizer span:nth-child(2) { animation-delay: 150ms; height: 8px; }
            .mini-equalizer span:nth-child(3) { animation-delay: 300ms; height: 5px; }

            @keyframes mini-eq-bounce {
              0%, 100% { height: 4px; }
              50% { height: 10px; }
            }

            html[data-motion='reduce'] .mini-equalizer span {
              animation: none;
              height: 6px !important;
            }
          `}</style>
          <div className="focus__noise-meta" style={{ gap: 0 }}>
            <span className="focus__noise-label noiseTitleRow">
              White noise
              {noise.playing && (
                <span className="mini-equalizer" aria-label="Playing" title="Playing">
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </span>
          </div>
          <Button
            className={`noiseBtn noise-icon-toggle ${noise.playing ? 'is-playing' : ''} ${reduceMotion ? 'is-reduced-motion' : ''}`}
            onClick={toggleNoisePlaying}
            aria-label={noise.playing ? 'Pause noise' : 'Play noise'}
          >
            <svg viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg" className="noise-icon-toggle__play" aria-hidden>
              <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
            </svg>
            <svg viewBox="0 0 320 512" xmlns="http://www.w3.org/2000/svg" className="noise-icon-toggle__pause" aria-hidden>
              <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z" />
            </svg>
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default FocusCard
