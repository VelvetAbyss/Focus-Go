import {
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  normalizePath,
  type App,
} from 'obsidian'
import { fileBaseName, Replicator, type ReplicatorHost } from './replicator.ts'
import { titleToFileName } from './mapper.ts'
import { SyncAuthError, SyncClient, SyncRateLimitError } from './syncClient.ts'
import { VaultAdapter } from './vaultAdapter.ts'
import { emptyState, hashContent, isPluginState, type PluginState } from './state.ts'
import { DEFAULT_SETTINGS, normalizeFolder, type PluginSettings } from './settings.ts'

type PersistedData = {
  settings: PluginSettings
  state: PluginState
}

const PUSH_DEBOUNCE_MS = 2000

export default class FocusGoPlugin extends Plugin {
  override settings: PluginSettings = { ...DEFAULT_SETTINGS }
  private state: PluginState = emptyState()
  private replicator!: Replicator
  private vault!: VaultAdapter

  private pendingPaths = new Set<string>()
  private pendingDeletes = new Map<string, number>()
  private pushTimer: number | null = null
  private pollTimer: number | null = null
  private syncing = false
  private backoffUntil = 0
  private statusEl: HTMLElement | null = null

  override async onload(): Promise<void> {
    await this.loadPersisted()

    this.vault = new VaultAdapter(this.app)
    const client = new SyncClient(() => ({
      serverUrl: this.settings.serverUrl,
      token: this.settings.token,
    }))
    this.replicator = new Replicator(client, this.buildHost())

    this.statusEl = this.addStatusBarItem()
    this.setStatus('idle')

    this.addSettingTab(new FocusGoSettingTab(this.app, this))

    this.addCommand({
      id: 'sync-now',
      name: 'Sync now',
      callback: () => void this.syncNow(true),
    })
    this.addCommand({
      id: 'resync-from-scratch',
      name: 'Re-sync from scratch',
      callback: () => void this.resyncFromScratch(),
    })

    // Vault events only become meaningful once the initial layout is ready;
    // before that Obsidian replays creations for every existing file.
    this.app.workspace.onLayoutReady(() => {
      this.registerVaultEvents()
      void this.scanForOfflineEdits().then(() => this.syncNow())
      this.schedulePoll()
    })
  }

  override async onunload(): Promise<void> {
    if (this.pushTimer !== null) window.clearTimeout(this.pushTimer)
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer)
    await this.savePersisted()
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  private buildHost(): ReplicatorHost {
    return {
      getSettings: () => ({
        folder: normalizeFolder(this.settings.folder),
        syncEnabled: this.settings.syncEnabled,
      }),
      getState: () => this.state,
      saveState: () => this.savePersisted(),
      vault: {
        ensureFolder: (folder) => this.vault.ensureFolder(folder),
        readIfExists: async (path) => {
          const file = this.vault.getFile(path)
          return file ? this.vault.read(file) : null
        },
        availablePath: (folder, title, exceptPath) =>
          this.vault.availablePath(folder, title, exceptPath),
        write: async (path, content) => {
          await this.vault.write(path, content)
        },
        rename: async (from, to) => {
          const file = this.vault.getFile(from)
          if (file) await this.vault.rename(file, to)
        },
        trash: async (path) => {
          const file = this.vault.getFile(path)
          if (file) await this.vault.trash(file)
        },
        exists: (path) => this.vault.getFile(path) !== null,
      },
      notify: (message) => new Notice(`Focus & Go: ${message}`, 8000),
    }
  }

