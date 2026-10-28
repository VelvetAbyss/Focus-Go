import { spawn, type ChildProcess } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

let apiProcess: ChildProcess
let webProcess: ChildProcess
let apiBase: string

const startApi = async () => {
  const script = resolve(process.cwd(), 'focus-go-api/test/fixtures/sync-auth-browser-server.js')
  apiProcess = spawn(process.execPath, [script], { cwd: resolve(process.cwd(), 'focus-go-api') })
  let buffer = ''
  const port = await new Promise<number>((resolvePort, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Sync test API did not start: ${buffer}`)), 15_000)
    apiProcess.stderr?.on('data', chunk => { buffer += String(chunk) })
    apiProcess.stdout?.on('data', (chunk) => {
      buffer += String(chunk)
      const match = buffer.match(/\{"port":(\d+)\}/)
      if (match) {
        clearTimeout(timeout)
        resolvePort(Number(match[1]))
      }
    })
    apiProcess.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Sync test API exited ${code}: ${buffer}`))
    })
  })
  apiBase = `http://127.0.0.1:${port}`
}

const startWeb = async () => {
  const vite = resolve(process.cwd(), '../../node_modules/vite/bin/vite.js')
  webProcess = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5178', '--strictPort'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_API_BASE: apiBase,
      VITE_AUTH_API_BASE: `${apiBase}/api/auth`,
    },
  })
  let lastError: unknown = null
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:5178/')
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    if (webProcess.exitCode !== null) break
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  throw new Error(`Sync test Web did not start: ${String(lastError)}`)
}

