import { useEffect, useRef } from 'react'
import AppShell from './app/layout/AppShell'
import DashboardRoute from './app/routes/DashboardRoute'
import SettingsRoute from './app/routes/SettingsRoute'
import { seedDatabase } from './data/seed'
import { applyTheme, resolveInitialTheme } from './shared/theme/theme'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { DatePickerProvider } from './shared/ui/datePicker/DatePickerProvider'
import { PreferencesProvider } from './shared/prefs/PreferencesProvider'
import { ToastProvider } from './shared/ui/toast/ToastProvider'

const AppRoutes = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const checkedInitialRoute = useRef(false)

  useEffect(() => {
    if (checkedInitialRoute.current) return
    checkedInitialRoute.current = true
    if (location.pathname === '/settings' && location.key === 'default') {
      navigate('/', { replace: true })
    }
  }, [location.key, location.pathname, navigate])

  return (
    <AppShell>
      <DashboardRoute />
      {location.pathname === '/settings' ? <SettingsRoute /> : null}
    </AppShell>
  )
}

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
          <DatePickerProvider>
            <AppRoutes />
          </DatePickerProvider>
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

export default App
