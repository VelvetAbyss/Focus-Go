import type { SearchDoc, SearchKind } from './commandSearch'
import { getAuth } from '../../store/auth'

export type RecentCommandTarget = { kind: SearchKind; id: string }

const STORAGE_PREFIX = 'focusgo.command.recent.v1'
const MAX_RECENT_TARGETS = 8
const KINDS = new Set<SearchKind>(['task', 'note', 'diary', 'project'])

const storageKey = (ownerId: string) => `${STORAGE_PREFIX}:${ownerId}`

const isTarget = (value: unknown): value is RecentCommandTarget => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.kind === 'string' && KINDS.has(candidate.kind as SearchKind)
    && typeof candidate.id === 'string' && candidate.id.length > 0
}

export const readRecentCommandTargets = (ownerId: string): RecentCommandTarget[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isTarget).slice(0, MAX_RECENT_TARGETS) : []
  } catch {
    return []
  }
}

export const rememberRecentCommandTarget = (ownerId: string, target: RecentCommandTarget): RecentCommandTarget[] => {
  const next = [target, ...readRecentCommandTargets(ownerId).filter((item) => item.kind !== target.kind || item.id !== target.id)]
    .slice(0, MAX_RECENT_TARGETS)
  try {
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(next))
  } catch {
    // Navigation still works when storage is unavailable or full.
  }
  return next
}

export const readCurrentUserRecentCommandTargets = () => readRecentCommandTargets(getAuth()?.user?.id || 'guest')

export const rememberCurrentUserRecentCommandTarget = (target: RecentCommandTarget) =>
  rememberRecentCommandTarget(getAuth()?.user?.id || 'guest', target)

export const resolveRecentCommandTargets = (targets: RecentCommandTarget[], docs: SearchDoc[]): SearchDoc[] => {
  const byKey = new Map(docs.map((doc) => [`${doc.kind}:${doc.id}`, doc]))
  return targets.flatMap((target) => {
    const doc = byKey.get(`${target.kind}:${target.id}`)
    return doc ? [doc] : []
  })
}
