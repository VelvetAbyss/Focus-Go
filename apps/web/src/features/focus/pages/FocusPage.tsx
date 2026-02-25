import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppNumber, AppNumberGroup } from '../../../shared/ui/AppNumber'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FocusSession, NoiseSettings, NoiseTrackId } from '../../../data/models/types'
import { focusRepo } from '../../../data/repositories/focusRepo'
import { createDefaultNoiseSettings, DEFAULT_NOISE_PRESET } from '../noise'
import FocusSettingsDrawer from '../FocusSettingsDrawer'
import { useNoiseMixer } from '../useNoiseMixer'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import FocusPortal from '../FocusPortal'
import NoiseControlPanel from '../components/NoiseControlPanel'
import { useToast } from '../../../shared/ui/toast/toast'
import { useSharedFocusTimer } from '../useSharedFocusTimer'

const DURATION_PRESETS = [25, 45, 60]

const clampDuration = (value: number) => {
  if (!Number.isFinite(value)) return 25
  const stepped = Math.round(value / 5) * 5
  return Math.max(15, Math.min(120, stepped))
}

const playCompletionTone = () => {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  const audioContext = new AudioCtx()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(786, audioContext.currentTime)
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.13, audioContext.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.43)
  window.setTimeout(() => void audioContext.close(), 600)
}

type FocusHistoryPanelProps = {
  sessions: FocusSession[]
  statusFilter: 'all' | 'completed' | 'interrupted'
  onStatusFilterChange: (value: 'all' | 'completed' | 'interrupted') => void
  durationFilter: 'all' | '15' | '30' | '60'
  onDurationFilterChange: (value: 'all' | '15' | '30' | '60') => void
}

