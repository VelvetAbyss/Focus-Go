import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { encodeTaskPayload, decodeBlob, decodeTaskDocument, sha256Hex } from '../protocol.ts'
import type { SyncWireBlob, TaskItem } from '../types.ts'

// The server's own implementation, imported directly from the API package. If
// these two ever drift, pushes stop matching `assumedMasterState` and every
// update silently dead-ends in the conflict path instead of erroring — so this
// test is the guard rail for that whole class of failure.
const require = createRequire(import.meta.url)
const serverProtocolPath = require.resolve(
  '../../../web/focus-go-api/sync/protocol.js',
)
const serverProtocol = await import(serverProtocolPath)

const baseTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  createdAt: 1,
  updatedAt: 2,
  title: 'Ship the bridge',
  description: 'A description',
  pinned: false,
  isToday: true,
  status: 'doing',
  priority: 'high',
  tags: ['work'],
  subtasks: [{ id: 's1', title: 'Design', done: true }],
  taskNoteBlocks: [],
  activityLogs: [],
  ...overrides,
})

const SAMPLES: Array<{ name: string; task: TaskItem }> = [
  { name: 'plain task, no note body', task: baseTask({ taskNoteContentMd: '' }) },
  { name: 'ascii note body', task: baseTask({ taskNoteContentMd: 'Hello world' }) },
  {
    name: 'multibyte + emoji note body',
    task: baseTask({ taskNoteContentMd: '中文笔记 🎉\n第二行' }),
  },
  {
    name: 'note body with fenced code',
    task: baseTask({ taskNoteContentMd: '```ts\nconst a = 1\n```' }),
  },
  {
    name: 'task carrying attachments and activity logs',
    task: baseTask({
      taskNoteContentMd: 'body',
      attachments: [
        { id: 'a1', hash: 'deadbeef', mime: 'image/png', width: 1, height: 2, byteLength: 3, createdAt: 4 },
      ],
      activityLogs: [{ id: 'l1', type: 'status', message: 'moved', createdAt: 5 }],
    }),
  },
]

for (const sample of SAMPLES) {
  test(`wire encoding matches the server: ${sample.name}`, async () => {
    const mine = await encodeTaskPayload(sample.task)
    const theirs = serverProtocol.normalizePayloadForWire('tasks', sample.task)

    assert.deepEqual(
      mine.payload,
      theirs.payload,
      'payload must be structurally identical or assumedMasterState will never match',
    )
    assert.equal(mine.blobs.length, theirs.blobs.length)
    for (let i = 0; i < mine.blobs.length; i += 1) {
      assert.equal(mine.blobs[i].hash, theirs.blobs[i].hash, 'blob hash mismatch')
      assert.equal(mine.blobs[i].rawByteLength, theirs.blobs[i].rawByteLength)
      assert.equal(mine.blobs[i].contentType, theirs.blobs[i].contentType)
      assert.equal(mine.blobs[i].compression, theirs.blobs[i].compression)
    }
  })
}

test('the blob hash is sha256 over the namespaced raw body', async () => {
  const body = 'note body'
  const { blobs } = await encodeTaskPayload(baseTask({ taskNoteContentMd: body }))
  assert.equal(blobs[0].hash, await sha256Hex(`task:contentMd:${body}`))
})

test('gzip round-trips through our own decoder', async () => {
  const body = '中文 🎉\n```ts\nconst a = 1\n```'
  const { blobs } = await encodeTaskPayload(baseTask({ taskNoteContentMd: body }))
  assert.equal(decodeBlob(blobs[0]), body)
})

test("the server's gzip decodes with our decoder too", async () => {
  const body = 'cross-implementation body 中文'
  const theirs = serverProtocol.normalizePayloadForWire('tasks', baseTask({ taskNoteContentMd: body }))
  assert.equal(decodeBlob(theirs.blobs[0] as SyncWireBlob), body)
})

test('encode/decode is a round trip through the wire shape', async () => {
  const task = baseTask({ taskNoteContentMd: 'the note', taskNoteContentJson: { doc: true } })
  const { payload, blobs } = await encodeTaskPayload(task)

  // The wire form must not carry the bodies inline.
  assert.equal(payload.taskNoteContentMd, undefined)
  assert.equal(payload.taskNoteContentJson, undefined)

  const decoded = decodeTaskDocument(payload, new Map(blobs.map((blob) => [blob.hash, blob])))
  assert.equal(decoded.taskNoteContentMd, 'the note')
})

test('emptying a note drops its bodyRef so the old blob stops being rendered', async () => {
  const withBody = await encodeTaskPayload(baseTask({ taskNoteContentMd: 'something' }))
  assert.ok((withBody.payload.bodyRefs as Record<string, string>).taskNoteContentMd)

  const cleared = await encodeTaskPayload({
    ...baseTask({ taskNoteContentMd: '' }),
    bodyRefs: (withBody.payload as Record<string, unknown>).bodyRefs,
  } as TaskItem)
  assert.equal(cleared.payload.bodyRefs, undefined)
})

test('a document whose blob is missing is reported rather than silently emptied', async () => {
  const { payload } = await encodeTaskPayload(baseTask({ taskNoteContentMd: 'body' }))
  const { hasUnresolvedBody } = await import('../protocol.ts')

  assert.equal(hasUnresolvedBody(payload, new Map()), true)
  const decoded = decodeTaskDocument(payload, new Map())
  assert.equal(decoded.taskNoteContentMd, undefined)
})
