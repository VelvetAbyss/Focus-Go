import type { ProjectItem } from '../../data/models/types'
import type { TaskPriority } from './tasks.types'

export type ParsedQuickAdd = {
  title: string
  priority: TaskPriority | null
  tags: string[]
  dueDate?: string
  isToday?: boolean
  projectId?: string
  /** Set when the text named a clock time ("今天下午3点", "at 3pm"). */
  reminderAt?: number
}

type ChronoComponent = 'day' | 'weekday' | 'hour' | 'minute' | 'month'

type ChronoParser = {
  parse: (text: string, ref?: Date, opts?: { forwardDate?: boolean }) => Array<{
    index: number
    text: string
    start: { date: () => Date; isCertain: (component: ChronoComponent) => boolean }
  }>
}

type ChronoLike = ChronoParser & { zh?: { hans?: ChronoParser } }

// Part-of-day words mean something on their own in a title ("早上跑步"); only parse them
// next to a date or a clock time.
const BARE_PART_OF_DAY = new Set(['早上', '早晨', '上午', '中午', '下午', '傍晚', '晚上', '夜里', '凌晨'])
const CJK = /[\u3400-\u9fff]/

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

  let reminderAt: number | undefined
  if (!dueDate && !hasFastDateToken && titleText) {
    const chrono = await loadChrono()
    const parser = chrono && CJK.test(titleText) ? chrono.zh?.hans ?? chrono : chrono
    if (parser) {
      const now = new Date()
      const results = parser
        .parse(titleText, now, { forwardDate: true })
        .filter(
          (result) =>
            // A bare month ("整理12月账单", "march on") is part of the title, not a due date.
            (result.start.isCertain('day') || result.start.isCertain('weekday') || result.start.isCertain('hour')) &&
            !BARE_PART_OF_DAY.has(result.text.trim()),
        )
      const match = results[0]
      if (match) {
        const date = match.start.date()
        let hasTime = match.start.isCertain('hour')
        // "周五前交报告 下午3点": the day and the time came as two phrases; join them.
        const timeOnly = hasTime
          ? undefined
          : results.find((result) => result !== match && result.start.isCertain('hour') && !result.start.isCertain('day') && !result.start.isCertain('weekday'))
        if (timeOnly) {
          const time = timeOnly.start.date()
          date.setHours(time.getHours(), time.getMinutes(), 0, 0)
          hasTime = true
        }
        dueDate = toDateKey(date)
        if (dueDate === toDateKey(now)) isToday = true
        if (hasTime && date.getTime() > now.getTime()) reminderAt = date.getTime()
        // Cut the later phrase first so the earlier index stays valid.
        const cuts = [match, timeOnly].filter((cut): cut is NonNullable<typeof cut> => Boolean(cut)).sort((a, b) => b.index - a.index)
        for (const cut of cuts) titleText = removeDatePhrase(titleText, cut.index, cut.text.length)
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
    reminderAt,
  }
}

/** Cut the date phrase out of the title, with the words that only served it. */
const removeDatePhrase = (text: string, index: number, length: number) => {
  const before = text
    .slice(0, index)
    // "report by friday", "交报告 在周五"
    .replace(/\s*\b(?:by|on|at|before|due)\s*$/i, '')
    .replace(/(?:在|于)\s*$/, '')
  const after = text
    .slice(index + length)
    // "周五前提交", "明天的会", "3号之前交"
    .replace(/^\s*(?:之前|以前|前|的)/, '')
  return `${before} ${after}`.replace(/\s+/g, ' ').trim()
}
