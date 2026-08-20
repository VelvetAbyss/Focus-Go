import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LEGACY_ROUTES, ROUTES } from './routes'
import BrandLoader from '../../shared/ui/loading/BrandLoader'

const DashboardRoute = lazy(() => import('./DashboardRoute'))
const TimelinePage = lazy(() => import('../../features/timeline/pages/TimelinePage'))
const TasksPage = lazy(() => import('../../features/tasks/pages/TasksPage'))
const ProjectsPage = lazy(() => import('../../features/projects/pages/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('../../features/projects/pages/ProjectDetailPage'))
const NotePage = lazy(() => import('../../features/notes/pages/NotePage'))
const CalendarPage = lazy(() => import('../../features/calendar/pages/CalendarPage'))
const TripsPage = lazy(() => import('../../features/trips/TripsPage'))
const TripDetailPage = lazy(() => import('../../features/trips/TripDetailPage'))
const FocusPage = lazy(() => import('../../features/focus/pages/FocusPage'))
const DiaryPage = lazy(() => import('../../features/diary/pages/DiaryPage'))
const SettingsRoute = lazy(() => import('./SettingsRoute'))
const LabsPage = lazy(() => import('../../features/labs/pages/LabsPage'))
const SupportPage = lazy(() => import('../../features/support/SupportPage'))
const HabitTrackerPage = lazy(() => import('../../features/habits/pages/HabitTrackerPage'))
const AdminPage = lazy(() => import('../../features/admin/pages/AdminPage'))

export const RouteFallback = () => (
  <BrandLoader variant="inline" data-testid="route-loader" />
)

const AppRoutes = () => {
  const location = useLocation()

  return (
    <Routes key={location.pathname} location={location}>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="/rss" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={<RouteFallback />}><DashboardRoute /></Suspense>} />
      <Route path={ROUTES.TIMELINE} element={<Suspense fallback={<RouteFallback />}><TimelinePage /></Suspense>} />
      <Route path={ROUTES.PROJECTS} element={<Suspense fallback={<RouteFallback />}><ProjectsPage /></Suspense>} />
      <Route path={ROUTES.PROJECT_DETAIL} element={<Suspense fallback={<RouteFallback />}><ProjectDetailPage /></Suspense>} />
      <Route path={ROUTES.TASKS} element={<Suspense fallback={<RouteFallback />}><TasksPage /></Suspense>} />
      <Route path={ROUTES.NOTE} element={<Suspense fallback={<RouteFallback />}><NotePage /></Suspense>} />
      <Route path={ROUTES.CALENDAR} element={<Suspense fallback={<RouteFallback />}><CalendarPage /></Suspense>} />
      <Route path={ROUTES.TRIPS} element={<Suspense fallback={<RouteFallback />}><TripsPage /></Suspense>} />
      <Route path={ROUTES.TRIP_DETAIL} element={<Suspense fallback={<RouteFallback />}><TripDetailPage /></Suspense>} />
      <Route path={ROUTES.FOCUS} element={<Suspense fallback={<RouteFallback />}><FocusPage /></Suspense>} />
      <Route path={ROUTES.REVIEW} element={<Navigate to={ROUTES.DIARY} replace />} />
      <Route path={ROUTES.DIARY} element={<Suspense fallback={<RouteFallback />}><DiaryPage /></Suspense>} />
      <Route path={`${ROUTES.SETTINGS}/*`} element={<Suspense fallback={<RouteFallback />}><SettingsRoute /></Suspense>} />
      <Route path={ROUTES.LABS} element={<Suspense fallback={<RouteFallback />}><LabsPage /></Suspense>} />
      <Route path={ROUTES.SUPPORT} element={<Suspense fallback={<RouteFallback />}><SupportPage /></Suspense>} />
      <Route path={ROUTES.MEMBERSHIP} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.PREMIUM} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.PREMIUM_SUCCESS} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.HABITS} element={<Suspense fallback={<RouteFallback />}><HabitTrackerPage /></Suspense>} />
      <Route path={ROUTES.ADMIN} element={<Suspense fallback={<RouteFallback />}><AdminPage /></Suspense>} />
    </Routes>
  )
}

export default AppRoutes
