import { lazy, Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import DashboardRoute from './DashboardRoute'
import { LEGACY_ROUTES, ROUTES } from './routes'
import { useLabs } from '../../features/labs/LabsContext'
import { usePremiumGate } from '../../features/premium/PremiumProvider'

const TasksPage = lazy(() => import('../../features/tasks/pages/TasksPage'))
const NotePage = lazy(() => import('../../features/notes/pages/NotePage'))
const CalendarPage = lazy(() => import('../../features/calendar/pages/CalendarPage'))
const TripsPage = lazy(() => import('../../features/trips/TripsPage'))
const TripDetailPage = lazy(() => import('../../features/trips/TripDetailPage'))
const FocusPage = lazy(() => import('../../features/focus/pages/FocusPage'))
const DiaryPage = lazy(() => import('../../features/diary/pages/DiaryPage'))
const SettingsRoute = lazy(() => import('./SettingsRoute'))
const LabsPage = lazy(() => import('../../features/labs/pages/LabsPage'))
const HabitTrackerPage = lazy(() => import('../../features/habits/pages/HabitTrackerPage'))
const PremiumPricingPage = lazy(() => import('../../features/payments/pages/PremiumPricingPage'))
const PaymentSuccessPage = lazy(() => import('../../features/payments/pages/PaymentSuccessPage'))

export const RouteFallback = () => (
  <section className="route-loader" data-testid="route-loader" aria-live="polite" aria-busy="true">
    <span className="route-loader__mark" aria-hidden="true" />
    <span className="sr-only">Loading page</span>
  </section>
)

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
  return <Suspense fallback={<RouteFallback />}><HabitTrackerPage /></Suspense>
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path={LEGACY_ROUTES.KNOWLEDGE} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="/rss" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.DASHBOARD} element={<DashboardRoute />} />
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
      <Route path={ROUTES.PREMIUM} element={<Suspense fallback={<RouteFallback />}><PremiumPricingPage /></Suspense>} />
      <Route path={ROUTES.PREMIUM_SUCCESS} element={<Suspense fallback={<RouteFallback />}><PaymentSuccessPage /></Suspense>} />
      <Route path={ROUTES.HABITS} element={<GuardedHabitsRoute />} />
    </Routes>
  )
}

export default AppRoutes
