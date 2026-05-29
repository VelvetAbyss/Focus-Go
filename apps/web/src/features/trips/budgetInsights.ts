import type { TripRecord } from '../../data/models/types'
import { tripDuration } from './tripData'

export type BudgetSlice = {
  id: string
  label: string
  emoji: string
  planned: number
  actual: number
  /** Share of total planned spend, 0..1. */
  share: number
}

export type BudgetBreakdown = {
  slices: BudgetSlice[]
  planned: number
  actual: number
  remaining: number
  /** actual / planned as a 0..100 integer. */
  percent: number
  overrun: boolean
}

/** Aggregate a trip's budget into sorted category slices plus totals. */
export const budgetBreakdown = (trip: TripRecord): BudgetBreakdown => {
  const planned = trip.budget.reduce((sum, item) => sum + item.planned, 0)
  const actual = trip.budget.reduce((sum, item) => sum + item.actual, 0)
  const slices = trip.budget
    .filter((item) => item.planned > 0 || item.actual > 0)
    .map((item) => ({
      id: item.id,
      label: item.label || '—',
      emoji: item.emoji,
      planned: item.planned,
      actual: item.actual,
      share: planned > 0 ? item.planned / planned : 0,
    }))
    .sort((a, b) => b.planned - a.planned)
  return {
    slices,
    planned,
    actual,
    remaining: planned - actual,
    percent: planned > 0 ? Math.round((actual / planned) * 100) : 0,
    overrun: actual > planned && planned > 0,
  }
}

export type BudgetSplit = 'total' | 'perPerson' | 'perDay'

/** Divide a budget figure for the chosen split. Guards against divide-by-zero. */
export const splitBudget = (value: number, split: BudgetSplit, travelers: number, days: number): number => {
  if (split === 'perPerson') return value / Math.max(1, travelers)
  if (split === 'perDay') return value / Math.max(1, days)
  return value
}

/** Trip length in days, at least 1 (itinerary length, fallback to 1). */
export const tripDays = (trip: TripRecord): number => Math.max(1, tripDuration(trip))
