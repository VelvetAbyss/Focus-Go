import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Replicator, type ReplicatorHost } from '../replicator.ts'
import { encodeTaskPayload } from '../protocol.ts'
import { emptyState, hashContent } from '../state.ts'
import { toMarkdown } from '../mapper.ts'
import type { Checkpoint, PullResponse, PushResponse, PushRow, SyncClient } from '../syncClient.ts'
import type { SyncWireBlob, TaskItem } from '../types.ts'

// Run against the API's real store, not a hand-written stub, so the optimistic
// concurrency and tombstone rules under test are the ones that actually ship.
const require = createRequire(import.meta.url)
const storePath = require.resolve('../../../web/focus-go-api/sync/store.js')
const store = await import(storePath)
// Resolve the driver from the API package rather than vendoring a second copy
// of a native module into this workspace.
const Database = createRequire(storePath)('better-sqlite3')

const USER = 'user-1'

class RealServer {
  readonly db = new Database(':memory:')
  private readonly blobs = new Map<string, SyncWireBlob>()

  constructor() {
    store.ensureSyncTables(this.db)
  }

  asClient(): SyncClient {
    return {
      pull: async (checkpoint: Checkpoint, limit = 100): Promise<PullResponse> =>
        store.getRxdbPullState(this.db, USER, 'tasks', checkpoint, limit),
      push: async (rows: PushRow[], blobs: SyncWireBlob[]): Promise<PushResponse> => {
        for (const blob of blobs) {
          this.blobs.set(blob.hash, blob)
          store.upsertSyncBlob(this.db, blob)
        }
        return store.pushRxdbRows(this.db, USER, 'tasks', rows)
      },
    } as unknown as SyncClient
  }

  /** Simulate the web app writing a task. */
  async appWrites(task: TaskItem): Promise<void> {
    const { payload, blobs } = await encodeTaskPayload(task)
    for (const blob of blobs) store.upsertSyncBlob(this.db, blob)
    const current = store.getRxdbPullState(this.db, USER, 'tasks', null, 500).documents
      .find((doc: { id: string }) => doc.id === task.id)
    const result = store.pushRxdbRows(this.db, USER, 'tasks', [
      { newDocumentState: payload, assumedMasterState: current ?? null },
    ])
    assert.equal(result.conflicts.length, 0, 'app write should not conflict in test setup')
  }

  async appDeletes(id: string, at: number): Promise<void> {
    const current = store.getRxdbPullState(this.db, USER, 'tasks', null, 500).documents
      .find((doc: { id: string }) => doc.id === id)
    assert.ok(current, 'task must exist to be deleted')
    const result = store.pushRxdbRows(this.db, USER, 'tasks', [
      { newDocumentState: { ...current, updatedAt: at, _deleted: true }, assumedMasterState: current },
    ])
    assert.equal(result.conflicts.length, 0)
  }

  /** Live rows only. A pull still returns tombstones, which `readRaw` exposes. */
  read(id: string) {
    const document = this.readRaw(id)
    return document?._deleted === true ? undefined : document
  }

  readRaw(id: string) {
    return store.getRxdbPullState(this.db, USER, 'tasks', null, 500).documents
      .find((doc: { id: string }) => doc.id === id)
  }
}

class FakeVault {
  readonly files = new Map<string, string>()
  readonly trashed: string[] = []

  async ensureFolder() {}
  async readIfExists(path: string) {
    return this.files.get(path) ?? null
  }
  async availablePath(folder: string, title: string, exceptPath?: string) {
    const base = title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled task'
    for (let i = 0; i < 100; i += 1) {
      const path = `${folder}/${i === 0 ? base : `${base}-${i + 1}`}.md`
      if (path === exceptPath || !this.files.has(path)) return path
    }
    throw new Error('no path available')
  }
  async write(path: string, content: string) {
    this.files.set(path, content)
  }
  async rename(from: string, to: string) {
    const content = this.files.get(from)
    if (content === undefined) return
    this.files.delete(from)
    this.files.set(to, content)
  }
  async trash(path: string) {
    this.files.delete(path)
    this.trashed.push(path)
  }
  exists(path: string) {
    return this.files.has(path)
  }
}

