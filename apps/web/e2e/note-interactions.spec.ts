import { expect, test, type Page } from '@playwright/test'

// Keep local editor regressions independent of the live authentication service.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
})

const createNote = async (page: Page, content = 'Follow up with the buyer') => {
  await page.goto('/note')
  const result = await page.evaluate(async (contentMd) => {
    const [{ notesRepo }, { projectsRepo }] = await Promise.all([
      import('/src/data/repositories/notesRepo.ts'), import('/src/data/repositories/projectsRepo.ts'),
    ])
    const project = await projectsRepo.create({ title: 'Editor interaction test' })
    const note = await notesRepo.create({ title: 'Interaction test', contentMd, tags: [`project:${project.id}`], collection: 'all-notes' })
    return { noteId: note.id, projectId: project.id }
  }, content)
  await page.goto(`/note?note=${result.noteId}`)
  await expect(page.locator('.note-editor .ProseMirror')).toContainText(content, { timeout: 15000 })
  return result
}

const typeCommand = async (page: Page, command: string) => {
  const editor = page.locator('.note-editor .ProseMirror')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(command)
  await expect(page.locator('.note-command-menu')).toBeVisible()
}

test('slash formatting is one undoable action and ordinary typing keeps its history', async ({ page }) => {
  await createNote(page)
  await typeCommand(page, '/quote')
  await page.getByRole('option', { name: 'Quote', exact: true }).click()
  const editor = page.locator('.note-editor .ProseMirror')
  await expect(editor.locator('blockquote')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('blockquote')).toHaveCount(0)
  await expect(editor).toContainText('/quote')
  await page.keyboard.press('ControlOrMeta+Shift+Z')
  await expect(editor.locator('blockquote')).toHaveCount(1)
  await page.keyboard.type('Quoted context')
  await expect(editor).toContainText('Quoted context')
  await expect.poll(async () => page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.list()).some((note) => note.contentMd.includes('Quoted context'))
  })).toBe(true)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor).not.toContainText('Quoted context')
  await expect(editor.locator('blockquote')).toHaveCount(1)
})

test('a waiting command preserves project and note provenance', async ({ page }) => {
  const { noteId, projectId } = await createNote(page)
  await typeCommand(page, '/waiting')
  await page.keyboard.press('Enter')
  const dialog = page.locator('.note-task-dialog')
  await dialog.getByRole('textbox', { name: 'Task title' }).fill('Wait for buyer feedback')
  await dialog.getByRole('textbox', { name: 'Waiting on', exact: true }).fill('Buyer')
  await expect(dialog.getByLabel('Project')).toHaveValue(projectId)
  await dialog.getByRole('button', { name: 'Create and open' }).click()
  await expect(page).toHaveURL(/\/tasks\?task=/)
  const taskId = new URL(page.url()).searchParams.get('task')!
  await expect.poll(async () => page.evaluate(async ({ taskId, noteId, projectId }) => {
    const [{ tasksRepo }, { taskNoteLinksRepo }] = await Promise.all([
      import('/src/data/repositories/tasksRepo.ts'), import('/src/data/repositories/taskNoteLinksRepo.ts'),
    ])
    const task = (await tasksRepo.list()).find((item) => item.id === taskId)
    const links = await taskNoteLinksRepo.listByTask(taskId)
    return task?.status === 'waiting' && task.waitingOn === 'Buyer' && task.projectId === projectId && links.some((link) => link.note.id === noteId)
  }, { taskId, noteId, projectId })).toBe(true)
})

test('canceling a task dialog restores selection, and composition Enter does not submit', async ({ page }) => {
  await createNote(page)
  const editor = page.locator('.note-editor .ProseMirror')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  const dialog = page.locator('.note-task-dialog')
  const title = dialog.getByRole('textbox', { name: 'Task title' })
  await expect(title).toHaveValue('Follow up with the buyer')
  await title.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }))
  })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/note\?note=/)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(editor).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Follow up with the buyer')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type(' — next step')
  await expect(editor).toContainText('Follow up with the buyer — next step')
})

test('Chinese reminder command works at 390px and saves an explicit reminder time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await createNote(page, '客户沟通记录')
  await typeCommand(page, '/提醒')
  await page.screenshot({ path: '../../artifacts/notion-interactions-2026-10-14/slash-menu-zh-mobile.png' })
  await page.keyboard.press('Enter')
  const dialog = page.locator('.note-task-dialog')
  await dialog.getByRole('textbox', { name: '任务名称' }).fill('提醒跟进客户')
  const reminderInput = dialog.getByLabel('提醒', { exact: true })
  await reminderInput.fill('2020-01-01T15:00')
  await dialog.getByRole('button', { name: '创建并打开' }).click()
  await expect(dialog).toBeVisible()
  expect(await reminderInput.evaluate((element: HTMLInputElement) => element.validity.rangeUnderflow)).toBe(true)
  const reminderTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  await reminderInput.fill(reminderTime)
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../../artifacts/notion-interactions-2026-10-14/reminder-dialog-zh-mobile.png' })
  await dialog.getByRole('button', { name: '创建并打开' }).click()
  await expect(page).toHaveURL(/\/tasks\?task=/)
  const taskId = new URL(page.url()).searchParams.get('task')!
  const task = await page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((item) => item.id === id)
  }, taskId)
  expect(task?.title).toBe('提醒跟进客户')
  expect(task?.reminderAt).toBeGreaterThan(Date.now())
})
