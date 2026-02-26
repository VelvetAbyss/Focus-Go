import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { ensureLabsSeed, upgradeToPremiumMock } from '../labs/labsApi'
import {
  addSource,
  assignSourceGroup,
  clearMockFailures,
  createSourceGroup,
  deleteSourceGroup,
  getEntries,
  getEntriesView,
  getSources,
  markEntriesAsRead,
  refreshAll,
  refreshSource,
  removeSource,
  restoreSource,
  setMockSourceFailure,
  starSource,
  unstarSource,
} from './rssApi'

describe('rssApi', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    clearMockFailures()
    await ensureLabsSeed()
    await upgradeToPremiumMock()
  })

  it('adds source with validation and dedupe', async () => {
    await addSource({ route: '/my/custom-feed', displayName: 'My Custom Feed' })
    await expect(addSource({ route: '/my/custom-feed', displayName: 'Dup' })).rejects.toThrow(/already exists/i)
  })

  it('accepts normal RSS URL source', async () => {
    const created = await addSource({
      route: 'https://wechat2rss.bestblogs.dev/feed/ff621c3e98d6ae6fceb3397e57441ffc6ea3c17f.xml',
      displayName: '',
    })
    expect(created.route.startsWith('https://')).toBe(true)
    expect(created.displayName.length).toBeGreaterThan(0)
  })

  it('refreshes and returns entries with dedupe key strategy', async () => {
    const before = await getSources()
    expect(before.length).toBeGreaterThan(0)

    const result = await refreshAll()
    expect(result.ok).toBe(true)

    const entries = await getEntries()
    const ids = new Set(entries.map((item) => `${item.route}::${item.guidOrLink}`))
    expect(ids.size).toBe(entries.length)
  })

  it('returns stale response when source fails but cache exists', async () => {
    const source = (await getSources())[0]
    expect(source).toBeTruthy()
    await refreshSource(source!.id)

    setMockSourceFailure(source!.route, true)
    const result = await refreshSource(source!.id)
    expect(result.ok).toBe(true)
    expect(result.stale).toBe(true)
    expect(result.lastSuccessAt).toBeTypeOf('number')
  })

  it('returns error when source fails without cache', async () => {
    const created = await addSource({ route: '/custom/empty-fail', displayName: 'Will Fail' })
    setMockSourceFailure(created.route, true)

    const result = await refreshSource(created.id)
    expect(result.ok).toBe(false)
  })

  it('soft removes and restores sources', async () => {
    const source = (await getSources())[0]
    await removeSource(source!.id)
    const active = await getSources()
    expect(active.some((item) => item.id === source!.id)).toBe(false)

    const removed = await getSources({ includeRemoved: true })
    expect(removed.find((item) => item.id === source!.id)?.deletedAt).toBeTypeOf('number')

    await restoreSource(source!.id)
    const restored = await getSources()
    expect(restored.some((item) => item.id === source!.id)).toBe(true)
  })

  it('marks entries as read in batch', async () => {
    await refreshAll()
    const entries = await getEntries()
    const ids = entries.slice(0, 2).map((item) => item.id)
    const read = await markEntriesAsRead(ids)
    expect(read).toHaveLength(2)
    expect(read.every((item) => ids.includes(item.entryId))).toBe(true)
  })

  it('supports source group CRUD and fallback to ungrouped when deleting group', async () => {
    const group = await createSourceGroup('Tech')
    const source = (await getSources())[0]
    await assignSourceGroup(source!.id, group.id)

    const grouped = (await getSources({ groupId: group.id })).map((item) => item.id)
    expect(grouped).toContain(source!.id)

    await deleteSourceGroup(group.id)
    const ungrouped = await getSources({ groupId: null })
    expect(ungrouped.find((item) => item.id === source!.id)?.groupId ?? null).toBeNull()
  })

  it('supports star and unstar source filtering', async () => {
    const source = (await getSources())[0]
    await starSource(source!.id)
    const starred = await getSources({ onlyStarred: true })
    expect(starred.some((item) => item.id === source!.id)).toBe(true)

    await unstarSource(source!.id)
    const unstarred = await getSources({ onlyStarred: true })
    expect(unstarred.some((item) => item.id === source!.id)).toBe(false)
  })

  it('filters entries by all-active/source/group/starred scopes', async () => {
    const [firstSource, secondSource] = await getSources()
    const group = await createSourceGroup('Only First')
    await assignSourceGroup(firstSource!.id, group.id)
    await starSource(secondSource!.id)
    await refreshAll()

    const allEntries = await getEntriesView({ scope: 'all-active' })
    const sourceEntries = await getEntriesView({ scope: 'source', sourceId: firstSource!.id })
    const groupEntries = await getEntriesView({ scope: 'group', groupId: group.id })
    const starredEntries = await getEntriesView({ scope: 'starred' })

    expect(allEntries.length).toBeGreaterThan(0)
    expect(sourceEntries.every((item) => item.sourceId === firstSource!.id)).toBe(true)
    expect(groupEntries.every((item) => item.sourceId === firstSource!.id)).toBe(true)
    expect(starredEntries.every((item) => item.sourceId === secondSource!.id)).toBe(true)
  })

  it('updates lastEntryAt and lastSuccessAt after refresh success', async () => {
    const source = (await getSources())[0]
    await refreshSource(source!.id)

    const refreshed = (await getSources()).find((item) => item.id === source!.id)
    expect(refreshed?.lastSuccessAt).toBeTypeOf('number')
    expect(refreshed?.lastEntryAt).toBeTypeOf('number')
  })
})
