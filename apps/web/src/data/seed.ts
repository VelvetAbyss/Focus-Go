import { dashboardRepo } from './repositories/dashboardRepo'
import { diaryRepo } from './repositories/diaryRepo'
import { focusRepo } from './repositories/focusRepo'
import { spendRepo } from './repositories/spendRepo'
import { tasksRepo } from './repositories/tasksRepo'
import { widgetTodoRepo } from './repositories/widgetTodoRepo'
import type { TaskPriority } from './models/types'
import { createId } from '../shared/utils/ids'
import { toDateKey } from '../shared/utils/time'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from './defaultDashboardLayout'

const priorityCycle: TaskPriority[] = ['high', 'medium', 'low']

export const seedDatabase = async () => {
  const existingTasks = await tasksRepo.list()
  if (existingTasks.length > 0) return

  const todayKey = toDateKey()
  const tomorrowKey = toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))

  await tasksRepo.add({
    title: 'Draft MVP onboarding flow',
    status: 'todo',
    priority: 'high',
    dueDate: tomorrowKey,
    tags: ['mvp', 'ux'],
    subtasks: [
      { id: createId(), title: 'Sketch entry states', done: false },
      { id: createId(), title: 'Decide copy tone', done: false },
    ],
  })

  await tasksRepo.add({
    title: 'Focus Center animation polish',
    status: 'doing',
    priority: 'medium',
    dueDate: todayKey,
    tags: ['motion'],
    subtasks: [],
  })

  await tasksRepo.add({
    title: 'Prepare spend categories',
    status: 'done',
    priority: 'low',
    tags: ['finance'],
    subtasks: [],
  })

  await Promise.all(
    ['day', 'week', 'month'].map((scope, index) =>
      widgetTodoRepo.add({
        scope: scope as 'day' | 'week' | 'month',
        title: `Plan ${scope} rhythm`,
        priority: priorityCycle[index],
        dueDate: tomorrowKey,
        done: false,
      })
    )
  )

  await diaryRepo.add({
    dateKey: todayKey,
    contentMd:
      '## Today\n- Reviewed MVP structure\n- Defined Apple-minimal tone\n- Collected visual references',
    tags: ['daily'],
  })

  const [foodCategory, toolsCategory] = await Promise.all([
    spendRepo.addCategory({ name: 'Food', icon: 'UtensilsCrossed' }),
    spendRepo.addCategory({ name: 'Tools', icon: 'Toolbox' }),
  ])

  await spendRepo.addEntry({
    amount: 38,
    currency: 'CNY',
    categoryId: foodCategory.id,
    note: 'Team lunch',
    dateKey: todayKey,
  })

  await spendRepo.addEntry({
    amount: 12,
    currency: 'USD',
    categoryId: toolsCategory.id,
    note: 'Design resource',
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
}
