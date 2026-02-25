import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { NoiseSettings, NoiseTrackId } from '../../../data/models/types'
import { NOISE_TRACKS } from '../noise'
import NoiseSlider from '../NoiseSlider'

export type NoiseControlPanelProps = {
  noise: NoiseSettings
  onTogglePlay: () => void
  onToggleTrack: (trackId: NoiseTrackId, enabled: boolean) => void
  onTrackVolume: (trackId: NoiseTrackId, volume: number) => void
  onMasterVolume: (volume: number) => void
  onPlayBlocked?: () => void
  compact?: boolean
}

const toPercent = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100)

const NoiseControlPanel = ({
  noise,
  onTogglePlay,
  onToggleTrack,
  onTrackVolume,
  onMasterVolume,
  onPlayBlocked,
  compact = false,
}: NoiseControlPanelProps) => {
  const [inlineHint, setInlineHint] = useState<string | null>(null)
  const hintTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = () => {
    if (noise.playing) {
      onTogglePlay()
      return
    }

    const hasEnabledTrack = NOISE_TRACKS.some((track) => noise.tracks[track.id].enabled)
    if (!hasEnabledTrack) {
      if (onPlayBlocked) {
        onPlayBlocked()
        return
      }
      setInlineHint('Enable at least one track')
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current)
      }
      hintTimerRef.current = window.setTimeout(() => {
        setInlineHint(null)
        hintTimerRef.current = null
      }, 2000)
      return
    }

    onTogglePlay()
  }

  return (
    <section className={`focus-noise-panel ${compact ? 'focus-noise-panel--compact' : ''}`}>
      <div className="focus-noise-panel__header">
        <h4 className="focus-noise-panel__title">White Noise</h4>
        <Button type="button" variant={noise.playing ? 'default' : 'outline'} size="sm" onClick={handleTogglePlay}>
          {noise.playing ? 'Pause' : 'Play'}
        </Button>
      </div>

      {inlineHint ? <p className="focus-noise-panel__hint">{inlineHint}</p> : null}

      <div className="focus-noise-track focus-noise-track--master" data-enabled="1">
        <div className="focus-noise-track__top">
          <p className="focus-noise-track__name">Master Volume</p>
          <span className="focus-noise-track__value">{toPercent(noise.masterVolume)}%</span>
        </div>
        <div className="focus-noise-track__slider">
          <div className="focus-noise-track__sliderWrap">
            <NoiseSlider
              value={noise.masterVolume ?? 0}
              onChange={onMasterVolume}
              step={0.05}
              className="noise-slider--compact noise-slider--capsule"
            />
          </div>
        </div>
      </div>

      <div className="focus-noise-grid">
        {NOISE_TRACKS.map((track) => {
          const current = noise.tracks[track.id]
          const trackPercent = toPercent(current.volume)
          return (
            <div
              className="focus-noise-track focus-noise-track--compact"
              data-enabled={current.enabled ? '1' : '0'}
              key={track.id}
            >
              <div className="focus-noise-track__top">
                <p className="focus-noise-track__name">{track.label}</p>
                <div className="focus-noise-track__controls">
                  <span className="focus-noise-track__value">{trackPercent}%</span>
                  <Switch checked={current.enabled} onCheckedChange={(checked) => onToggleTrack(track.id, checked)} />
                </div>
              </div>
              <div className="focus-noise-track__slider">
                <div className={`focus-noise-track__sliderWrap ${current.enabled ? '' : 'is-disabled'}`.trim()}>
                  <NoiseSlider
                    value={current.volume}
                    onChange={(value) => onTrackVolume(track.id, value)}
                    disabled={!current.enabled}
                    step={0.05}
                    className="noise-slider--compact noise-slider--capsule"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default NoiseControlPanel
