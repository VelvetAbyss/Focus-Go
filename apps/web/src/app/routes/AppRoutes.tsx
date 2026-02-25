import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardRoute from './DashboardRoute'
import SettingsRoute from './SettingsRoute'
import { LEGACY_ROUTES, ROUTES } from './routes'
import RssPage from '../../features/rss/pages/RssPage'
import TasksPage from '../../features/tasks/pages/TasksPage'
import CalendarPage from '../../features/calendar/pages/CalendarPage'
import FocusPage from '../../features/focus/pages/FocusPage'
import NotesPage from '../../features/notes/pages/NotesPage'
import ReviewPage from '../../features/diary/pages/ReviewPage'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.NOTES} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<DashboardRoute />} />
      <Route path={ROUTES.RSS} element={<RssPage />} />
      <Route path={ROUTES.TASKS} element={<TasksPage />} />
      <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
      <Route path={ROUTES.FOCUS} element={<FocusPage />} />
      <Route path={ROUTES.NOTES} element={<NotesPage />} />
      <Route path={ROUTES.REVIEW} element={<ReviewPage />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsRoute />} />
    </Routes>
  )
}

export default AppRoutes
