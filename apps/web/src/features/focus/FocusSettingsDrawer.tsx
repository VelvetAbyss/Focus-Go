import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import Drawer from '../../shared/ui/Drawer'
import type { NoiseSettings, NoiseTrackId, NoiseTrackSettings } from '../../data/models/types'
import { NOISE_TRACKS } from './noise'
import NoiseSlider from './NoiseSlider'
import Button from '../../shared/ui/Button'
import { useMotionPreference } from '../../shared/prefs/useMotionPreference'

type FocusSettingsDrawerProps = {
  open: boolean
  onClose: () => void
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  setFocusMinutes: (value: number) => void
  setBreakMinutes: (value: number) => void
  setLongBreakMinutes: (value: number) => void
  noise: NoiseSettings
  setNoise: (next: NoiseSettings) => void
  setNoiseTrack: (trackId: NoiseTrackId, patch: Partial<NoiseTrackSettings>) => void
  setNoiseMasterVolume: (value: number) => void
}

const clampMinutes = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 5
  const stepped = Math.round(normalized / 5) * 5
  return Math.max(5, Math.min(120, stepped))
}

const FocusSettingsDrawer = ({
  open,
  onClose,
  focusMinutes,
  breakMinutes,
  longBreakMinutes,
  setFocusMinutes,
  setBreakMinutes,
  setLongBreakMinutes,
  noise,
  setNoise,
  setNoiseTrack,
  setNoiseMasterVolume,
}: FocusSettingsDrawerProps) => {
  const [activeTimer, setActiveTimer] = useState<'focus' | 'break' | 'longBreak' | null>(null)
  const { reduceMotion } = useMotionPreference()
  const layoutTransition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }

  const updateTimer = (kind: 'focus' | 'break' | 'longBreak', nextValue: number) => {
    const safeValue = clampMinutes(nextValue)
    if (kind === 'focus') {
      setFocusMinutes(safeValue)
      return
    }
    if (kind === 'break') {
      setBreakMinutes(safeValue)
      return
    }
    setLongBreakMinutes(safeValue)
  }

  const timerRows: { key: 'focus' | 'break' | 'longBreak'; label: string; value: number }[] = [
    { key: 'focus', label: 'Focus', value: focusMinutes },
    { key: 'break', label: 'Break', value: breakMinutes },
    { key: 'longBreak', label: 'Long Break', value: longBreakMinutes },
  ]

  const toPercent = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100)
  const fromPercent = (value: number) => Math.max(0, Math.min(100, value)) / 100
  const handleClose = () => {
    setActiveTimer(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const nextFocus = clampMinutes(focusMinutes)
    const nextBreak = clampMinutes(breakMinutes)
    const nextLongBreak = clampMinutes(longBreakMinutes)
    if (nextFocus !== focusMinutes) setFocusMinutes(nextFocus)
    if (nextBreak !== breakMinutes) setBreakMinutes(nextBreak)
    if (nextLongBreak !== longBreakMinutes) setLongBreakMinutes(nextLongBreak)
  }, [open, focusMinutes, breakMinutes, longBreakMinutes, setFocusMinutes, setBreakMinutes, setLongBreakMinutes])

  return (
    <Drawer
      open={open}
      title="Focus Settings"
      onClose={handleClose}
      hideDefaultClose
      actions={
        <Button className="button button--ghost" onClick={handleClose}>
          Done
        </Button>
      }
    >
      <motion.section layout transition={layoutTransition} className="focus-settings__panel">
        <div className="focus-settings__panelHeader">
          <h4>Timer</h4>
        </div>
        <motion.div layout className="focus-settings__timerList">
          {timerRows.map((timer) => {
            const expanded = activeTimer === timer.key
            const displayValue = clampMinutes(timer.value)
            return (
              <motion.div layout key={timer.key} className="focus-settings__timerItem" transition={layoutTransition}>
                <button
                  type="button"
                  className="focus-settings__timePill"
                  onClick={() => setActiveTimer(expanded ? null : timer.key)}
                  aria-expanded={expanded}
                  aria-controls={`timer-stepper-${timer.key}`}
                >
                  <span className="focus-settings__timerLabel">{timer.label}</span>
                  <span className="focus-settings__timerValue">{displayValue}</span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={`timer-stepper-${timer.key}`}
                      layout
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      transition={layoutTransition}
                      className="focus-settings__stepper"
                    >
                      <Button
                        className="button button--ghost focus-settings__stepperBtn"
                        onClick={() => updateTimer(timer.key, displayValue - 5)}
                        disabled={displayValue <= 5}
                      >
                        -
                      </Button>
                      <span className="focus-settings__stepperValue">{displayValue} min</span>
                      <Button
                        className="button button--ghost focus-settings__stepperBtn"
                        onClick={() => updateTimer(timer.key, displayValue + 5)}
                        disabled={displayValue >= 120}
                      >
                        +
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>

      <motion.section layout transition={layoutTransition} className="focus-settings__panel">
        <div className="focus-settings__noiseHeader">
          <h4>Noise</h4>
          <Button
            className="button button--ghost focus-settings__stopBtn"
            onClick={() => setNoise({ ...noise, playing: false })}
            disabled={!noise.playing}
          >
            Stop
          </Button>
        </div>
        <p className="muted">Enable one or more tracks, then use Play in the card.</p>

        <motion.div layout transition={layoutTransition} className="focus-noise-track focus-noise-track--master">
          <div className="focus-noise-track__top">
            <p className="focus-noise-track__name">Master Volume</p>
            <span className="focus-noise-track__value">{toPercent(noise.masterVolume)}%</span>
          </div>
          <div className="focus-noise-track__slider">
            <div className="focus-noise-track__sliderWrap">
              <NoiseSlider
                value={noise.masterVolume ?? 0}
                onChange={setNoiseMasterVolume}
                step={0.05}
                className="noise-slider--compact"
              />
            </div>
          </div>
        </motion.div>

        <motion.div layout transition={layoutTransition} className="focus-noise-grid">
          {NOISE_TRACKS.map((track) => {
            const current = noise.tracks[track.id]
            const trackPercent = toPercent(current.volume)
            return (
              <motion.div
                layout
                transition={layoutTransition}
                className="focus-noise-track focus-noise-track--compact"
                key={track.id}
              >
                <div className="focus-noise-track__top">
                  <p className="focus-noise-track__name">{track.label}</p>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={current.enabled}
                      onChange={(event) => setNoiseTrack(track.id, { enabled: event.target.checked })}
                    />
                    <span className="toggle__track" />
                  </label>
                </div>
                <AnimatePresence initial={false} mode="wait">
                  {current.enabled ? (
                    <motion.div
                      key={`${track.id}-enabled`}
                      layout
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      transition={layoutTransition}
                    >
                      <div className="focus-noise-track__slider">
                        <div className="focus-noise-track__sliderWrap">
                          <NoiseSlider
                            value={current.volume}
                            onChange={(value) => setNoiseTrack(track.id, { volume: fromPercent(toPercent(value)) })}
                            step={0.05}
                            className="noise-slider--compact"
                          />
                        </div>
                      </div>
                      <p className="focus-noise-track__meta">{trackPercent}%</p>
                    </motion.div>
                  ) : (
                    <motion.p
                      key={`${track.id}-disabled`}
                      layout
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      transition={layoutTransition}
                      className="focus-noise-track__meta focus-noise-track__meta--muted"
                    >
                      Muted (remembers {trackPercent}%)
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.section>
    </Drawer>
  )
}

export default FocusSettingsDrawer
