import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Drawer from '../../shared/ui/Drawer'
import type { NoiseSettings, NoiseTrackId, NoiseTrackSettings } from '../../data/models/types'
import { Button } from '@/components/ui/button'
import { useMotionPreference } from '../../shared/prefs/useMotionPreference'
import NoiseControlPanel from './components/NoiseControlPanel'

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
  const [noiseHint, setNoiseHint] = useState<string | null>(null)
  const noiseHintTimerRef = useRef<number | null>(null)
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

  const setNoiseTrackEnabled = useCallback(
    (trackId: NoiseTrackId, enabled: boolean) => {
      setNoiseTrack(trackId, { enabled })
    },
    [setNoiseTrack]
  )
  const setNoiseTrackVolume = useCallback(
    (trackId: NoiseTrackId, volume: number) => {
      setNoiseTrack(trackId, { volume })
    },
    [setNoiseTrack]
  )
  const toggleNoisePlaying = useCallback(() => {
    setNoise({ ...noise, playing: !noise.playing })
  }, [noise, setNoise])
  const handlePlayBlocked = useCallback(() => {
    setNoiseHint('Enable at least one track')
    if (noiseHintTimerRef.current) {
      window.clearTimeout(noiseHintTimerRef.current)
    }
    noiseHintTimerRef.current = window.setTimeout(() => {
      setNoiseHint(null)
      noiseHintTimerRef.current = null
    }, 2000)
  }, [])

  const handleClose = () => {
    setActiveTimer(null)
    setNoiseHint(null)
    if (noiseHintTimerRef.current) {
      window.clearTimeout(noiseHintTimerRef.current)
      noiseHintTimerRef.current = null
    }
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

  useEffect(() => {
    return () => {
      if (noiseHintTimerRef.current) {
        window.clearTimeout(noiseHintTimerRef.current)
        noiseHintTimerRef.current = null
      }
    }
  }, [])

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
        <NoiseControlPanel
          noise={noise}
          onTogglePlay={toggleNoisePlaying}
          onToggleTrack={setNoiseTrackEnabled}
          onTrackVolume={setNoiseTrackVolume}
          onMasterVolume={setNoiseMasterVolume}
          onPlayBlocked={handlePlayBlocked}
          compact
        />
        {noiseHint ? <p className="focus-settings__noiseHint">{noiseHint}</p> : null}
      </motion.section>
    </Drawer>
  )
}

export default FocusSettingsDrawer
