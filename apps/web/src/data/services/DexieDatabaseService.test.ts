import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { IDatabaseService } from '@focus-go/core'
import { createDexieDatabaseService } from './DexieDatabaseService'
import { db } from '../db'

describe('DexieDatabaseService', () => {
  it('implements IDatabaseService contract surface', () => {
    const service: IDatabaseService = createDexieDatabaseService()
    expect(typeof service.tasks.list).toBe('function')
    expect(typeof service.notes.list).toBe('function')
    expect(typeof service.notes.create).toBe('function')
    expect(typeof service.notes.hardDelete).toBe('function')
    expect(typeof service.noteTags.list).toBe('function')
    expect(typeof service.noteAppearance.get).toBe('function')
    expect(typeof service.widgetTodos.add).toBe('function')
    expect(typeof service.widgetTodos.resetDone).toBe('function')
    expect(typeof service.focus.upsert).toBe('function')
    expect(typeof service.focusSessions.start).toBe('function')
    expect(typeof service.diary.listTrash).toBe('function')
    expect(typeof service.spend.listCategories).toBe('function')
    expect(typeof service.dashboard.get).toBe('function')
    expect(typeof service.lifeDashboard.get).toBe('function')
    expect(typeof service.books.list).toBe('function')
    expect(typeof service.media.list).toBe('function')
    expect(typeof service.stocks.list).toBe('function')
    expect(typeof service.lifeSubscriptions.list).toBe('function')
    expect(typeof service.lifePodcasts.list).toBe('function')
    expect(typeof service.lifePeople.list).toBe('function')
    expect(typeof service.habits.listHabits).toBe('function')
  })

  it('persists life dashboard layout independently from main dashboard', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    await service.dashboard.upsert({
      items: [{ key: 'tasks', x: 0, y: 0, w: 4, h: 4 }],
      hiddenCardIds: ['weather'],
      themeOverride: null,
    })

    const life = await service.lifeDashboard.upsert({
      items: [{ key: 'library', x: 0, y: 0, w: 4, h: 4 }],
      hiddenCardIds: ['stocks'],
    })

    expect(life.items[0]?.key).toBe('library')
    expect(life.hiddenCardIds).toEqual(['stocks'])
    expect((await service.dashboard.get())?.items[0]?.key).toBe('tasks')
    expect((await service.lifeDashboard.get())?.items[0]?.key).toBe('library')
  })

  it('stores book records with reading progress and reflection', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.books.create({
      source: 'open-library',
      sourceId: 'OL123W',
      title: 'Atomic Habits',
      authors: ['James Clear'],
      status: 'reading',
      progress: 42,
      reflection: 'Useful notes',
      coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
      summary: 'Build better habits.',
      subjects: ['Habits'],
      isbn13: '9780735211292',
    })

    const updated = await service.books.update(created.id, {
      progress: 60,
      reflection: 'Updated reflection',
    })

    expect(created.title).toBe('Atomic Habits')
    expect(updated?.progress).toBe(60)
    expect(updated?.reflection).toBe('Updated reflection')
    expect((await service.books.list())[0]?.isbn13).toBe('9780735211292')
  })

  it('stores stocks watch items and quote snapshots', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.stocks.create({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      lastPrice: 189.52,
      change: 1.2,
      changePercent: 0.64,
      note: 'Core watchlist',
      pinned: true,
    })

    const updated = await service.stocks.update(created.id, {
      lastPrice: 190.11,
      note: 'Updated note',
    })

    expect(created.symbol).toBe('AAPL')
    expect(updated?.lastPrice).toBe(190.11)
    expect(updated?.note).toBe('Updated note')
    expect((await service.stocks.list())[0]?.pinned).toBe(true)
  })

  it('stores media watch items with tmdb metadata', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.media.create({
      source: 'tmdb',
      sourceId: '110492',
      tmdbId: 110492,
      mediaType: 'tv',
      title: 'Shogun',
      status: 'watching',
      progress: 50,
      director: 'Frederick E.O. Toye',
      cast: ['Hiroyuki Sanada', 'Anna Sawai'],
      genres: ['Drama'],
      releaseDate: '2024-02-27',
      posterUrl: 'https://image.tmdb.org/t/p/w342/test.jpg',
    })

    const updated = await service.media.update(created.id, {
      progress: 75,
      cast: ['Hiroyuki Sanada', 'Anna Sawai', 'Cosmo Jarvis'],
    })

    expect(created.tmdbId).toBe(110492)
    expect(updated?.progress).toBe(75)
    expect(updated?.cast).toContain('Cosmo Jarvis')
  })

  it('stores life subscriptions and keeps yearly totals available for callers', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const monthly = await service.lifeSubscriptions.create({
      name: 'Spotify',
      amount: 12,
      currency: 'USD',
      cycle: 'monthly',
    })
    const yearly = await service.lifeSubscriptions.create({
      name: 'Figma',
      amount: 120,
      currency: 'CNY',
      cycle: 'yearly',
    })

    const updated = await service.lifeSubscriptions.update(yearly.id, {
      amount: 144,
    })
    const listed = await service.lifeSubscriptions.list()

    expect(monthly.name).toBe('Spotify')
    expect(updated?.amount).toBe(144)
    expect(listed).toHaveLength(2)
    expect(Number((listed.reduce((sum, item) => sum + (item.cycle === 'yearly' ? item.amount / 12 : item.amount), 0)).toFixed(2))).toBe(24)

    await service.lifeSubscriptions.remove(monthly.id)
    expect(await service.lifeSubscriptions.list()).toHaveLength(1)
  })

  it('stores podcasts with nested episodes and play state', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.lifePodcasts.create({
      source: 'itunes',
      sourceId: '1',
      collectionId: 1,
      name: 'Acquired',
      author: 'Ben & David',
      episodes: [{ id: 'ep-1', title: 'Nintendo', duration: '1 hr 20 min' }],
      selectedEpisodeId: 'ep-1',
      isPlaying: true,
    })

    const updated = await service.lifePodcasts.update(created.id, {
      episodes: [...created.episodes, { id: 'ep-2', title: 'Apple', duration: '2 hr' }],
      isPlaying: false,
    })

    expect(created.episodes).toHaveLength(1)
    expect(updated?.episodes).toHaveLength(2)
    expect(updated?.isPlaying).toBe(false)
  })

  it('stores netease podcasts with remote audio urls', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.lifePodcasts.create({
      source: 'netease',
      sourceId: '796756498',
      collectionId: 796756498,
      name: 'Just Some Collections',
      author: '我最爱吃螺蛳粉',
      externalUrl: 'https://music.163.com/djradio?id=796756498',
      episodes: [{
        id: '2539083386',
        title: 'alice cullen 【playlist】',
        audioUrl: 'https://example.com/audio.mp3',
        externalUrl: 'https://music.163.com/program?id=2539083386',
      }],
      selectedEpisodeId: '2539083386',
      isPlaying: false,
    })

    expect(created.source).toBe('netease')
    expect(created.episodes[0]?.audioUrl).toBe('https://example.com/audio.mp3')
    expect(created.externalUrl).toBe('https://music.163.com/djradio?id=796756498')
    expect(created.episodes[0]?.externalUrl).toBe('https://music.163.com/program?id=2539083386')
  })

  it('stores people rows and preserves birthday metadata', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.lifePeople.create({
      name: 'Ada Lovelace',
      group: 'Work',
      avatarInitials: 'AL',
      birthday: '1990-12-10',
      lastInteraction: '2026-04-01',
    })

    const updated = await service.lifePeople.update(created.id, {
      group: 'Friends',
      city: 'London',
    })

    expect(created.avatarInitials).toBe('AL')
    expect(updated?.group).toBe('Friends')
    expect(updated?.city).toBe('London')
  })

  it('hydrates rich task note fields from legacy blocks when listing tasks', async () => {
    await db.tasks.clear()
    const service = createDexieDatabaseService()
    const created = await service.tasks.add({
      title: 'Legacy task',
      status: 'todo',
      priority: null,
    })
    await db.tasks.put({
      ...created,
      title: 'Legacy task',
      taskNoteBlocks: [
        { id: 'p1', type: 'paragraph', text: 'Prep ' },
        { id: 'p2', type: 'paragraph', text: ' before review' },
      ],
      taskNoteContentMd: undefined,
      taskNoteContentJson: undefined,
    })

    const task = (await service.tasks.list()).find((item) => item.id === created.id)

    expect(task).toBeDefined()
    expect(task?.taskNoteContentMd).toBe('Prep \n\n before review')
    expect(task?.taskNoteContentJson).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Prep ' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' before review' }],
        },
      ],
    })
  })

  it('clears legacy task note blocks when saving rich task note content', async () => {
    await db.tasks.clear()
    const service = createDexieDatabaseService()
    const created = await service.tasks.add({
      title: 'Rich task',
      status: 'todo',
      priority: null,
      taskNoteBlocks: [
        { id: 'legacy', type: 'paragraph', text: 'legacy text' },
      ],
      taskNoteContentMd: 'Fresh text',
      taskNoteContentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fresh text' }] }],
      },
    })

    expect(created.taskNoteBlocks).toEqual([])
    expect(created.taskNoteContentMd).toBe('Fresh text')

    const stored = await db.tasks.get(created.id)
    expect(stored?.taskNoteBlocks).toEqual([])
    expect(stored?.taskNoteContentMd).toBe('Fresh text')
  })

  it('creates a blank note and lists it as active', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.notes.create()
    const notes = await service.notes.list()

    expect(created.title).toBe('')
    expect(created.collection).toBe('all-notes')
    expect(created.contentMd).toBe('')
    expect(notes.map((note) => note.id)).toContain(created.id)
  })

  it('soft deletes and restores notes through trash', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()
    const created = await service.notes.create()

    await service.notes.update(created.id, { title: 'Draft title', tags: ['Design'] })
    await service.notes.softDelete(created.id)

    const activeAfterDelete = await service.notes.list()
    const trashAfterDelete = await service.notes.listTrash()

    expect(activeAfterDelete.some((note) => note.id === created.id)).toBe(false)
    expect(trashAfterDelete.find((note) => note.id === created.id)?.deletedAt).toEqual(expect.any(Number))

    await service.notes.restore(created.id)

    const restored = await service.notes.list()
    expect(restored.find((note) => note.id === created.id)?.title).toBe('Draft title')
  })

  it('persists note appearance and note tags', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const tag = await service.noteTags.create({
      name: 'Research',
      icon: 'microscope',
      pinned: true,
      parentId: null,
      sortOrder: 1,
    })
    const appearance = await service.noteAppearance.upsert({
      id: 'note_appearance',
      theme: 'graphite',
      font: 'serif',
      fontSize: 18,
      lineHeight: 1.8,
      contentWidth: 70,
      focusMode: true,
    })

    expect(tag.name).toBe('Research')
    expect((await service.noteTags.list())[0]?.pinned).toBe(true)
    expect(appearance.theme).toBe('graphite')
    expect((await service.noteAppearance.get())?.font).toBe('serif')
  })

  it('enqueues sync outbox items after writes', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const task = await service.tasks.add({
      title: 'Sync me',
      status: 'todo',
      priority: null,
    })
    await service.tasks.remove(task.id)

    const outbox = await db.syncOutbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entityType).toBe('tasks')
    expect(outbox[0].op).toBe('delete')
    expect(outbox[0].entityId).toBe(task.id)
  })
})
