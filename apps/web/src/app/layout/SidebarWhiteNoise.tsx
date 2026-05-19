import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pause, Waves } from 'lucide-react'
import { useSharedNoise } from '../../features/focus/SharedNoiseProvider'
import {
  cloneNoiseTracks,
  findMatchingNoiseScenePreset,
  NOISE_SCENE_PRESETS,
  type NoiseScenePresetId,
} from '../../features/focus/noise'
import { useI18n } from '../../shared/i18n/useI18n'
import { usePremiumGate } from '../../features/premium/PremiumProvider'
import { useAuthGate } from '../../features/auth/AuthGateContext'

type Props = { collapsed: boolean }

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const SidebarWhiteNoise = ({ collapsed }: Props) => {
  const { t } = useI18n()
  const { noise, setNoise, toggleNoisePlaying, setNoiseMasterVolume } = useSharedNoise()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const { requireAuth } = useAuthGate()
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const isPlaying = noise.playing
  const allowed = canUse('focus.white-noise').allowed
  const activeScene = findMatchingNoiseScenePreset(noise.tracks)

  const handleToggle = () => {
    if (!allowed) {
      openUpgradeModal('button', 'focus.white-noise')
      return
    }
    requireAuth(() => toggleNoisePlaying())
  }

  const handleSceneChange = (nextId: NoiseScenePresetId) => {
    if (!allowed) {
      openUpgradeModal('button', 'focus.white-noise')
      return
    }
    requireAuth(() => {
      const nextScene = NOISE_SCENE_PRESETS.find((scene) => scene.id === nextId)
      if (!nextScene) return
      setNoise({
        ...noise,
        tracks: cloneNoiseTracks(nextScene.tracks),
      })
    })
  }

  const setVolumeFromEvent = (clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    setNoiseMasterVolume(clamp01((clientX - rect.left) / rect.width))
  }

  return (
    <motion.div
      layout
      className={`sidebar-noise-mini${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <button
        type="button"
        className={`sidebar-noise-mini__toggle${isPlaying ? ' is-playing' : ''}`}
        onClick={handleToggle}
        aria-label={isPlaying ? t('focus.pauseNoise') : t('focus.playNoise')}
        title={isPlaying ? t('focus.pauseNoise') : t('focus.playNoise')}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isPlaying ? 'pause' : 'play'}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ display: 'flex' }}
          >
            {isPlaying ? <Pause size={12} /> : <Waves size={12} />}
          </motion.span>
        </AnimatePresence>
        {isPlaying ? <span className="sidebar-noise-mini__dot" aria-hidden /> : null}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            key="body"
            className="sidebar-noise-mini__body"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <select
              className="sidebar-noise-mini__preset"
              value={activeScene?.id ?? ''}
              onChange={(event) => handleSceneChange(event.target.value as NoiseScenePresetId)}
              aria-label={t('focus.scenes')}
            >
              {!activeScene ? (
                <option value="" disabled hidden>
                  {t('focus.scenes')}
                </option>
              ) : null}
              {NOISE_SCENE_PRESETS.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.emoji} {t(scene.labelKey)}
                </option>
              ))}
            </select>

            <div
              ref={sliderRef}
              className="sidebar-noise-mini__volume"
              role="slider"
              aria-label={t('focus.volume')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(noise.masterVolume * 100)}
              onMouseDown={(event) => {
                if (!allowed) {
                  openUpgradeModal('button', 'focus.white-noise')
                  return
                }
                requireAuth(() => {
                  draggingRef.current = true
                  setVolumeFromEvent(event.clientX)
                  const onMove = (ev: MouseEvent) => {
                    if (!draggingRef.current) return
                    setVolumeFromEvent(ev.clientX)
                  }
                  const onUp = () => {
                    draggingRef.current = false
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                })
              }}
            >
              <div
                className="sidebar-noise-mini__volume-fill"
                style={{ width: `${noise.masterVolume * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default SidebarWhiteNoise
