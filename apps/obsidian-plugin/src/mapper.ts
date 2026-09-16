import {
  hasKey,
  parseYamlMap,
  readBoolean,
  readString,
  readStringList,
  splitFrontmatter,
  stringifyYamlMap,
  type YamlMap,
} from './yaml.ts'
import {
  MAPPED_FIELD_KEYS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type TaskSubtask,
} from './types.ts'

export const ID_KEY = 'focusgo-id'
export const TITLE_KEY = 'focusgo-title'
export const SUBTASKS_HEADING = '## Subtasks'
export const NOTES_HEADING = '## Notes'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Characters that cannot appear in an Obsidian file name. */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|#^[\]]/g

/**
 * A task's title is its file name — that is how Obsidian works, and it makes
 * renaming a note the natural way to rename a task. Titles that cannot survive
 * a file name keep their true value in the `focusgo-title` property.
 */
export const titleToFileName = (title: string): string => {
  const cleaned = title
    .replace(ILLEGAL_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim()
  return cleaned === '' ? 'Untitled task' : cleaned
}

export const titleSurvivesFileName = (title: string): boolean => titleToFileName(title) === title

type ParsedSubtask = { title: string; done: boolean }

export type ParsedTaskFile = {
  id: string | null
  /** Only keys the file actually carried. Absent keys keep their remote value. */
  fields: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority | null
    dueDate?: string
    startDate?: string
    endDate?: string
    waitingOn?: string
    nextPollAt?: number
    tags?: string[]
    pinned?: boolean
    isToday?: boolean
    subtasks?: ParsedSubtask[]
    taskNoteContentMd?: string
  }
}

// ---------------------------------------------------------------------------
// Task -> markdown
// ---------------------------------------------------------------------------

export const toMarkdown = (task: TaskItem): string => {
  const frontmatter: YamlMap = { [ID_KEY]: task.id }

  // Only needed when the file name cannot represent the title losslessly.
  if (!titleSurvivesFileName(task.title)) frontmatter[TITLE_KEY] = task.title

  frontmatter.status = task.status
  frontmatter.priority = task.priority ?? null
  if (task.dueDate) frontmatter.due = task.dueDate
  if (task.startDate) frontmatter.start = task.startDate
  if (task.endDate) frontmatter.end = task.endDate
  // Who you are waiting on, and when to chase. A due date cannot say either.
  if (task.waitingOn) frontmatter['waiting-on'] = task.waitingOn
  if (typeof task.nextPollAt === 'number') {
    frontmatter['next-poll'] = new Date(task.nextPollAt).toISOString().slice(0, 10)
  }
  frontmatter.tags = task.tags ?? []
  frontmatter.pinned = Boolean(task.pinned)
  frontmatter.today = Boolean(task.isToday)
  if (task.projectId) frontmatter.project = task.projectId
  frontmatter.updated = new Date(task.updatedAt).toISOString()

  const sections: string[] = []
  const description = (task.description ?? '').trim()
  if (description !== '') sections.push(description)

  const subtasks = task.subtasks ?? []
  if (subtasks.length > 0) {
    const lines = subtasks.map((subtask) => `- [${subtask.done ? 'x' : ' '}] ${subtask.title}`)
    sections.push([SUBTASKS_HEADING, ...lines].join('\n'))
  }

  const note = (task.taskNoteContentMd ?? '').trim()
  if (note !== '') sections.push([NOTES_HEADING, note].join('\n'))

  const body = sections.join('\n\n')
  return `---\n${stringifyYamlMap(frontmatter)}\n---\n\n${body}${body === '' ? '' : '\n'}`
}

// ---------------------------------------------------------------------------
// markdown -> task fields
// ---------------------------------------------------------------------------

/**
 * Split the body into description / subtasks / notes.
 *
 * Fenced code blocks are skipped so a `## Notes` line inside a code sample does
 * not silently truncate the description. Only the first top-level occurrence of
 * each heading counts, and once the notes section starts everything else — any
 * further headings included — belongs to it.
 */
