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
