import { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createAuditLogger } from './audit/logger'
import { createSqliteBundle, resolveDesktopDbPath } from './db/sqliteService'
import { createFileAccessGuard } from './fs/accessGuard'
import { createIpcRouter, registerIpcHandlers, type IpcHandlerMap } from './ipc/router'
import { toggleWindowVisibility } from './native/windowToggle'
import { createSecureWindowOptions, isNavigationAllowed } from './security/windowSecurity'
import { setupAutoUpdater } from './updater/autoUpdater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null
let tray: Tray | null = null
const TOGGLE_SHORTCUT = 'CommandOrControl+Shift+F'

const parseReadImportPayload = (payload: unknown): { filePath: string } | null => {
  if (!payload || typeof payload !== 'object') return null
  const candidate = (payload as { filePath?: unknown }).filePath
  if (typeof candidate !== 'string' || candidate.trim() === '') return null
  return { filePath: candidate }
}

function createWindow() {
  const secureOptions = createSecureWindowOptions(
    path.join(__dirname, 'preload.mjs'),
    path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
  )

  win = new BrowserWindow(secureOptions)

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isNavigationAllowed(url, VITE_DEV_SERVER_URL)) {
      event.preventDefault()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.whenReady().then(() => {
  const auditLogger = createAuditLogger({
    logDir: path.join(app.getPath('userData'), 'logs'),
  })

  const sqliteBundle = createSqliteBundle(resolveDesktopDbPath(app.getPath('userData')))

  const dbHandlers: IpcHandlerMap = {
    'db:tasks:list': async () => sqliteBundle.service.tasks.list(),
    'db:tasks:add': async (payload) => sqliteBundle.service.tasks.add(payload as never),
    'db:tasks:update': async (payload) => sqliteBundle.service.tasks.update((payload as { task: never }).task),
    'db:tasks:remove': async (payload) => {
      await sqliteBundle.service.tasks.remove((payload as { id: string }).id)
      return null
    },
    'db:tasks:updateStatus': async (payload) => {
      const typed = payload as { id: string; status: never }
      return sqliteBundle.service.tasks.updateStatus(typed.id, typed.status)
    },
    'db:tasks:appendProgress': async (payload) => {
      const typed = payload as { id: string; content: string }
      return sqliteBundle.service.tasks.appendProgress(typed.id, typed.content)
    },
    'db:tasks:clearAllTags': async () => {
      await sqliteBundle.service.tasks.clearAllTags()
      return null
    },
    'db:widgetTodos:list': async (payload) => sqliteBundle.service.widgetTodos.list((payload as { scope?: never }).scope),
    'db:widgetTodos:add': async (payload) => sqliteBundle.service.widgetTodos.add(payload as never),
    'db:widgetTodos:update': async (payload) => sqliteBundle.service.widgetTodos.update((payload as { item: never }).item),
    'db:widgetTodos:remove': async (payload) => {
      await sqliteBundle.service.widgetTodos.remove((payload as { id: string }).id)
      return null
    },
    'db:focus:get': async () => sqliteBundle.service.focus.get(),
    'db:focus:upsert': async (payload) => sqliteBundle.service.focus.upsert(payload as never),
    'db:focusSessions:list': async (payload) => sqliteBundle.service.focusSessions.list((payload as { limit?: number }).limit),
    'db:focusSessions:start': async (payload) => sqliteBundle.service.focusSessions.start(payload as never),
    'db:focusSessions:complete': async (payload) => {
      const typed = payload as { id: string; actualMinutes?: number; completedAt?: number }
      return sqliteBundle.service.focusSessions.complete(typed.id, {
        actualMinutes: typed.actualMinutes,
        completedAt: typed.completedAt,
      })
    },
    'db:diary:list': async () => sqliteBundle.service.diary.list(),
    'db:diary:listActive': async () => sqliteBundle.service.diary.listActive(),
    'db:diary:getByDate': async (payload) => sqliteBundle.service.diary.getByDate((payload as { dateKey: string }).dateKey),
    'db:diary:listByRange': async (payload) => {
      const typed = payload as { dateFrom: string; dateTo: string; options?: { includeDeleted?: boolean } }
      return sqliteBundle.service.diary.listByRange(typed.dateFrom, typed.dateTo, typed.options)
    },
    'db:diary:listTrash': async () => sqliteBundle.service.diary.listTrash(),
    'db:diary:softDeleteByDate': async (payload) => sqliteBundle.service.diary.softDeleteByDate((payload as { dateKey: string }).dateKey),
    'db:diary:restoreByDate': async (payload) => sqliteBundle.service.diary.restoreByDate((payload as { dateKey: string }).dateKey),
    'db:diary:markExpiredOlderThan': async (payload) => sqliteBundle.service.diary.markExpiredOlderThan((payload as { days?: number }).days),
    'db:diary:hardDeleteByDate': async (payload) => sqliteBundle.service.diary.hardDeleteByDate((payload as { dateKey: string }).dateKey),
    'db:diary:add': async (payload) => sqliteBundle.service.diary.add(payload as never),
    'db:diary:update': async (payload) => sqliteBundle.service.diary.update((payload as { entry: never }).entry),
    'db:spend:listEntries': async () => sqliteBundle.service.spend.listEntries(),
    'db:spend:addEntry': async (payload) => sqliteBundle.service.spend.addEntry(payload as never),
    'db:spend:deleteEntry': async (payload) => {
      await sqliteBundle.service.spend.deleteEntry((payload as { id: string }).id)
      return null
    },
    'db:spend:updateEntry': async (payload) => sqliteBundle.service.spend.updateEntry((payload as { entry: never }).entry),
    'db:spend:listCategories': async () => sqliteBundle.service.spend.listCategories(),
    'db:spend:addCategory': async (payload) => sqliteBundle.service.spend.addCategory(payload as never),
    'db:spend:updateCategory': async (payload) => sqliteBundle.service.spend.updateCategory((payload as { category: never }).category),
    'db:dashboard:get': async () => sqliteBundle.service.dashboard.get(),
    'db:dashboard:upsert': async (payload) => sqliteBundle.service.dashboard.upsert(payload as never),
  }

  const router = createIpcRouter(dbHandlers, auditLogger)
  registerIpcHandlers(ipcMain, router)

  const fsGuard = createFileAccessGuard(app.getPath('userData'))

  ipcMain.handle('fs:selectImportFile', async () => {
    const selected = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Data files', extensions: ['json', 'txt'] }],
    })

    if (selected.canceled || selected.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = selected.filePaths[0]
    fsGuard.allowUserSelectedPath(filePath)
    return { canceled: false, filePath }
  })

  ipcMain.handle('fs:readImportFile', async (_event, payload) => {
    const parsed = parseReadImportPayload(payload)
    if (!parsed) {
      throw new Error('Invalid read payload')
    }

    if (!fsGuard.canReadPath(parsed.filePath)) {
      throw new Error('Path is not allowed')
    }

    const content = await readFile(parsed.filePath, 'utf8')
    return content
  })

  ipcMain.handle('db:importDexieJsonFromFile', async (_event, payload) => {
    const parsed = parseReadImportPayload(payload)
    if (!parsed) {
      throw new Error('Invalid import payload')
    }
    if (!fsGuard.canReadPath(parsed.filePath)) {
      throw new Error('Path is not allowed')
    }

    const content = await readFile(parsed.filePath, 'utf8')
    return sqliteBundle.importFromDexieJson(content)
  })

  createWindow()

  const toggleMainWindow = () => {
    if (!win) return
    toggleWindowVisibility(win)
  }

  try {
    const iconPath = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
    tray = new Tray(iconPath)
    const rebuildTrayMenu = () => {
      tray?.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: win?.isVisible() ? 'Hide' : 'Show',
            click: toggleMainWindow,
          },
          {
            label: 'Quit',
            click: () => app.quit(),
          },
        ])
      )
    }

    tray.on('click', toggleMainWindow)
    rebuildTrayMenu()
    win?.on('show', rebuildTrayMenu)
    win?.on('hide', rebuildTrayMenu)
  } catch (error) {
    void auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'native:tray:init',
      ok: false,
      errorCode: error instanceof Error ? error.message : String(error),
    })
  }

  const shortcutRegistered = globalShortcut.register(TOGGLE_SHORTCUT, toggleMainWindow)
  if (!shortcutRegistered) {
    void auditLogger.log({
      timestamp: new Date().toISOString(),
      channel: 'native:shortcut:register',
      ok: false,
      errorCode: 'SHORTCUT_REGISTRATION_FAILED',
    })
  }

  app.on('before-quit', () => {
    tray?.destroy()
    sqliteBundle.close()
  })

  void setupAutoUpdater({
    isDev: Boolean(VITE_DEV_SERVER_URL),
    auditLogger,
  })
})
