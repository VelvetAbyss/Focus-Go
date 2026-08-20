import { describe, expect, it } from 'vitest'
import { encodeSyncPayload } from './content'

describe('encodeSyncPayload', () => {
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
