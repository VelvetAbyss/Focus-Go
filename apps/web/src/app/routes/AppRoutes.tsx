import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import DashboardRoute from './DashboardRoute'
import SettingsRoute from './SettingsRoute'
import { LEGACY_ROUTES, ROUTES } from './routes'
import TasksPage from '../../features/tasks/pages/TasksPage'
import FocusPage from '../../features/focus/pages/FocusPage'
import CalendarPage from '../../features/calendar/pages/CalendarPage'
import NotesPage from '../../features/notes/pages/NotesPage'
import ReviewPage from '../../features/diary/pages/ReviewPage'
import LabsPage from '../../features/labs/pages/LabsPage'
import RssPage from '../../features/rss/pages/RssPage'
import HabitTrackerPage from '../../features/habits/pages/HabitTrackerPage'
import { useLabs } from '../../features/labs/LabsContext'
import { useToast } from '../../shared/ui/toast/toast'
import { useLabsI18n } from '../../features/labs/labsI18n'

const GuardedRssRoute = () => {
  const { ready, canAccessRssFeature } = useLabs()
  const toast = useToast()
  const i18n = useLabsI18n()
  const location = useLocation()
  const didNotifyRef = useRef(false)

  const denied = ready && !canAccessRssFeature

  useEffect(() => {
    if (denied && !didNotifyRef.current) {
      toast.push({ variant: 'info', message: i18n.toast.rssAccessDenied })
      didNotifyRef.current = true
    }
    if (!denied) {
      didNotifyRef.current = false
    }
  }, [denied, i18n.toast.rssAccessDenied, toast])

  if (!ready) return null
  if (denied) return <Navigate to={ROUTES.LABS} replace state={{ from: location.pathname }} />
  return <RssPage />
}

const GuardedHabitsRoute = () => {
  const { ready, canAccessHabitFeature } = useLabs()
  const toast = useToast()
  const i18n = useLabsI18n()
  const location = useLocation()
  const didNotifyRef = useRef(false)

  const denied = ready && !canAccessHabitFeature

  useEffect(() => {
    if (denied && !didNotifyRef.current) {
      toast.push({ variant: 'info', message: i18n.toast.habitAccessDenied })
      didNotifyRef.current = true
    }
    if (!denied) {
      didNotifyRef.current = false
    }
  }, [denied, i18n.toast.habitAccessDenied, toast])

  if (!ready) return null
  if (denied) return <Navigate to={ROUTES.LABS} replace state={{ from: location.pathname }} />
  return <HabitTrackerPage />
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.NOTES} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<DashboardRoute />} />
      <Route path={ROUTES.TASKS} element={<TasksPage />} />
      <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
      <Route path={ROUTES.FOCUS} element={<FocusPage />} />
      <Route path={ROUTES.NOTES} element={<NotesPage />} />
      <Route path={ROUTES.REVIEW} element={<ReviewPage />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsRoute />} />
      <Route path={ROUTES.LABS} element={<LabsPage />} />
      <Route path={ROUTES.RSS} element={<GuardedRssRoute />} />
      <Route path={ROUTES.HABITS} element={<GuardedHabitsRoute />} />
    </Routes>
  )
}

export default AppRoutes
