import { applyMapped, fromMarkdown, projectMapped, toMarkdown, titleToFileName } from './mapper.ts'
import { mergeTask, describeDiscarded } from './merge.ts'
import { decodeTaskDocument, encodeTaskPayload, hasUnresolvedBody } from './protocol.ts'
import { hashContent, type PluginState, type TaskShadow } from './state.ts'
import type { PushRow, SyncClient } from './syncClient.ts'
import type { SyncWireBlob, TaskItem, WireDocument } from './types.ts'

export type ReplicatorHost = {
  getSettings: () => { folder: string; syncEnabled: boolean }
  getState: () => PluginState
  saveState: () => Promise<void>
  /** Vault operations, narrowed so the replicator can be tested without Obsidian. */
  vault: {
    ensureFolder(folder: string): Promise<void>
    readIfExists(path: string): Promise<string | null>
    availablePath(folder: string, title: string, exceptPath?: string): Promise<string>
    write(path: string, content: string): Promise<void>
    rename(from: string, to: string): Promise<void>
    trash(path: string): Promise<void>
    exists(path: string): boolean
  }
  notify: (message: string) => void
  now?: () => number
  newId?: () => string
}

export type SyncReport = {
  pulled: number
  pushed: number
  deleted: number
  conflicts: number
  skipped: number
}

const emptyReport = (): SyncReport => ({ pulled: 0, pushed: 0, deleted: 0, conflicts: 0, skipped: 0 })

export class Replicator {
  /** Paths whose next `modify` event is our own write echoing back. */
  private readonly selfWrites = new Set<string>()

  private readonly client: SyncClient
  private readonly host: ReplicatorHost

  constructor(client: SyncClient, host: ReplicatorHost) {
    this.client = client
    this.host = host
  }

  private get state() {
    return this.host.getState()
  }

  private now() {
    return (this.host.now ?? Date.now)()
  }

  private newId() {
    return (this.host.newId ?? (() => crypto.randomUUID()))()
  }

  /** True when a `modify` event for `path` was caused by our own write. */
  consumeSelfWrite(path: string): boolean {
    if (!this.selfWrites.has(path)) return false
    this.selfWrites.delete(path)
    return true
  }

  private async writeFile(path: string, content: string): Promise<string> {
    this.selfWrites.add(path)
    await this.host.vault.write(path, content)
    return hashContent(content)
  }

  private findShadowByPath(path: string): [string, TaskShadow] | null {
    for (const entry of Object.entries(this.state.tasks)) {
      if (entry[1].filePath === path) return entry
    }
    return null
  }

  /** The full task, with its note body folded back in from the shadow. */
  private shadowTask(shadow: TaskShadow): TaskItem {
    return { ...(shadow.remoteDoc as unknown as TaskItem), taskNoteContentMd: shadow.noteMd }
  }

  // -------------------------------------------------------------------------
  // Pull
  // -------------------------------------------------------------------------

  async pull(report = emptyReport()): Promise<SyncReport> {
    const { folder } = this.host.getSettings()
    await this.host.vault.ensureFolder(folder)

    const LIMIT = 100
    for (let page = 0; page < 200; page += 1) {
      const response = await this.client.pull(this.state.checkpoint, LIMIT)
      const blobs = new Map<string, SyncWireBlob>(response.blobs.map((blob) => [blob.hash, blob]))

      for (const document of response.documents) {
        await this.applyRemote(document, blobs, folder, report)
      }

      this.state.checkpoint = response.checkpoint
      await this.host.saveState()
      if (response.documents.length < LIMIT) break
    }
    return report
  }

