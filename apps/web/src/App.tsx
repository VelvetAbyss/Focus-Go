import { useEffect } from 'react'
import AppShell from './app/layout/AppShell'
import AppRoutes from './app/routes/AppRoutes'
import { seedDatabase } from './data/seed'
import { applyTheme, resolveInitialTheme } from './shared/theme/theme'
import { BrowserRouter } from 'react-router-dom'
import { DatePickerProvider } from './shared/ui/datePicker/DatePickerProvider'
import { PreferencesProvider } from './shared/prefs/PreferencesProvider'
import { ToastProvider } from './shared/ui/toast/ToastProvider'

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
            <AppShell>
              <AppRoutes />
            </AppShell>
          </DatePickerProvider>
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}

export default App
