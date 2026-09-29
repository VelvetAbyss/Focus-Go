import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMapped,
  fromMarkdown,
  reconcileSubtasks,
  titleToFileName,
  toMarkdown,
} from '../mapper.ts'
import type { TaskItem } from '../types.ts'

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  createdAt: 1000,
  updatedAt: 2000,
  title: 'Ship the bridge',
  description: 'Wire Obsidian to the sync API.',
  pinned: false,
  isToday: true,
  status: 'doing',
  priority: 'high',
  dueDate: '2026-09-10',
  tags: ['work', 'deep'],
  subtasks: [
    { id: 's1', title: 'Design the schema', done: true },
    { id: 's2', title: 'Write the push path', done: false },
  ],
  taskNoteBlocks: [],
  taskNoteContentMd: 'Some **notes** here.',
  activityLogs: [],
  ...overrides,
})

/** Round-trip a task through markdown and back into a full document. */
const roundTrip = (source: TaskItem, fileName = titleToFileName(source.title)) => {
  const markdown = toMarkdown(source)
  const parsed = fromMarkdown(markdown, fileName)
  return { markdown, parsed, merged: applyMapped(source, parsed.fields, { now: 9999 }) }
}

test('a full task survives a round trip', () => {
  const source = task()
  const { parsed, merged } = roundTrip(source)

  assert.equal(parsed.id, 'task-1')
  assert.equal(merged.title, source.title)
  assert.equal(merged.description, source.description)
  assert.equal(merged.status, 'doing')
  assert.equal(merged.priority, 'high')
  assert.equal(merged.dueDate, '2026-09-10')
  assert.deepEqual(merged.tags, ['work', 'deep'])
  assert.equal(merged.pinned, false)
  assert.equal(merged.isToday, true)
  assert.deepEqual(merged.subtasks, source.subtasks)
  assert.equal(merged.taskNoteContentMd, 'Some **notes** here.')
})

test('unmapped fields are preserved through a round trip', () => {
  const source = task({
    attachments: [
      { id: 'a1', hash: 'h', mime: 'image/png', width: 1, height: 1, byteLength: 1, createdAt: 1 },
    ],
    activityLogs: [{ id: 'l1', type: 'status', message: 'moved to doing', createdAt: 5 }],
    progressHistory: [{ id: 'p1', text: 'halfway', createdAt: 6 }],
    dependencyTaskIds: ['task-2'],
    collaboratorIds: ['user-9'],
    reminderAt: 12345,
    projectId: 'prj-1',
    ownerId: 'user-1',
  })

  const { merged } = roundTrip(source)

  assert.deepEqual(merged.attachments, source.attachments)
  assert.deepEqual(merged.activityLogs, source.activityLogs)
  assert.deepEqual(merged.progressHistory, source.progressHistory)
  assert.deepEqual(merged.dependencyTaskIds, ['task-2'])
  assert.deepEqual(merged.collaboratorIds, ['user-9'])
  assert.equal(merged.reminderAt, 12345)
  assert.equal(merged.projectId, 'prj-1')
  assert.equal(merged.ownerId, 'user-1')
  assert.equal(merged.createdAt, 1000)
})

test('content with emoji, CJK, code fences and nested lists round-trips', () => {
  const note = [
    '中文笔记 🎉',
    '',
    '- 一级',
    '  - 二级',
    '    - 三级',
    '',
    '```ts',
    'const a: number = 1',
    '```',
  ].join('\n')
  const source = task({ taskNoteContentMd: note, description: '描述 with émoji 🚀' })

  const { merged } = roundTrip(source)
  assert.equal(merged.taskNoteContentMd, note)
  assert.equal(merged.description, '描述 with émoji 🚀')
})

test('a heading inside a fenced code block does not split the body', () => {
  const note = ['```md', '## Notes', 'not a real heading', '```'].join('\n')
  const source = task({ description: 'desc', taskNoteContentMd: note })

  const { merged } = roundTrip(source)
  assert.equal(merged.description, 'desc')
  assert.equal(merged.taskNoteContentMd, note)
})

