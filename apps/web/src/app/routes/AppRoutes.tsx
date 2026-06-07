import { lazy, Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LEGACY_ROUTES, ROUTES } from './routes'
import { useLabs } from '../../features/labs/LabsContext'
import { usePremiumGate } from '../../features/premium/PremiumProvider'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
import { markDiscoveryNewSeen } from '../../shared/discovery/resetDiscovery'

const NotFoundPage = lazy(() => import('./NotFoundPage'))
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
const HabitTrackerPage = lazy(() => import('../../features/habits/pages/HabitTrackerPage'))
const MembershipPage = lazy(() => import('../../features/payments/pages/MembershipPage'))
const PaymentSuccessPage = lazy(() => import('../../features/payments/pages/PaymentSuccessPage'))
const AdminPage = lazy(() => import('../../features/admin/pages/AdminPage'))

export const RouteFallback = () => (
  <BrandLoader variant="inline" data-testid="route-loader" />
)

const GuardedHabitsRoute = () => {
  const { ready, canAccessHabitFeature } = useLabs()
  const { openUpgradeModal } = usePremiumGate()
  const location = useLocation()
  const didNotifyRef = useRef(false)

  const denied = ready && !canAccessHabitFeature

  useEffect(() => {
    if (denied && !didNotifyRef.current) {
      markDiscoveryNewSeen('nav-habits')
      openUpgradeModal('route', 'dashboard.extra-widgets')
      didNotifyRef.current = true
    }
    if (!denied) {
      didNotifyRef.current = false
    }
  }, [denied, openUpgradeModal])

  if (!ready) return null
  if (denied) return <Navigate to={ROUTES.LABS} replace state={{ from: location.pathname }} />
  return <Suspense fallback={<RouteFallback />}><HabitTrackerPage /></Suspense>
}

const GuardedProjectsRoute = ({ detail = false }: { detail?: boolean }) => {
  const { ready, catalog } = useLabs()
  const { openUpgradeModal } = usePremiumGate()
  const location = useLocation()
  const didNotifyRef = useRef(false)
  const projectFeature = catalog.find((item) => item.featureKey === 'project-workspace')
  const denied = ready && (!projectFeature || projectFeature.requiresPremium || projectFeature.state !== 'installed')

  useEffect(() => {
    if (denied && !didNotifyRef.current) {
      markDiscoveryNewSeen('nav-projects')
      openUpgradeModal('route', 'project.workspace')
      didNotifyRef.current = true
    }
    if (!denied) {
      didNotifyRef.current = false
    }
  }, [denied, openUpgradeModal])

  if (!ready) return null
  if (denied) return <Navigate to={ROUTES.LABS} replace state={{ from: location.pathname }} />
  if (detail) return <Suspense fallback={<RouteFallback />}><ProjectDetailPage /></Suspense>
  return <Suspense fallback={<RouteFallback />}><ProjectsPage /></Suspense>
}

const AppRoutes = () => {
  const location = useLocation()

  return (
    <Routes key={location.pathname} location={location}>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="/rss" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={<RouteFallback />}><DashboardRoute /></Suspense>} />
      <Route path={ROUTES.TIMELINE} element={<Suspense fallback={<RouteFallback />}><TimelinePage /></Suspense>} />
      <Route path={ROUTES.PROJECTS} element={<GuardedProjectsRoute />} />
      <Route path={ROUTES.PROJECT_DETAIL} element={<GuardedProjectsRoute detail />} />
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
      <Route path={ROUTES.MEMBERSHIP} element={<Suspense fallback={<RouteFallback />}><MembershipPage /></Suspense>} />
      <Route path={ROUTES.PREMIUM} element={<Navigate to={ROUTES.MEMBERSHIP} replace />} />
      <Route path={ROUTES.PREMIUM_SUCCESS} element={<Suspense fallback={<RouteFallback />}><PaymentSuccessPage /></Suspense>} />
      <Route path={ROUTES.HABITS} element={<GuardedHabitsRoute />} />
      <Route path={ROUTES.ADMIN} element={<Suspense fallback={<RouteFallback />}><AdminPage /></Suspense>} />
      <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFoundPage /></Suspense>} />
    </Routes>
  )
}

export default AppRoutes
