import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'

const runMock = vi.fn(() => ({ changes: 1 }))
const getMock = vi.fn(() => undefined)
const allMock = vi.fn(() => [])

vi.mock('better-sqlite3', () => {
  class FakeDatabase {
    pragma() {
      return undefined
    }

    exec() {
      return undefined
    }

    prepare() {
      return {
        run: runMock,
        get: getMock,
        all: allMock,
      }
    }

    transaction<T extends (...args: never[]) => unknown>(fn: T) {
      return (...args: Parameters<T>) => fn(...args)
    }

    close() {
      return undefined
    }
  }

  return {
    default: FakeDatabase,
  }
})

import { createSqliteBundle, resolveDesktopDbPath } from '../electron/db/sqliteService'

describe('sqlite bundle (mocked)', () => {
  beforeEach(() => {
    runMock.mockClear()
    getMock.mockClear()
    allMock.mockClear()
  })

  it('creates service bundle with all data access groups', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-sqlite-'))
    const dbPath = path.join(baseDir, 'focus-go.sqlite3')
    const bundle = createSqliteBundle(dbPath)

    expect(bundle.dbPath).toBe(dbPath)
    expect(typeof bundle.service.tasks.list).toBe('function')
    expect(typeof bundle.service.widgetTodos.list).toBe('function')
    expect(typeof bundle.service.focus.get).toBe('function')
    expect(typeof bundle.service.focusSessions.start).toBe('function')
    expect(typeof bundle.service.diary.list).toBe('function')
    expect(typeof bundle.service.spend.listEntries).toBe('function')
    expect(typeof bundle.service.dashboard.get).toBe('function')
    expect(typeof bundle.service.lifeDashboard.get).toBe('function')
    expect(typeof bundle.service.books.list).toBe('function')
    expect(typeof bundle.service.media.list).toBe('function')
    expect(typeof bundle.service.stocks.list).toBe('function')
    expect(typeof bundle.service.lifeSubscriptions.list).toBe('function')
    expect(typeof bundle.service.lifePodcasts.list).toBe('function')
    expect(typeof bundle.service.lifePeople.list).toBe('function')
    expect(typeof bundle.service.habits.listHabits).toBe('function')

    bundle.close()
  })

  it('persists linked habit ids for widget todos', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-sqlite-'))
    const dbPath = path.join(baseDir, 'focus-go.sqlite3')
    const bundle = createSqliteBundle(dbPath)

    await bundle.service.widgetTodos.add({
      scope: 'day',
      title: '喝水',
      priority: 'medium',
      done: false,
      linkedHabitId: 'habit-water',
    })

    const payloads = runMock.mock.calls.map(([arg]) => arg).filter(Boolean)
    expect(payloads).toContainEqual(expect.objectContaining({ linkedHabitId: 'habit-water' }))

    bundle.close()
  })

  it('throws for invalid import json', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-sqlite-'))
    const dbPath = path.join(baseDir, 'focus-go.sqlite3')
    const bundle = createSqliteBundle(dbPath)

    expect(() => bundle.importFromDexieJson('{invalid-json')).toThrow()

    bundle.close()
  })

  it('routes life subscription create update remove through sqlite statements', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-sqlite-'))
    const dbPath = path.join(baseDir, 'focus-go.sqlite3')
    const bundle = createSqliteBundle(dbPath)

    getMock.mockReturnValueOnce(undefined).mockReturnValueOnce({
      id: 'sub-1',
      name: 'Spotify',
      amount: 12,
      cycle: 'monthly',
      createdAt: 1,
      updatedAt: 1,
      userId: null,
      workspaceId: null,
    })

    const created = await bundle.service.lifeSubscriptions.create({
      name: 'Spotify',
      amount: 12,
      cycle: 'monthly',
    })
    const updated = await bundle.service.lifeSubscriptions.update('sub-1', {
      cycle: 'yearly',
      amount: 120,
    })
    await bundle.service.lifeSubscriptions.remove('sub-1')

    const payloads = runMock.mock.calls.map(([arg]) => arg).filter(Boolean)
    expect(created.name).toBe('Spotify')
    expect(updated?.cycle).toBe('yearly')
    expect(payloads).toContainEqual(expect.objectContaining({ name: 'Spotify', amount: 12, cycle: 'monthly' }))
    expect(payloads).toContainEqual(expect.objectContaining({ id: 'sub-1', amount: 120, cycle: 'yearly' }))

    bundle.close()
  })

  it('resolves db path under userData directory', () => {
    const userDataDir = '/tmp/focus-go-user-data'
    expect(resolveDesktopDbPath(userDataDir)).toBe('/tmp/focus-go-user-data/focus-go.sqlite3')
  })
})