const FOLDER = 'Focus & Go/Tasks'

const harness = () => {
  const server = new RealServer()
  const vault = new FakeVault()
  const state = emptyState()
  const notices: string[] = []
  let clock = 1_000_000

  const host: ReplicatorHost = {
    getSettings: () => ({ folder: FOLDER, syncEnabled: true }),
    getState: () => state,
    saveState: async () => {},
    vault,
    notify: (message) => notices.push(message),
    now: () => (clock += 1000),
    newId: (() => {
      let counter = 0
      return () => `generated-${(counter += 1)}`
    })(),
  }

  return {
    server,
    vault,
    state,
    notices,
    replicator: new Replicator(server.asClient(), host),
    setClock: (value: number) => {
      clock = value
    },
  }
}

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  createdAt: 1,
  updatedAt: 100,
  title: 'Ship the bridge',
  description: 'desc',
  pinned: false,
  isToday: false,
  status: 'todo',
  priority: null,
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
  ...overrides,
})

// ---------------------------------------------------------------------------

test('a task created in the app materialises as a note', async () => {
  const h = harness()
  await h.server.appWrites(task({ taskNoteContentMd: 'the body' }))

  const report = await h.replicator.pull()

  assert.equal(report.pulled, 1)
  const path = `${FOLDER}/Ship the bridge.md`
  assert.ok(h.vault.files.has(path))
  const content = h.vault.files.get(path) as string
  assert.match(content, /focusgo-id: task-1/)
  assert.match(content, /the body/)
})

test('a task deleted in the app removes the note', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  await h.server.appDeletes('task-1', 200)
  const report = await h.replicator.pull()

  assert.equal(report.deleted, 1)
  assert.deepEqual(h.vault.trashed, [`${FOLDER}/Ship the bridge.md`])
  assert.equal(h.state.tasks['task-1'], undefined)
})

test('renaming a task in the app renames the note', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  await h.server.appWrites(task({ title: 'A different name', updatedAt: 300 }))
  await h.replicator.pull()

  assert.ok(!h.vault.files.has(`${FOLDER}/Ship the bridge.md`))
  assert.ok(h.vault.files.has(`${FOLDER}/A different name.md`))
  assert.equal(h.state.tasks['task-1'].filePath, `${FOLDER}/A different name.md`)
})

test('editing a note pushes the change and keeps unmapped fields', async () => {
  const h = harness()
  await h.server.appWrites(
    task({
      taskNoteContentMd: 'original body',
      attachments: [
        { id: 'a1', hash: 'h', mime: 'image/png', width: 1, height: 1, byteLength: 1, createdAt: 1 },
      ],
      activityLogs: [{ id: 'l1', type: 'status', message: 'created', createdAt: 1 }],
    }),
  )
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  const edited = (h.vault.files.get(path) as string)
    .replace('status: todo', 'status: done')
    .replace('original body', 'edited body')
  h.vault.files.set(path, edited)

  const report = await h.replicator.push([path])
  assert.equal(report.pushed, 1)

  const stored = h.server.read('task-1')
  assert.equal(stored.status, 'done')
  assert.deepEqual(stored.attachments, [
    { id: 'a1', hash: 'h', mime: 'image/png', width: 1, height: 1, byteLength: 1, createdAt: 1 },
  ])
  assert.deepEqual(stored.activityLogs, [{ id: 'l1', type: 'status', message: 'created', createdAt: 1 }])
})