const splitBodySections = (body: string) => {
  const lines = body.split('\n')
  let fence: string | null = null
  let subtasksAt = -1
  let notesAt = -1

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const fenceMatch = /^\s{0,3}(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1][0]
      else if (line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (fence !== null) continue
    const heading = line.trim()
    if (subtasksAt === -1 && notesAt === -1 && heading === SUBTASKS_HEADING) subtasksAt = i
    else if (notesAt === -1 && heading === NOTES_HEADING) notesAt = i
  }

  const descriptionEnd = subtasksAt !== -1 ? subtasksAt : notesAt !== -1 ? notesAt : lines.length
  const description = lines.slice(0, descriptionEnd).join('\n').trim()

  let subtasksBlock: string | null = null
  if (subtasksAt !== -1) {
    const end = notesAt !== -1 && notesAt > subtasksAt ? notesAt : lines.length
    subtasksBlock = lines.slice(subtasksAt + 1, end).join('\n')
  }

  const notes = notesAt !== -1 ? lines.slice(notesAt + 1).join('\n').trim() : null

  return { description, subtasksBlock, notes }
}

const parseSubtasks = (block: string): ParsedSubtask[] => {
  const subtasks: ParsedSubtask[] = []
  for (const line of block.split('\n')) {
    const match = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line)
    if (!match) continue
    const title = match[2].trim()
    if (title === '') continue
    subtasks.push({ title, done: match[1].toLowerCase() === 'x' })
  }
  return subtasks
}

const readDate = (map: YamlMap, key: string): string | undefined => {
  const raw = readString(map, key)
  if (raw === undefined) return undefined
  // A bare YYYY-MM-DD is what we emit; anything else (a full timestamp pasted in
  // by hand, say) is narrowed to its date part when possible.
  if (DATE_PATTERN.test(raw)) return raw
  const isoPrefix = raw.slice(0, 10)
  return DATE_PATTERN.test(isoPrefix) ? isoPrefix : undefined
}

/**
 * @param baseName file name without the `.md` extension — the task's title,
 *                 unless a `focusgo-title` escape hatch says otherwise.
 */
