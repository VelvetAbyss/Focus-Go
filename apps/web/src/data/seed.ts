import { dashboardRepo } from './repositories/dashboardRepo'
import { diaryRepo } from './repositories/diaryRepo'
import { focusRepo } from './repositories/focusRepo'
import { lifeDashboardRepo } from './repositories/lifeDashboardRepo'
import { spendRepo } from './repositories/spendRepo'
import { syncedPreferencesRepo } from './repositories/syncedPreferencesRepo'
import { tasksRepo } from './repositories/tasksRepo'
import { widgetTodoRepo } from './repositories/widgetTodoRepo'
import { toDateKey } from '../shared/utils/time'
import { ensureLabsSeed } from '../features/labs/labsApi'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from './defaultDashboardLayout'

const DEFAULT_LIFE_LAYOUT_ITEMS = [
  { key: 'library', x: 5, y: 3, w: 6, h: 8 },
  { key: 'media_card', x: 5, y: 17, w: 6, h: 7 },
  { key: 'subscriptions_card', x: 18, y: 24, w: 6, h: 7 },
  { key: 'daily_review', x: 11, y: 32, w: 7, h: 7 },
  { key: 'trips_card', x: 18, y: 7, w: 6, h: 8 },
  { key: 'podcast_card', x: 0, y: 24, w: 5, h: 15 },
  { key: 'people_card', x: 11, y: 39, w: 7, h: 8 },
]

const DEFAULT_LIFE_HIDDEN_CARD_IDS = ['stocks']

const hasExistingSeedSurfaceData = async () => {
  const [tasks, widgetTodos, diaryEntries, spendEntries, spendCategories, focusSettings] = await Promise.all([
    tasksRepo.list(),
    widgetTodoRepo.list(),
    diaryRepo.list(),
    spendRepo.listEntries(),
    spendRepo.listCategories(),
    focusRepo.get(),
  ])
  return (
    tasks.length > 0 ||
    widgetTodos.length > 0 ||
    diaryEntries.length > 0 ||
    spendEntries.length > 0 ||
    spendCategories.length > 0 ||
    focusSettings !== null
  )
}

export const seedDatabase = async () => {
  await ensureLabsSeed()
  const initialSeedCompletedAt = await syncedPreferencesRepo.getInitialSeedCompletedAt()
  if (initialSeedCompletedAt) return false

  if (await hasExistingSeedSurfaceData()) {
    await syncedPreferencesRepo.markInitialSeedCompleted()
    return false
  }

  const todayKey = toDateKey()
  const tomorrowKey = toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))

  await tasksRepo.add({
    title: 'Plan today around one meaningful task',
    status: 'todo',
    priority: 'high',
    dueDate: tomorrowKey,
    tags: ['today'],
    subtasks: [],
  })

  await widgetTodoRepo.add({
    scope: 'day',
    title: 'Keep the dashboard light: one task, one session, one review.',
    priority: 'medium',
    dueDate: tomorrowKey,
    done: false,
  })

  await diaryRepo.add({
    dateKey: todayKey,
    entryAt: Date.now(),
    contentMd: '## Today\n- Chose one thing worth finishing\n- Left room for a focused session later',
    contentJson: null,
    tags: ['daily'],
    weatherSnapshot: null,
    deletedAt: null,
    expiredAt: null,
  })

  const lifeCategory = await spendRepo.addCategory({ name: 'Life', icon: 'WalletCards' })

  await spendRepo.addEntry({
    amount: 32,
    currency: 'CNY',
    categoryId: lifeCategory.id,
    note: 'Quick lunch between tasks',
    dateKey: todayKey,
  })

  await focusRepo.upsert({
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    noise: {
      playing: false,
      loop: true,
      masterVolume: 0.6,
      tracks: {
        cafe: { enabled: false, volume: 0.3 },
        fireplace: { enabled: false, volume: 0.3 },
        rain: { enabled: false, volume: 0.3 },
        wind: { enabled: false, volume: 0.3 },
        thunder: { enabled: false, volume: 0.3 },
        ocean: { enabled: false, volume: 0.3 },
      },
    },
    noisePreset: {
      presetId: 'default',
      presetName: 'Default',
      scope: 'focus-center',
      isPlaying: false,
      loop: true,
      tracks: {
        cafe: { enabled: false, volume: 0.6 },
        fireplace: { enabled: true, volume: 0.6 },
        rain: { enabled: true, volume: 0.6 },
        wind: { enabled: true, volume: 0.6 },
        thunder: { enabled: true, volume: 0.6 },
        ocean: { enabled: true, volume: 0.6 },
      },
    },
  })

  await dashboardRepo.upsert({
    items: DEFAULT_DASHBOARD_LAYOUT_ITEMS,
    hiddenCardIds: DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
    themeOverride: DEFAULT_DASHBOARD_THEME_OVERRIDE,
  })

  await lifeDashboardRepo.upsert({
    items: DEFAULT_LIFE_LAYOUT_ITEMS,
    hiddenCardIds: DEFAULT_LIFE_HIDDEN_CARD_IDS,
  })

  await syncedPreferencesRepo.markInitialSeedCompleted()
  return true
}
