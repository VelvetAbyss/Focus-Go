import type { Checkpoint } from './syncClient.ts'
import type { WireDocument } from './types.ts'

/**
 * What the plugin remembers between runs, per task.
 *
 * `remoteDoc` is the wire document exactly as it was pulled — never re-encoded.
 * It serves three jobs at once and all three break if it is reconstructed:
 *  1. it is the `assumedMasterState` a push must send for optimistic concurrency,
 *  2. it is the base for three-way merges, and
 *  3. together with `fileHash` it tells an echo of our own write apart from a
 *     genuine edit by the user.
 */
export type TaskShadow = {
  remoteDoc: WireDocument
  /** Note body, kept out of `remoteDoc` because the wire form stores it as a blob ref. */
  noteMd: string
  filePath: string
  fileHash: string
}

export type PluginState = {
  version: 1
  checkpoint: Checkpoint
  tasks: Record<string, TaskShadow>
  /** Paths this plugin created, so an unknown file in the folder is user-authored. */
  knownPaths: Record<string, string>
}

export const emptyState = (): PluginState => ({
  version: 1,
  checkpoint: null,
  tasks: {},
  knownPaths: {},
})

/** Non-cryptographic content hash — this only needs to detect our own echoes. */
export const hashContent = (content: string): string => {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 0x01000193)
    h2 = Math.imul(h2 + code, 0x85ebca6b) ^ (h2 >>> 13)
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`
}

export const isPluginState = (value: unknown): value is PluginState =>
  typeof value === 'object' &&
  value !== null &&
  (value as PluginState).version === 1 &&
  typeof (value as PluginState).tasks === 'object'
