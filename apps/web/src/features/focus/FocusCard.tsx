import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Card from '../../shared/ui/Card'
import { focusRepo } from '../../data/repositories/focusRepo'
import type { NoiseSettings, NoiseTrackId, NoiseTrackSettings } from '../../data/models/types'
import FocusSettingsDrawer from './FocusSettingsDrawer'
import { createDefaultNoiseSettings, DEFAULT_NOISE_PRESET } from './noise'
import { useNoiseMixer } from './useNoiseMixer'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'
import { useMotionPreference } from '../../shared/prefs/useMotionPreference'
import { useSharedFocusTimer } from './useSharedFocusTimer'

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const FocusCard = () => {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [longBreakMinutes, setLongBreakMinutes] = useState(15)
  const [noise, setNoise] = useState<NoiseSettings>(createDefaultNoiseSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { reduceMotion } = useMotionPreference()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: focusMinutes })

  useNoiseMixer(noise)

  useEffect(() => {
    void focusRepo.get().then((settings) => {
      if (!settings) return
      setFocusMinutes(settings.focusMinutes)
      setBreakMinutes(settings.breakMinutes)
      setLongBreakMinutes(settings.longBreakMinutes)

      const preset = settings.noisePreset ?? DEFAULT_NOISE_PRESET
      const fallbackNoise = settings.noise ?? createDefaultNoiseSettings()
      setNoise({
        playing: fallbackNoise.playing,
        loop: fallbackNoise.loop ?? preset.loop,
        masterVolume: fallbackNoise.masterVolume ?? 0.6,
        tracks: { ...preset.tracks, ...fallbackNoise.tracks },
      })

      if (!settings.noisePreset) {
        void focusRepo.upsert({
          focusMinutes: settings.focusMinutes,
          breakMinutes: settings.breakMinutes,
          longBreakMinutes: settings.longBreakMinutes,
          noise: settings.noise ?? fallbackNoise,
          noisePreset: DEFAULT_NOISE_PRESET,
        })
      }
    })
  }, [])

  useEffect(() => {
    void focusRepo.upsert({
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
      noise,
    })
  }, [focusMinutes, breakMinutes, longBreakMinutes, noise])

  const minutes = Math.floor(timerState.remainingSeconds / 60)
  const seconds = timerState.remainingSeconds % 60
  const timerTrend = useMemo(() => {
    return (oldValue: number, value: number) => (value >= oldValue ? 1 : -1)
  }, [])

  const setNoiseTrack = (trackId: NoiseTrackId, patch: Partial<NoiseTrackSettings>) => {
    setNoise((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          ...prev.tracks[trackId],
          ...patch,
        },
      },
    }))
  }

  const handleToggleNoise = () => {
    setNoise((prev) => ({ ...prev, playing: !prev.playing }))
  }

  const setNoiseMasterVolume = (value: number) => {
    setNoise((prev) => ({ ...prev, masterVolume: value }))
  }

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
    <Card
      title="Focus Center"
      eyebrow="Pomodoro"
      actions={
        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.07.07a2.18 2.18 0 0 1 0 3.08 2.18 2.18 0 0 1-3.08 0l-.07-.07a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.64V21a2.2 2.2 0 0 1-4.4 0v-.1a1.8 1.8 0 0 0-1.1-1.64 1.8 1.8 0 0 0-1.98.36l-.07.07a2.18 2.18 0 0 1-3.08 0 2.18 2.18 0 0 1 0-3.08l.07-.07A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.64-1.1H2.9a2.2 2.2 0 0 1 0-4.4h.1A1.8 1.8 0 0 0 4.64 8.4a1.8 1.8 0 0 0-.36-1.98l-.07-.07a2.18 2.18 0 0 1 0-3.08 2.18 2.18 0 0 1 3.08 0l.07.07A1.8 1.8 0 0 0 9.4 3.6a1.8 1.8 0 0 0 1.1-1.64V1.9a2.2 2.2 0 0 1 4.4 0v.1a1.8 1.8 0 0 0 1.1 1.64 1.8 1.8 0 0 0 1.98-.36l.07-.07a2.18 2.18 0 0 1 3.08 0 2.18 2.18 0 0 1 0 3.08l-.07.07a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.64 1.1h.1a2.2 2.2 0 0 1 0 4.4h-.1A1.8 1.8 0 0 0 19.4 15Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      }
    >
      <div className="focus" style={{ margin: '-6px 0', gap: 6 }}>
        <div className="focus__mode">Focus</div>
        <div className="focus__time" style={{ margin: '4px 0 8px' }}>
          <AppNumberGroup>
            <AppNumber value={minutes} trend={timerTrend} />
            <span aria-hidden>:</span>
            <AppNumber value={seconds} trend={timerTrend} format={{ minimumIntegerDigits: 2 }} />
          </AppNumberGroup>
        </div>
        <div className="focus__actions" style={{ marginTop: 8, gap: 14 }}>
          <Button size="sm" onClick={() => void handlePrimaryAction()}>
            {timerState.running ? 'Pause' : timerState.status === 'paused' ? 'Resume' : 'Start'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void reset()}>
            Reset
          </Button>
        </div>

        <div className="focus__noise" style={{ marginTop: 10, minHeight: 36 }}>
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
            onClick={handleToggleNoise}
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
      <FocusSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        focusMinutes={focusMinutes}
        breakMinutes={breakMinutes}
        longBreakMinutes={longBreakMinutes}
        setFocusMinutes={(value) => {
          const next = clampDuration(value)
          setFocusMinutes(next)
          void setDuration(next)
        }}
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

export default FocusCard
