import { describe, expect, it } from 'vitest'
import { decodeSyncPayload, encodeSyncPayload } from './content'

describe('encodeSyncPayload', () => {
  it('roundtrips CRDT state through compressed content-addressed note blobs', async () => {
    const note = { id: 'crdt-note', createdAt: 1, updatedAt: 2, title: '', contentMd: 'body', contentJson: null,
      crdtState: 'encoded-yjs-update', editorMode: 'document', collection: 'all-notes', tags: [], pinned: false } as const
    const encoded = await encodeSyncPayload('notes', note as never)
    expect(encoded.payload).not.toHaveProperty('crdtState')
    expect(encoded.payload).toMatchObject({ bodyRefs: { crdtState: expect.any(String) } })
    const decoded = await decodeSyncPayload('notes', encoded.payload, new Map(encoded.blobs.map(blob => [blob.hash, blob])))
    expect(decoded).toMatchObject({ crdtState: note.crdtState, contentMd: note.contentMd })
  })
  it('drops invalid optional ids from note payloads', async () => {
    const encoded = await encodeSyncPayload('notes', {
      id: 'note-1',
      createdAt: 1,
      updatedAt: 2,
      userId: 'undefined',
      workspaceId: '  ',
      title: 'Note',
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
    })

    expect(encoded.payload).not.toHaveProperty('userId')
    expect(encoded.payload).not.toHaveProperty('workspaceId')
  })

  it('strips raw task note bodies after converting them to blob refs', async () => {
    const encoded = await encodeSyncPayload('tasks', {
      id: 'task-1',
      createdAt: 1,
      updatedAt: 2,
      title: 'Task',
      description: '',
      pinned: false,
      isToday: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '# body',
      taskNoteContentJson: { type: 'doc' },
      activityLogs: [],
      userId: 'null',
      workspaceId: 'workspace-1',
    })

    expect(encoded.payload).not.toHaveProperty('taskNoteContentMd')
    expect(encoded.payload).not.toHaveProperty('taskNoteContentJson')
    expect(encoded.payload).toMatchObject({
      workspaceId: 'workspace-1',
      bodyRefs: {
        taskNoteContentMd: expect.any(String),
        taskNoteContentJson: expect.any(String),
      },
    })
    expect(encoded.payload).not.toHaveProperty('userId')
  })
})
