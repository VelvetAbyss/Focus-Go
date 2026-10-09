import { Moon, Sun } from 'lucide-react'
import { useThemeMode } from '../../shared/theme/useThemeMode'
import { readStoredThemePreference } from '../../shared/theme/theme'
import { setThemeWithTransition } from '../../shared/theme/themeTransition'
import { syncedPreferencesRepo } from '../../data/repositories/syncedPreferencesRepo'
import { useI18n } from '../../shared/i18n/useI18n'
import './sidebar-theme-toggle.css'

/** Day/night as an icon switch in the sidebar's top row, beside the collapse control. */
const SidebarThemeToggle = () => {
  const theme = useThemeMode()
  const { t } = useI18n()
  const isDark = theme === 'dark'
  const toggle = () => {
    const preference = readStoredThemePreference()
    const current = preference === 'light' || preference === 'dark' ? preference : theme
    setThemeWithTransition(current === 'dark' ? 'light' : 'dark')
    void syncedPreferencesRepo.persistFromLocal()
  }

  return (
    <button
      type="button"
      className="sidebar-theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={t('shell.theme.nightMode')}
      title={t(isDark ? 'shell.theme.toDay' : 'shell.theme.toNight')}
      onClick={toggle}
    >
      <span className="sidebar-theme-toggle__icons" aria-hidden="true">
        <Sun className="sidebar-theme-toggle__sun" size={16} />
        <Moon className="sidebar-theme-toggle__moon" size={16} />
      </span>
    </button>
  )
}

export default SidebarThemeToggle