  private inSyncFolder(path: string): boolean {
    return path.startsWith(`${normalizeFolder(this.settings.folder)}/`) && path.endsWith('.md')
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || !this.inSyncFolder(file.path)) return
        // A write we just made comes back as a modify event; pushing it would
        // be an infinite echo.
        if (this.replicator.consumeSelfWrite(file.path)) return
        this.queuePush(file.path)
      }),
    )

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (!(file instanceof TFile) || !this.inSyncFolder(file.path)) return
        if (this.replicator.consumeSelfWrite(file.path)) return
        this.queuePush(file.path)
      }),
    )

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (!(file instanceof TFile)) return
        const wasInside = this.inSyncFolder(oldPath)
        const isInside = this.inSyncFolder(file.path)
        if (this.replicator.consumeSelfWrite(file.path)) return

        if (wasInside && !isInside) {
          // Moved out of the folder: stop syncing it, but never delete the task.
          void this.replicator.forget(oldPath)
          return
        }
        if (isInside) {
          this.repathShadow(oldPath, file.path)
          this.queuePush(file.path)
        }
      }),
    )

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (!(file instanceof TFile) || !this.inSyncFolder(file.path)) return
        this.queueDelete(file.path)
      }),
    )
  }

  /** Keep the shadow pointing at the note after a user rename. */
  private repathShadow(oldPath: string, newPath: string): void {
    for (const shadow of Object.values(this.state.tasks)) {
      if (shadow.filePath !== oldPath) continue
      shadow.filePath = newPath
      break
    }
    const id = this.state.knownPaths[oldPath]
    if (id) {
      delete this.state.knownPaths[oldPath]
      this.state.knownPaths[newPath] = id
    }
  }

  // -------------------------------------------------------------------------
  // Scheduling
  // -------------------------------------------------------------------------

  private queuePush(path: string): void {
    this.pendingPaths.add(path)
    if (this.pushTimer !== null) window.clearTimeout(this.pushTimer)
    this.pushTimer = window.setTimeout(() => {
      this.pushTimer = null
      void this.syncNow()
    }, PUSH_DEBOUNCE_MS)
  }

  private schedulePoll(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer)
    // One timer at the shorter cadence; each tick decides whether it is due,
    // so switching between focused and background needs no re-scheduling.
    this.pollTimer = window.setInterval(() => {
      const interval = document.hasFocus()
        ? this.settings.activeIntervalSeconds
        : this.settings.idleIntervalSeconds
      if (Date.now() - this.lastSyncAt < interval * 1000) return
      void this.syncNow()
    }, 5000)
    this.registerInterval(this.pollTimer)
  }

  private lastSyncAt = 0

  async syncNow(manual = false): Promise<void> {
    if (!this.settings.syncEnabled && !manual) return
    if (this.syncing) return
    if (!this.settings.token || !this.settings.serverUrl) {
      if (manual) new Notice('Focus & Go: add your server URL and token in settings first.')
      return
    }
    if (Date.now() < this.backoffUntil && !manual) return

    this.syncing = true
    this.setStatus('syncing')
    const paths = [...this.pendingPaths]
    this.pendingPaths.clear()

    try {
      // Push first: a pull must never overwrite an edit that has not been sent.
      if (paths.length > 0) await this.replicator.push(paths)
      const report = await this.replicator.pull()
      this.lastSyncAt = Date.now()
      this.backoffUntil = 0
      this.setStatus('idle')
      if (manual) {
        new Notice(
          `Focus & Go: ${report.pulled} in, ${report.pushed} out` +
            (report.conflicts > 0 ? `, ${report.conflicts} merged` : ''),
        )
      }
    } catch (error) {
      // Anything unsent goes back in the queue so it is retried, not dropped.
      for (const path of paths) this.pendingPaths.add(path)
      this.handleSyncError(error, manual)
    } finally {
      this.syncing = false
      await this.savePersisted()
    }
  }

  private handleSyncError(error: unknown, manual: boolean): void {
    if (error instanceof SyncAuthError) {
      this.settings.syncEnabled = false
      this.setStatus('auth')
      new Notice(`Focus & Go: ${error.message}`, 10000)
      return
    }
    if (error instanceof SyncRateLimitError) {
      this.backoffUntil = Date.now() + error.retryAfterSeconds * 1000
      this.setStatus('waiting')
      return
    }
    this.setStatus('error')
    // Offline is the common case and should not nag on every poll.
    if (manual) new Notice(`Focus & Go: ${(error as Error)?.message ?? 'sync failed'}`, 8000)
  }

  private setStatus(status: 'idle' | 'syncing' | 'error' | 'auth' | 'waiting'): void {
    if (!this.statusEl) return
    const label: Record<typeof status, string> = {
      idle: 'Focus & Go ✓',
      syncing: 'Focus & Go ↻',
      error: 'Focus & Go ⚠',
      auth: 'Focus & Go — sign in',
      waiting: 'Focus & Go — waiting',
    }
    this.statusEl.setText(label[status])
  }

  // -------------------------------------------------------------------------
  // Deletion
  // -------------------------------------------------------------------------

  /**
   * Deleting a note deletes the task, but never immediately. A short undo window
   * covers the ordinary slip, and a burst of deletions — the shape a sync
   * conflict or a mis-dragged folder takes — asks before touching anything.
   */
  private queueDelete(path: string): void {
    this.pendingDeletes.set(path, Date.now())
    const undoSeconds = Math.max(1, this.settings.deleteUndoSeconds)

    const notice = new Notice('', undoSeconds * 1000)
    notice.noticeEl.createSpan({ text: `Focus & Go: deleting "${baseName(path)}"… ` })
    notice.noticeEl
      .createEl('a', { text: 'Undo', href: '#' })
      .addEventListener('click', (event) => {
        event.preventDefault()
        this.pendingDeletes.delete(path)
        notice.hide()
        new Notice('Focus & Go: delete cancelled — the task is unchanged.')
        // Replay so the note comes back.
        this.state.checkpoint = null
        void this.syncNow()
      })

    window.setTimeout(() => void this.flushDeletes(), undoSeconds * 1000 + 200)
  }

  private async flushDeletes(): Promise<void> {
    const due = [...this.pendingDeletes.keys()]
    if (due.length === 0) return

    if (due.length > this.settings.bulkDeleteThreshold) {
      this.pendingDeletes.clear()
      new ConfirmBulkDeleteModal(this.app, due, async (confirmed) => {
        if (!confirmed) {
          // Put the notes back rather than leaving the vault and app diverged.
          this.state.checkpoint = null
          await this.syncNow()
          return
        }
        for (const path of due) await this.replicator.pushDelete(path)
        await this.savePersisted()
      }).open()
      return
    }

    this.pendingDeletes.clear()
    for (const path of due) {
      try {
        await this.replicator.pushDelete(path)
      } catch (error) {
        this.handleSyncError(error, false)
      }
    }
    await this.savePersisted()
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /** Catch up on edits made while Obsidian (or the plugin) was not running. */
  private async scanForOfflineEdits(): Promise<void> {
    const folder = normalizeFolder(this.settings.folder)
    for (const file of this.vault.listMarkdown(folder)) {
      const shadow = Object.values(this.state.tasks).find((entry) => entry.filePath === file.path)
      if (!shadow) {
        this.pendingPaths.add(file.path)
        continue
      }
      const content = await this.vault.read(file)
      // A rename leaves the content byte-identical, so the hash alone would miss
      // one made while the plugin was not running. The title lives in the file
      // name, so compare that too.
      const renamed =
        titleToFileName(String((shadow.remoteDoc as { title?: unknown }).title ?? '')) !==
        fileBaseName(file.path)
      if (renamed || hashContent(content) !== shadow.fileHash) this.pendingPaths.add(file.path)
    }
  }

  private async loadPersisted(): Promise<void> {
    const data = (await this.loadData()) as Partial<PersistedData> | null
    this.settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) }
    this.state = isPluginState(data?.state) ? (data?.state as PluginState) : emptyState()
  }

  async savePersisted(): Promise<void> {
    await this.saveData({ settings: this.settings, state: this.state } satisfies PersistedData)
  }

  async resyncFromScratch(): Promise<void> {
    this.state = emptyState()
    await this.savePersisted()
    new Notice('Focus & Go: re-syncing everything…')
    await this.syncNow(true)
  }
}