test('the notes section keeps its own sub-headings', () => {
  const note = ['## Background', 'why', '', '### Detail', 'how'].join('\n')
  const { merged } = roundTrip(task({ taskNoteContentMd: note }))
  assert.equal(merged.taskNoteContentMd, note)
})

test('empty optional fields round-trip as empty, not as stale values', () => {
  const source = task({
    description: '',
    taskNoteContentMd: '',
    subtasks: [],
    tags: [],
    priority: null,
    dueDate: undefined,
    startDate: undefined,
    endDate: undefined,
  })

  const { markdown, merged } = roundTrip(source)
  assert.ok(!markdown.includes('## Subtasks'))
  assert.ok(!markdown.includes('## Notes'))
  assert.equal(merged.description, '')
  assert.equal(merged.taskNoteContentMd, '')
  assert.deepEqual(merged.subtasks, [])
  assert.deepEqual(merged.tags, [])
  assert.equal(merged.priority, null)
  assert.equal(merged.dueDate, undefined)
})

test('renaming the file renames the task', () => {
  const markdown = toMarkdown(task())
  const parsed = fromMarkdown(markdown, 'A completely new title')
  assert.equal(parsed.fields.title, 'A completely new title')
})

test('a title that cannot be a file name survives via the escape hatch', () => {
  const source = task({ title: 'Fix: auth/callback [urgent]' })
  const fileName = titleToFileName(source.title)

  assert.ok(!fileName.includes('/'))
  const markdown = toMarkdown(source)
  assert.ok(markdown.includes('focusgo-title:'))

  // Untouched file name -> the real title is still the truth.
  const parsed = fromMarkdown(markdown, fileName)
  assert.equal(parsed.fields.title, 'Fix: auth/callback [urgent]')

  // Genuinely renamed -> the new file name wins.
  const renamed = fromMarkdown(markdown, 'Something else entirely')
  assert.equal(renamed.fields.title, 'Something else entirely')
})

test('a title that is fine as a file name does not add the escape hatch', () => {
  assert.ok(!toMarkdown(task({ title: 'Plain title' })).includes('focusgo-title:'))
})

test('ticking a checkbox in Obsidian changes only that subtask', () => {
  const source = task()
  const edited = toMarkdown(source).replace('- [ ] Write the push path', '- [x] Write the push path')
  const parsed = fromMarkdown(edited, titleToFileName(source.title))
  const merged = applyMapped(source, parsed.fields, { now: 9999 })

  assert.deepEqual(merged.subtasks, [
    { id: 's1', title: 'Design the schema', done: true },
    { id: 's2', title: 'Write the push path', done: true },
  ])
})

test('Obsidian block-sequence tags parse the same as our flow style', () => {
  const markdown = [
    '---',
    'focusgo-id: task-1',
    'status: todo',
    'tags:',
    '  - work',
    '  - deep',
    '---',
    '',
    'body',
  ].join('\n')

  assert.deepEqual(fromMarkdown(markdown, 'T').fields.tags, ['work', 'deep'])
})

test('clearing a value is distinguishable from omitting the key', () => {
  const withCleared = ['---', 'focusgo-id: t', 'priority:', 'tags:', '---', ''].join('\n')
  const clearedFields = fromMarkdown(withCleared, 'T').fields
  assert.equal(clearedFields.priority, null)
  assert.deepEqual(clearedFields.tags, [])

  const withoutKeys = ['---', 'focusgo-id: t', '---', ''].join('\n')
  const absentFields = fromMarkdown(withoutKeys, 'T').fields
  assert.equal('priority' in absentFields, false)
  assert.equal(absentFields.tags, undefined)
})

