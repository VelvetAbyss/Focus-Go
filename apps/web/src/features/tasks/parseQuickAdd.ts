import type { ProjectItem } from '../../data/models/types'
import type { TaskPriority, TaskRecurrence } from './tasks.types'

export type ParsedQuickAdd = {
  title: string
  priority: TaskPriority | null
  tags: string[]
  dueDate?: string
  isToday?: boolean
  projectId?: string
  /** Set when the text named a clock time ("今天下午3点", "at 3pm"). */
  reminderAt?: number
  /** Set when the text named a repeat ("每周五", "每月 31 号", "every monday"). */
  recurrence?: TaskRecurrence
  /** Set when the text opens with "等 <who>" / "wait <who>": a task waiting on someone, its date the chase date. */
  waitingOn?: string
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

// "等 Lowe's 回报价 周五", "wait for Ace samples friday". The space after 等 keeps 等待 / 等级 in titles.
const WAITING_PREFIX = /^\s*(?:等|wait(?:ing)?(?:\s+(?:for|on))?)\s+(\S+)(?:\s+|$)/i

/** The person or company a "等 …" line waits on, and the text with the prefix gone (the name stays in the title). */
const splitWaiting = (rawTitle: string) => {
  const match = WAITING_PREFIX.exec(rawTitle)
  if (!match) return null
  const who = match[1].replace(/^@/, '')
  // "等 3 天" or "等 明天" is not a name.
  if (!who || /^\d+$/.test(who) || FAST_DATE_TOKENS.has(who.toLowerCase())) return null
  return { who, text: `${who} ${rawTitle.slice(match.index + match[0].length)}`.trim() }
}

const ZH_NUMBER: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
const ZH_WEEKDAY: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
const EN_WEEKDAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const toCount = (value: string) => ZH_NUMBER[value] ?? (value === 'other' ? 2 : Number.parseInt(value, 10))

type RecurrenceMatch = { rule: TaskRecurrence; weekday?: number; monthDay?: number; index: number; length: number }

// Most specific first. Bare "daily"/"weekly"/"周报" stay in the title: only "每…" / "every …" repeat.
const RECURRENCE_PATTERNS: Array<{ re: RegExp; build: (m: RegExpExecArray) => Omit<RecurrenceMatch, 'index' | 'length'> }> = [
  { re: /每个?月(?:底|末)/, build: () => ({ rule: { frequency: 'monthly', interval: 1, monthDay: 31 }, monthDay: 31 }) },
  { re: /每个?月\s*(\d{1,2})\s*(?:号|日)/, build: (m) => ({ rule: { frequency: 'monthly', interval: 1, monthDay: Number(m[1]) }, monthDay: Number(m[1]) }) },
  { re: /每(两|二|三|\d+)个?月/, build: (m) => ({ rule: { frequency: 'monthly', interval: toCount(m[1]) } }) },
  { re: /每个?月/, build: () => ({ rule: { frequency: 'monthly', interval: 1 } }) },
  { re: /每(两|二|\d+)(?:个)?(?:周|星期|礼拜)([一二三四五六日天])?/, build: (m) => ({ rule: { frequency: 'weekly', interval: toCount(m[1]) }, weekday: m[2] ? ZH_WEEKDAY[m[2]] : undefined }) },
  { re: /每个?工作日/, build: () => ({ rule: { frequency: 'weekdays', interval: 1 } }) },
  { re: /每个?(?:周|星期|礼拜)([一二三四五六日天])?/, build: (m) => ({ rule: { frequency: 'weekly', interval: 1 }, weekday: m[1] ? ZH_WEEKDAY[m[1]] : undefined }) },
  { re: /每隔?(两|二|三|四|五|六|七|\d+)天/, build: (m) => ({ rule: { frequency: 'daily', interval: toCount(m[1]) } }) },
  { re: /每天|每日/, build: () => ({ rule: { frequency: 'daily', interval: 1 } }) },
  { re: /每年/, build: () => ({ rule: { frequency: 'yearly', interval: 1 } }) },
  { re: /\bevery\s+weekday\b/i, build: () => ({ rule: { frequency: 'weekdays', interval: 1 } }) },
  { re: /\bevery\s+(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, build: (m) => ({ rule: { frequency: 'weekly', interval: 1 }, weekday: EN_WEEKDAY[m[1].toLowerCase()] }) },
  {
    re: /\bevery\s+(\d+|other)\s+(day|week|month|year)s?\b/i,
    build: (m) => ({ rule: { frequency: `${m[2].toLowerCase() === 'day' ? 'dai' : m[2].toLowerCase()}ly` as TaskRecurrence['frequency'], interval: toCount(m[1].toLowerCase()) } }),
  },
  {
    re: /\bevery\s+(day|week|month|year)\b/i,
    build: (m) => ({ rule: { frequency: `${m[1].toLowerCase() === 'day' ? 'dai' : m[1].toLowerCase()}ly` as TaskRecurrence['frequency'], interval: 1 } }),
  },
]

const findRecurrence = (text: string): RecurrenceMatch | null => {
  for (const { re, build } of RECURRENCE_PATTERNS) {
    const match = re.exec(text)
    if (match) {
      const built = build(match)
      if (!Number.isFinite(built.rule.interval) || built.rule.interval < 1) continue
      return { ...built, index: match.index, length: match[0].length }
    }
  }
  return null
}

/** The first date of a series that starts no earlier than today. */
const firstOccurrence = (match: RecurrenceMatch, today: Date) => {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (match.rule.frequency === 'weekly' && match.weekday != null) {
    start.setDate(start.getDate() + ((match.weekday - start.getDay() + 7) % 7))
  } else if (match.rule.frequency === 'weekdays') {
    while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1)
  } else if (match.rule.frequency === 'monthly' && match.monthDay != null) {
    const clamp = (year: number, month: number) =>
      new Date(year, month, Math.min(match.monthDay!, new Date(year, month + 1, 0).getDate()))
    const thisMonth = clamp(start.getFullYear(), start.getMonth())
    return thisMonth >= start ? thisMonth : clamp(start.getFullYear(), start.getMonth() + 1)
  }
  return start
}

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
  const waiting = splitWaiting(rawTitle)
  if (waiting) rawTitle = waiting.text
  // A repeat phrase is cut first, so chrono doesn't also read "每周五" as this Friday.
  const repeat = findRecurrence(rawTitle)
  const textWithoutRepeat = repeat ? removeDatePhrase(rawTitle, repeat.index, repeat.length) : rawTitle
  const tokenized = tokenize(textWithoutRepeat, projects, fallbackProjectId)
  let { dueDate, isToday } = tokenized
  let titleText = tokenized.titleParts.join(' ').trim()
  const repeatStart = repeat ? firstOccurrence(repeat, new Date()) : null
  let recurrence: TaskRecurrence | undefined
  if (repeat && repeatStart) {
    recurrence = repeat.rule.frequency === 'monthly' || repeat.rule.frequency === 'yearly'
      ? { ...repeat.rule, monthDay: repeat.monthDay ?? repeatStart.getDate() }
      : repeat.rule
  }

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
        // "每周五 下午3点": the repeat names the day, the text only a time.
        if (repeatStart && !match.start.isCertain('day') && !match.start.isCertain('weekday')) {
          date.setFullYear(repeatStart.getFullYear(), repeatStart.getMonth(), repeatStart.getDate())
        }
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

  if (repeatStart && !dueDate) dueDate = toDateKey(repeatStart)

  return {
    title: titleText || textWithoutRepeat.trim() || rawTitle.trim(),
    priority: tokenized.priority,
    tags: tokenized.tags,
    dueDate,
    isToday,
    projectId: tokenized.projectId,
    reminderAt,
    recurrence,
    waitingOn: waiting?.who,
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
