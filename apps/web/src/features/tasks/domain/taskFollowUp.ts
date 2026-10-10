import type { TaskItem } from '../../../data/models/types'

const SAFE_SOURCE = /^(https?:|mailto:|message:)/i

/**
 * A task's source link, kept only when it is a web page, a mail address or a Mail.app message
 * link; anything else (javascript:, data:) is dropped so it can never run from the task.
 */
export const safeSourceUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const url = value.trim()
  if (!url || url.length > 2000 || !SAFE_SOURCE.test(url)) return undefined
  return url
}

/** A short name for where a link points: the mail service, or the site's host. */
export const sourceLabel = (url: string): string => {
  if (/^mailto:/i.test(url)) return url.slice(7).split('?')[0]
  if (/^message:/i.test(url)) return 'Mail'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'mail.google.com') return 'Gmail'
    if (/(^|\.)outlook\.(live|office|office365)\.com$/.test(host)) return 'Outlook'
    return host
  } catch {
    return url
  }
}

const pad = (value: number) => String(value).padStart(2, '0')
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** The date `workdays` working days (Mon–Fri) after `from`, as a date key. */
export const addWorkdays = (from: Date, workdays: number) => {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12)
  let left = workdays
  while (left > 0) {
    date.setDate(date.getDate() + 1)
    if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1
  }
  return toDateKey(date)
}

/** How many working days a chase waits before the next one is due. */
export const CHASE_INTERVAL_WORKDAYS = 3

/** A date key's morning, at `startMinutes` after midnight local time, as a timestamp. */
export const morningOf = (dateKey: string, startMinutes = 9 * 60) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, Math.floor(startMinutes / 60), startMinutes % 60).getTime()
}

/**
 * A follow-up just went out: remember when, note it in the progress history, and move the
 * chase date on, with a reminder that morning so the next chase isn't left to memory. The task
 * stays waiting; how long it has waited in all is kept.
 */
export const withChase = (task: TaskItem, logText: string, now = Date.now(), startMinutes = 9 * 60): TaskItem => {
  const dueDate = addWorkdays(new Date(now), CHASE_INTERVAL_WORKDAYS)
  return {
    ...task,
    chasedAt: [...(task.chasedAt ?? []), now].slice(-50),
    dueDate,
    reminderAt: morningOf(dueDate, startMinutes),
    reminderFiredAt: undefined,
    progressHistory: [
      { id: `chase-${now.toString(36)}`, text: logText, createdAt: now },
      ...(task.progressHistory ?? []),
    ].slice(0, 50),
  }
}

/** Waiting tasks grouped by who they wait on, the group waiting longest first. */
export const groupWaitingByCounterpart = (
  tasks: readonly TaskItem[],
  waitedDays: (task: TaskItem) => number,
) => {
  const groups = new Map<string, { spellings: Map<string, number>; tasks: TaskItem[]; longest: number }>()
  for (const task of tasks) {
    const who = task.waitingOn?.trim() || ''
    const key = who.toLowerCase()
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), tasks: [] as TaskItem[], longest: 0 }
    if (who) group.spellings.set(who, (group.spellings.get(who) ?? 0) + 1)
    group.tasks.push(task)
    group.longest = Math.max(group.longest, waitedDays(task))
    groups.set(key, group)
  }
  // "lowe's" and "Lowe's" are one company; the heading uses the spelling written most, and
  // between equals the one with capitals.
  const nameOf = (spellings: Map<string, number>) =>
    [...spellings.entries()].sort(
      ([a, countA], [b, countB]) => countB - countA || Number(b !== b.toLowerCase()) - Number(a !== a.toLowerCase()),
    )[0]?.[0] ?? null
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      who: nameOf(group.spellings),
      longest: group.longest,
      tasks: group.tasks.sort((a, b) => waitedDays(b) - waitedDays(a)),
    }))
    .sort((a, b) => (a.who === null ? 1 : b.who === null ? -1 : b.longest - a.longest))
}
