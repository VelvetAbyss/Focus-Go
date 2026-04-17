import { useEffect } from 'react'
import AppShell from './app/layout/AppShell'
import AppRoutes from './app/routes/AppRoutes'
import { seedDatabase } from './data/seed'
import { applyTheme, resolveInitialTheme } from './shared/theme/theme'
import { BrowserRouter } from 'react-router-dom'
import { PreferencesProvider } from './shared/prefs/PreferencesProvider'
import { ToastProvider } from './shared/ui/toast/ToastProvider'
import { LabsProvider } from './features/labs/LabsContext'
import { SharedNoiseProvider } from './features/focus/SharedNoiseProvider'
import { PremiumProvider } from './features/premium/PremiumProvider'
import { SyncProvider } from './data/sync/service'
import { useIsLoggedIn, refreshAuthProfile } from './store/auth'
import { SYNC_DATA_UPDATED_EVENT } from './data/sync/constants'
import { syncedPreferencesRepo } from './data/repositories/syncedPreferencesRepo'

const App = () => {
  const isLoggedIn = useIsLoggedIn()

  useEffect(() => {
    if (isLoggedIn) void refreshAuthProfile()
  }, [isLoggedIn])

  useEffect(() => {
    seedDatabase().then(async () => {
      await syncedPreferencesRepo.hydrateLocalFromDb()
      applyTheme(resolveInitialTheme())
    })
  }, [])

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
        <ToastProvider>
          <SyncProvider>
            <PremiumProvider>
              <LabsProvider>
                <SharedNoiseProvider>
                  <AppShell>
                    <AppRoutes key={isLoggedIn ? 'authenticated' : 'guest'} />
                  </AppShell>
                </SharedNoiseProvider>
              </LabsProvider>
            </PremiumProvider>
          </SyncProvider>
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

export default App
