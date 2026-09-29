import { expect, test } from '@playwright/test'

test('a note action becomes a linked project task across views', async ({ page }) => {
  await page.goto('/note')
  const { projectId, noteId } = await page.evaluate(async () => {
    const [{ projectsRepo }, { notesRepo }] = await Promise.all([
      import('/src/data/repositories/projectsRepo.ts'),
      import('/src/data/repositories/notesRepo.ts'),
    ])
    const project = await projectsRepo.create({ title: 'Vendor workflow project' })
    const note = await notesRepo.create({
      title: 'Vendor meeting notes',
      contentMd: 'Prepare vendor report',
      collection: 'all-notes',
      tags: [`project:${project.id}`],
    })
    return { projectId: project.id, noteId: note.id }
  })
  await page.goto(`/note?note=${noteId}`)
  const editor = page.locator('.note-editor .ProseMirror')
  await expect(editor).toContainText('Prepare vendor report')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Create task' }).click()
  const dialog = page.locator('.note-task-dialog')
  await expect(dialog.getByRole('textbox', { name: 'Task title' })).toHaveValue('Prepare vendor report')
  await expect(dialog.getByLabel('Project')).toHaveValue(projectId)
  await dialog.getByRole('button', { name: 'Create and open' }).click()

  await expect(page).toHaveURL(/\/tasks\?task=[^&]+&from=/)
  const taskId = new URL(page.url()).searchParams.get('task')!
  await expect(page.locator('.task-drawer-panel')).toContainText('Prepare vendor report')
  await expect.poll(async () => page.evaluate(async ({ taskId, noteId, projectId }) => {
    const [{ tasksRepo }, { taskNoteLinksRepo }] = await Promise.all([
      import('/src/data/repositories/tasksRepo.ts'),
      import('/src/data/repositories/taskNoteLinksRepo.ts'),
    ])
    const task = (await tasksRepo.list()).find((item) => item.id === taskId)
    const links = await taskNoteLinksRepo.listByTask(taskId)
    return task?.projectId === projectId && links.some((item) => item.note.id === noteId)
  }, { taskId, noteId, projectId })).toBe(true)

  await page.getByRole('button', { name: 'Back to note' }).click()
  await expect(page).toHaveURL(`/note?note=${noteId}`)
  await expect(editor).toContainText('Prepare vendor report')

  await page.goto(`/projects/${projectId}?tab=tasks`)
  await expect(page.getByRole('tab', { name: 'Tasks' })).toHaveAttribute('aria-selected', 'true')
  const taskCard = page.locator('.task-card-shell').filter({ hasText: 'Prepare vendor report' })
  await expect(taskCard).toBeVisible()
  await taskCard.click()
  await page.locator('.task-drawer-panel').getByRole('button', { name: 'Done' }).first().click()
  await expect.poll(async () => page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((task) => task.id === id)?.status
  }, taskId)).toBe('done')
  await page.locator('.toast__action').click()
  await expect.poll(async () => page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((task) => task.id === id)?.status
  }, taskId)).toBe('todo')

  await page.goto(`/tasks?task=${taskId}`)
  await expect(page.locator('.task-drawer-panel')).toContainText('Prepare vendor report')
  await expect(page.locator('.task-drawer-panel .task-detail-status-badge')).toContainText('Todo')
})

test('the note task action stays named and usable on a narrow Chinese screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.goto('/note')
  const noteId = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.create({ title: '移动端笔记', contentMd: '跟进项目任务', collection: 'all-notes' })).id
  })
  await page.goto(`/note?note=${noteId}`)
  await expect(page.locator('.note-editor .ProseMirror')).toContainText('跟进项目任务')
  await page.getByRole('button', { name: '创建任务' }).click()
  const dialog = page.locator('.note-task-dialog')
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await expect(dialog.getByRole('textbox', { name: '任务名称' })).toBeFocused()
})
