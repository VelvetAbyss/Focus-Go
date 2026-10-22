import { describe, it, expect } from 'vitest'
import { createAnonymousCounter } from './anonymousCounts'

function fixture(origin = 'https://app.nestflow.art') {
  const values = new Map<string,string>(), sent: unknown[] = []
  let privacy = false, healthy = true
  const counter = createAnonymousCounter({ origin, storage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => { values.set(key,value) } }, privacySignal: () => privacy, send: async body => { sent.push(JSON.parse(body)); return healthy } })
  return { counter, sent, values, privacy: () => { privacy = true }, fail: () => { healthy = false }, recover: () => { healthy = true } }
}

describe('anonymous browser counter', () => {
  it('sends one fixed first-success payload after success, with no IDs or content', async () => {
    const f = fixture(); await Promise.all([f.counter.firstSuccess('zh'),f.counter.firstSuccess('en')]); await f.counter.firstSuccess('en')
    expect(f.sent).toEqual([{ event: 'first_success', page: 'app', language: 'zh-CN' }])
    expect([...f.values.values()]).toEqual(['true'])
  })
  it('honors opt-out and browser privacy signals before any request or first-use flag', async () => {
    const f = fixture(); f.counter.setEnabled(false); await f.counter.firstSuccess('en'); expect(f.sent).toEqual([])
    f.counter.setEnabled(true); f.privacy(); await f.counter.firstSuccess('en'); expect(f.sent).toEqual([])
    expect(f.values.has('focusgo.anonymous-counts.first-success')).toBe(false)
  })
  it('allows retry on a later real success after an offline failure', async () => {
    const f = fixture(); f.fail(); await f.counter.firstSuccess('en'); expect(f.values.size).toBe(0)
    f.recover(); await f.counter.firstSuccess('en'); await f.counter.firstSuccess('en'); expect(f.sent).toHaveLength(2)
  })
  it('reads a newer shared preference after a successful local choice', () => {
    const f = fixture(); f.counter.setEnabled(true); f.values.set('focusgo.anonymous-counts.enabled', 'false'); expect(f.counter.enabled()).toBe(false)
  })
  it('keeps opt-out effective even if preference storage is full', async () => {
    const sent: string[] = []
    const counter = createAnonymousCounter({ origin: 'https://app.nestflow.art', storage: { getItem: () => null, setItem: () => { throw new Error('quota') } }, privacySignal: () => false, send: async body => { sent.push(body); return true } })
    counter.setEnabled(false); await counter.firstSuccess('en'); expect(counter.enabled()).toBe(false); expect(sent).toEqual([])
  })
  it('rejects dev hosts and private/query paths rather than transmit them', async () => {
    const dev = fixture('http://localhost:5173'); await dev.counter.firstSuccess('en'); await dev.counter.website('website_view','/'); expect(dev.sent).toEqual([])
    const site = fixture('https://nestflow.art'); await site.counter.website('website_view','/tasks/private'); await site.counter.website('app_open','/?q=private'); expect(site.sent).toEqual([])
    await site.counter.website('app_open','/zh/features/pomodoro/'); expect(site.sent).toEqual([{ event: 'app_open', page: '/zh/features/pomodoro/', language: 'zh-CN' }])
  })
})