const authRequest = async (path: string, body: Record<string, string>) => {
  const response = await fetch(`${apiBase}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5178' },
    body: JSON.stringify(body),
  })
  expect(response.ok, await response.text()).toBe(true)
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('better-auth.session_token='))
  expect(cookie).toBeTruthy()
  const token = cookie!.split(';')[0].split('=').slice(1).join('=')
  return { name: 'better-auth.session_token', value: token, url: apiBase }
}

test.beforeAll(async () => {
  await startApi()
  await startWeb()
})

test.afterAll(async () => {
  webProcess?.kill('SIGTERM')
  apiProcess?.kill('SIGTERM')
})

test('two signed-in browsers keep legacy offline edits as reviewable conflict copies', async ({ browser }) => {
  test.setTimeout(120_000)
  const credentials = { email: `sync-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234' }
  const cookieA = await authRequest('sign-up/email', { ...credentials, name: 'Sync Browser Test' })
  const cookieB = await authRequest('sign-in/email', credentials)
  const contextA = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' })
  const contextB = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' })
  try {
    await contextA.addCookies([cookieA])
    await contextB.addCookies([cookieB])
    for (const context of [contextA, contextB]) {
      await context.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
    }
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    await pageA.goto('/note')
    await pageA.getByRole('button', { name: 'New note' }).first().click()
    const editorA = pageA.locator('.note-editor .ProseMirror')
    await editorA.fill('Initial shared note')
    const noteId = new URL(pageA.url()).searchParams.get('note')!
    await expect.poll(async () => pageA.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, noteId,
    )).toContain('Initial shared note')
    await pageA.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())

    await pageB.goto('/workspace/settings')
    await pageB.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await pageB.goto(`/note?note=${noteId}`)
    const editorB = pageB.locator('.note-editor .ProseMirror')
    await expect(editorB).toContainText('Initial shared note')

    await contextB.setOffline(true)
    await editorB.fill('Second device offline edit')
    await expect.poll(async () => pageB.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, noteId,
    )).toContain('Second device offline edit')
    // Unmount the upgraded CRDT editor before simulating a legacy record.
    await pageB.getByRole('button', { name: 'New note' }).first().click()
    await expect(pageB).not.toHaveURL(new RegExp(`note=${noteId}`))
    // Simulate a pre-CRDT client: its text is still preserved as a conflict copy.
    await pageB.evaluate(async (id) => {
      await (await import('/src/data/db/index.ts')).db.notes.update(id, { crdtState: '', updatedAt: Date.now() })
    }, noteId)

    await editorA.fill('First device online edit')
    await expect.poll(async () => pageA.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, noteId,
    )).toContain('First device online edit')
    await pageA.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())

    await contextB.setOffline(false)
    await pageB.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await expect.poll(async () => pageB.evaluate(async () =>
      (await (await import('/src/data/db/index.ts')).db.syncConflicts.toArray()).filter(item => item.entityType === 'notes').length,
    )).toBe(1)
    await expect.poll(async () => pageB.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, noteId,
    )).toContain('First device online edit')
    await pageB.goto(`/note?note=${noteId}`)
    await expect(editorB).toContainText('First device online edit')
    await pageB.reload()
    await expect(pageB.locator('.note-editor .ProseMirror')).toContainText('First device online edit')
    await pageB.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(pageB).toHaveURL(/\/settings/)
    await pageB.getByRole('tab', { name: /Data/ }).click()
    await expect(pageB.getByRole('heading', { name: 'Sync conflict copies' })).toBeVisible()
    const conflictId = await pageB.evaluate(async () => (await (await import('/src/data/db/index.ts')).db.syncConflicts.toArray()).find(item => item.entityType === 'notes')?.id)
    const conflictCard = pageB.getByTestId(`sync-conflict-${conflictId}`)
    await conflictCard.getByText('Compare copies').click()
    await expect(conflictCard.getByTestId('conflict-local-preview')).toContainText('Second device offline edit')
    await expect(conflictCard.getByTestId('conflict-remote-preview')).toContainText('First device online edit')
    const downloadPromise = pageB.waitForEvent('download')
    await conflictCard.getByRole('button', { name: 'Download both copies' }).click()
    const download = await downloadPromise
    const savedPath = await download.path()
    const conflict = JSON.parse(await readFile(savedPath!, 'utf8'))
    expect(conflict.localDocument.contentMd).toContain('Second device offline edit')
    expect(conflict.remoteDocument.contentMd).toContain('First device online edit')
    await conflictCard.getByRole('button', { name: 'Save local version as new note' }).click()
    await expect.poll(async () => pageB.evaluate(async () =>
      (await (await import('/src/data/db/index.ts')).db.syncConflicts.toArray()).find(item => item.entityType === 'notes')?.resolvedAt,
    )).toBeGreaterThan(0)
    const recoveredId = await pageB.evaluate(async () =>
      (await (await import('/src/data/db/index.ts')).db.syncConflicts.toArray()).find(item => item.entityType === 'notes')?.restoredEntityId,
    )
    expect(recoveredId).toBeTruthy()
    expect(recoveredId).not.toBe(noteId)
    expect(await pageB.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, recoveredId,
    )).toContain('Second device offline edit')
    expect(await pageB.evaluate(async (id) =>
      (await (await import('/src/data/db/index.ts')).db.notes.get(id))?.contentMd, noteId,
    )).toContain('First device online edit')
    await conflictCard.getByRole('button', { name: 'Open recovered note' }).click()
    await expect(pageB).toHaveURL(new RegExp(`note=${recoveredId}`))
    await expect(pageB.locator('.note-editor .ProseMirror')).toContainText('Second device offline edit')
  } finally {
    await contextA.close().catch(() => {})
    await contextB.close().catch(() => {})
  }
})

