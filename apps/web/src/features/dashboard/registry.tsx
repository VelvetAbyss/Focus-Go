import { Suspense, lazy } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import TasksBoard from '../tasks/TasksBoard'
import FocusCard from '../focus/FocusCard'
import SpendCard from '../spend/SpendCard'
import WidgetTodosCard from './cards/WidgetTodosCard'
import WeatherWidgetCard from './cards/WeatherWidgetCard'
import type { LifeTranslate } from '../life/lifeI18n'

const WorldClockCard = lazy(() => import('../life/cards/WorldClockCard'))
const BooksCard = lazy(() => import('../life/cards/BooksCard'))
const DailyReviewCard = lazy(() => import('../life/cards/DailyReviewCard'))
const MediaCard = lazy(() => import('../life/cards/MediaCard'))
const PeopleCard = lazy(() => import('../life/cards/PeopleCard'))
const PodcastCard = lazy(() => import('../life/cards/PodcastCard'))
const SubscriptionsCard = lazy(() => import('../life/cards/SubscriptionsCard'))
const StocksCard = lazy(() => import('../life/cards/StocksCard'))
const TripsCard = lazy(() => import('../life/cards/TripsCard'))

const lifeCardFallbackStyle = {
  height: '100%',
  borderRadius: 24,
  background: '#ffffff',
  boxShadow: '0 12px 28px rgba(58, 55, 51, 0.05)',
} satisfies CSSProperties

const renderLazyLifeCard = (node: ReactNode) => (
  <Suspense fallback={<div aria-hidden="true" style={lifeCardFallbackStyle} />}>{node}</Suspense>
)

export type DashboardCard = {
  id: string
  title: string
  defaultSize: { w: number; h: number }
  defaultVisible?: boolean
  pageScope?: 'main' | 'life'
  render: () => ReactNode
}

export const getDashboardCards = (): DashboardCard[] => [
  {
    id: 'tasks',
    title: 'Tasks',
    defaultSize: { w: 4, h: 4 },
    pageScope: 'main',
    render: () => <TasksBoard />,
  },
  {
    id: 'focus',
    title: 'Focus Center',
    defaultSize: { w: 4, h: 3 },
    pageScope: 'main',
    render: () => <FocusCard />,
  },
  {
    id: 'spend',
    title: 'Spend',
    defaultSize: { w: 4, h: 3 },
    pageScope: 'main',
    render: () => <SpendCard />,
  },
  {
    id: 'weather',
    title: 'Weather',
    defaultSize: { w: 4, h: 2 },
    pageScope: 'main',
    render: () => <WeatherWidgetCard />,
  },
  {
    id: 'widget-todos',
    title: 'Daily/Weekly/Monthly',
    defaultSize: { w: 6, h: 3 },
    pageScope: 'main',
    render: () => <WidgetTodosCard />,
  },
  {
    id: 'world_clock',
    title: 'World Clock',
    defaultSize: { w: 3, h: 4 },
    pageScope: 'main',
    render: () => renderLazyLifeCard(<WorldClockCard />),
  },
]

export const getLifeCards = (t: LifeTranslate): DashboardCard[] => [
  {
    id: 'daily_review',
    title: t('life.card.dailyReview'),
    defaultSize: { w: 14, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<DailyReviewCard />),
  },
  {
    id: 'library',
    title: t('life.card.library'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<BooksCard />),
  },
  {
    id: 'media_card',
    title: t('life.card.media'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<MediaCard />),
  },
  {
    id: 'trips_card',
    title: t('life.card.trips'),
    defaultSize: { w: 8, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<TripsCard />),
  },
  {
    id: 'subscriptions_card',
    title: t('life.card.subscriptions'),
    defaultSize: { w: 24, h: 4 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<SubscriptionsCard />),
  },
  {
    id: 'podcast_card',
    title: t('life.card.podcast'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<PodcastCard />),
  },
  {
    id: 'people_card',
    title: t('life.card.people'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<PeopleCard />),
  },
  {
    id: 'stocks',
    title: 'Stocks',
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => renderLazyLifeCard(<StocksCard />),
  },
]
