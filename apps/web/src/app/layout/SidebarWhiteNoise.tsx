import type { CSSProperties } from 'react'
import { Waves, Volume2 } from 'lucide-react'
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
import AmbientSettingsPopover from './AmbientSettingsPopover'
import SidebarControlIcon from './SidebarControlIcon'

type Props = { collapsed: boolean }

const SidebarWhiteNoise = ({ collapsed }: Props) => {
  const { t } = useI18n()
  const { noise, setNoise, toggleNoisePlaying, setNoiseMasterVolume } = useSharedNoise()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const { requireAuth } = useAuthGate()

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

  const handleSceneChange = (nextId: NoiseScenePresetId | '') => {
    if (!allowed) {
      openUpgradeModal('button', 'focus.white-noise')
      return
    }
    requireAuth(() => {
      // Empty value = "return to default background" — disable every noise track
      // so no preset matches, ambient scene falls back to 'idle'.
      if (nextId === '') {
        const cleared = cloneNoiseTracks(noise.tracks)
        for (const key of Object.keys(cleared) as Array<keyof typeof cleared>) {
          cleared[key] = { ...cleared[key], enabled: false }
        }
        setNoise({ ...noise, tracks: cleared })
        return
      }
      const nextScene = NOISE_SCENE_PRESETS.find((scene) => scene.id === nextId)
      if (!nextScene) return
      setNoise({
        ...noise,
        tracks: cloneNoiseTracks(nextScene.tracks),
      })
    })
  }

  return (
    <div
      className={`sidebar-noise-mini${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}
    >
      <div className="sidebar-tool__row">
        <button
          type="button"
          className={`sidebar-noise-mini__toggle${isPlaying ? ' is-playing' : ''}`}
          onClick={handleToggle}
          aria-label={isPlaying ? t('focus.pauseNoise') : t('focus.playNoise')}
          title={isPlaying ? t('focus.pauseNoise') : t('focus.playNoise')}
          aria-pressed={isPlaying}
        >
          <SidebarControlIcon active={isPlaying} Idle={Waves} />
        </button>
        {!collapsed && (
          <div className="sidebar-noise-mini__preset-row sidebar-reveal">
            <select
              className="sidebar-noise-mini__preset"
              value={activeScene?.id ?? ''}
              onChange={(event) => handleSceneChange(event.target.value as NoiseScenePresetId | '')}
              aria-label={t('focus.scenes')}
              title={activeScene ? t(activeScene.labelKey) : t('focus.scenes')}
            >
              <option value="">{activeScene ? t('focus.scenes.returnDefault') : t('focus.scenes')}</option>
              {NOISE_SCENE_PRESETS.map((scene) => (
                <option key={scene.id} value={scene.id}>{t(scene.labelKey)}</option>
              ))}
            </select>
            <AmbientSettingsPopover />
          </div>
        )}
      </div>
      {!collapsed && <div className="sidebar-noise-mini__volume-row sidebar-reveal">
        <Volume2 size={13} aria-hidden="true" />
        <input
          type="range"
          className="sidebar-noise-mini__volume"
          min={0} max={100} step={1}
          value={Math.round(noise.masterVolume * 100)}
          aria-label={t('focus.volume')}
          aria-valuetext={`${Math.round(noise.masterVolume * 100)}%`}
          style={{ '--volume-pct': `${noise.masterVolume * 100}%` } as CSSProperties}
          onChange={(event) => {
            if (!allowed) {
              openUpgradeModal('button', 'focus.white-noise')
              return
            }
            const volume = Number(event.target.value) / 100
            requireAuth(() => setNoiseMasterVolume(volume))
          }}
        />
        <span className="sidebar-tool__value" aria-hidden="true">{Math.round(noise.masterVolume * 100)}%</span>
      </div>}
    </div>
  )
}

export default SidebarWhiteNoise