test('renaming a note in Obsidian renames the task', async () => {
  // Regression: a rename leaves the file content byte-identical, so a
  // content-hash check skips the push and the new title never reaches the app.
  const h = harness()
  await h.server.appWrites(task({ title: 'Original name' }))
  await h.replicator.pull()

  const from = `${FOLDER}/Original name.md`
  const to = `${FOLDER}/Renamed by hand.md`
  const content = h.vault.files.get(from) as string
  h.vault.files.delete(from)
  h.vault.files.set(to, content)
  h.state.tasks['task-1'].filePath = to

  const report = await h.replicator.push([to])

  assert.equal(report.pushed, 1)
  assert.equal(h.server.read('task-1').title, 'Renamed by hand')
})

test('renaming a note whose title needs the escape hatch still renames the task', async () => {
  const h = harness()
  await h.server.appWrites(task({ title: '[demo] has/illegal:chars' }))
  await h.replicator.pull()

  const from = h.state.tasks['task-1'].filePath
  assert.match(h.vault.files.get(from) as string, /focusgo-title:/)

  const to = `${FOLDER}/Hello.md`
  h.vault.files.set(to, h.vault.files.get(from) as string)
  h.vault.files.delete(from)
  h.state.tasks['task-1'].filePath = to

  await h.replicator.push([to])
  assert.equal(h.server.read('task-1').title, 'Hello')
})

test('a whitespace-only edit does not push', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  h.vault.files.set(path, `${h.vault.files.get(path) as string}\n\n`)

  assert.equal((await h.replicator.push([path])).pushed, 0)
})

test('a push that changes nothing is a no-op', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const report = await h.replicator.push([`${FOLDER}/Ship the bridge.md`])
  assert.equal(report.pushed, 0)
})

test('a new note without an id becomes a new task and gets its id written back', async () => {
  const h = harness()
  const path = `${FOLDER}/Brand new.md`
  h.vault.files.set(path, 'Just a description\n')

  const report = await h.replicator.push([path])

  assert.equal(report.pushed, 1)
  const written = h.vault.files.get(path) as string
  assert.match(written, /focusgo-id: generated-1/)
  const stored = h.server.read('generated-1')
  assert.equal(stored.title, 'Brand new')
  assert.equal(stored.description, 'Just a description')
  assert.equal(stored.status, 'todo')
})

test('deleting a note deletes the task', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  h.vault.files.delete(path)
  const report = await h.replicator.pushDelete(path)

  assert.equal(report.deleted, 1)
  assert.equal(h.server.read('task-1'), undefined, 'no longer a live row')
  assert.equal(h.server.readRaw('task-1')._deleted, true, 'a tombstone the app will replicate')
  assert.equal(h.state.tasks['task-1'], undefined)
})

test('a note deleted after the app edited the task does not delete it', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  // The app moves the task on while the vault still holds the old shadow.
  await h.server.appWrites(task({ status: 'doing', updatedAt: 500 }))

  const path = `${FOLDER}/Ship the bridge.md`
  h.vault.files.delete(path)
  const report = await h.replicator.pushDelete(path)

  assert.equal(report.deleted, 0)
  assert.ok(h.server.read('task-1'), 'the task must survive')
  assert.match(h.notices.join(' '), /not deleted/)
})

test('concurrent edits merge field by field, app wins on a true clash', async () => {
  const h = harness()
  await h.server.appWrites(task({ status: 'todo', priority: null }))
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  // Vault changes priority; app concurrently changes status.
  h.vault.files.set(path, (h.vault.files.get(path) as string).replace('priority:', 'priority: high'))
  await h.server.appWrites(task({ status: 'doing', priority: null, updatedAt: 600 }))

  await h.replicator.push([path])

  const stored = h.server.read('task-1')
  assert.equal(stored.priority, 'high', 'the vault-only change survives')
  assert.equal(stored.status, 'doing', 'the app-only change survives')
})

test('when both sides change the same field, the app wins and the user is told', async () => {
  const h = harness()
  await h.server.appWrites(task({ status: 'todo' }))
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  h.vault.files.set(path, (h.vault.files.get(path) as string).replace('status: todo', 'status: done'))
  await h.server.appWrites(task({ status: 'doing', updatedAt: 700 }))

  await h.replicator.push([path])

  assert.equal(h.server.read('task-1').status, 'doing')
  assert.match(h.notices.join(' '), /edited in both places/)
  assert.match(h.vault.files.get(path) as string, /status: doing/)
})

