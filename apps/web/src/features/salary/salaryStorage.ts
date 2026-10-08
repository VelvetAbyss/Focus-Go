import type { SalarySettings } from './salaryModel'

/**
 * The pay widgets' state: one JSON value in localStorage, carried across
 * devices inside the synced preferences (syncedPreferencesRepo). No React.
 */

export type WishItem = {
  id: string
  name: string
  price: number
  /** Progress counts paid time from here. */
  addedAt: number
}

export type BreakSession = {
  id: string
  startAt: number
  endAt: number
}

export type SalaryState = {
  settings: SalarySettings | null
  wishlist: WishItem[]
  breaks: BreakSession[]
  /** Set while a break is running. */
  activeBreakStartAt: number | null
}

export const SALARY_STORAGE_KEY = 'focusgo.salary'
export const MAX_WISHES = 40
/** Breaks are a running record, not an archive: keep about two months. */
export const BREAK_RETENTION_MS = 62 * 86_400_000
const MAX_BREAKS = 600

export const EMPTY_SALARY_STATE: SalaryState = {
  settings: null,
  wishlist: [],
  breaks: [],
  activeBreakStartAt: null,
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isMinute = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 24 * 60

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export const normalizeSalarySettings = (raw: unknown): SalarySettings | null => {
  if (!isRecord(raw)) return null
  const { monthlySalary, workStart, workEnd, lunch, workdays } = raw
  if (typeof monthlySalary !== 'number' || !Number.isFinite(monthlySalary) || monthlySalary <= 0) return null
  if (!isMinute(workStart) || !isMinute(workEnd) || workEnd <= workStart) return null
  const days = Array.isArray(workdays)
    ? Array.from(new Set(workdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))).sort()
    : []
  if (days.length === 0) return null
  const validLunch = isRecord(lunch) && isMinute(lunch.start) && isMinute(lunch.end) && lunch.end > lunch.start
  return {
    monthlySalary,
    workStart,
    workEnd,
    lunch: validLunch ? { start: lunch.start as number, end: lunch.end as number } : null,
    workdays: days,
  }
}

export const normalizeSalaryState = (raw: unknown, now = Date.now()): SalaryState => {
  if (!isRecord(raw)) return EMPTY_SALARY_STATE
  const wishlist = Array.isArray(raw.wishlist)
    ? raw.wishlist
        .filter(
          (item): item is WishItem =>
            isRecord(item) &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.price === 'number' &&
            Number.isFinite(item.price) &&
            item.price > 0 &&
            isTime(item.addedAt),
        )
        .slice(0, MAX_WISHES)
    : []
  const breaks = Array.isArray(raw.breaks)
    ? raw.breaks
        .filter(
          (item): item is BreakSession =>
            isRecord(item) &&
            typeof item.id === 'string' &&
            isTime(item.startAt) &&
            isTime(item.endAt) &&
            item.endAt > item.startAt &&
            now - item.endAt < BREAK_RETENTION_MS,
        )
        .sort((a, b) => a.startAt - b.startAt)
        .slice(-MAX_BREAKS)
    : []
  const active = raw.activeBreakStartAt
  return {
    settings: normalizeSalarySettings(raw.settings),
    wishlist,
    breaks,
    activeBreakStartAt: isTime(active) && active <= now + 60_000 ? active : null,
  }
}

export const readSalaryState = (): SalaryState => {
  if (typeof window === 'undefined') return EMPTY_SALARY_STATE
  try {
    const raw = window.localStorage.getItem(SALARY_STORAGE_KEY)
    return raw ? normalizeSalaryState(JSON.parse(raw)) : EMPTY_SALARY_STATE
  } catch {
    return EMPTY_SALARY_STATE
  }
}

export const writeSalaryState = (state: SalaryState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SALARY_STORAGE_KEY, JSON.stringify(normalizeSalaryState(state)))
  } catch {
    // Storage full or blocked: the change is not kept.
  }
}