  private async applyRemote(
    document: WireDocument,
    blobs: Map<string, SyncWireBlob>,
    folder: string,
    report: SyncReport,
  ): Promise<void> {
    const shadow = this.state.tasks[document.id]

    if (document._deleted === true) {
      if (shadow) {
        if (this.host.vault.exists(shadow.filePath)) await this.host.vault.trash(shadow.filePath)
        delete this.state.tasks[document.id]
        delete this.state.knownPaths[shadow.filePath]
        report.deleted += 1
      }
      return
    }

    // A body we cannot rebuild would materialise as an empty `## Notes`, so the
    // file is left alone until a later pull brings the blob with it.
    if (hasUnresolvedBody(document, blobs)) {
      report.skipped += 1
      return
    }

    const task = decodeTaskDocument(document, blobs)

    // Never overwrite an edit the user has not had pushed yet — the next cycle
    // pushes it, and the merge path resolves any genuine conflict.
    if (shadow) {
      const current = await this.host.vault.readIfExists(shadow.filePath)
      if (current !== null && hashContent(current) !== shadow.fileHash) {
        report.skipped += 1
        return
      }
    }

    let path = shadow?.filePath ?? (await this.host.vault.availablePath(folder, task.title))

    // A renamed task moves its note, so the file name keeps tracking the title.
    if (shadow && titleToFileName(task.title) !== fileBaseName(shadow.filePath)) {
      const target = await this.host.vault.availablePath(folder, task.title, shadow.filePath)
      if (target !== shadow.filePath && this.host.vault.exists(shadow.filePath)) {
        this.selfWrites.add(target)
        await this.host.vault.rename(shadow.filePath, target)
        delete this.state.knownPaths[shadow.filePath]
        path = target
      }
    }

    const content = toMarkdown(task)
    const fileHash = await this.writeFile(path, content)

    this.state.tasks[task.id] = {
      remoteDoc: document,
      noteMd: task.taskNoteContentMd ?? '',
      filePath: path,
      fileHash,
    }
    this.state.knownPaths[path] = task.id
    report.pulled += 1
  }

  // -------------------------------------------------------------------------
  // Push
  // -------------------------------------------------------------------------

  /** Push the given vault paths. Unknown paths become new tasks. */
  async push(paths: string[], report = emptyReport()): Promise<SyncReport> {
    for (const path of paths) {
      const content = await this.host.vault.readIfExists(path)
      if (content === null) continue
      await this.pushOne(path, content, report)
    }
    await this.host.saveState()
    return report
  }

  private async pushOne(path: string, content: string, report: SyncReport): Promise<void> {
    const parsed = fromMarkdown(content, fileBaseName(path))
    const shadowEntry = parsed.id ? this.state.tasks[parsed.id] : undefined

    if (!parsed.id || !shadowEntry) {
      await this.createTask(path, content, parsed, report)
      return
    }

    const base = this.shadowTask(shadowEntry)
    const next = applyMapped(base, parsed.fields, { now: this.now(), newId: () => this.newId() })

    // Compare what the file can express, not the file's bytes. A rename changes
    // the title without touching a byte of content, and a whitespace-only edit
    // does the opposite — a content hash gets both of those wrong.
    if (sameMappedFields(base, next)) {
      shadowEntry.fileHash = hashContent(content)
      shadowEntry.filePath = path
      return
    }

    const { payload, blobs } = await encodeTaskPayload(next)
    const response = await this.client.push(
      [{ newDocumentState: payload, assumedMasterState: shadowEntry.remoteDoc }],
      blobs,
    )

    if (response.conflicts.length === 0) {
      shadowEntry.remoteDoc = payload
      shadowEntry.noteMd = next.taskNoteContentMd ?? ''
      shadowEntry.fileHash = hashContent(content)
      report.pushed += 1
      return
    }

    await this.resolveConflict(path, parsed, base, response.conflicts[0], response.blobs, report)
  }

  private async createTask(
    path: string,
    content: string,
    parsed: ReturnType<typeof fromMarkdown>,
    report: SyncReport,
  ): Promise<void> {
    const now = this.now()
    const id = parsed.id ?? this.newId()
    const skeleton: TaskItem = {
      id,
      createdAt: now,
      updatedAt: now,
      title: parsed.fields.title ?? fileBaseName(path),
      description: '',
      pinned: false,
      isToday: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      activityLogs: [],
    }
    const task = applyMapped(skeleton, parsed.fields, { now, newId: () => this.newId() })
    const { payload, blobs } = await encodeTaskPayload(task)

    const response = await this.client.push(
      [{ newDocumentState: payload, assumedMasterState: null }],
      blobs,
    )
    if (response.conflicts.length > 0) {
      // The id already exists server-side. Leave it for the next pull to
      // materialise rather than guessing which side is right.
      report.conflicts += 1
      return
    }

    // Write the id back so the note is linked from here on.
    const withId = toMarkdown(task)
    const fileHash = await this.writeFile(path, withId)
    this.state.tasks[id] = {
      remoteDoc: payload,
      noteMd: task.taskNoteContentMd ?? '',
      filePath: path,
      fileHash,
    }
    this.state.knownPaths[path] = id
    report.pushed += 1
    void content
  }