test('editing a note whose task was deleted in the app removes the note', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  h.vault.files.set(path, (h.vault.files.get(path) as string).replace('status: todo', 'status: done'))
  await h.server.appDeletes('task-1', 800)

  await h.replicator.push([path])

  assert.deepEqual(h.vault.trashed, [path])
  assert.match(h.notices.join(' '), /deleted in Focus & Go/)
})

test('a pull does not clobber a note with unpushed edits', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  const dirty = (h.vault.files.get(path) as string).replace('desc', 'my unsaved edit')
  h.vault.files.set(path, dirty)

  await h.server.appWrites(task({ description: 'app changed it', updatedAt: 900 }))
  h.state.checkpoint = null
  const report = await h.replicator.pull()

  assert.equal(report.skipped, 1)
  assert.equal(h.vault.files.get(path), dirty, 'the local edit must survive until it is pushed')
})

test('an incremental pull only reports what changed', async () => {
  const h = harness()
  await h.server.appWrites(task({ id: 'a', title: 'Task A' }))
  await h.server.appWrites(task({ id: 'b', title: 'Task B', updatedAt: 101 }))
  assert.equal((await h.replicator.pull()).pulled, 2)

  assert.equal((await h.replicator.pull()).pulled, 0, 'nothing new')

  await h.server.appWrites(task({ id: 'b', title: 'Task B renamed', updatedAt: 1000 }))
  assert.equal((await h.replicator.pull()).pulled, 1)
})

test('moving a note out of the folder keeps the task', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  await h.replicator.forget(`${FOLDER}/Ship the bridge.md`)

  assert.ok(h.server.read('task-1'), 'the task is untouched')
  assert.equal(h.state.tasks['task-1'], undefined)
  assert.equal(h.state.checkpoint, null, 'a full replay re-materialises it')
})

test('our own writes are recognised as echoes exactly once', async () => {
  const h = harness()
  await h.server.appWrites(task())
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  assert.equal(h.replicator.consumeSelfWrite(path), true)
  assert.equal(h.replicator.consumeSelfWrite(path), false, 'a real later edit must not be swallowed')
})

test('a task the app clears fields on round-trips to an emptied note', async () => {
  const h = harness()
  await h.server.appWrites(task({ tags: ['a', 'b'], dueDate: '2026-01-01', taskNoteContentMd: 'x' }))
  await h.replicator.pull()

  await h.server.appWrites(task({ tags: [], dueDate: undefined, taskNoteContentMd: '', updatedAt: 1100 }))
  await h.replicator.pull()

  const content = h.vault.files.get(`${FOLDER}/Ship the bridge.md`) as string
  assert.match(content, /tags: \[\]/)
  assert.ok(!content.includes('due:'))
  assert.ok(!content.includes('## Notes'))
})

test('the note body survives a full pull -> edit -> push -> pull cycle', async () => {
  const h = harness()
  const body = '中文 🎉\n\n```ts\nconst a = 1\n```'
  await h.server.appWrites(task({ taskNoteContentMd: body }))
  await h.replicator.pull()

  const path = `${FOLDER}/Ship the bridge.md`
  const appended = `${h.vault.files.get(path) as string}\nappended line\n`
  h.vault.files.set(path, appended)
  await h.replicator.push([path])

  h.state.checkpoint = null
  h.state.tasks = {}
  h.vault.files.clear()
  await h.replicator.pull()

  const roundTripped = h.vault.files.get(path) as string
  assert.match(roundTripped, /中文 🎉/)
  assert.match(roundTripped, /const a = 1/)
  assert.match(roundTripped, /appended line/)
})

test('state hashing detects our own write versus a user edit', () => {
  const content = toMarkdown(task())
  assert.equal(hashContent(content), hashContent(content))
  assert.notEqual(hashContent(content), hashContent(`${content}x`))
})
