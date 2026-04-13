import type { ReactNode } from 'react'
import TasksBoard from '../tasks/TasksBoard'
import FocusCard from '../focus/FocusCard'
import SpendCard from '../spend/SpendCard'
import WidgetTodosCard from './cards/WidgetTodosCard'
import WeatherWidgetCard from './cards/WeatherWidgetCard'
import WorldClockCard from '../life/cards/WorldClockCard'
import BooksCard from '../life/cards/BooksCard'
import DailyReviewCard from '../life/cards/DailyReviewCard'
import MediaCard from '../life/cards/MediaCard'
import PeopleCard from '../life/cards/PeopleCard'
import PodcastCard from '../life/cards/PodcastCard'
import SubscriptionsCard from '../life/cards/SubscriptionsCard'
import StocksCard from '../life/cards/StocksCard'
import TripsCard from '../life/cards/TripsCard'
import type { LifeTranslate } from '../life/lifeI18n'

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
    render: () => <WorldClockCard />,
  },
]

export const getLifeCards = (t: LifeTranslate): DashboardCard[] => [
  {
    id: 'daily_review',
    title: t('life.card.dailyReview'),
    defaultSize: { w: 14, h: 8 },
    pageScope: 'life',
    render: () => <DailyReviewCard />,
  },
  {
    id: 'library',
    title: t('life.card.library'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <BooksCard />,
  },
  {
    id: 'media_card',
    title: t('life.card.media'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <MediaCard />,
  },
  {
    id: 'trips_card',
    title: t('life.card.trips'),
    defaultSize: { w: 8, h: 8 },
    pageScope: 'life',
    render: () => <TripsCard />,
  },
  {
    id: 'subscriptions_card',
    title: t('life.card.subscriptions'),
    defaultSize: { w: 24, h: 4 },
    pageScope: 'life',
    render: () => <SubscriptionsCard />,
  },
  {
    id: 'podcast_card',
    title: t('life.card.podcast'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <PodcastCard />,
  },
  {
    id: 'people_card',
    title: t('life.card.people'),
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <PeopleCard />,
  },
  {
    id: 'stocks',
    title: 'Stocks',
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <StocksCard />,
  },
]