  private async resolveConflict(
    path: string,
    parsed: ReturnType<typeof fromMarkdown>,
    base: TaskItem,
    conflict: WireDocument,
    blobs: SyncWireBlob[],
    report: SyncReport,
  ): Promise<void> {
    report.conflicts += 1
    const blobMap = new Map(blobs.map((blob) => [blob.hash, blob]))
    const remote = decodeTaskDocument(conflict, blobMap)

    if (conflict._deleted === true) {
      // The task was deleted in the app while the note was being edited. The
      // delete wins; the note goes so the vault matches.
      if (this.host.vault.exists(path)) await this.host.vault.trash(path)
      delete this.state.tasks[base.id]
      delete this.state.knownPaths[path]
      this.host.notify(`"${base.title}" was deleted in Focus & Go — the note was removed.`)
      return
    }

    const { fields, discarded } = mergeTask(base, parsed.fields, remote)
    const merged = applyMapped(remote, fields, { now: this.now(), newId: () => this.newId() })
    const { payload, blobs: outBlobs } = await encodeTaskPayload(merged)

    const retry = await this.client.push(
      [{ newDocumentState: payload, assumedMasterState: conflict }],
      outBlobs,
    )

    if (retry.conflicts.length > 0) {
      // Still moving underneath us. Take the server's version and let the next
      // pull rewrite the file; the local edit is recorded below.
      this.host.notify(`Could not merge "${merged.title}" — Focus & Go's version was kept.`)
      return
    }

    const content = toMarkdown(merged)
    const fileHash = await this.writeFile(path, content)
    this.state.tasks[merged.id] = {
      remoteDoc: payload,
      noteMd: merged.taskNoteContentMd ?? '',
      filePath: path,
      fileHash,
    }
    report.pushed += 1

    if (discarded.length > 0) {
      this.host.notify(
        `"${merged.title}" was edited in both places — Focus & Go won for ${discarded
          .map((entry) => entry.key)
          .join(', ')}.`,
      )
    }
  }

  /** Markdown describing what a merge threw away, for a conflict note. */
  conflictReport(title: string, discarded: ReturnType<typeof mergeTask>['discarded']): string {
    return [
      `# Discarded vault edits: ${title}`,
      '',
      `Focus & Go had newer values for these fields when the note was synced at ${new Date(
        this.now(),
      ).toISOString()}.`,
      '',
      describeDiscarded(discarded),
      '',
    ].join('\n')
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /** Push a tombstone for a note the user deleted. */
  async pushDelete(path: string, report = emptyReport()): Promise<SyncReport> {
    const entry = this.findShadowByPath(path)
    if (!entry) return report
    const [id, shadow] = entry

    const tombstone: WireDocument = {
      ...shadow.remoteDoc,
      updatedAt: this.now(),
      _deleted: true,
    }
    const rows: PushRow[] = [{ newDocumentState: tombstone, assumedMasterState: shadow.remoteDoc }]
    const response = await this.client.push(rows, [])

    if (response.conflicts.length > 0) {
      // The task changed in the app after the note was deleted. Do not delete
      // something the user has since worked on — restore it on the next pull.
      delete this.state.tasks[id]
      delete this.state.knownPaths[path]
      this.state.checkpoint = null
      this.host.notify('That task changed in Focus & Go — it was not deleted.')
    } else {
      delete this.state.tasks[id]
      delete this.state.knownPaths[path]
      report.deleted += 1
    }

    await this.host.saveState()
    return report
  }

  /** Forget a note that left the sync folder, without touching the task. */
  async forget(path: string): Promise<void> {
    const entry = this.findShadowByPath(path)
    if (!entry) return
    delete this.state.tasks[entry[0]]
    delete this.state.knownPaths[path]
    // Replay from scratch so the task is materialised again in its folder.
    this.state.checkpoint = null
    await this.host.saveState()
  }
}

/** Equality over just the fields the markdown round-trips. */
export const sameMappedFields = (a: TaskItem, b: TaskItem): boolean =>
  JSON.stringify(projectMapped(a)) === JSON.stringify(projectMapped(b))

export const fileBaseName = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return name.endsWith('.md') ? name.slice(0, -3) : name
}
