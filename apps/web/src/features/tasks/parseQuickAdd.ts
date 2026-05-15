import type { ProjectItem } from '../../data/models/types'
import type { TaskPriority } from './tasks.types'

export type ParsedQuickAdd = {
  title: string
  priority: TaskPriority | null
  tags: string[]
  dueDate?: string
  isToday?: boolean
  projectId?: string
}

type ChronoLike = {
  parse: (text: string, ref?: Date, opts?: { forwardDate?: boolean }) => Array<{
    index: number
    text: string
    start: { date: () => Date }
  }>
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeToken = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '')

let chronoPromise: Promise<ChronoLike | null> | null = null
const loadChrono = (): Promise<ChronoLike | null> => {
  if (!chronoPromise) {
    chronoPromise = import('chrono-node')
      .then((mod) => mod as unknown as ChronoLike)
      .catch(() => null)
  }
  return chronoPromise
}

const FAST_DATE_TOKENS = new Set(['today', '今天', 'tomorrow', '明天'])

const tokenize = (rawTitle: string, projects: ProjectItem[], fallbackProjectId?: string) => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const parts = rawTitle.trim().split(/\s+/)
  const tags: string[] = []
  let priority: TaskPriority | null = null
  let dueDate: string | undefined
  let isToday = false
  let projectId = fallbackProjectId
  const titleParts: string[] = []
  const projectBySlug = new Map(projects.map((p) => [normalizeToken(p.title), p.id] as const))

  parts.forEach((part) => {
    const token = part.trim()
    if (!token) return
    const lower = token.toLowerCase()
    if (lower === 'today' || lower === '今天') {
      isToday = true
      dueDate = toDateKey(today)
      return
    }
    if (lower === 'tomorrow' || lower === '明天') {
      dueDate = toDateKey(tomorrow)
      return
    }
    if (lower.startsWith('#') && lower.length > 1) {
      tags.push(token.slice(1))
      return
    }
    if (lower.startsWith('!')) {
      const value = lower.slice(1)
      if (value === '1' || value === 'high') priority = 'high'
      else if (value === '2' || value === 'medium' || value === 'med') priority = 'medium'
      else if (value === '3' || value === 'low') priority = 'low'
      else titleParts.push(token)
      return
    }
    if (lower.startsWith('@') && lower.length > 1) {
      const matchedProjectId = projectBySlug.get(normalizeToken(token.slice(1)))
      if (matchedProjectId) projectId = matchedProjectId
      else tags.push(token.slice(1))
      return
    }
    titleParts.push(token)
  })

  return {
    titleParts,
    priority,
    tags,
    dueDate,
    isToday,
    projectId,
  }
}

export const parseQuickAdd = async (
  rawTitle: string,
  projects: ProjectItem[],
  fallbackProjectId?: string,
): Promise<ParsedQuickAdd> => {
  const tokenized = tokenize(rawTitle, projects, fallbackProjectId)
  let { dueDate, isToday } = tokenized
  let titleText = tokenized.titleParts.join(' ').trim()

  const hasFastDateToken = rawTitle
    .toLowerCase()
    .split(/\s+/)
    .some((t) => FAST_DATE_TOKENS.has(t))

  if (!dueDate && !hasFastDateToken && titleText) {
    const chrono = await loadChrono()
    if (chrono) {
      const results = chrono.parse(titleText, new Date(), { forwardDate: true })
      if (results.length > 0) {
        const first = results[0]
        const date = first.start.date()
        dueDate = toDateKey(date)
        if (toDateKey(date) === toDateKey(new Date())) isToday = true
        titleText = (titleText.slice(0, first.index) + titleText.slice(first.index + first.text.length))
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
  }

  return {
    title: titleText || rawTitle.trim(),
    priority: tokenized.priority,
    tags: tokenized.tags,
    dueDate,
    isToday,
    projectId: tokenized.projectId,
  }
}
