import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '../routes/routes'
import {
  applyTheme,
  readStoredThemePreference,
  resolveInitialTheme,
  type ThemeMode,
  writeStoredThemePreference,
} from '../../shared/theme/theme'
import { THEME_BEFORE_MODE_TOGGLE_EVENT } from '../../shared/theme/themePack'
import Sidebar from './Sidebar'
import { useTaskReminderEngine } from '../../features/tasks/useTaskReminderEngine'

type AppShellProps = {
  children: ReactNode
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'focusgo.sidebar.collapsed.v1'
const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 1536px)'

const readSidebarCollapsed = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

const readCompactViewport = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches
    : false

const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation()
  const [compactViewport, setCompactViewport] = useState(() => readCompactViewport())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readCompactViewport() || readSidebarCollapsed())
  const [sidebarDimmed, setSidebarDimmed] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== 'undefined') {
      const current = document.documentElement.dataset.theme
      if (current === 'light' || current === 'dark') return current
    }
    return readStoredThemePreference() ?? resolveInitialTheme()
  })
  useTaskReminderEngine()
  const isNoteRoute = location.pathname === ROUTES.NOTE

  useEffect(() => {
    if (compactViewport) return
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
  }, [compactViewport, sidebarCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY)
    const handleViewportChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const nextCompact = 'matches' in event ? event.matches : media.matches
      setCompactViewport(nextCompact)
      setSidebarCollapsed(nextCompact ? true : readSidebarCollapsed())
    }

    handleViewportChange(media)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleViewportChange)
      return () => media.removeEventListener('change', handleViewportChange)
    }

    media.addListener(handleViewportChange)
    return () => media.removeListener(handleViewportChange)
  }, [])

  useEffect(() => {
    const toggleHandler = () => setSidebarCollapsed((prev) => !prev)
    const setCollapsedHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed?: boolean }>).detail
      if (typeof detail?.collapsed === 'boolean') setSidebarCollapsed(detail.collapsed)
    }
    const setDimmedHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ dimmed?: boolean }>).detail
      if (typeof detail?.dimmed === 'boolean') setSidebarDimmed(detail.dimmed)
    }
    window.addEventListener('focus-shell:toggle-sidebar', toggleHandler)
    window.addEventListener('focus-shell:set-sidebar-collapsed', setCollapsedHandler)
    window.addEventListener('focus-shell:set-sidebar-dimmed', setDimmedHandler)
    return () => {
      window.removeEventListener('focus-shell:toggle-sidebar', toggleHandler)
      window.removeEventListener('focus-shell:set-sidebar-collapsed', setCollapsedHandler)
      window.removeEventListener('focus-shell:set-sidebar-dimmed', setDimmedHandler)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const syncThemeFromDom = () => {
      const domTheme = root.dataset.theme
      if (domTheme === 'light' || domTheme === 'dark') {
        setTheme((prev) => (prev === domTheme ? prev : domTheme))
      }
    }
    syncThemeFromDom()
    const observer = new MutationObserver(syncThemeFromDom)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const toggleTheme = () => {
    window.dispatchEvent(new CustomEvent(THEME_BEFORE_MODE_TOGGLE_EVENT))
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    writeStoredThemePreference(nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <div className={`focus-shell ${sidebarDimmed ? 'focus-shell--sidebar-dimmed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="focus-shell__main flex min-h-0 flex-1 flex-col">
        <section className={`focus-shell__route-layer flex min-h-0 flex-1 flex-col ${isNoteRoute ? 'focus-shell__route-layer--full-bleed' : ''}`}>
          {children}
        </section>
      </main>
    </div>
  )
}

export default AppShell
