// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { enqueueSyncOperation } from './repository'
import { SYNC_DATA_UPDATED_EVENT } from './constants'
import '../events/timelineProjection'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token', user: { id: 'test-account' } }),
}))

vi.mock('./content', () => ({
  createBlobMap: (blobs: Array<{ hash: string }>) => new Map(blobs.map((blob) => [blob.hash, blob])),
  encodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => ({ payload, blobs: [] }),
  decodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => payload,
}))

import { ensureRxdbSyncReady, resetRxdbSyncDatabase, runRxdbSyncCycle } from './rxdb'

describe('rxdb sync migration', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const syncDataUpdatedSpies: Array<(event: Event) => void> = []

  // Listen on the real jsdom window. Replacing the global `window` with a bare
  // EventTarget (the previous approach) starves RxDB's replication plugin of the
  // window APIs it expects: the cycle never reaches in-sync, burns its full
  // RXDB_SYNC_TIMEOUT_MS, and — because every rxdb entry point serialises on one
  // module-level queue — leaves that queue blocked for every later `beforeEach`.
  const listenForSyncDataUpdated = () => {
    const spy = vi.fn()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, spy)
    syncDataUpdatedSpies.push(spy)
    return spy
  }

  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    while (syncDataUpdatedSpies.length > 0) {
      window.removeEventListener(SYNC_DATA_UPDATED_EVENT, syncDataUpdatedSpies.pop()!)
    }
    vi.unstubAllGlobals()
    fetchMock.mockReset()
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

  it('keeps offline note and task changes queued until connectivity returns', async () => {
    const note = {
      id: 'note-offline', title: 'Offline note', contentMd: 'Edited while disconnected', contentJson: null,
      editorMode: 'document' as const, collection: 'all-notes' as const, tags: [], excerpt: '',
      pinned: false, wordCount: 3, charCount: 25, paragraphCount: 1, imageCount: 0,
      fileCount: 0, headings: [], backlinks: [], deletedAt: null, createdAt: 1, updatedAt: 20,
    }
    const task = {
      id: 'task-offline', title: 'Offline task', description: '', pinned: false, isToday: false,
      status: 'done' as const, priority: null, tags: [], subtasks: [], taskNoteBlocks: [],
      taskNoteContentMd: '', taskNoteContentJson: null, activityLogs: [], createdAt: 1, updatedAt: 21,
    }
    await db.notes.put(note)
    await db.tasks.put(task)
    await enqueueSyncOperation('notes', 'upsert', note)
    await enqueueSyncOperation('tasks', 'upsert', task)

    let connected = false
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => connected)
    const pushed = new Map<string, Set<string>>()
    fetchMock.mockImplementation(async (input, init) => {
      if (!connected) throw new TypeError('Failed to fetch')
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return { ok: true, json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }) } as Response
      }
      if (url.includes('/sync/rxdb/push')) {
        const ids = pushed.get(body.entityType) ?? new Set<string>()
        for (const row of body.rows ?? []) ids.add(row.newDocumentState.id)
        pushed.set(body.entityType, ids)
      }
      return { ok: true, json: async () => ({ conflicts: [], blobs: [] }) } as Response
    })

    await expect(runRxdbSyncCycle()).rejects.toThrow()
    expect((await db.notes.get(note.id))?.contentMd).toBe(note.contentMd)
    expect((await db.tasks.get(task.id))?.status).toBe('done')

    connected = true
    await runRxdbSyncCycle()
    expect(pushed.get('notes')).toEqual(new Set([note.id]))
    expect(pushed.get('tasks')).toEqual(new Set([task.id]))
    expect((await db.notes.toArray()).filter((row) => row.id === note.id)).toHaveLength(1)
    expect((await db.tasks.toArray()).filter((row) => row.id === task.id)).toHaveLength(1)
    onlineSpy.mockRestore()
  }, 30_000)

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

  it('archives offline note and task edits when another device changed the same records', async () => {
    const local = {
      id: 'note-shared', title: 'Shared note', contentMd: 'My offline edit', contentJson: null,
      editorMode: 'document' as const, collection: 'all-notes' as const, tags: [], excerpt: '',
      pinned: false, wordCount: 3, charCount: 15, paragraphCount: 1, imageCount: 0,
      fileCount: 0, headings: [], backlinks: [], deletedAt: null, createdAt: 1, updatedAt: 100,
    }
    const remote = { ...local, contentMd: 'Other device edit', updatedAt: 200, _deleted: false }
    const localTask = {
      id: 'task-shared', title: 'My offline task edit', description: '', pinned: false, isToday: false,
      status: 'todo' as const, priority: null, tags: [], subtasks: [], taskNoteBlocks: [],
      taskNoteContentMd: '', taskNoteContentJson: null, activityLogs: [], createdAt: 1, updatedAt: 101,
    }
    const remoteTask = { ...localTask, title: 'Other device task edit', updatedAt: 201, _deleted: false }
    await db.notes.put(local)
    await db.tasks.put(localTask)
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        const isFirstNotePull = body.entityType === 'notes' && !body.checkpoint
        const isFirstTaskPull = body.entityType === 'tasks' && !body.checkpoint
        const pulled = isFirstNotePull ? remote : isFirstTaskPull ? remoteTask : null
        return { ok: true, json: async () => ({
          documents: pulled ? [pulled] : [],
          checkpoint: pulled ? { id: pulled.id, updatedAt: pulled.updatedAt, sequence: 1 } : body.checkpoint ?? null,
          blobs: [],
        }) } as Response
      }
      return { ok: true, json: async () => ({
        conflicts: body.entityType === 'notes' ? [remote]
          : body.entityType === 'tasks' ? [remoteTask] : [], blobs: [],
      }) } as Response
    })

    await runRxdbSyncCycle()

    const conflicts = await db.syncConflicts.toArray()
    expect(conflicts).toHaveLength(2)
    const noteConflict = conflicts.find((item) => item.entityType === 'notes')
    const taskConflict = conflicts.find((item) => item.entityType === 'tasks')
    expect(noteConflict?.accountId).toBe('test-account')
    expect(noteConflict?.localDocument.contentMd).toBe('My offline edit')
    expect(noteConflict?.remoteDocument.contentMd).toBe('Other device edit')
    expect(taskConflict?.localDocument.title).toBe('My offline task edit')
    expect(taskConflict?.remoteDocument.title).toBe('Other device task edit')
    expect((await db.notes.get(local.id))?.contentMd).toBe('Other device edit')
    expect((await db.tasks.get(localTask.id))?.title).toBe('Other device task edit')
    expect((await db.syncState.get('cloud-sync'))?.status).toBe('blocked')
  }, 15_000)

  it('batches pulled Dexie refresh notifications per entity', async () => {
    const syncDataUpdated = listenForSyncDataUpdated()

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
    const syncDataUpdated = listenForSyncDataUpdated()

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
    const syncDataUpdated = listenForSyncDataUpdated()

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
