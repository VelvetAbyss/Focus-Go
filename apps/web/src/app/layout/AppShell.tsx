import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '../routes/routes'
import {
  applyTheme,
  readStoredThemePreference,
  resolveInitialTheme,
  resolveTheme,
  type ThemeMode,
  writeStoredThemePreference,
} from '../../shared/theme/theme'
import { THEME_BEFORE_MODE_TOGGLE_EVENT } from '../../shared/theme/themePack'
import Sidebar from './Sidebar'
import { useTaskReminderEngine } from '../../features/tasks/useTaskReminderEngine'
import OnboardingProgressiveRuntime from '../../features/onboarding/OnboardingProgressiveRuntime'

type AppShellProps = {
  children: ReactNode
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'focusgo.sidebar.collapsed.v1'
const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 1536px)'
const TABLET_AND_UP_MEDIA_QUERY = '(min-width: 768px)'
const SHELL_SCALE_MIN_WIDTH = 1512
const SHELL_SCALE_MAX_WIDTH = 1920
const SHELL_SCALE_MIN = 0.8
const SHELL_SCALE_MAX = 1

const readSidebarCollapsed = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

const readCompactViewport = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches
    : false

// eslint-disable-next-line react-refresh/only-export-components
export const resolveShellScale = (viewportWidth: number) => {
  const safeWidth = Number.isFinite(viewportWidth) ? viewportWidth : SHELL_SCALE_MAX_WIDTH
  if (safeWidth <= SHELL_SCALE_MIN_WIDTH) return SHELL_SCALE_MIN
  if (safeWidth >= SHELL_SCALE_MAX_WIDTH) return SHELL_SCALE_MAX
  const progress = (safeWidth - SHELL_SCALE_MIN_WIDTH) / (SHELL_SCALE_MAX_WIDTH - SHELL_SCALE_MIN_WIDTH)
  const next = SHELL_SCALE_MIN + progress * (SHELL_SCALE_MAX - SHELL_SCALE_MIN)
  return Number(next.toFixed(4))
}

const readShellScale = () => {
  if (typeof window === 'undefined') return SHELL_SCALE_MAX
  if (typeof window.matchMedia === 'function' && !window.matchMedia(TABLET_AND_UP_MEDIA_QUERY).matches) return SHELL_SCALE_MAX
  return resolveShellScale(window.innerWidth)
}

const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation()
  const [compactViewport, setCompactViewport] = useState(() => readCompactViewport())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readCompactViewport() || readSidebarCollapsed())
  const [sidebarDimmed, setSidebarDimmed] = useState(false)
  const [shellScale, setShellScale] = useState(() => readShellScale())
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== 'undefined') {
      const current = document.documentElement.dataset.theme
      if (current === 'light' || current === 'dark') return current
    }
    const storedSelection = readStoredThemePreference()
    if (storedSelection === 'light' || storedSelection === 'dark') return storedSelection
    return resolveInitialTheme()
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
    if (typeof window === 'undefined') return
    let frame = 0
    const syncScale = () => {
      setShellScale((prev) => {
        const next = readShellScale()
        if (prev === next) return prev
        return next
      })
    }
    const scheduleSync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(syncScale)
    }
    scheduleSync()
    window.addEventListener('resize', scheduleSync)
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(TABLET_AND_UP_MEDIA_QUERY) : null
    if (media && typeof media.addEventListener === 'function') media.addEventListener('change', scheduleSync)
    else if (media) media.addListener(scheduleSync)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleSync)
      if (media && typeof media.removeEventListener === 'function') media.removeEventListener('change', scheduleSync)
      else if (media) media.removeListener(scheduleSync)
    }
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      const selection = readStoredThemePreference()
      if (selection !== 'system') return
      const next = resolveTheme('system')
      setTheme(next)
      applyTheme(next)
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSystemThemeChange)
      return () => media.removeEventListener('change', handleSystemThemeChange)
    }

    media.addListener(handleSystemThemeChange)
    return () => media.removeListener(handleSystemThemeChange)
  }, [])

  const toggleTheme = () => {
    window.dispatchEvent(new CustomEvent(THEME_BEFORE_MODE_TOGGLE_EVENT))
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    writeStoredThemePreference(nextTheme)
    applyTheme(nextTheme)
  }

  const shellStyle = {
    '--shell-scale': shellScale,
  } as CSSProperties

  return (
    <div className={`focus-shell ${sidebarDimmed ? 'focus-shell--sidebar-dimmed' : ''}`} style={shellStyle}>
      <div className="focus-shell__scale-wrap">
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
        <OnboardingProgressiveRuntime />
      </div>
    </div>
  )
}

export default AppShell