export const fromMarkdown = (content: string, baseName: string): ParsedTaskFile => {
  const { frontmatter, body } = splitFrontmatter(content)
  const map = frontmatter === null ? {} : parseYamlMap(frontmatter)
  const fields: ParsedTaskFile['fields'] = {}

  // Title: the file name wins, unless it is the sanitised form of a stored
  // title that could not be represented — in which case the file was not
  // actually renamed and the stored title is still the truth.
  const storedTitle = readString(map, TITLE_KEY)
  fields.title =
    storedTitle !== undefined && titleToFileName(storedTitle) === baseName ? storedTitle : baseName

  const status = readString(map, 'status')
  if (status !== undefined && (TASK_STATUSES as readonly string[]).includes(status)) {
    fields.status = status as TaskStatus
  }

  if (hasKey(map, 'priority')) {
    const priority = readString(map, 'priority')
    if (priority === undefined) fields.priority = null
    else if ((TASK_PRIORITIES as readonly string[]).includes(priority)) {
      fields.priority = priority as TaskPriority
    }
  }

  const due = readDate(map, 'due')
  if (due !== undefined) fields.dueDate = due
  const start = readDate(map, 'start')
  if (start !== undefined) fields.startDate = start
  const end = readDate(map, 'end')
  if (end !== undefined) fields.endDate = end

  if (hasKey(map, 'waiting-on')) {
    const waitingOn = readString(map, 'waiting-on')
    fields.waitingOn = waitingOn === undefined ? undefined : waitingOn
  }
  if (hasKey(map, 'next-poll')) {
    const nextPoll = readDate(map, 'next-poll')
    fields.nextPollAt = nextPoll === undefined ? undefined : Date.parse(`${nextPoll}T00:00:00`)
  }

  const tags = readStringList(map, 'tags')
  if (tags !== undefined) fields.tags = tags

  const pinned = readBoolean(map, 'pinned')
  if (pinned !== undefined) fields.pinned = pinned
  const today = readBoolean(map, 'today')
  if (today !== undefined) fields.isToday = today

  const { description, subtasksBlock, notes } = splitBodySections(body)
  fields.description = description
  if (subtasksBlock !== null) fields.subtasks = parseSubtasks(subtasksBlock)
  else fields.subtasks = []
  fields.taskNoteContentMd = notes ?? ''

  return { id: readString(map, ID_KEY) ?? null, fields }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Reconcile parsed checkbox lines against the subtasks the server already has,
 * so ids survive edits. Titles match first (the common case — a box was ticked),
 * then position (a title was reworded).
 */
export const reconcileSubtasks = (
  parsed: ParsedSubtask[],
  existing: TaskSubtask[],
  newId: () => string,
): TaskSubtask[] => {
  const byTitle = new Map<string, TaskSubtask[]>()
  for (const subtask of existing) {
    const bucket = byTitle.get(subtask.title)
    if (bucket) bucket.push(subtask)
    else byTitle.set(subtask.title, [subtask])
  }

  const claimed = new Set<string>()
  const result: (TaskSubtask | null)[] = parsed.map((item) => {
    const bucket = byTitle.get(item.title)
    const match = bucket?.find((candidate) => !claimed.has(candidate.id))
    if (!match) return null
    claimed.add(match.id)
    return { id: match.id, title: item.title, done: item.done }
  })

  // Anything unmatched by title falls back to the id at the same position.
  const positional = existing.filter((subtask) => !claimed.has(subtask.id))
  let positionalIndex = 0
  return result.map((entry, index) => {
    if (entry) return entry
    const fallback = positional[positionalIndex]
    positionalIndex += 1
    const id = fallback && !claimed.has(fallback.id) ? fallback.id : newId()
    claimed.add(id)
    return { id, title: parsed[index].title, done: parsed[index].done }
  })
}

/**
 * Produce the document to push: the last-known remote document with only the
 * mapped fields overwritten.
 *
 * This is the single most important function in the plugin. Rebuilding a task
 * from its markdown instead would silently drop attachments, activity logs,
 * progress history and dependency links — every field the file cannot express.
 */
export const applyMapped = (
  base: TaskItem,
  parsed: ParsedTaskFile['fields'],
  options: { now?: number; newId?: () => string } = {},
): TaskItem => {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const next: TaskItem = { ...base }

  if (parsed.title !== undefined) next.title = parsed.title
  if (parsed.description !== undefined) next.description = parsed.description
  if (parsed.status !== undefined) next.status = parsed.status
  if (parsed.priority !== undefined) next.priority = parsed.priority
  if (parsed.tags !== undefined) next.tags = parsed.tags
  if (parsed.pinned !== undefined) next.pinned = parsed.pinned
  if (parsed.isToday !== undefined) next.isToday = parsed.isToday

  // Dates are omitted from the file when unset, so an absent key means cleared.
  next.dueDate = parsed.dueDate
  next.startDate = parsed.startDate
  next.endDate = parsed.endDate
  // Same rule for the waiting pair: clearing `waiting-on` in the vault clears it.
  next.waitingOn = parsed.waitingOn
  next.nextPollAt = parsed.nextPollAt

  if (parsed.subtasks !== undefined) {
    next.subtasks = reconcileSubtasks(parsed.subtasks, base.subtasks ?? [], newId)
  }

  if (parsed.taskNoteContentMd !== undefined) {
    next.taskNoteContentMd = parsed.taskNoteContentMd
    // The rich-text mirror cannot be regenerated from markdown here. Dropping it
    // makes the markdown authoritative rather than leaving a stale JSON body
    // that the app would render in preference to the edit just made.
    next.taskNoteContentJson = null
  }

  next.updatedAt = options.now ?? Date.now()
  return next
}

/** The mapped projection of a task, for change detection and merging. */
export const projectMapped = (task: TaskItem): Record<string, unknown> => {
  const projection: Record<string, unknown> = {}
  for (const key of MAPPED_FIELD_KEYS) projection[key] = task[key]
  return projection
}
