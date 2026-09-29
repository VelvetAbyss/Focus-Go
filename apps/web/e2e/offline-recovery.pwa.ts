import { expect, test } from '@playwright/test'

test('a note and task survive an offline reload without duplicate records', async ({ page, context }) => {
  await page.goto('/note')
  await page.getByRole('button', { name: 'New note' }).first().click()
  let editor = page.locator('.note-editor .ProseMirror')
  await editor.fill('Offline recovery note')
  await expect(page).toHaveURL(/\/note\?note=[^&]+$/)
  const noteId = new URL(page.url()).searchParams.get('note')!
  await page.getByRole('button', { name: 'Create task' }).click()
  const dialog = page.locator('.note-task-dialog')
  await dialog.getByRole('textbox', { name: 'Task title' }).fill('Offline recovery task')
  await dialog.getByRole('button', { name: 'Create and open' }).click()
  await expect(page).toHaveURL(/\/tasks\?task=[^&]+&from=/)
  const taskId = new URL(page.url()).searchParams.get('task')!
  await page.getByRole('button', { name: 'Back to note' }).click()
  await expect(page).toHaveURL(`/note?note=${noteId}`)

  await expect.poll(async () => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration())?.active?.state,
  )).toBe('activated')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  editor = page.locator('.note-editor .ProseMirror')
  await expect(editor).toContainText('Offline recovery note')

  await context.setOffline(true)
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.insertText(' offline recovery marker')
  await expect(editor).toContainText('offline recovery marker')
  // Reload immediately, while both editor and repository debounce windows may still be open.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.note-editor .ProseMirror')).toContainText('offline recovery marker')

  await page.goto(`/tasks?task=${taskId}`, { waitUntil: 'domcontentloaded' })
  const drawer = page.locator('.task-drawer-panel')
  await expect(drawer.locator('.task-detail-title-input')).toHaveValue('Offline recovery task')
  await drawer.getByRole('button', { name: 'Done' }).first().click()
  await expect(drawer.locator('.task-detail-status-badge')).toContainText('Done')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.task-drawer-panel .task-detail-status-badge')).toContainText('Done')

  await context.setOffline(false)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const records = await page.evaluate(async ({ noteId, taskId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('workbench-app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const readAll = <T,>(table: string) => new Promise<T[]>((resolve, reject) => {
      const request = database.transaction(table, 'readonly').objectStore(table).getAll()
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
    const [notes, tasks] = await Promise.all([
      readAll<{ id: string; contentMd: string }>('notes'),
      readAll<{ id: string; status: string }>('tasks'),
    ])
    database.close()
    return {
      notes: notes.filter((note) => note.id === noteId),
      tasks: tasks.filter((task) => task.id === taskId),
    }
  }, { noteId, taskId })
  expect(records.notes).toHaveLength(1)
  expect(records.notes[0].contentMd).toContain('offline recovery marker')
  expect(records.tasks).toHaveLength(1)
  expect(records.tasks[0].status).toBe('done')
})

test('a narrow Chinese note stays editable after a disconnected reload', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.goto('/note')
  await page.getByRole('button', { name: '新建笔记' }).first().click()
  const editor = page.locator('.note-editor .ProseMirror')
  await editor.fill('离线恢复笔记')
  await expect.poll(async () => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration())?.active?.state,
  )).toBe('activated')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(editor).toContainText('离线恢复笔记')

  await context.setOffline(true)
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.insertText('继续编辑')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(editor).toContainText('离线恢复笔记继续编辑')
  await page.screenshot({ path: '/tmp/focusgo-offline-zh-390.png' })
})
