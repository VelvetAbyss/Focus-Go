import { useSyncExternalStore } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useI18n } from '../../shared/i18n/useI18n'
import { playInterfaceSound } from '../../shared/sound/interactionSounds'
import {
  getSoundPreferences, setSoundPreferences, SOUND_DEFAULTS, subscribeSoundPreferences,
} from '../../shared/sound/soundPreferences'

const serverSnapshot = () => SOUND_DEFAULTS

export default function SidebarSoundToggle({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n()
  const prefs = useSyncExternalStore(subscribeSoundPreferences, getSoundPreferences, serverSnapshot)
  const Icon = prefs.enabled && prefs.volume > 0 ? Volume2 : VolumeX

  return (
    <button
      type="button"
      className="focus-sidebar__item sidebar-sound-toggle"
      role="switch"
      aria-checked={prefs.enabled}
      aria-label={t('settings.sound.title')}
      title={t(prefs.enabled ? 'shell.sound.disable' : 'shell.sound.enable')}
      onClick={() => {
        const enabled = !getSoundPreferences().enabled
        setSoundPreferences({ enabled })
        if (enabled) playInterfaceSound('on')
      }}
    >
      <Icon size={18} aria-hidden="true" />
      {!collapsed ? (
        <>
          <span className="sidebar-reveal sidebar-sound-toggle__label">{t('shell.sound.label')}</span>
          <span className="sidebar-sound-toggle__track" aria-hidden="true">
            <span className="sidebar-sound-toggle__thumb" />
          </span>
        </>
      ) : null}
    </button>
  )
}