test('realtime notifications deliver edits and offline CRDT edits converge across two signed-in browsers', async ({ browser }) => {
  test.setTimeout(180_000)
  const credentials = { email: `crdt-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234' }
  const cookieA = await authRequest('sign-up/email', { ...credentials, name: 'CRDT Browser Test' })
  const cookieB = await authRequest('sign-in/email', credentials)
  const contexts = await Promise.all([browser.newContext({ serviceWorkers: 'block' }), browser.newContext({ serviceWorkers: 'block' })])
  const syncLog: string[] = []
  try {
    await contexts[0].addCookies([cookieA]); await contexts[1].addCookies([cookieB])
    for (const context of contexts) await context.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
    const a = await contexts[0].newPage(); const b = await contexts[1].newPage()
    for (const [label, page] of [['A', a], ['B', b]] as const) {
      page.on('console', message => { if (message.text().includes('[sync]')) syncLog.push(`${label}: ${message.text()}`) })
      page.on('pageerror', error => syncLog.push(`${label} ERROR: ${error.message}`))
    }
    await a.goto('/note')
    await a.getByRole('button', { name: 'New note' }).first().click()
    const first = a.locator('.note-editor .ProseMirror')
    await first.fill('Shared baseline')
    const id = new URL(a.url()).searchParams.get('note')!
    await expect.poll(() => a.evaluate(async noteId => (await (await import('/src/data/db/index.ts')).db.notes.get(noteId))?.crdtState, id)).toBeTruthy()
    await a.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await b.goto('/workspace/settings')
    await b.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await b.goto(`/note?note=${id}`)
    const second = b.locator('.note-editor .ProseMirror')
    await expect(second).toContainText('Shared baseline')
    await first.press('ControlOrMeta+End'); await first.press('End'); await first.pressSequentially(' realtime')
    // No manual sync: local commit + authenticated invalidation must suffice.
    await expect(second).toContainText('Shared baseline realtime', { timeout: 20_000 })
    await contexts[1].setOffline(true)
    await second.press('ControlOrMeta+End'); await second.press('End'); await second.pressSequentially(' BBBB')
    await expect.poll(() => b.evaluate(async noteId => (await (await import('/src/data/db/index.ts')).db.notes.get(noteId))?.contentMd, id)).toContain('BBBB')
    await first.press('ControlOrMeta+Home'); await first.press('Home'); await first.pressSequentially('AAAA ')
    await expect.poll(() => a.evaluate(async noteId => (await (await import('/src/data/db/index.ts')).db.notes.get(noteId))?.contentMd, id)).toContain('AAAA')
    await a.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await contexts[1].setOffline(false)
    try {
      await expect(first).toContainText('BBBB', { timeout: 30_000 })
      await expect(second).toContainText('AAAA', { timeout: 30_000 })
    } catch (error) {
      for (const [label, page] of [['A', a], ['B', b]] as const) {
        const diagnostic = await page.evaluate(async noteId => {
          const { db } = await import('/src/data/db/index.ts')
          const { isNoteCrdtSnapshot } = await import('/src/data/sync/noteCrdt.ts')
          const note = await db.notes.get(noteId)
          return { note, valid: note ? isNoteCrdtSnapshot(note) : false, pending: await db.pendingSyncChanges.toArray(), conflicts: await db.syncConflicts.toArray(), state: await db.syncState.toArray() }
        }, id)
        await test.info().attach(`sync-${label}.json`, { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' })
      }
      throw error
    }
    await expect.poll(async () => first.innerText()).toBe(await second.innerText())
    await b.reload()
    await expect(b.locator('.note-editor .ProseMirror')).toContainText('AAAA')
    await expect(b.locator('.note-editor .ProseMirror')).toContainText('BBBB')
    await expect.poll(() => b.evaluate(async noteId => (await (await import('/src/data/db/index.ts')).db.pendingSyncChanges.toArray()).filter(item => item.entityType === 'notes' && item.entityId === noteId).length, id)).toBe(0)
    await b.screenshot({ path: resolve(process.cwd(), '../../artifacts/sync-upgrade-2026-10-16/two-device-merged.png'), fullPage: true })
    expect(await b.evaluate(async () => (await (await import('/src/data/db/index.ts')).db.syncConflicts.toArray()).filter(item => item.entityType === 'notes').length)).toBe(0)
  } finally {
    await test.info().attach('sync-log.json', { body: JSON.stringify(syncLog, null, 2), contentType: 'application/json' })
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0]
      if (page) {
        const state = await page.evaluate(async () => {
          const { db } = await import('/src/data/db/index.ts')
          const { isNoteCrdtSnapshot } = await import('/src/data/sync/noteCrdt.ts')
          const notes = await db.notes.toArray()
          return { notes, valid: notes.map(note => isNoteCrdtSnapshot(note)), pending: await db.pendingSyncChanges.toArray(), conflicts: await db.syncConflicts.toArray(), state: await db.syncState.toArray() }
        }).catch(error => ({ error: String(error) }))
        await test.info().attach(`final-device-${index}.json`, { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
      }
    }
    await Promise.all(contexts.map(context => context.close()))
  }
})

test('Chinese narrow dark conflict recovery works with keyboard and reduced motion', async ({ browser }) => {
  test.setTimeout(60_000)
  const credentials = { email: `sync-mobile-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234' }
  const cookie = await authRequest('sign-up/email', { ...credentials, name: 'Sync Mobile Test' })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  try {
    await context.addCookies([cookie])
    await context.addInitScript(() => {
      localStorage.setItem('workbench.ui.language', 'zh')
      localStorage.setItem('focusgo.theme', 'dark')
    })
    const page = await context.newPage()
    await page.goto('/workspace/settings')
    await expect.poll(async () => page.evaluate(async () =>
      (await import('/src/store/auth.ts')).getAuth()?.user?.id ?? null,
    )).not.toBeNull()
    await page.evaluate(async () => {
      const accountId = (await import('/src/store/auth.ts')).getAuth()!.user!.id
      await (await import('/src/data/sync/conflicts.ts')).recordSyncConflict(
        accountId,
        'notes',
        { id: 'mobile-conflict', title: '窄屏笔记', contentMd: '本机保留的段落', updatedAt: 100 },
        { id: 'mobile-conflict', title: '窄屏笔记', contentMd: '云端当前段落', updatedAt: 200 },
      )
    })
    await page.reload()
    await page.getByRole('tab', { name: /数据/ }).click()
    const compare = page.getByText('对照两份内容', { exact: true })
    await compare.focus()
    await compare.press('Enter')
    await expect(page.getByTestId('conflict-local-preview')).toContainText('本机保留的段落')
    await expect(page.getByTestId('conflict-remote-preview')).toContainText('云端当前段落')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
    await page.screenshot({ path: test.info().outputPath('conflict-390-zh-dark.png'), fullPage: true })
    const restore = page.getByRole('button', { name: '将本机版本另存为新笔记' })
    await restore.focus()
    await restore.press('Enter')
    await expect(page.getByRole('button', { name: '打开恢复的笔记' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  } finally {
    await context.close().catch(() => {})
  }
})

test('data safety: unsent tasks survive logout/switch/reset attempts, then restore after clearing site data', async ({ browser }) => {
  test.setTimeout(180_000)
  const credentials = { email: `safety-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234' }
  const cookie = await authRequest('sign-up/email', { ...credentials, name: 'Data Safety Test' })
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' })
  try {
    await context.addCookies([cookie])
    await context.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
    const page = await context.newPage()
    let destructiveRequests = 0
    page.on('request', request => { if (request.url().includes('/sign-out') || (request.method() === 'DELETE' && request.url().endsWith('/user/data'))) destructiveRequests++ })
    console.log('DATA SAFETY: initial page')
    await page.goto('/workspace/settings?section=data')
    await expect(page.getByTestId('sync-safety-status')).toContainText('Cloud confirmed', { timeout: 45000 })
    // Disable automatic scheduling and fail upload, without blocking auth or browser navigation.
    await page.getByRole('switch', { name: 'Toggle cloud sync' }).uncheck()
    console.log('DATA SAFETY: offline')
    await context.setOffline(true)
    console.log('DATA SAFETY: create task')
    const task = await page.evaluate(async () => {
      const { createDexieDatabaseService } = await import('/src/data/services/DexieDatabaseService.ts')
      return createDexieDatabaseService().tasks.add({ title: 'Inspect Bestbuy image quality – recovery sentinel', description: 'Compare full-size originals and listing thumbnails', status: 'todo', priority: null, dueDate: '2026-10-21', tags: ['image-quality'], subtasks: [{ id: 'sentinel-step', title: 'Check the original image', done: false }] })
    })
    await expect(page.getByTestId('sync-safety-status')).toContainText(/Saved on device.*pending/)
    await page.screenshot({ path: resolve(process.cwd(), '../../artifacts/sync-safety-2026-10-20/offline-pending-status.png'), fullPage: true })
    console.log('DATA SAFETY: attempt logout')
    await page.locator('.sidebar-user-panel').click()
    const account = page.getByRole('dialog')
    await account.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByTestId('data-safety-notice')).toBeVisible()
    expect(await page.evaluate(async id => (await (await import('/src/data/db/index.ts')).db.tasks.get(id))?.title, task.id)).toBe(task.title)
    await account.getByRole('button', { name: 'Switch Account', exact: true }).click()
    await expect(page.getByTestId('data-safety-notice')).toBeVisible()
    expect((await context.cookies()).some(c => c.name === cookie.name && c.value === cookie.value)).toBe(true)
    console.log('DATA SAFETY: export')
    await page.screenshot({ path: resolve(process.cwd(), '../../artifacts/sync-safety-2026-10-20/unsent-task-protected.png'), fullPage: true })
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export device backup', exact: true }).click()
    const backup = await downloadPromise
    expect((await readFile((await backup.path())!)).length).toBeGreaterThan(100)
    // Inspect the exported ZIP manifest: the sentinel and its durable upload record are both present.
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await readFile((await backup.path())!))
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.db.tables.tasks.find((row: { id: string }) => row.id === task.id)?.title).toBe(task.title)
    expect(manifest.db.tables.pending_sync_changes.some((row: { entityId: string }) => row.entityId === task.id)).toBe(true)
    console.log('DATA SAFETY: reset guard')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Reset App' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm reset', exact: true }).click()
    await expect(page.getByTestId('data-safety-notice')).toBeVisible()
    expect(await page.evaluate(async id => !!await (await import('/src/data/db/index.ts')).db.tasks.get(id), task.id)).toBe(true)
    expect(destructiveRequests).toBe(0)
    console.log('DATA SAFETY: reconnect')
    await context.setOffline(false)
    await page.getByRole('switch', { name: 'Toggle cloud sync' }).check()
    await expect(page.getByTestId('sync-safety-status')).toContainText('Cloud confirmed', { timeout: 45000 })
    // Actual browser site-data removal in an isolated test context. No production user data is touched.
    console.log('DATA SAFETY: clear site data')
    const cdp = await context.newCDPSession(page)
    await page.goto('about:blank')
    await cdp.send('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:5178', storageTypes: 'all' })
    await context.clearCookies()
    await expect.poll(async () => cdp.send('Storage.getUsageAndQuota', { origin: 'http://127.0.0.1:5178' }).then(r => r.usage)).toBe(0)
    const newCookie = await authRequest('sign-in/email', credentials)
    await context.addCookies([newCookie])
    console.log('DATA SAFETY: restore')
    await page.goto('/tasks')
    // Restoration is asynchronous. Verify persisted recovery before opening a
    // deep link, which the board discards if its first local load is empty.
    await expect.poll(async () => page.evaluate(async id =>
      (await (await import('/src/data/db/index.ts')).db.tasks.get(id))?.title, task.id,
    ), { timeout: 45000 }).toBe(task.title)
    console.log('DATA SAFETY: persisted task restored')
    await page.goto(`/tasks?task=${task.id}`)
    await expect(page.locator('.task-detail-title-input')).toHaveValue(task.title, { timeout: 45000 })
    const safetyBounds = await page.getByTestId('sync-status-trigger').boundingBox()
    const sidebarBounds = await page.locator('aside.focus-sidebar').boundingBox()
    const headingBounds = await page.locator('.tasks-workspace-header').boundingBox()
    expect(safetyBounds!.height).toBeLessThan(50)
    expect(safetyBounds!.x + safetyBounds!.width).toBeLessThanOrEqual(sidebarBounds!.x + sidebarBounds!.width)
    // The task drawer traps keyboard focus until dismissed.
    await page.keyboard.press('Escape')
    await page.getByTestId('sync-status-trigger').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sidebar-sync__popover')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sync & backup' })).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/details.png' })
    await page.keyboard.press('Escape')
    await expect(page.locator('.sidebar-sync__popover')).not.toBeVisible()
    await expect(page.getByTestId('sync-status-trigger')).toBeFocused()
    await page.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/sidebar.png' })
    await page.locator('.focus-sidebar__toggle').click()
    await page.getByTestId('sync-status-trigger').click()
    await expect(page.locator('.sidebar-sync__popover')).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await page.locator('.sidebar-sync__popover').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
    await page.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/collapsed.png' })
    await page.keyboard.press('Escape')
    await page.locator('.sidebar-theme-toggle').click()
    await page.getByTestId('sync-status-trigger').click()
    await expect(page.locator('.sidebar-sync__popover')).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/dark.png' })
    await page.keyboard.press('Escape')
    expect(headingBounds!.y + headingBounds!.height).toBeLessThan(page.viewportSize()!.height)
    const restored = await page.evaluate(async id => (await (await import('/src/data/db/index.ts')).db.tasks.get(id)), task.id)
    expect(restored?.id).toBe(task.id)
    expect(restored?.title).toBe(task.title)
    expect(restored).toMatchObject({ description: task.description, dueDate: task.dueDate, tags: task.tags, subtasks: task.subtasks, status: task.status, createdAt: task.createdAt })
    await page.goto(`/tasks?task=${task.id}`)
    await expect(page.locator('.task-detail-title-input')).toHaveValue(task.title)
    await page.screenshot({ path: resolve(process.cwd(), '../../artifacts/sync-safety-2026-10-20/cleared-site-restored-task.png'), fullPage: true })
    const previewCookie = await authRequest('sign-up/email', { email: `sidebar-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234', name: 'Dylan' })
    const preview = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } })
    try {
      await preview.addCookies([previewCookie])
      await preview.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
      const previewPage = await preview.newPage()
      await previewPage.goto('/tasks')
      await expect(previewPage.getByTestId('sync-safety-status')).toContainText('云端已确认', { timeout: 45000 })
      await previewPage.getByTestId('sync-status-trigger').click()
      await expect(previewPage.locator('.sidebar-sync__popover')).toBeVisible()
      await previewPage.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/preview-zh.png', clip: { x: 0, y: 0, width: 600, height: 350 } })
      await previewPage.setViewportSize({ width: 390, height: 844 })
      await expect.poll(async () => {
        const bounds = await previewPage.locator('.sidebar-sync__popover').boundingBox()
        return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390
      }).toBe(true)
      await previewPage.screenshot({ animations: 'disabled', path: 'artifacts/sidebar-sync-status/mobile.png' })
    } finally { await preview.close() }
  } finally { await context.close() }
})


test('data safety: interrupted reset preserves local content and rebuilds the wiped cloud', async ({ browser }) => {
  test.setTimeout(120_000)
  const cookie = await authRequest('sign-up/email', { email: `reset-safety-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234', name: 'Reset Safety Test' })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    await context.addCookies([cookie])
    await context.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
    const page = await context.newPage()
    await page.goto('/workspace/settings?section=data')
    await expect(page.getByTestId('sync-safety-status')).toContainText('Cloud confirmed', { timeout: 45000 })
    const task = await page.evaluate(async () => {
      const { createDexieDatabaseService } = await import('/src/data/services/DexieDatabaseService.ts')
      return createDexieDatabaseService().tasks.add({ title: 'Inspect Bestbuy image quality – recovery sentinel', status: 'todo', priority: null, tags: [], subtasks: [] })
    })
    await expect.poll(async () => page.evaluate(async id =>
      (await (await import('/src/data/sync/client.ts')).syncApi.rxdbPull({ entityType: 'tasks', checkpoint: null, limit: 100 })).documents.some(row => row.id === id), task.id,
    )).toBe(true)
    // A committed server wipe with a bad response must retain local content,
    // invalidate confirmation, and rebuild server data when sync is re-enabled.
    await expect(page.getByTestId('sync-safety-status')).toContainText('Cloud confirmed', { timeout: 45000 })
    await page.getByRole('switch', { name: 'Toggle cloud sync' }).uncheck()
    await page.getByRole('button', { name: 'Reset App' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm reset', exact: true }).click()
    await expect(page.getByTestId('data-safety-notice')).toBeVisible()
    expect(await page.evaluate(async () => (await (await import('/src/data/db/index.ts')).db.syncState.get('cloud-sync'))?.lastCloudConfirmedAt)).toBeNull()
    expect(await page.evaluate(async id => (await (await import('/src/data/db/index.ts')).db.tasks.get(id))?.title, task.id)).toBe(task.title)
    expect(await page.evaluate(async () => (await (await import('/src/data/sync/client.ts')).syncApi.rxdbPull({ entityType: 'tasks', checkpoint: null, limit: 100 })).documents.length)).toBe(0)
    await page.getByRole('switch', { name: 'Toggle cloud sync' }).check()
    await expect(page.getByTestId('sync-safety-status')).toContainText('Cloud confirmed', { timeout: 45000 })
    expect(await page.evaluate(async () => (await (await import('/src/data/sync/client.ts')).syncApi.rxdbPull({ entityType: 'tasks', checkpoint: null, limit: 100 })).documents.some(row => row.title === 'Inspect Bestbuy image quality – recovery sentinel'))).toBe(true)

  } finally { await context.close() }
})

test('data safety: image upload placeholders survive opening, editing and reloading a synced note', async ({ page }) => {
  const cookie = await authRequest('sign-up/email', { email: `image-schema-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234', name: 'Image Schema Test' })
  await page.context().addCookies([cookie])
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/note')
  const noteId = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII='
    const note = await notesRepo.create({
      title: 'Image upload schema regression', collection: 'all-notes', tags: [],
      contentMd: '# Image upload schema regression\n\nBefore the upload\n\nAfter the upload',
      contentJson: { type: 'doc', content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Image upload schema regression' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Before the upload' }] },
        { type: 'imageUpload', attrs: { accept: 'image/*', limit: 3, maxSize: 10485760 } },
        { type: 'image', attrs: { src: image, alt: 'Existing attachment' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'After the upload' }] },
      ] },
    })
    return note.id
  })
  await page.goto(`/note?note=${noteId}`)
  const editor = page.locator('.note-editor .ProseMirror')
  await expect(editor).toContainText('Before the upload')
  await expect(editor).toContainText('After the upload')
  await expect(editor.locator('.tiptap-image-upload')).toBeVisible()
  await expect(editor.locator('img[alt="Existing attachment"]')).toBeVisible()
  await editor.locator('p').last().click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' - continued after opening')
  await expect.poll(async () => page.evaluate(async id => {
    const { db } = await import('/src/data/db/index.ts')
    const note = await db.notes.get(id)
    return { saved: note?.contentMd.includes('continued after opening'), crdt: !!note?.crdtState }
  }, noteId)).toEqual({ saved: true, crdt: true })
  await page.reload()
  await expect(editor).toContainText('After the upload - continued after opening')
  await expect(editor.locator('.tiptap-image-upload')).toBeVisible()
  await expect(editor.locator('img[alt="Existing attachment"]')).toBeVisible()
  expect(await editor.locator('img[alt="Existing attachment"]').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  expect(await page.evaluate(async id => {
    const { db } = await import('/src/data/db/index.ts')
    return (await db.notes.get(id))?.title
  }, noteId)).toBe('Image upload schema regression')
  expect(await page.evaluate(async id => {
    const { db } = await import('/src/data/db/index.ts')
    return (await db.notes.get(id))?.contentJson?.content
  }, noteId)).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'imageUpload', attrs: { accept: 'image/*', limit: 3, maxSize: 10485760 } }),
    expect.objectContaining({ type: 'image', attrs: expect.objectContaining({ alt: 'Existing attachment' }) }),
  ]))
  expect(errors).toEqual([])
  await page.screenshot({ path: '../../artifacts/note-image-upload-2026-10-20/reopened-note.png', fullPage: true })
})

