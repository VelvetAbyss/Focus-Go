import type { ReactNode } from 'react'
import TasksBoard from '../tasks/TasksBoard'
import FocusCard from '../focus/FocusCard'
import SpendCard from '../spend/SpendCard'
import WidgetTodosCard from './cards/WidgetTodosCard'
import DiaryLauncherCard from './cards/DiaryLauncherCard'
import WeatherWidgetCard from './cards/WeatherWidgetCard'
import BooksCard from '../life/cards/BooksCard'
import MediaCard from '../life/cards/MediaCard'
import SubscriptionsCard from '../life/cards/SubscriptionsCard'

export type DashboardCard = {
  id: string
  title: string
  defaultSize: { w: number; h: number }
  defaultVisible?: boolean
  render: () => ReactNode
}

export const getDashboardCards = (): DashboardCard[] => [
  {
    id: 'tasks',
    title: 'Tasks',
    defaultSize: { w: 4, h: 4 },
    render: () => <TasksBoard />,
  },
  {
    id: 'focus',
    title: 'Focus Center',
    defaultSize: { w: 4, h: 3 },
    render: () => <FocusCard />,
  },
  {
    id: 'spend',
    title: 'Spend',
    defaultSize: { w: 4, h: 3 },
    render: () => <SpendCard />,
  },
  {
    id: 'weather',
    title: 'Weather',
    defaultSize: { w: 4, h: 2 },
    render: () => <WeatherWidgetCard />,
  },
  {
    id: 'widget-todos',
    title: 'Daily/Weekly/Monthly',
    defaultSize: { w: 6, h: 3 },
    render: () => <WidgetTodosCard />,
  },
  {
    id: 'diary',
    title: 'Diary',
    defaultSize: { w: 6, h: 3 },
    render: () => <DiaryLauncherCard />,
  },
]

export const getLifeCards = (): DashboardCard[] => [
  {
    id: 'books_card',
    title: 'Books',
    defaultSize: { w: 4, h: 3 },
    render: () => <BooksCard />,
  },
  {
    id: 'media_card',
    title: 'Media',
    defaultSize: { w: 4, h: 3 },
    render: () => <MediaCard />,
  },
  {
    id: 'subscriptions_card',
    title: 'Subscriptions',
    defaultSize: { w: 8, h: 2 },
    render: () => <SubscriptionsCard />,
  },
]
