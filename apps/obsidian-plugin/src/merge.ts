import { MAPPED_FIELD_KEYS, type TaskItem } from './types.ts'
import type { ParsedTaskFile } from './mapper.ts'

export type MergeOutcome = {
  /** Fields to apply on top of `remote`. */
  fields: ParsedTaskFile['fields']
  /** Fields the local edit lost because the app changed them too. */
  discarded: Array<{ key: string; local: unknown; remote: unknown }>
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  // Cheap structural equality — these values are plain JSON.
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * Three-way merge of one task.
 *
 * `base` is the document we last pulled (what the local file was rendered from),
 * `local` is what the file says now, `remote` is what the server has moved on to.
 *
 * Per mapped field: whichever side changed it wins; if both changed it, the app
 * wins and the local value is reported as discarded. The app is the primary
 * surface, and losing a stray vault edit is far less costly than silently
 * reverting deliberate work done in the product.
 */
export const mergeTask = (
  base: TaskItem,
  local: ParsedTaskFile['fields'],
  remote: TaskItem,
): MergeOutcome => {
  const fields: ParsedTaskFile['fields'] = {}
  const discarded: MergeOutcome['discarded'] = []

  for (const key of MAPPED_FIELD_KEYS) {
    if (!(key in local)) continue
    const localValue = (local as Record<string, unknown>)[key]
    const baseValue = (base as Record<string, unknown>)[key]
    const remoteValue = (remote as Record<string, unknown>)[key]

    const localChanged = !sameValue(localValue, baseValue)
    const remoteChanged = !sameValue(remoteValue, baseValue)

    if (!localChanged) continue
    if (!remoteChanged) {
      ;(fields as Record<string, unknown>)[key] = localValue
      continue
    }
    if (sameValue(localValue, remoteValue)) continue
    discarded.push({ key, local: localValue, remote: remoteValue })
  }

  return { fields, discarded }
}

/**
 * Subtasks are compared as a whole list, which makes any concurrent edit on
 * either side look like a whole-list conflict. That is intentionally coarse:
 * reconciling two independently reordered lists without stable positions
 * produces surprising results more often than it saves a keystroke.
 */
export const describeDiscarded = (discarded: MergeOutcome['discarded']): string =>
  discarded
    .map((entry) => `- \`${entry.key}\`: vault had ${JSON.stringify(entry.local)}, app had ${JSON.stringify(entry.remote)}`)
    .join('\n')
