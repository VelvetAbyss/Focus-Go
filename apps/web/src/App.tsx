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

const App = () => {
  useEffect(() => {
    seedDatabase().then(() => {
      applyTheme(resolveInitialTheme())
    })
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
                    <AppRoutes />
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
