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

    bundle.close()
  })

  it('throws for invalid import json', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focusgo-sqlite-'))
    const dbPath = path.join(baseDir, 'focus-go.sqlite3')
    const bundle = createSqliteBundle(dbPath)

    expect(() => bundle.importFromDexieJson('{invalid-json')).toThrow()

    bundle.close()
  })

  it('resolves db path under userData directory', () => {
    const userDataDir = '/tmp/focus-go-user-data'
    expect(resolveDesktopDbPath(userDataDir)).toBe('/tmp/focus-go-user-data/focus-go.sqlite3')
  })
})
