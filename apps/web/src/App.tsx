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
import { getAuthUrl } from './config/auth'
import { getAuth } from './store/auth'

const handleLogin = () => {
  window.location.href = getAuthUrl()
}

const handleLogout = () => {
  localStorage.removeItem('auth')
  window.location.reload()
}

const App = () => {
  // 在组件内部读取，确保 mountApp() 调用时拿到最新 localStorage
  const authState = getAuth()
  console.log('AUTH STATE:', authState)

  useEffect(() => {
    seedDatabase().then(() => {
      applyTheme(resolveInitialTheme())
    })
  }, [])

  const user = authState?.user

  return (
    <BrowserRouter>
      <PreferencesProvider>
        <ToastProvider>
          <LabsProvider>
            <SharedNoiseProvider>
              <div
                style={{
                  position: 'fixed',
                  top: 8,
                  right: 12,
                  zIndex: 99999,
                  pointerEvents: 'all',
                }}
              >
                {authState ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{user?.name || user?.nickname || user?.email}</span>
                    <button type="button" onClick={handleLogout}>Logout</button>
                  </div>
                ) : (
                  <button type="button" onClick={handleLogin}>Login</button>
                )}
              </div>
              <AppShell>
                <AppRoutes />
              </AppShell>
            </SharedNoiseProvider>
          </LabsProvider>
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

export default App
