// @vitest-environment jsdom

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_ID } from './syncedPreferencesRepo'
import { writeLanguage, writeWorldClockItems } from '../../shared/prefs/preferences'
import { writeStoredThemePreference } from '../../shared/theme/theme'
import { writeSidebarOrder } from '../../app/layout/sidebarOrder'
import { writeLayoutLocked } from '../../shared/prefs/dashboardLayoutLock'
import { writeStoredSubscriptions } from '../../features/calendar/calendarStorage'
import { readSalaryState, SALARY_STORAGE_KEY, writeSalaryState } from '../../features/salary/salaryStorage'

describe('syncedPreferencesRepo', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('persists the current local preference snapshot into Dexie', async () => {
    writeLanguage('zh')
    writeStoredThemePreference('dark')
    writeSidebarOrder(['route:tasks', 'route:dashboard'])
    writeLayoutLocked(false)
    writeWorldClockItems([
      {
        id: 'clock-1',
        label: 'Shanghai',
        searchValue: 'Shanghai',
        latitude: 31.2304,
        longitude: 121.4737,
        timeZone: 'Asia/Shanghai',
      },
    ])
    writeStoredSubscriptions([
      {
        id: 'custom-1',
        name: 'Team',
        sourceType: 'custom',
        provider: 'ics',
        color: '#2563eb',
        enabled: true,
        syncPermission: 'read',
        order: 0,
        url: 'https://example.com/team.ics',
      },
    ])

    await syncedPreferencesRepo.persistFromLocal()

    const stored = await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)
    expect(stored?.language).toBe('zh')
    expect(stored?.themeSelection).toBe('dark')
    expect(stored?.sidebarOrder).toEqual(['route:tasks', 'route:dashboard'])
    expect(stored?.dashboardLayoutLocked).toBe(false)
    expect(stored?.worldClockItems[0]?.label).toBe('Shanghai')
    expect(stored?.calendarSubscriptions[0]?.id).toBe('custom-1')
  })

  it('hydrates local storage from the synced preference row', async () => {
    await db.syncedPreferences.put({
      id: SYNCED_PREFERENCES_ID,
      language: 'zh',
      uiAnimationsEnabled: false,
      numberAnimationsEnabled: false,
      defaultCurrency: 'CNY',
      weatherAutoLocationEnabled: false,
      weatherManualCity: 'Shanghai',
      weatherTemperatureUnit: 'fahrenheit',
      worldClockItems: [],
      focusCompletionSoundEnabled: false,
      taskReminderEnabled: false,
      taskReminderLeadMinutes: 15,
      diaryFont: 'playfair',
      neteaseExperimentalPlaybackEnabled: true,
      neteaseExperimentalPlaybackConfirmed: true,
      sidebarOrder: ['route:dashboard', 'route:tasks'],
      themeSelection: 'dark',
      dashboardLayoutLocked: false,
      calendarSubscriptions: [],
      createdAt: 1,
      updatedAt: 2,
    })

    const changed = await syncedPreferencesRepo.hydrateLocalFromDb()

    expect(changed).toBe(true)
    expect(window.localStorage.getItem('workbench.ui.language')).toBe('zh')
    expect(window.localStorage.getItem('focusgo.theme')).toBe('dark')
    expect(window.localStorage.getItem('focusgo.sidebar.order.v1')).toBe(JSON.stringify(['route:dashboard', 'route:tasks']))
    expect(window.localStorage.getItem('workbench.dashboard.layoutLocked')).toBe('false')
  })

  it('carries the pay widgets across devices, and keeps them when an older client sends none', async () => {
    const salary = {
      settings: { monthlySalary: 12000, workStart: 540, workEnd: 1080, lunch: { start: 720, end: 780 }, workdays: [1, 2, 3, 4, 5] },
      wishlist: [{ id: 'w1', name: 'Headphones', price: 1399, addedAt: Date.now() - 60_000 }],
      breaks: [{ id: 'b1', startAt: Date.now() - 120_000, endAt: Date.now() - 60_000 }],
      activeBreakStartAt: null,
    }
    writeSalaryState(salary)
    await syncedPreferencesRepo.persistFromLocal()
    const stored = await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)
    expect(stored?.salary).toEqual(salary)

    // Another device: local storage is empty until the row is hydrated.
    window.localStorage.removeItem(SALARY_STORAGE_KEY)
    await syncedPreferencesRepo.hydrateLocalFromDb()
    expect(readSalaryState()).toEqual(salary)

    // A row written by a client that predates the widgets leaves them alone.
    await db.syncedPreferences.put({ ...stored!, salary: undefined, language: 'en' })
    await syncedPreferencesRepo.hydrateLocalFromDb()
    expect(readSalaryState()).toEqual(salary)
  })

  it('marks the initial seed as completed without overwriting existing preferences', async () => {
    writeLanguage('zh')

    await syncedPreferencesRepo.persistFromLocal()
    const before = await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)

    await syncedPreferencesRepo.markInitialSeedCompleted(123)

    const stored = await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)
    expect(stored?.language).toBe('zh')
    expect(stored?.initialSeedCompletedAt).toBe(123)
    expect(stored?.createdAt).toBe(before?.createdAt)
    expect(stored?.updatedAt).toBe(123)
  })
})
