import { TFile, TFolder, normalizePath, type App } from 'obsidian'
import { titleToFileName } from './mapper.ts'

/**
 * Every filesystem touch goes through here, so the replicator never talks to
 * Obsidian's API directly and stays unit-testable.
 */
export class VaultAdapter {
  private readonly app: App

  constructor(app: App) {
    this.app = app
  }

  private get vault() {
    return this.app.vault
  }

  async ensureFolder(folder: string): Promise<void> {
    const path = normalizePath(folder)
    const existing = this.vault.getAbstractFileByPath(path)
    if (existing instanceof TFolder) return
    // Creating a nested path creates the intermediate folders too.
    await this.vault.createFolder(path).catch((error: unknown) => {
      // A concurrent create (or Obsidian Sync racing us) is not an error.
      if (!String(error).includes('already exists')) throw error
    })
  }

  getFile(path: string): TFile | null {
    const file = this.vault.getAbstractFileByPath(normalizePath(path))
    return file instanceof TFile ? file : null
  }

  listMarkdown(folder: string): TFile[] {
    const prefix = `${normalizePath(folder)}/`
    return this.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix))
  }

  read(file: TFile): Promise<string> {
    return this.vault.read(file)
  }

  /** Pick a free path for `title`, avoiding a collision with any other task's file. */
  async availablePath(folder: string, title: string, exceptPath?: string): Promise<string> {
    const base = titleToFileName(title)
    for (let suffix = 0; suffix < 500; suffix += 1) {
      const name = suffix === 0 ? base : `${base}-${suffix + 1}`
      const path = normalizePath(`${folder}/${name}.md`)
      if (path === exceptPath) return path
      if (!this.vault.getAbstractFileByPath(path)) return path
    }
    return normalizePath(`${folder}/${base}-${Date.now()}.md`)
  }

  async write(path: string, content: string): Promise<TFile> {
    const normalized = normalizePath(path)
    const existing = this.getFile(normalized)
    if (existing) {
      await this.vault.modify(existing, content)
      return existing
    }
    return this.vault.create(normalized, content)
  }

  async rename(file: TFile, path: string): Promise<void> {
    const target = normalizePath(path)
    if (file.path === target) return
    await this.app.fileManager.renameFile(file, target)
  }

  /** Delete to the user's configured trash, never a hard unlink. */
  async trash(file: TFile): Promise<void> {
    await this.app.fileManager.trashFile(file)
  }
}
