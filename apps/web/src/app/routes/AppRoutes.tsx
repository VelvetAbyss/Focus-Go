import { lazy, Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import DashboardRoute from './DashboardRoute'
import SettingsRoute from './SettingsRoute'
import { LEGACY_ROUTES, ROUTES } from './routes'
import TasksPage from '../../features/tasks/pages/TasksPage'
import NotePage from '../../features/notes/pages/NotePage'
import CalendarPage from '../../features/calendar/pages/CalendarPage'
import DiaryPage from '../../features/diary/pages/DiaryPage'
import LabsPage from '../../features/labs/pages/LabsPage'
import HabitTrackerPage from '../../features/habits/pages/HabitTrackerPage'
import { useLabs } from '../../features/labs/LabsContext'
import { usePremiumGate } from '../../features/premium/PremiumProvider'

const FocusPage = lazy(() => import('../../features/focus/pages/FocusPage'))

const GuardedHabitsRoute = () => {
  const { ready, canAccessHabitFeature } = useLabs()
  const { openUpgradeModal } = usePremiumGate()
  const location = useLocation()
  const didNotifyRef = useRef(false)

  const denied = ready && !canAccessHabitFeature

  useEffect(() => {
    if (denied && !didNotifyRef.current) {
      openUpgradeModal('route', 'dashboard.extra-widgets')
      didNotifyRef.current = true
    }
    if (!denied) {
      didNotifyRef.current = false
    }
  }, [denied, openUpgradeModal])

  if (!ready) return null
  if (denied) return <Navigate to={ROUTES.LABS} replace state={{ from: location.pathname }} />
  return <HabitTrackerPage />
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="/rss" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<DashboardRoute />} />
      <Route path={ROUTES.TASKS} element={<TasksPage />} />
      <Route path={ROUTES.NOTE} element={<NotePage />} />
      <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
      <Route
        path={ROUTES.FOCUS}
        element={
          <Suspense fallback={null}>
            <FocusPage />
          </Suspense>
        }
      />
      <Route path={ROUTES.REVIEW} element={<Navigate to={ROUTES.DIARY} replace />} />
      <Route path={ROUTES.DIARY} element={<DiaryPage />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsRoute />} />
      <Route path={ROUTES.LABS} element={<LabsPage />} />
      <Route path={ROUTES.HABITS} element={<GuardedHabitsRoute />} />
    </Routes>
  )
}

export default AppRoutes
