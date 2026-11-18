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


test('reading through a tag preserves its four cards, search, context history and list scroll', async ({ page }) => {
  await page.goto('/note')
  const first = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    const { noteTagsRepo } = await import('/src/data/repositories/noteTagsRepo.ts')
    await noteTagsRepo.create({ name: 'Lowes', icon: 'tag', pinned: false, sortOrder: 20 })
    let id = ''
    for (let n = 0; n < 18; n++) {
      const title = 'Audit note ' + String(n).padStart(2, '0')
      const note = await notesRepo.create({ title, contentMd: '# ' + title + '\n\n' + 'Plain body. '.repeat(35) + 'amber lighthouse ' + n, tags: n < 4 ? ['Lowes'] : [] })
      if (n === 0) id = note.id
    }
    return id
  })
  await page.goto('/note?note=' + first)
  const browser = page.locator('.note-page-column--browser')
  const editor = page.locator('.note-editor .ProseMirror')
  const lowes = page.getByRole('button', { name: 'Lowes', exact: true })
  await lowes.click()
  const cards = browser.locator('.note-card')
  await expect(cards).toHaveCount(4)
  for (const n of ['01', '02']) {
    await browser.getByRole('button', { name: 'Audit note ' + n, exact: true }).click()
    await expect(editor).toContainText('Audit note ' + n)
    await expect(cards).toHaveCount(4)
    await expect(browser.getByText('Lowes', { exact: true }).first()).toBeVisible()
  }
  await page.goBack()
  await expect(editor).toContainText('Audit note 01')
  await expect(cards).toHaveCount(4)
  await page.goForward()
  await expect(editor).toContainText('Audit note 02')
  await expect(cards).toHaveCount(4)
  const search = browser.getByRole('textbox')
  await search.fill('amber lighthouse 3')
  await expect(cards).toHaveCount(1)
  await search.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(editor).toContainText('Audit note 03')
  await expect(search).toHaveValue('amber lighthouse 3')
  await expect(cards).toHaveCount(1)
  await search.fill('absent query')
  await expect(cards).toHaveCount(0)
  await expect(editor).toHaveCount(0)
  await search.press('Escape')
  await expect(cards).toHaveCount(4)
  await page.locator('.note-page-column--sidebar').getByRole('button', { name: /^Notes \d+/i }).click()
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(18)
  const list = browser.locator('.overflow-y-auto')
  await list.evaluate(node => { node.scrollTop = node.scrollHeight })
  const lastVisible = cards.filter({ hasText: 'Audit note' }).last()
  const lastTitle = await lastVisible.locator('h4').innerText()
  const offset = await list.evaluate(node => node.scrollTop)
  expect(offset).toBeGreaterThan(0)
  await lastVisible.getByRole('button', { name: lastTitle, exact: true }).click()
  await expect(editor).toContainText(lastTitle)
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(offset - 5)
})

test('tag drops add a label and trash previews are read only and recoverable', async ({ page }) => {
  const { noteId, projectId } = await createNote(page, 'Keep the most recent edit')
  await page.evaluate(async () => {
    const { noteTagsRepo } = await import('/src/data/repositories/noteTagsRepo.ts')
    await noteTagsRepo.create({ name: 'QA review', icon: 'tag', sortOrder: 30 })
  })
  await page.reload()
  const sidebar = page.locator('.note-page-column--sidebar')
  const browser = page.locator('.note-page-column--browser')
  const editor = page.locator('.note-editor .ProseMirror')
  const card = browser.locator('.note-card').filter({ hasText: 'Interaction test' })
  await card.dragTo(sidebar.getByRole('button', { name: 'QA review', exact: true }))
  await expect.poll(() => page.evaluate(async (id) => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.list()).find(n => n.id === id)?.tags
  }, noteId)).toEqual(expect.arrayContaining(['project:' + projectId, 'QA review']))
  await card.hover()
  await card.getByRole('button', { name: 'Move to trash' }).click()
  await sidebar.getByRole('button', { name: /^Trash\s+1$/ }).click()
  await browser.getByRole('button', { name: 'Interaction test', exact: true }).click()
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await expect(page.locator('.note-editor__toolbar-wrap [role=toolbar]')).toHaveCount(0)
  await expect(browser.getByRole('button', { name: 'New note' })).toHaveCount(0)
  await card.hover()
  let prompt = ''
  page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss() })
  await card.getByRole('button', { name: 'Delete permanently' }).click()
  expect(prompt).toContain('Interaction test')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Restore' }).click()
  await expect(sidebar.getByRole('button', { name: /^Trash\s+0$/ })).toBeVisible()
  await sidebar.getByRole('button', { name: 'QA review', exact: true }).click()
  await expect(editor).toHaveAttribute('contenteditable', 'true')
  await expect(editor).toContainText('Keep the most recent edit')
})

test('keyboard navigation reaches virtualized cards and sorting dismisses normally', async ({ page }) => {
  await page.goto('/note')
  const id = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    let first = ''
    for (let i = 0; i < 55; i++) {
      const title = 'Virtual card ' + String(i).padStart(2, '0')
      const note = await notesRepo.create({ title, contentMd: title })
      if (!first) first = note.id
    }
    return first
  })
  await page.goto('/note?note=' + id)
  const browser = page.locator('.note-page-column--browser')
  const search = browser.getByRole('textbox')
  const sort = browser.getByRole('button', {name:/Sort by/})
  await sort.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await sort.click()
  await search.click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await sort.click()
  await page.getByRole('menuitemradio', {name:'Title', exact:true}).click()
  await search.fill('Virtual card')
  await search.press('ArrowDown')
  await expect(browser.getByRole('button', {name:'Virtual card 00', exact:true})).toBeFocused()
  await page.keyboard.press('End')
  const last = browser.getByRole('button', {name:'Virtual card 54', exact:true})
  await expect(last).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.note-editor .ProseMirror')).toHaveText('Virtual card 54')
  await expect(search).toHaveValue('Virtual card')
  await page.getByRole('button', {name:'Clear search', exact:true}).click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')
})

test('Markdown export and reimport retain checked items, link destinations and text color', async ({ page }, testInfo) => {
  await page.goto('/note')
  const id = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    const contentJson = { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting checklist' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Review draft', marks: [
          { type: 'link', attrs: { href: 'https://example.com/review' } },
          { type: 'textStyle', attrs: { color: '#337ea9' } },
        ] }] },
      ] }] },
    ] }
    return (await notesRepo.create({ title: 'Meeting checklist', contentMd: '# Meeting checklist\n\n- Review draft', contentJson })).id
  })
  await page.goto('/note?note=' + id)
  const editor = page.locator('.note-editor .ProseMirror')
  await expect(editor.locator('input[type=checkbox]')).toBeChecked()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Markdown.*\.md/ }).click()
  const file = await download
  const path = testInfo.outputPath(file.suggestedFilename())
  await file.saveAs(path)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles(path)
  await page.getByRole('button', { name: 'Import 1', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('note')).not.toBe(id)
  await expect(editor.locator('input[type=checkbox]')).toBeChecked()
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/review')
  await expect(editor.locator('span[style*="color"]')).toHaveText('Review draft')
})