const baseName = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return name.endsWith('.md') ? name.slice(0, -3) : name
}

class ConfirmBulkDeleteModal extends Modal {
  private readonly paths: string[]
  private readonly onChoice: (confirmed: boolean) => Promise<void>
  private decided = false

  constructor(app: App, paths: string[], onChoice: (confirmed: boolean) => Promise<void>) {
    super(app)
    this.paths = paths
    this.onChoice = onChoice
  }

  override onOpen(): void {
    this.contentEl.createEl('h3', { text: `Delete ${this.paths.length} tasks?` })
    this.contentEl.createEl('p', {
      text:
        'That many notes disappearing at once is more often a sync glitch or a mis-dragged folder ' +
        'than a real intent. Nothing has been deleted in Focus & Go yet.',
    })
    const list = this.contentEl.createEl('ul')
    for (const path of this.paths.slice(0, 20)) list.createEl('li', { text: baseName(path) })
    if (this.paths.length > 20) {
      list.createEl('li', { text: `…and ${this.paths.length - 20} more` })
    }

    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
    buttons.createEl('button', { text: 'Keep the tasks' }).addEventListener('click', () => {
      this.decide(false)
    })
    const deleteButton = buttons.createEl('button', {
      text: `Delete ${this.paths.length} tasks`,
      cls: 'mod-warning',
    })
    deleteButton.addEventListener('click', () => this.decide(true))
  }

