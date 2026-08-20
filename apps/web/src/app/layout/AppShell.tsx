import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '../routes/routes'
import {
  applyTheme,
  readStoredThemePreference,
  resolveTheme,
} from '../../shared/theme/theme'
import Sidebar from './Sidebar'
import AmbientSceneStage from './AmbientSceneStage'
import { useTaskReminderEngine } from '../../features/tasks/useTaskReminderEngine'
import TaskReminderModal from '../../features/tasks/TaskReminderModal'
import { AuthGateProvider } from '../../features/auth/AuthGateContext'
import AuthInteractionGate from '../../features/auth/AuthInteractionGate'
import { getAuth, subscribeAuth } from '../../store/auth'
import { isLocalhostRuntime } from '../../shared/env/localhost'
import { clearLocalUserData } from '../../data/sync/repository'
import CommandPalette from '../../shared/ui/CommandPalette'
import { useSharedNoise } from '../../features/focus/SharedNoiseProvider'
import { findMatchingNoiseScenePreset } from '../../features/focus/noise'

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
  const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  if (raw === null) return null
  return raw === '1'
}

const readCompactViewport = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? Boolean(window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY)?.matches)
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
  if (typeof window.matchMedia === 'function' && window.matchMedia(TABLET_AND_UP_MEDIA_QUERY)?.matches === false) return SHELL_SCALE_MAX
  return resolveShellScale(window.innerWidth)
}


const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation()
  const { noise } = useSharedNoise()
  const storedSidebarCollapsed = readSidebarCollapsed()
  const [compactViewport, setCompactViewport] = useState(() => readCompactViewport())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => storedSidebarCollapsed ?? false)
  const [sidebarDimmed, setSidebarDimmed] = useState(false)
  const [shellScale, setShellScale] = useState(() => readShellScale())
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const ambientScene = findMatchingNoiseScenePreset(noise.tracks)?.id ?? 'idle'
  useTaskReminderEngine()

  useEffect(() => {
    if (isLocalhostRuntime()) return
    const guard = () => {
      if (!getAuth()?.user) void clearLocalUserData()
    }
    guard()
    return subscribeAuth(guard)
  }, [])

  const isNoteRoute = location.pathname === ROUTES.NOTE
  const isTimelineRoute = location.pathname === ROUTES.TIMELINE
  const isDiaryRoute = location.pathname === ROUTES.DIARY
  const isCalendarRoute = location.pathname === ROUTES.CALENDAR
  const isFocusRoute = location.pathname === ROUTES.FOCUS
  const isTasksRoute = location.pathname === ROUTES.TASKS
  const isTripsRoute = location.pathname === ROUTES.TRIPS || location.pathname.startsWith('/trips/')
  const isFullBleedRoute = isNoteRoute || isTimelineRoute || isDiaryRoute || isCalendarRoute || isFocusRoute || isTasksRoute || isTripsRoute

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
      if (!nextCompact) {
        const stored = readSidebarCollapsed()
        if (stored !== null) setSidebarCollapsed(stored)
      }
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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      const selection = readStoredThemePreference()
      if (selection !== 'system') return
      applyTheme(resolveTheme('system'))
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSystemThemeChange)
      return () => media.removeEventListener('change', handleSystemThemeChange)
    }

    media.addListener(handleSystemThemeChange)
    return () => media.removeListener(handleSystemThemeChange)
  }, [])

  const shellStyle = {
    '--shell-scale': shellScale,
  } as CSSProperties

  return (
    <AuthGateProvider>
      <>
        <div className={`focus-shell ${sidebarDimmed ? 'focus-shell--sidebar-dimmed' : ''}`} data-ambient-scene={ambientScene} style={shellStyle}>
          <AmbientSceneStage scene={ambientScene} />
          <div className="focus-shell__scale-wrap">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />
            <main className={`focus-shell__main flex min-h-0 flex-1 flex-col ${isFullBleedRoute ? 'focus-shell__main--surface-less' : ''}`}>
              <section className={`focus-shell__route-layer flex min-h-0 flex-1 flex-col ${isFullBleedRoute ? 'focus-shell__route-layer--full-bleed' : ''}`}>
                <AuthInteractionGate>
                  {children}
                </AuthInteractionGate>
              </section>
            </main>
          </div>
        </div>
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        <TaskReminderModal />
      </>
    </AuthGateProvider>
  )
}

export default AppShell
