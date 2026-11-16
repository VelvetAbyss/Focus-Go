import { useEffect, useLayoutEffect, useState, useRef, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'
import { useI18n } from '../../shared/i18n/useI18n'
import { ROUTES } from '../routes/routes'
import {
  applyTheme,
  readStoredThemePreference,
  resolveTheme,
} from '../../shared/theme/theme'
import Sidebar from './Sidebar'
import AmbientSceneStage from './AmbientSceneStage'
import { useTaskReminderEngine } from '../../features/tasks/useTaskReminderEngine'
import { useQuickCapture } from '../../features/tasks/application/useQuickCapture'
import { useWebPushLifecycle } from '../../shared/push/useWebPushLifecycle'
import TaskReminderModal from '../../features/tasks/TaskReminderModal'
import { AuthGateProvider } from '../../features/auth/AuthGateContext'
import AuthInteractionGate from '../../features/auth/AuthInteractionGate'
import CommandPalette from '../../shared/ui/CommandPalette'
import { useSharedNoise } from '../../features/focus/SharedNoiseProvider'
import { findMatchingNoiseScenePreset } from '../../features/focus/noise'
import { useAmbientPreferences } from '../../features/focus/ambientPreferences'
import '../../shared/theme/ambient-theme.css'
import { installInteractionSounds } from '../../shared/sound/interactionSounds'
import '../../shared/theme/workspace-design.css'
import '../../shared/theme/workspace-responsive.css'

type AppShellProps = {
  children: ReactNode
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'focusgo.sidebar.collapsed.v1'
const readSidebarCollapsed = () => {
  if (typeof localStorage === 'undefined') return false
  const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  if (raw === null) return null
  return raw === '1'
}

// Browser zoom owns text scaling. Reflow never counter-scales the user's zoom.
// eslint-disable-next-line react-refresh/only-export-components, @typescript-eslint/no-unused-vars
export const resolveShellScale = (_viewportWidth: number) => 1

const AppShell = ({ children }: AppShellProps) => {
  useEffect(installInteractionSounds, [])
  const location = useLocation()
  const { noise } = useSharedNoise()
  const { language } = useI18n()
  const zh = language === 'zh'
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1920 : window.innerWidth)
  const compactViewport = viewportWidth < 1280
  const drawerLayout = viewportWidth <= 960
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed() ?? false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [compactSidebarExpanded, setCompactSidebarExpanded] = useState(false)
  const navigationRef = useRef<HTMLDivElement>(null)
  const navigationTriggerRef = useRef<HTMLButtonElement>(null)
  const navigationCloseRef = useRef<HTMLButtonElement>(null)
  const [sidebarDimmed, setSidebarDimmed] = useState(false)
  const shellScale = resolveShellScale(viewportWidth)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const ambientPrefs = useAmbientPreferences()
  // With no sound scene playing, the desk stays plain unless an idle effect
  // has been selected in settings.
  const ambientScene = findMatchingNoiseScenePreset(noise.tracks)?.id ?? (ambientPrefs.effects.idle.windowLight ? 'window-light' : 'idle')
  const showAmbientStage = ambientScene !== 'idle' || ambientPrefs.effects.idle.timeOfDayPalette || ambientPrefs.effects.idle.slowBreath
  // Publish to the root so portaled dialogs, native controls and route surfaces
  // share the same environment. Light/dark remains the user's independent choice.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.ambientScene = ambientScene
    return () => { delete root.dataset.ambientScene }
  }, [ambientScene])
  useTaskReminderEngine()
  useWebPushLifecycle()
  useQuickCapture()

  // Local data is cleared only by signing out on purpose (the account menu). An expired or
  // revoked session keeps it and asks for sign-in again (AuthGateProvider), so nothing written
  // offline is lost; signing in as another account is refused until this one's data is cleared.

  const isNoteRoute = location.pathname === ROUTES.NOTE
  const isTimelineRoute = location.pathname === ROUTES.TIMELINE
  const isDiaryRoute = location.pathname === ROUTES.DIARY
  const isCalendarRoute = location.pathname === ROUTES.CALENDAR
  const isFocusRoute = location.pathname === ROUTES.FOCUS
  const isTasksRoute = location.pathname === ROUTES.TASKS
  const isTripsRoute = location.pathname === ROUTES.TRIPS || location.pathname.startsWith('/trips/')
  const isFullBleedRoute = [ROUTES.BAZI, ROUTES.ASTROLOGY, ROUTES.TAROT].some(route => location.pathname === route) || isNoteRoute || isTimelineRoute || isDiaryRoute || isCalendarRoute || isFocusRoute || isTasksRoute || isTripsRoute

  useEffect(() => {
    if (compactViewport) return
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
  }, [compactViewport, sidebarCollapsed])

  useEffect(() => {
    if (!compactViewport) {
      const stored = readSidebarCollapsed()
      if (stored !== null) setSidebarCollapsed(stored)
    }
  }, [compactViewport])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { setNavigationOpen(false) }, [location.pathname, drawerLayout])

  useEffect(() => {
    if (!drawerLayout || !navigationOpen) return
    const trigger = navigationTriggerRef.current
    const focusFrame = window.requestAnimationFrame(() => navigationCloseRef.current?.focus())
    const outsideDialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
      .find((node) => node !== navigationRef.current && !navigationRef.current?.contains(node))
    // Account dialogs portal outside the rail. Dismiss the underlying drawer,
    // keep its tools mounted, and hand focus to the dialog instead of trapping it.
    const observer = new MutationObserver(() => { if (outsideDialog()) setNavigationOpen(false) })
    observer.observe(document.body, { childList: true, subtree: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || outsideDialog()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setNavigationOpen(false)
      }
      // Portaled pickers/dialogs manage their own focus while open.
      if (event.key !== 'Tab' || !navigationRef.current?.contains(document.activeElement)) return
      const controls = Array.from(navigationRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'))
        .filter((node) => node.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown)
      const dialogControl = outsideDialog()?.querySelector<HTMLElement>('button, input, [tabindex="0"]')
      ;(dialogControl ?? trigger)?.focus()
    }
  }, [drawerLayout, navigationOpen])

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

  // Overlays portal to <body>, outside the zoomed wrapper: give them the same scale
  // (shared/theme/overlay-scale.css).
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--overlay-scale', String(shellScale))
    return () => {
      root.style.removeProperty('--overlay-scale')
    }
  }, [shellScale])

  const shellStyle = {
    '--shell-scale': shellScale,
  } as CSSProperties

  return (
    <AuthGateProvider>
      <>
        <div className={`focus-shell ${sidebarDimmed ? 'focus-shell--sidebar-dimmed' : ''}`} data-ambient-scene={ambientScene} data-layout={drawerLayout ? 'drawer' : compactViewport ? 'compact' : 'wide'} data-navigation-open={navigationOpen} style={shellStyle}>
          {showAmbientStage ? <AmbientSceneStage scene={ambientScene} /> : null}
          <div className="focus-shell__scale-wrap">
            <header className="focus-shell__mobile-bar" inert={drawerLayout && navigationOpen}>
              <button ref={navigationTriggerRef} type="button" aria-label={zh ? '打开导航' : 'Open navigation'} aria-expanded={navigationOpen} aria-controls="workspace-navigation" onClick={() => setNavigationOpen(true)}><Menu size={20} /><span>{zh ? '菜单' : 'Menu'}</span></button>
              <span className="focus-shell__brand">Focus<span>&</span>go</span>
              <button type="button" aria-label={zh ? '搜索与命令' : 'Search and commands'} onClick={() => setCommandPaletteOpen(true)}><Search size={20} /></button>
            </header>
            {drawerLayout && navigationOpen ? <button className="focus-shell__nav-backdrop" aria-label={zh ? '关闭导航' : 'Close navigation'} tabIndex={-1} onClick={() => setNavigationOpen(false)} /> : null}
            <div id="workspace-navigation" ref={navigationRef} className="focus-shell__navigation" inert={drawerLayout && !navigationOpen} role={drawerLayout && navigationOpen ? 'dialog' : undefined} aria-modal={drawerLayout && navigationOpen ? true : undefined} aria-label={drawerLayout ? (zh ? '工作区导航' : 'Workspace navigation') : undefined}
              onClickCapture={(event) => { if (drawerLayout && (event.target as HTMLElement).closest('a[href]')) setNavigationOpen(false) }}>
              <button className="focus-shell__nav-close" ref={navigationCloseRef} type="button" aria-label={zh ? '关闭导航' : 'Close navigation'} onClick={() => setNavigationOpen(false)}><X size={20} /></button>
              <Sidebar collapsed={drawerLayout ? false : compactViewport ? !compactSidebarExpanded : sidebarCollapsed} onToggle={() => drawerLayout ? setNavigationOpen(false) : compactViewport ? setCompactSidebarExpanded((prev) => !prev) : setSidebarCollapsed((prev) => !prev)} drawer={drawerLayout} />
            </div>
            <main className="focus-shell__main flex min-h-0 flex-1 flex-col" inert={drawerLayout && navigationOpen}>
              <div className="relative min-h-0 flex-1">
              <section className={`focus-shell__route-layer flex min-h-0 flex-1 flex-col ${isFullBleedRoute ? 'focus-shell__route-layer--full-bleed' : ''}`}>
                <AuthInteractionGate className="focus-shell__route-content">
                  {children}
                </AuthInteractionGate>
              </section>
              </div>
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
