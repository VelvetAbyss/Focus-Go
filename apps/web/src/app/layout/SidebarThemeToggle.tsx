import { Moon, Sun } from 'lucide-react'
import { useThemeMode } from '../../shared/theme/useThemeMode'
import { readStoredThemePreference } from '../../shared/theme/theme'
import { setThemeWithTransition } from '../../shared/theme/themeTransition'
import { syncedPreferencesRepo } from '../../data/repositories/syncedPreferencesRepo'
import { useI18n } from '../../shared/i18n/useI18n'
import './sidebar-theme-toggle.css'

const SidebarThemeToggle = ({ collapsed }: { collapsed: boolean }) => {
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
    <div className={`sidebar-theme-control${collapsed ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="sidebar-theme-toggle"
        role="switch"
        aria-checked={isDark}
        aria-label={t('shell.theme.nightMode')}
        title={t(isDark ? 'shell.theme.toDay' : 'shell.theme.toNight')}
        onClick={toggle}
      >
        {!collapsed && <span className="sidebar-theme-toggle__label">{t(isDark ? 'shell.theme.night' : 'shell.theme.day')}</span>}
        <span className="sidebar-theme-toggle__track" aria-hidden="true">
          <Sun className="sidebar-theme-toggle__hint sidebar-theme-toggle__hint--sun" size={13} />
          <Moon className="sidebar-theme-toggle__hint sidebar-theme-toggle__hint--moon" size={13} />
          <span className="sidebar-theme-toggle__thumb">
            <Sun className="sidebar-theme-toggle__sun" size={15} />
            <Moon className="sidebar-theme-toggle__moon" size={15} />
          </span>
        </span>
      </button>
    </div>
  )
}

export default SidebarThemeToggle
