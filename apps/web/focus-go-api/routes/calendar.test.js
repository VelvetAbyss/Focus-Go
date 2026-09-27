import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createCalendarRouter, isPublicAddress, normalizeFeedUrl } from './calendar.js'

const ICS = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n'
const PRESET = 'https://ical.muhan.org/rest.ics'

const createServer = async ({ fetchImpl, lookup = async () => [{ address: '93.184.216.34' }] }) => {
  const calls = []
  const app = express()
  const requireAuth = (req, res, next) => {
    if (req.headers.authorization === 'Bearer ok') return next()
    return res.status(401).json({ error: 'Missing or invalid session' })
  }
  app.use('/calendar', createCalendarRouter({
    fetchImpl: async (url, init) => {
      calls.push(url)
      return fetchImpl(url, init)
    },
    lookup,
    requireAuth,
  }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  return {
    calls,
    get: (url, headers) => fetch(`http://127.0.0.1:${server.address().port}/calendar/ics?url=${encodeURIComponent(url)}`, { headers }),
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('classifies addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) assert.equal(isPublicAddress(ip), true, ip)
})

test('normalizes feed URLs and rejects unsafe ones', () => {
  assert.equal(normalizeFeedUrl('webcal://example.com/a.ics').href, 'https://example.com/a.ics')
  assert.equal(normalizeFeedUrl('ftp://example.com/a.ics'), null)
  assert.equal(normalizeFeedUrl('https://example.com:8443/a.ics'), null)
  assert.equal(normalizeFeedUrl('https://user:pw@example.com/a.ics'), null)
  assert.equal(normalizeFeedUrl('http://localhost/a.ics'), null)
})

test('serves presets signed out and requires a session for other feeds', async () => {
  const ctx = await createServer({ fetchImpl: async () => new Response(ICS, { status: 200 }) })
  try {
    const preset = await ctx.get(PRESET)
    assert.equal(preset.status, 200)
    assert.match(await preset.text(), /BEGIN:VCALENDAR/)

    const privateFeed = 'https://calendar.example.com/private/secret.ics'
    assert.equal((await ctx.get(privateFeed)).status, 401)
    assert.equal((await ctx.get(privateFeed, { Authorization: 'Bearer ok' })).status, 200)
  } finally {
    await ctx.close()
  }
})

test('refuses hosts that resolve to private addresses, including via redirect', async () => {
  const lookup = async (host) => [{ address: host === 'internal.example.com' ? '10.0.0.5' : '93.184.216.34' }]
  const ctx = await createServer({
    lookup,
    fetchImpl: async (url) => (url.startsWith('https://ical.muhan.org')
      ? new Response('', { status: 302, headers: { location: 'https://internal.example.com/x.ics' } })
      : new Response(ICS, { status: 200 })),
  })
  try {
    const direct = await ctx.get('https://internal.example.com/x.ics', { Authorization: 'Bearer ok' })
    assert.equal(direct.status, 400)
    const redirected = await ctx.get(PRESET)
    assert.equal(redirected.status, 400)
    assert.deepEqual(ctx.calls, ['https://ical.muhan.org/rest.ics'])
  } finally {
    await ctx.close()
  }
})

test('rejects bodies that are not calendars', async () => {
  const ctx = await createServer({ fetchImpl: async () => new Response('<html>login</html>', { status: 200 }) })
  try {
    assert.equal((await ctx.get('https://example.com/a.ics', { Authorization: 'Bearer ok' })).status, 422)
  } finally {
    await ctx.close()
  }
})
