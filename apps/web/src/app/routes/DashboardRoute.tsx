import { lazy, Suspense } from 'react'
import FirstFocus from '../../features/onboarding/FirstFocus'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
const DashboardPage = lazy(() => import('../../features/dashboard/DashboardPage'))

const DashboardRoute = () => <FirstFocus><Suspense fallback={<BrandLoader variant="inline" />}><DashboardPage /></Suspense></FirstFocus>

export default DashboardRoute
