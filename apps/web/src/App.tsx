import { useEffect } from 'react'
import AppShell from './app/layout/AppShell'
import AppRoutes from './app/routes/AppRoutes'
import AppBootGate from './app/AppBootGate'
import { applyTheme, resolveInitialTheme } from './shared/theme/theme'
import { BrowserRouter } from 'react-router-dom'
import { PreferencesProvider } from './shared/prefs/PreferencesProvider'
import { ToastProvider } from './shared/ui/toast/ToastProvider'
import { LabsProvider } from './features/labs/LabsContext'
import { DiscoveryHintProvider } from './shared/discovery/DiscoveryHintContext'
import { SharedNoiseProvider } from './features/focus/SharedNoiseProvider'
import { PremiumProvider } from './features/premium/PremiumProvider'
import { SyncProvider } from './data/sync/service'
import { useIsLoggedIn, refreshAuthProfile } from './store/auth'
import { SYNC_DATA_UPDATED_EVENT } from './data/sync/constants'
import { syncedPreferencesRepo } from './data/repositories/syncedPreferencesRepo'
import { useDesktopAuthDeepLink } from './config/desktopAuth'
import { getPlatform } from './platform'

const App = () => {
  const isLoggedIn = useIsLoggedIn()

  // Desktop-only: complete Google sign-in when the focusgo:// callback returns.
  useDesktopAuthDeepLink()

  // Desktop-only: reveal the window after first paint (created hidden → no flash).
  // The update check deliberately lives in StartupGate instead, which renders
  // even when this component does not.
  useEffect(() => {
    const platform = getPlatform()
    const frame = requestAnimationFrame(() => void platform.showAppWindow())
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (isLoggedIn) void refreshAuthProfile()
  }, [isLoggedIn])

  useEffect(() => {
    const handleSyncDataUpdated = () => {
      void syncedPreferencesRepo.hydrateLocalFromDb().then(() => {
        applyTheme(resolveInitialTheme())
      })
    }
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, handleSyncDataUpdated)
    return () => window.removeEventListener(SYNC_DATA_UPDATED_EVENT, handleSyncDataUpdated)
  }, [])

  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AppBootGate>
          <ToastProvider>
            <SyncProvider>
              <PremiumProvider>
              <DiscoveryHintProvider>
                <LabsProvider>
                  <SharedNoiseProvider>
                    <AppShell>
                      <AppRoutes key={isLoggedIn ? 'authenticated' : 'guest'} />
                    </AppShell>
                  </SharedNoiseProvider>
                </LabsProvider>
                </DiscoveryHintProvider>
              </PremiumProvider>
            </SyncProvider>
          </ToastProvider>
        </AppBootGate>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

export default App
