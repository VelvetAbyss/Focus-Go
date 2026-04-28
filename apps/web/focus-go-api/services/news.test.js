import test from 'node:test'
import assert from 'node:assert/strict'
import { createNewsService, ensureNewsTables } from './news.js'

const createDb = () => {
  const rows = new Map()
  const db = {
    exec: () => {},
    prepare: (sql) => {
      if (sql.startsWith('SELECT')) {
        return {
          get: (sourceId) => {
            const row = rows.get(sourceId)
            return row ? { ...row } : undefined
          },
        }
      }
      return {
        run: (sourceId, updatedAt, itemsJson) => {
          rows.set(sourceId, { source_id: sourceId, updated_at: updatedAt, items_json: itemsJson })
        },
      }
    },
    close: () => {},
  }
  ensureNewsTables(db)
  return db
}

const story = (id, title = `Story ${id}`) => ({ id, title, url: `https://example.com/${id}` })

test('rejects invalid source ids', async () => {
  const db = createDb()
  const service = createNewsService({ db, fetchers: {}, now: () => 1_000 })

  await assert.rejects(() => service.getSource({ id: 'missing' }), /Invalid source id/)
  db.close()
})

test('returns fresh cache inside source interval', async () => {
  const db = createDb()
  let calls = 0
  const service = createNewsService({
    db,
    now: () => 10_000,
    fetchers: {
      zhihu: async () => {
        calls += 1
        return [story('a')]
      },
    },
  })

  const first = await service.getSource({ id: 'zhihu' })
  assert.equal(first.status, 'success')

  const cachedService = createNewsService({
    db,
    now: () => 11_000,
    fetchers: {
      zhihu: async () => {
        calls += 1
        return [story('b')]
      },
    },
  })
  const second = await cachedService.getSource({ id: 'zhihu' })

  assert.equal(second.status, 'cache')
  assert.equal(second.items[0].id, 'a')
  assert.equal(calls, 1)
  db.close()
})

test('latest bypasses TTL only after the per-source interval', async () => {
  const db = createDb()
  let calls = 0
  const service = createNewsService({
    db,
    now: () => 10_000,
    fetchers: {
      zhihu: async () => {
        calls += 1
        return [story('a')]
      },
    },
  })
  await service.getSource({ id: 'zhihu' })

  const insideInterval = createNewsService({
    db,
    now: () => 20_000,
    fetchers: {
      zhihu: async () => {
        calls += 1
        return [story('b')]
      },
    },
  })
  assert.equal((await insideInterval.getSource({ id: 'zhihu', latest: true })).items[0].id, 'a')
  assert.equal(calls, 1)

  const outsideInterval = createNewsService({
    db,
    now: () => 10_000 + 10 * 60 * 1000 + 1,
    fetchers: {
      zhihu: async () => {
        calls += 1
        return [story('c')]
      },
    },
  })
  const refreshed = await outsideInterval.getSource({ id: 'zhihu', latest: true })
  assert.equal(refreshed.status, 'success')
  assert.equal(refreshed.items[0].id, 'c')
  assert.equal(calls, 2)
  db.close()
})

test('falls back to stale cache when fetch fails', async () => {
  const db = createDb()
  const service = createNewsService({
    db,
    now: () => 10_000,
    fetchers: { zhihu: async () => [story('a')] },
  })
  await service.getSource({ id: 'zhihu' })

  const failingService = createNewsService({
    db,
    now: () => 10_000 + 31 * 60 * 1000,
    fetchers: {
      zhihu: async () => {
        throw new Error('upstream down')
      },
    },
  })
  const result = await failingService.getSource({ id: 'zhihu', latest: true })

  assert.equal(result.status, 'cache')
  assert.equal(result.items[0].id, 'a')
  assert.match(result.warning, /upstream down/)
  db.close()
})
