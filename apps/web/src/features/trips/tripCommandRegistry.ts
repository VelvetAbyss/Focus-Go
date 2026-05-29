import { useSyncExternalStore } from 'react'
import type { TripRecord } from '../../data/models/types'
import type { ViewMode } from './sections/Itinerary'

/**
 * Lightweight module-level registry that lets the global Cmd+K command palette
 * surface context-aware Trip actions without a second hotkey listener.
 *
 * The active Trip detail page publishes its current trip + action callbacks here
 * on mount and clears them on unmount. The shared CommandPalette reads the
 * snapshot to build trip-specific commands (jump to section, switch view,
 * add activity, delete trip).
 */

export type TripSectionCommand = { id: string; label: string }

export type TripCommandContext = {
  trip: TripRecord
  sections: TripSectionCommand[]
  scrollToSection: (id: string) => void
  switchItineraryView: (view: ViewMode) => void
  addActivity: (dayNum: number) => void
  deleteTrip: () => void
}

let current: TripCommandContext | null = null
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export const setTripCommandContext = (ctx: TripCommandContext | null) => {
  current = ctx
  emit()
}

export const getTripCommandContext = (): TripCommandContext | null => current

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useTripCommandContext = (): TripCommandContext | null =>
  useSyncExternalStore(subscribe, getTripCommandContext, () => null)
