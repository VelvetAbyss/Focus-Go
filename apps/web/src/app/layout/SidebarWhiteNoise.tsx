import { Waves } from 'lucide-react'
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
import LevelSlider from '../../shared/ui/LevelSlider'
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

  const playLabel = isPlaying ? t('focus.pauseNoise') : t('focus.playNoise')

  // Expanded: the sound's icon in the nav's icon column, the scene on the
  // label line, play at the end, and the level bars under the label.
  // Collapsed: one button, the sound's icon that turns into pause.
  return (
    <div className={`sidebar-noise-mini${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar-tool__row">
        {collapsed ? (
          <button type="button" className="sidebar-tool__play" onClick={handleToggle}
            aria-label={playLabel} title={playLabel} aria-pressed={isPlaying}>
            <SidebarControlIcon active={isPlaying} Idle={Waves} size={16} />
          </button>
        ) : (
          <>
            <span className="sidebar-tool__icon" aria-hidden="true"><Waves /></span>
            <select
              className="sidebar-tool__label sidebar-tool__select sidebar-reveal"
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
            <button type="button" className="sidebar-tool__play" onClick={handleToggle}
              aria-label={playLabel} title={playLabel} aria-pressed={isPlaying}>
              <SidebarControlIcon active={isPlaying} size={15} />
            </button>
          </>
        )}
      </div>
      {!collapsed && <div className="sidebar-tool__sub sidebar-reveal">
        <LevelSlider
          value={noise.masterVolume}
          label={t('focus.volume')}
          playing={isPlaying}
          onChange={(volume) => {
            if (!allowed) {
              openUpgradeModal('button', 'focus.white-noise')
              return
            }
            requireAuth(() => setNoiseMasterVolume(volume))
          }}
        />
        <span className="sidebar-tool__value" aria-hidden="true">{Math.round(noise.masterVolume * 100)}%</span>
      </div>}
    </div>
  )
}

export default SidebarWhiteNoise
