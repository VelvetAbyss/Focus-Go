import type { ReactNode } from 'react'
import TasksBoard from '../tasks/TasksBoard'
import FocusCard from '../focus/FocusCard'
import SpendCard from '../spend/SpendCard'
import WidgetTodosCard from './cards/WidgetTodosCard'
import DiaryLauncherCard from './cards/DiaryLauncherCard'
import WeatherWidgetCard from './cards/WeatherWidgetCard'
import BooksCard from '../life/cards/BooksCard'
import DailyReviewCard from '../life/cards/DailyReviewCard'
import MediaCard from '../life/cards/MediaCard'
import SubscriptionsCard from '../life/cards/SubscriptionsCard'
import StocksCard from '../life/cards/StocksCard'
import TripsCard from '../life/cards/TripsCard'

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
    id: 'diary',
    title: 'Diary',
    defaultSize: { w: 6, h: 3 },
    pageScope: 'main',
    render: () => <DiaryLauncherCard />,
  },
]

export const getLifeCards = (): DashboardCard[] => [
  {
    id: 'daily_review',
    title: 'Daily Review',
    defaultSize: { w: 14, h: 8 },
    pageScope: 'life',
    render: () => <DailyReviewCard />,
  },
  {
    id: 'library',
    title: 'Library',
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <BooksCard />,
  },
  {
    id: 'media_card',
    title: 'Media',
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <MediaCard />,
  },
  {
    id: 'trips_card',
    title: 'Trips',
    defaultSize: { w: 8, h: 8 },
    pageScope: 'life',
    render: () => <TripsCard />,
  },
  {
    id: 'subscriptions_card',
    title: 'Subscriptions',
    defaultSize: { w: 24, h: 4 },
    pageScope: 'life',
    render: () => <SubscriptionsCard />,
  },
  {
    id: 'stocks',
    title: 'Stocks',
    defaultSize: { w: 10, h: 8 },
    pageScope: 'life',
    render: () => <StocksCard />,
  },
]