const FocusHistoryPanel = memo(({
  sessions,
  statusFilter,
  onStatusFilterChange,
  durationFilter,
  onDurationFilterChange,
}: FocusHistoryPanelProps) => {
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <Card className="focus-history focus-surface-card focus-surface-card--side border-0 backdrop-blur-0">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Focus History</CardTitle>
        <div className="focus-history__filters">
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as 'all' | 'completed' | 'interrupted')}>
            <SelectTrigger className="focus-history__select">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="interrupted">Interrupted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={durationFilter} onValueChange={(value) => onDurationFilterChange(value as 'all' | '15' | '30' | '60')}>
            <SelectTrigger className="focus-history__select">
              <SelectValue placeholder="All duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All duration</SelectItem>
              <SelectItem value="15">15m+</SelectItem>
              <SelectItem value="30">30m+</SelectItem>
              <SelectItem value="60">60m+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="focus-history__content">
        {sessions.length === 0 ? (
          <p className="muted">No sessions in the last 30 days.</p>
        ) : (
          <ul className="focus-history__list">
            {sessions.map((session) => {
              const start = formatTime(session.createdAt)
              const endTimestamp = session.completedAt ?? session.interruptedAt ?? session.updatedAt
              const end = formatTime(endTimestamp)
              const minutes = session.actualMinutes ?? session.plannedMinutes
              return (
                <li key={session.id} className="focus-history__item">
                  <div className="focus-history__item-top">
                    <span>{start} - {end}</span>
                    <span className={`focus-history__status is-${session.status}`}>{session.status}</span>
                  </div>
                  <div className="focus-history__item-bottom">
                    <span>{minutes} min</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
})

const FocusPage = () => {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [longBreakMinutes, setLongBreakMinutes] = useState(15)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [durationDialogOpen, setDurationDialogOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [noise, setNoise] = useState<NoiseSettings>(createDefaultNoiseSettings())
  const [soundPlayedAt, setSoundPlayedAt] = useState<number | null>(null)
  const [historySessions, setHistorySessions] = useState<FocusSession[]>([])
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'completed' | 'interrupted'>('all')
  const [historyDurationFilter, setHistoryDurationFilter] = useState<'all' | '15' | '30' | '60'>('all')
  const completionSeenRef = useRef<number | null>(null)
  const toast = useToast()

  const { focusCompletionSoundEnabled } = usePreferences()
  const { state: timerState, start, pause, resume, reset, setDuration } = useSharedFocusTimer({ defaultDurationMinutes: focusMinutes })

  useNoiseMixer(noise)

  const durationMinutes = timerState.durationMinutes
  const secondsLeft = timerState.remainingSeconds
  const running = timerState.running
  const totalSeconds = Math.max(1, durationMinutes * 60)
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100
  const displayMinutes = Math.floor(secondsLeft / 60)
  const displaySeconds = secondsLeft % 60
  const timerTrend = useMemo(() => {
    return (oldValue: number, value: number) => (value >= oldValue ? 1 : -1)
  }, [])

  const setNoiseTrack = useCallback((trackId: NoiseTrackId, patch: Partial<NoiseSettings['tracks'][NoiseTrackId]>) => {
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
  }, [])

  const setNoiseMasterVolume = useCallback((value: number) => {
    setNoise((prev) => ({ ...prev, masterVolume: value }))
  }, [])

  const toggleNoisePlaying = useCallback(() => {
    setNoise((prev) => ({ ...prev, playing: !prev.playing }))
  }, [])

  const setNoiseTrackEnabled = useCallback((trackId: NoiseTrackId, enabled: boolean) => {
    setNoiseTrack(trackId, { enabled })
  }, [setNoiseTrack])

  const setNoiseTrackVolume = useCallback((trackId: NoiseTrackId, volume: number) => {
    setNoiseTrack(trackId, { volume })
  }, [setNoiseTrack])

  const loadFocusSettings = useCallback(async () => {
    const settings = await focusRepo.get()
    if (!settings) return
    const nextFocusMinutes = clampDuration(settings.focusMinutes)
    setFocusMinutes(nextFocusMinutes)
    setBreakMinutes(clampDuration(settings.breakMinutes))
    setLongBreakMinutes(clampDuration(settings.longBreakMinutes))

    const preset = settings.noisePreset ?? DEFAULT_NOISE_PRESET
    const fallbackNoise = settings.noise ?? createDefaultNoiseSettings()
    setNoise({
      playing: fallbackNoise.playing,
      loop: fallbackNoise.loop ?? preset.loop,
      masterVolume: fallbackNoise.masterVolume ?? 0.6,
      tracks: { ...preset.tracks, ...fallbackNoise.tracks },
    })
  }, [])

  const loadHistory = useCallback(async () => {
    const all = await focusRepo.listSessions(300)
    const now = Date.now()
    const cutoff = now - 30 * 24 * 60 * 60 * 1000
    const recent = all.filter((session) => session.createdAt >= cutoff)
    setHistorySessions(recent)
  }, [])

  useEffect(() => {
    void loadFocusSettings()
    void loadHistory()
  }, [loadFocusSettings, loadHistory])

  useEffect(() => {
    void focusRepo.upsert({
      focusMinutes,
      breakMinutes,
      longBreakMinutes,
      noise,
    })
  }, [focusMinutes, breakMinutes, longBreakMinutes, noise])

  const applyDuration = (value: number) => {
    const next = clampDuration(value)
    setFocusMinutes(next)
    void setDuration(next)
  }

  useEffect(() => {
    setImmersive(running)
  }, [running])

  useEffect(() => {
    if (!timerState.lastCompletedAt) return
    void loadHistory()
  }, [timerState.lastCompletedAt, loadHistory])

  useEffect(() => {
    if (!focusCompletionSoundEnabled) return
    if (!timerState.lastCompletedAt) return
    if (completionSeenRef.current === null) {
      completionSeenRef.current = timerState.lastCompletedAt
      return
    }
    if (completionSeenRef.current === timerState.lastCompletedAt) return
    completionSeenRef.current = timerState.lastCompletedAt
    setSoundPlayedAt(timerState.lastCompletedAt)
    playCompletionTone()
  }, [focusCompletionSoundEnabled, timerState.lastCompletedAt])

  const beginSession = async () => {
    const nextDuration = clampDuration(durationMinutes)
    setFocusMinutes(nextDuration)
    await start(nextDuration)
  }

  const handlePauseOrResume = async () => {
    if (running) {
      await pause()
      return
    }
    await resume()
  }

  const handlePrimaryAction = async () => {
    if (running) {
      await handlePauseOrResume()
      return
    }
    if (timerState.status === 'paused') {
      await resume()
      return
    }
    await beginSession()
  }

  const handleReset = async () => {
    setImmersive(false)
    await reset()
  }

  const filteredHistory = useMemo(() => {
    return historySessions.filter((session) => {
      if (historyStatusFilter !== 'all' && session.status !== historyStatusFilter) return false
      const minutes = session.actualMinutes ?? session.plannedMinutes
      if (historyDurationFilter === '15' && minutes < 15) return false
      if (historyDurationFilter === '30' && minutes < 30) return false
      if (historyDurationFilter === '60' && minutes < 60) return false
      return true
    })
  }, [historySessions, historyStatusFilter, historyDurationFilter])

  return (
    <section className="focus-page" data-immersive={immersive ? '1' : '0'}>
      <FocusPortal
        immersive={immersive}
        onExitImmersion={() => setImmersive(false)}
        onToggleSidebar={() => {
          window.dispatchEvent(new CustomEvent('focus-shell:toggle-sidebar'))
        }}
      >
        <Card className="focus-surface-card focus-surface-card--side border-0 backdrop-blur-0">
          <CardContent className="pt-6">
            <NoiseControlPanel
              noise={noise}
              onTogglePlay={toggleNoisePlaying}
              onToggleTrack={setNoiseTrackEnabled}
              onTrackVolume={setNoiseTrackVolume}
              onMasterVolume={setNoiseMasterVolume}
              onPlayBlocked={() => {
                toast.push({
                  variant: 'error',
                  title: 'No active track',
                  message: 'Enable at least one track',
                })
              }}
            />
          </CardContent>
        </Card>

        <section className="focus-stage focus-surface-card" aria-label="Focus timer stage">
          <div className="focus-stage__timer focus-stage__timer--flat" data-animation-visible={immersive ? '1' : '0'}>
            <div className="focus-stage__clock" aria-label={`Timer ${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`}>
              <div className="focus-stage__clock-line">
                <AppNumberGroup>
                  <AppNumber value={displayMinutes} trend={timerTrend} format={{ minimumIntegerDigits: 2 }} />
                  <span aria-hidden>:</span>
                  <AppNumber value={displaySeconds} trend={timerTrend} format={{ minimumIntegerDigits: 2 }} />
                </AppNumberGroup>
              </div>
            </div>
            <Progress className="focus-stage__line-progress" value={Math.max(0, Math.min(100, progress))} />
          </div>

          <div className="focus-stage__actions">
            <Button type="button" onClick={() => void handlePrimaryAction()}>
              {running ? 'Pause' : timerState.status === 'paused' ? 'Resume' : 'Start Focus'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDurationDialogOpen(true)}>
              Duration
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </div>

          <div className="focus-stage__meta">
            <span>Session: {running ? 'Running' : timerState.status === 'paused' ? 'Paused' : timerState.status === 'completed' ? 'Completed' : 'Idle'}</span>
            <span data-sound-enabled={focusCompletionSoundEnabled ? '1' : '0'}>
              Completion sound: {focusCompletionSoundEnabled ? 'On' : 'Off'}
            </span>
            <span>{soundPlayedAt ? `Last cue: ${new Date(soundPlayedAt).toLocaleTimeString()}` : 'No cue played yet'}</span>
          </div>
        </section>

        <FocusHistoryPanel
          sessions={filteredHistory}
          statusFilter={historyStatusFilter}
          onStatusFilterChange={setHistoryStatusFilter}
          durationFilter={historyDurationFilter}
          onDurationFilterChange={setHistoryDurationFilter}
        />
      </FocusPortal>

      <Dialog open={durationDialogOpen} onOpenChange={setDurationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Duration</DialogTitle>
            <DialogDescription>Pick how long this focus session should run.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Focus duration presets">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  type="button"
                  key={preset}
                  variant={durationMinutes === preset ? 'default' : 'outline'}
                  onClick={() => applyDuration(preset)}
                >
                  {preset}m
                </Button>
              ))}
            </div>
            <input
              type="range"
              min={15}
              max={120}
              step={5}
              value={durationMinutes}
              onChange={(event) => applyDuration(Number(event.target.value))}
            />
            <p className="muted">{durationMinutes} minutes</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setDurationDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </section>
  )
}

export default FocusPage