  private decide(confirmed: boolean): void {
    this.decided = true
    this.close()
    void this.onChoice(confirmed)
  }

  override onClose(): void {
    this.contentEl.empty()
    // Dismissing the modal is not consent to delete.
    if (!this.decided) void this.onChoice(false)
  }
}

class FocusGoSettingTab extends PluginSettingTab {
  private readonly plugin: FocusGoPlugin

  constructor(app: App, plugin: FocusGoPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  override display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('The Focus & Go API address, shown next to your token in the app settings.')
      .addText((text) =>
        text
          .setPlaceholder('https://api.nestflow.art')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim()
            await this.plugin.savePersisted()
          }),
      )

    new Setting(containerEl)
      .setName('Access token')
      .setDesc('Generate one in Focus & Go → Settings → Data → Obsidian & integrations.')
      .addText((text) => {
        text.inputEl.type = 'password'
        text
          .setPlaceholder('fg_…')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value.trim()
            await this.plugin.savePersisted()
          })
      })

    new Setting(containerEl)
      .setName('Folder')
      .setDesc('Vault folder your tasks are mirrored into.')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.folder)
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = normalizePath(normalizeFolder(value))
            await this.plugin.savePersisted()
          }),
      )

    new Setting(containerEl)
      .setName('Sync automatically')
      .setDesc('Turn off to sync only with the "Sync now" command.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncEnabled).onChange(async (value) => {
          this.plugin.settings.syncEnabled = value
          await this.plugin.savePersisted()
        }),
      )

    containerEl.createEl('h3', { text: 'Deleting' })
    containerEl.createEl('p', {
      text: 'Deleting a note deletes the task in Focus & Go.',
      cls: 'setting-item-description',
    })

    new Setting(containerEl)
      .setName('Undo window (seconds)')
      .setDesc('How long a delete waits before it is sent, so you can take it back.')
      .addText((text) =>
        text.setValue(String(this.plugin.settings.deleteUndoSeconds)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10)
          if (Number.isFinite(parsed) && parsed >= 1) {
            this.plugin.settings.deleteUndoSeconds = parsed
            await this.plugin.savePersisted()
          }
        }),
      )

    new Setting(containerEl)
      .setName('Confirm bulk deletes above')
      .setDesc('Deleting more notes than this at once asks first, instead of deleting the tasks.')
      .addText((text) =>
        text.setValue(String(this.plugin.settings.bulkDeleteThreshold)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10)
          if (Number.isFinite(parsed) && parsed >= 1) {
            this.plugin.settings.bulkDeleteThreshold = parsed
            await this.plugin.savePersisted()
          }
        }),
      )

    new Setting(containerEl)
      .setName('Re-sync from scratch')
      .setDesc('Forget local sync state and rebuild every note from the server.')
      .addButton((button) =>
        button.setButtonText('Re-sync').setWarning().onClick(() => {
          void this.plugin.resyncFromScratch()
        }),
      )
  }
}
