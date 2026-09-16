// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { enqueueSyncOperation } from './repository'
import { SYNC_DATA_UPDATED_EVENT } from './constants'
import '../events/timelineProjection'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token' }),
}))

vi.mock('./content', () => ({
  createBlobMap: (blobs: Array<{ hash: string }>) => new Map(blobs.map((blob) => [blob.hash, blob])),
  encodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => ({ payload, blobs: [] }),
  decodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => payload,
}))

import { ensureRxdbSyncReady, resetRxdbSyncDatabase, runRxdbSyncCycle } from './rxdb'

describe('rxdb sync migration', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('migrates existing Dexie rows into RxDB and pushes them through the new endpoint', async () => {
    await db.tasks.put({
      id: 'task-local',
      title: 'Local task',
      description: '',
      pinned: false,
      isToday: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '',
      taskNoteContentJson: null,
      activityLogs: [],
      createdAt: 1,
      updatedAt: 10,
    })

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    const pushCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/sync/rxdb/push'))
    expect(pushCall).toBeTruthy()
    const body = JSON.parse(String(pushCall?.[1]?.body ?? '{}'))
    expect(body.entityType).toBe('tasks')
    expect(body.rows[0].newDocumentState.id).toBe('task-local')
  })

  it('backfills imported local notes into a non-empty RxDB notes queue', async () => {
    const existingNote = {
      id: 'note-online',
      title: 'Online note',
      contentMd: 'online',
      contentJson: null,
      editorMode: 'document' as const,
      collection: 'all-notes' as const,
      tags: [],
      excerpt: '',
      pinned: false,
      wordCount: 1,
      charCount: 6,
      paragraphCount: 1,
      imageCount: 0,
      fileCount: 0,
      headings: [],
      backlinks: [],
      deletedAt: null,
      createdAt: 1,
      updatedAt: 10,
    }
    const importedNote = {
      ...existingNote,
      id: 'note-imported',
      title: 'Imported note',
      contentMd: '# Imported',
      tags: ['Imported'],
      updatedAt: 20,
    }
    await db.notes.bulkPut([existingNote, importedNote])
    await enqueueSyncOperation('notes', 'upsert', existingNote)

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await runRxdbSyncCycle()

    const notePushCalls = fetchMock.mock.calls.filter(([url, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return String(url).includes('/sync/rxdb/push') && body.entityType === 'notes'
    })
    const pushedIds = notePushCalls.flatMap(([, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return (body.rows ?? []).map((row: { newDocumentState: { id: string } }) => row.newDocumentState.id)
    })
    expect(pushedIds).toContain('note-imported')
  })

  it('pulls remote rows through the new endpoint and writes them back to Dexie tables', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'note-remote',
              title: 'Remote note',
              contentMd: 'body',
              contentJson: null,
              editorMode: 'document',
              collection: 'all-notes',
              tags: [],
              excerpt: '',
              pinned: false,
              wordCount: 0,
              charCount: 0,
              paragraphCount: 0,
              imageCount: 0,
              fileCount: 0,
              headings: [],
              backlinks: [],
              createdAt: 1,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'note-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.notes.get('note-remote'))?.title).toBe('Remote note')
  })

  it('batches pulled Dexie refresh notifications per entity', async () => {
    const eventTarget = new EventTarget()
    vi.spyOn(window, 'dispatchEvent').mockImplementation(eventTarget.dispatchEvent.bind(eventTarget))
    const syncDataUpdated = vi.fn()
    eventTarget.addEventListener(SYNC_DATA_UPDATED_EVENT, syncDataUpdated)

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [
              {
                id: 'note-remote-a',
                title: 'Remote note A',
                contentMd: 'body',
                contentJson: null,
                editorMode: 'document',
                collection: 'all-notes',
                tags: [],
                excerpt: '',
                pinned: false,
                wordCount: 0,
                charCount: 0,
                paragraphCount: 0,
                imageCount: 0,
                fileCount: 0,
                headings: [],
                backlinks: [],
                createdAt: 1,
                updatedAt: 20,
                _deleted: false,
              },
              {
                id: 'note-remote-b',
                title: 'Remote note B',
                contentMd: 'body',
                contentJson: null,
                editorMode: 'document',
                collection: 'all-notes',
                tags: [],
                excerpt: '',
                pinned: false,
                wordCount: 0,
                charCount: 0,
                paragraphCount: 0,
                imageCount: 0,
                fileCount: 0,
                headings: [],
                backlinks: [],
                createdAt: 1,
                updatedAt: 21,
                _deleted: false,
              },
            ],
            checkpoint: { updatedAt: 21, id: 'note-remote-b' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    const noteEvents = syncDataUpdated.mock.calls.filter(([event]) => {
      return (event as CustomEvent).detail?.topic === 'notes'
    })
    expect(noteEvents).toHaveLength(1)
  })

  it('does not emit pulled refresh notifications when Dexie data is unchanged', async () => {
    const eventTarget = new EventTarget()
    vi.spyOn(window, 'dispatchEvent').mockImplementation(eventTarget.dispatchEvent.bind(eventTarget))
    const syncDataUpdated = vi.fn()
    eventTarget.addEventListener(SYNC_DATA_UPDATED_EVENT, syncDataUpdated)

    await db.notes.put({
      id: 'note-remote',
      title: 'Remote note',
      contentMd: 'body',
      contentJson: null,
      editorMode: 'document',
      collection: 'all-notes',
      tags: [],
      excerpt: '',
      pinned: false,
      wordCount: 0,
      charCount: 0,
      paragraphCount: 0,
      imageCount: 0,
      fileCount: 0,
      headings: [],
      backlinks: [],
      deletedAt: null,
      createdAt: 1,
      updatedAt: 20,
    })

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'note-remote',
              title: 'Remote note',
              contentMd: 'body',
              contentJson: null,
              editorMode: 'document',
              collection: 'all-notes',
              tags: [],
              excerpt: '',
              pinned: false,
              wordCount: 0,
              charCount: 0,
              paragraphCount: 0,
              imageCount: 0,
              fileCount: 0,
              headings: [],
              backlinks: [],
              deletedAt: null,
              createdAt: 1,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'note-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect(syncDataUpdated.mock.calls.some(([event]) => (event as CustomEvent).detail?.topic === 'notes')).toBe(false)
  })

  it('does not loop when remote payload omits locally-defaulted fields', async () => {
    // Simulates a note whose wire payload omits fields the local normalize step
    // re-adds on read (e.g. excerpt, wordCount, charCount). Without the merge fix,
    // writeDexieEntity would see existing-with-defaults vs payload-without-defaults
    // as different, write every cycle, and dispatch a 'notes' refresh forever.
    const eventTarget = new EventTarget()
    vi.spyOn(window, 'dispatchEvent').mockImplementation(eventTarget.dispatchEvent.bind(eventTarget))
    const syncDataUpdated = vi.fn()
    eventTarget.addEventListener(SYNC_DATA_UPDATED_EVENT, syncDataUpdated)

    // Local row with all normalized defaults present (matches what list() bulkPuts).
    await db.notes.put({
      id: 'note-loop',
      title: 'Hello',
      contentMd: '',
      contentJson: null,
      editorMode: 'document',
      collection: 'all-notes',
      tags: [],
      excerpt: '',
      pinned: false,
      wordCount: 0,
      charCount: 0,
      paragraphCount: 0,
      imageCount: 0,
      fileCount: 0,
      headings: [],
      backlinks: [],
      deletedAt: null,
      createdAt: 1,
      updatedAt: 20,
    })

    // Wire payload omits the derived fields (matches real encoder behavior for
    // empty contentMd: no bodyRefs and decoder doesn't add the derived defaults).
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'note-loop',
              title: 'Hello',
              editorMode: 'document',
              collection: 'all-notes',
              tags: [],
              pinned: false,
              deletedAt: null,
              createdAt: 1,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'note-loop' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()
    // After the first cycle settled into steady state, additional cycles must
    // not fire 'notes' refresh events again. Pre-fix this looped forever.
    syncDataUpdated.mockClear()
    await runRxdbSyncCycle()
    await runRxdbSyncCycle()

    const noteEvents = syncDataUpdated.mock.calls.filter(([event]) => (event as CustomEvent).detail?.topic === 'notes')
    expect(noteEvents).toHaveLength(0)

    // Locally-derived fields must still be there after sync, not stripped.
    const stored = await db.notes.get('note-loop')
    expect(stored?.excerpt).toBe('')
    expect(stored?.wordCount).toBe(0)
  })

  it('syncs domainEvents and projects pulled events into local timeline items', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'domainEvents') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'event-remote',
              type: 'task.completed',
              actorId: null,
              workspaceId: null,
              occurredAt: 20,
              source: { kind: 'user' },
              subject: { domain: 'productivity', type: 'task', id: 'task-remote' },
              subjectKey: 'task:task-remote',
              related: [],
              payload: { title: 'Remote task', previousStatus: 'doing', completedAt: 20 },
              schemaVersion: 1,
              dedupeKey: 'task.completed:task-remote:20',
              createdAt: 20,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'event-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.domainEvents.get('event-remote'))?.dedupeKey).toBe('task.completed:task-remote:20')
    expect((await db.timelineItems.get('tl_event-remote'))?.summary).toBe('Remote task')
  })

  it('uses only rxdb endpoints during migration sync', async () => {
    await db.projects.put({
      id: 'project-local',
      title: 'Local project',
      description: '',
      goal: '',
      status: 'active',
      priority: null,
      health: 'on-track',
      progress: 0,
      createdAt: 1,
      updatedAt: 10,
    })

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (!url.includes('/sync/rxdb/')) throw new Error(`legacy sync endpoint called: ${url}`)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'projects') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'project-remote',
              title: 'Remote project',
              description: '',
              goal: '',
              status: 'active',
              priority: null,
              health: 'on-track',
              progress: 0,
              createdAt: 2,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'project-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.projects.get('project-local'))?.title).toBe('Local project')
    expect((await db.projects.get('project-remote'))?.title).toBe('Remote project')
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/sync/rxdb/'))).toBe(true)
    expect(fetchMock.mock.calls.some(([, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return body.entityType === 'timelineItems'
    })).toBe(false)
  })

  it('pushes deletes as tombstones with deletedAt', async () => {
    const deletedAt = 1234
    await enqueueSyncOperation('projects', 'delete', { id: 'project-deleted', updatedAt: deletedAt, title: 'Deleted' }, deletedAt)

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await runRxdbSyncCycle()

    const pushCall = fetchMock.mock.calls.find(([url, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return String(url).includes('/sync/rxdb/push') && body.entityType === 'projects'
    })
    const body = JSON.parse(String(pushCall?.[1]?.body ?? '{}'))
    expect(body.rows[0].newDocumentState).toMatchObject({
      id: 'project-deleted',
      _deleted: true,
      deletedAt,
      updatedAt: deletedAt,
    })
  })

  it('blocks malformed remote payloads before writing to Dexie', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{ id: 'note-bad', title: 'Bad', updatedAt: 'bad', _deleted: false }],
            checkpoint: null,
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await expect(runRxdbSyncCycle()).rejects.toThrow(/notes: pull returned invalid updatedAt/)
    expect(await db.notes.get('note-bad')).toBeUndefined()
    expect((await db.syncState.get('cloud-sync'))?.lastError).toContain('notes: pull returned invalid updatedAt')
  }, 15_000)

  it('blocks malformed remote domainEvents before writing to Dexie', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'domainEvents') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'event-bad',
              type: 'task.completed',
              occurredAt: 20,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: null,
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await expect(runRxdbSyncCycle()).rejects.toThrow(/domainEvents: pull returned invalid dedupeKey/)
    expect(await db.domainEvents.get('event-bad')).toBeUndefined()
  }, 15_000)
})