test('data safety: CRM customers, deals and follow-up tasks sync between two signed-in browsers', async ({ browser }) => {
  test.setTimeout(120_000)
  const credentials = { email: `crm-${crypto.randomUUID()}@example.test`, password: 'test-only-password-1234' }
  const cookieA = await authRequest('sign-up/email', { ...credentials, name: 'CRM Sync Test' })
  const cookieB = await authRequest('sign-in/email', credentials)
  const contextA = await browser.newContext({ serviceWorkers: 'block' })
  const contextB = await browser.newContext({ serviceWorkers: 'block' })
  try {
    await contextA.addCookies([cookieA])
    await contextB.addCookies([cookieB])
    for (const context of [contextA, contextB]) {
      await context.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
    }
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    await pageA.goto('/labs')
    await pageA.locator('.labs-card').filter({ hasText: 'Customer workspace' }).getByRole('button', { name: 'Install', exact: true }).click()
    await pageA.locator('.labs-row').filter({ hasText: 'Customer workspace' }).getByRole('link', { name: 'Open', exact: true }).click()
    await pageA.getByRole('button', { name: 'New customer', exact: true }).click()
    await pageA.getByLabel('Company name *').fill('CRM sync example')
    await pageA.getByRole('button', { name: 'Save customer', exact: true }).click()
    await expect(pageA.getByRole('heading', { name: 'CRM sync example', exact: true })).toBeVisible()
    const customerUrl = new URL(pageA.url()).pathname + new URL(pageA.url()).search
    await pageA.getByLabel('Conversation notes', { exact: true }).fill('Discussed annual supply')
    await pageA.getByLabel('Next follow-up', { exact: true }).fill('Send proposal')
    await pageA.getByLabel('Follow-up date *').fill('2027-01-12')
    await pageA.getByRole('button', { name: 'Log & schedule', exact: true }).click()
    await expect(pageA.locator('.crm-task-row')).toContainText('Send proposal')
    await pageA.getByRole('button', { name: 'Add opportunity', exact: true }).click()
    await pageA.getByLabel('Name *', { exact: true }).fill('Annual supply')
    await pageA.getByLabel('Amount', { exact: true }).fill('250')
    await pageA.getByRole('button', { name: 'Save opportunity', exact: true }).click()
    await expect(pageA.locator('.crm-deal-row')).toContainText('Annual supply')
    await pageA.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())

    await pageB.goto('/labs')
    await pageB.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await pageB.goto(customerUrl)
    await expect(pageB.getByRole('heading', { name: 'CRM sync example', exact: true })).toBeVisible()
    await expect(pageB.locator('.crm-task-row')).toContainText('Send proposal')
    await expect(pageB.locator('.crm-deal-row')).toContainText('Annual supply')
    await expect(pageB.locator('.crm-history')).toContainText('Discussed annual supply')
    const listTop = await pageB.locator('.crm-list-pane').evaluate(element => element.scrollTop)
    await pageB.locator('.crm-detail').hover()
    await pageB.mouse.wheel(0, 600)
    await expect.poll(() => pageB.locator('.crm-detail').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    expect(await pageB.locator('.crm-list-pane').evaluate(element => element.scrollTop)).toBe(listTop)
    expect(await pageB.locator('.focus-shell__route-layer').evaluate(element => element.scrollTop)).toBe(0)
    await pageB.getByRole('button', { name: 'Complete follow-up CRM sync example · Send proposal', exact: true }).click()
    await expect(pageB.locator('.crm-task-row')).toHaveCount(0)
    await pageB.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await pageA.evaluate(async () => (await import('/src/data/sync/rxdb.ts')).runRxdbSyncCycle())
    await expect(pageA.locator('.crm-task-row')).toHaveCount(0)
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