test('an absent or invalid field keeps the value the server has', () => {
  const source = task({ status: 'doing', priority: 'high' })
  const markdown = ['---', 'focusgo-id: task-1', 'status: nonsense', '---', '', 'desc'].join('\n')

  const merged = applyMapped(source, fromMarkdown(markdown, 'Ship the bridge').fields, { now: 1 })
  assert.equal(merged.status, 'doing', 'an invalid status must not clobber the real one')
  assert.equal(merged.priority, 'high', 'an omitted key must not clear the value')
})

test('a file with no frontmatter is still readable and has no id', () => {
  const parsed = fromMarkdown('Just some text\n', 'Brand new task')
  assert.equal(parsed.id, null)
  assert.equal(parsed.fields.title, 'Brand new task')
  assert.equal(parsed.fields.description, 'Just some text')
})

test('a full timestamp in a date field is narrowed to its date part', () => {
  const markdown = ['---', 'focusgo-id: t', 'due: 2026-09-10T12:00:00.000Z', '---', ''].join('\n')
  assert.equal(fromMarkdown(markdown, 'T').fields.dueDate, '2026-09-10')
})

test('CRLF line endings parse identically', () => {
  const source = task()
  const parsed = fromMarkdown(toMarkdown(source).replace(/\n/g, '\r\n'), titleToFileName(source.title))
  assert.equal(parsed.id, 'task-1')
  assert.deepEqual(parsed.fields.tags, ['work', 'deep'])
  assert.equal(parsed.fields.subtasks?.length, 2)
})

test('titles needing quotes in YAML survive', () => {
  for (const title of ['Title: with colon', '#hashtag start', 'true', '123', '  padded  ']) {
    const source = task({ title })
    const markdown = toMarkdown(source)
    const parsed = fromMarkdown(markdown, titleToFileName(title))
    assert.equal(parsed.fields.title, title, `failed for ${JSON.stringify(title)}`)
  }
})

test('reconcileSubtasks keeps ids when a title is reworded', () => {
  const existing = [
    { id: 's1', title: 'Old name', done: false },
    { id: 's2', title: 'Untouched', done: true },
  ]
  const parsed = [
    { title: 'New name', done: false },
    { title: 'Untouched', done: true },
  ]

  const result = reconcileSubtasks(parsed, existing, () => 'generated')
  assert.deepEqual(result, [
    { id: 's1', title: 'New name', done: false },
    { id: 's2', title: 'Untouched', done: true },
  ])
})

test('reconcileSubtasks mints ids for genuinely new rows', () => {
  let counter = 0
  const result = reconcileSubtasks(
    [{ title: 'Existing', done: false }, { title: 'Added', done: false }],
    [{ id: 's1', title: 'Existing', done: false }],
    () => `new-${(counter += 1)}`,
  )
  assert.deepEqual(result.map((item) => item.id), ['s1', 'new-1'])
})

test('reconcileSubtasks never reuses one id twice for duplicate titles', () => {
  const result = reconcileSubtasks(
    [{ title: 'Same', done: false }, { title: 'Same', done: true }],
    [{ id: 's1', title: 'Same', done: false }],
    () => 'fresh',
  )
  assert.equal(new Set(result.map((item) => item.id)).size, 2)
})

test('editing the note body clears the stale rich-text mirror', () => {
  const source = task({ taskNoteContentJson: { type: 'doc', content: [] } })
  const merged = applyMapped(source, { taskNoteContentMd: 'new body' }, { now: 1 })
  assert.equal(merged.taskNoteContentJson, null)
  assert.equal(merged.taskNoteContentMd, 'new body')
})

test('applyMapped stamps updatedAt so the push is ordered after the base', () => {
  const merged = applyMapped(task(), { title: 'x' }, { now: 123456 })
  assert.equal(merged.updatedAt, 123456)
})

test('titleToFileName never produces an empty or dot-leading name', () => {
  assert.equal(titleToFileName(''), 'Untitled task')
  assert.equal(titleToFileName('///'), 'Untitled task')
  assert.equal(titleToFileName('...hidden'), 'hidden')
  assert.ok(titleToFileName('x'.repeat(500)).length <= 120)
})
