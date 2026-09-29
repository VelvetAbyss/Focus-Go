import { expect, test } from '@playwright/test'

test('personal workflow stays connected with a realistic local dataset', async ({ page }) => {
  test.setTimeout(120_000)
  const taskTitle = 'Workflow baseline captured task'
  const noteText = 'Workflow baseline reference context for this task'
  const continuation = 'Follow-up decision recorded after finding the note'
  const startedAt = Date.now()
  const checkpoints: Record<string, number> = {}
  let actions = 0
  const acted = () => { actions += 1 }

  await page.goto('/tasks')
  await expect(page.locator('.tasks-page')).toBeVisible()
  const seedStartedAt = Date.now()
  await page.evaluate(async () => {
    const [{ projectsRepo }, { tasksRepo }, { notesRepo }] = await Promise.all([
      import('/src/data/repositories/projectsRepo.ts'),
      import('/src/data/repositories/tasksRepo.ts'),
      import('/src/data/repositories/notesRepo.ts'),
    ])
    const projects = []
    for (let index = 0; index < 10; index += 1) {
      projects.push(await projectsRepo.create({ title: `Benchmark project ${String(index + 1).padStart(2, '0')}` }))
    }
    await Promise.all(Array.from({ length: 50 }, (_, index) => tasksRepo.add({
      title: `Benchmark task ${String(index + 1).padStart(2, '0')}`,
      status: index % 5 === 0 ? 'doing' : 'todo',
      priority: 'medium',
      projectId: projects[index % projects.length].id,
    })))
    await Promise.all(Array.from({ length: 30 }, (_, index) => notesRepo.create({
      title: `Benchmark note ${String(index + 1).padStart(2, '0')}`,
      contentMd: index === 0 ? '# Long reference\n\n' + 'A sample paragraph for editor load.\n\n'.repeat(400) : `Note ${index + 1} reference`,
      collection: 'all-notes',
    })))
  })
  checkpoints.seedMs = Date.now() - seedStartedAt
  await page.reload()
  await expect(page.locator('.tasks-page')).toBeVisible()
  expect(await page.evaluate(async () => (await (await import('/src/data/repositories/tasksRepo.ts')).tasksRepo.list()).length)).toBe(50)

  const captureStartedAt = Date.now()
  acted(); await page.keyboard.press('ControlOrMeta+K')
  acted(); await page.locator('.command-palette__input-row input').fill(taskTitle)
  acted(); await page.getByRole('option', { name: new RegExp(`Create task ${taskTitle}`) }).click()
  await expect(page.locator('.task-card-shell').filter({ hasText: taskTitle })).toBeVisible()
  checkpoints.captureMs = Date.now() - captureStartedAt

  const noteStartedAt = Date.now()
  acted(); await page.locator('.task-card-shell').filter({ hasText: taskTitle }).click()
  const taskUrl = page.url()
  await expect(taskUrl).toMatch(/\/tasks\?task=[^&]+$/)
  const taskId = new URL(taskUrl).searchParams.get('task')!
  acted(); await page.getByRole('button', { name: 'New note' }).click()
  acted(); await page.locator('.task-drawer-panel').getByRole('button', { name: 'More' }).last().click()
  acted(); await page.getByRole('button', { name: 'Open in Notes' }).click()
  await expect(page).toHaveURL(/\/note\?note=[^&]+&from=/)
  const noteId = new URL(page.url()).searchParams.get('note')!
  acted(); await page.locator('.note-editor .ProseMirror').fill(noteText)
  await expect.poll(async () => page.evaluate(async (id) => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.list()).find((note) => note.id === id)?.contentMd ?? ''
  }, noteId)).toContain(noteText)
  acted(); await page.getByRole('button', { name: 'Back to task' }).click()
  await expect(page).toHaveURL(taskUrl)
  await expect(page.locator('.task-drawer-panel')).toBeVisible()

  acted(); await page.keyboard.press('ControlOrMeta+K')
  acted(); await page.locator('.command-palette__input-row input').fill(noteText)
  acted(); await page.locator('.command-palette__item--result').filter({ hasText: noteText }).click()
  await expect(page).toHaveURL(new RegExp(`/note\\?note=${noteId}(?:&|$)`))
  const foundEditor = page.locator('.note-editor .ProseMirror')
  await expect(foundEditor).toContainText(noteText)
  await expect(foundEditor).toBeFocused()
  acted(); await foundEditor.press('End')
  acted(); await foundEditor.press('Enter')
  acted(); await foundEditor.type(continuation)
  await expect.poll(async () => page.evaluate(async (id) => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.list()).find((note) => note.id === id)?.contentMd ?? ''
  }, noteId)).toContain(continuation)
  await page.goBack()
  await expect(page).toHaveURL(taskUrl)
  await expect(page.locator('.task-drawer-panel')).toBeVisible()
  checkpoints.noteRoundTripMs = Date.now() - noteStartedAt

  const focusStartedAt = Date.now()
  acted(); await page.locator('.task-drawer-panel').getByRole('button', { name: /^Focus$/ }).click()
  await expect(page).toHaveURL(/\/focus\?from=/)
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('focusgo.pendingTaskId'))).toBe(taskId)
  acted(); await page.getByRole('button', { name: 'Back to task' }).click()
  await expect(page).toHaveURL(taskUrl)
  await expect.poll(async () => page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((task) => task.id === id)?.status
  }, taskId)).toBe('doing')
  checkpoints.focusRoundTripMs = Date.now() - focusStartedAt

  const recoveryStartedAt = Date.now()
  acted(); await page.locator('.task-drawer-panel').getByRole('button', { name: 'Done' }).first().click()
  await expect(page.locator('.toast__action')).toBeVisible()
  await expect.poll(async () => page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((task) => task.id === id)?.status
  }, taskId)).toBe('done')
  acted(); await page.locator('.toast__action').click()
  await expect.poll(async () => page.evaluate(async (id) => {
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    return (await tasksRepo.list()).find((task) => task.id === id)?.status
  }, taskId)).toBe('doing')
  checkpoints.completionUndoMs = Date.now() - recoveryStartedAt

  const baseline = { dataset: { projects: 10, tasks: 50, notes: 30, longNoteParagraphs: 400 }, actions, checkpoints, totalMs: Date.now() - startedAt }
  await test.info().attach('personal-workflow-baseline.json', { body: JSON.stringify(baseline, null, 2), contentType: 'application/json' })
  console.log('PERSONAL_WORKFLOW_BASELINE', JSON.stringify(baseline))
})
