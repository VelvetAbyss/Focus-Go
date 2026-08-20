import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createNewsRouter } from './news.js'

const createServer = async () => {
  const service = {
    getSources: () => [{ id: 'zhihu', name: '知乎', category: 'hot', type: 'hottest', interval: 600000, home: 'https://example.com', accent: '#3A3733' }],
    getSource: async ({ id }) => {
      if (id !== 'zhihu') {
        const error = new Error('Invalid source id')
        error.statusCode = 400
        throw error
      }
      return { status: 'success', id, updatedTime: 1000, items: [{ id: '1', title: 'A', url: 'https://example.com/a' }] }
    },
    refreshSources: async (ids) => ({ results: ids.map((id) => ({ status: 'success', id, updatedTime: 1000, items: [] })) }),
  }
  const app = express()
  app.use(express.json())
  app.use('/news', createNewsRouter({ service }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

test('news router exposes sources and validates source ids', async () => {
  const ctx = await createServer()
  try {
    const sources = await fetch(`${ctx.baseUrl}/news/sources`)
    assert.equal(sources.status, 200)
    assert.equal((await sources.json()).sources[0].id, 'zhihu')

    const source = await fetch(`${ctx.baseUrl}/news/source?id=zhihu`)
    assert.equal(source.status, 200)
    assert.equal((await source.json()).items[0].title, 'A')

    const invalid = await fetch(`${ctx.baseUrl}/news/source?id=bad`)
    assert.equal(invalid.status, 400)
  } finally {
    await ctx.close()
  }
})
