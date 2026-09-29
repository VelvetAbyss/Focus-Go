import { expect, test } from '@playwright/test'

const percentile95 = (samples: number[]) => {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

test('fixed personal-workflow dataset records search, view, editor and save latency', async ({ page }) => {
  test.setTimeout(180_000)
  page.on('pageerror', (error) => console.error('PERFORMANCE_PAGE_ERROR', error.message))
  page.on('console', (message) => { if (message.type() === 'error') console.error('PERFORMANCE_CONSOLE_ERROR', message.text()) })
  await page.route('http://127.0.0.1:1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'en'))
  await page.goto('/tasks')
  await expect(page.locator('.tasks-page')).toBeVisible()
  const ids = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('workbench-app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const now = Date.now()
    const transaction = database.transaction(['projects', 'tasks', 'notes'], 'readwrite')
    for (let index = 0; index < 10; index++) {
      transaction.objectStore('projects').put({
        id: `perf-project-${index}`, title: `Perf project ${index + 1}`, description: '', goal: '',
        status: 'planning', priority: 'medium', health: 'on-track', progress: 0,
        nextAction: '', riskSummary: '', createdAt: now, updatedAt: now,
      })
    }
    for (let index = 0; index < 50; index++) {
      transaction.objectStore('tasks').put({
        id: `perf-task-${index}`, title: `Perf task ${String(index + 1).padStart(2, '0')}`,
        description: '', pinned: false, isToday: false, status: index % 5 === 0 ? 'doing' : 'todo',
        priority: 'medium', projectId: `perf-project-${index % 10}`, tags: [], subtasks: [],
        taskNoteBlocks: [], taskNoteContentMd: '', taskNoteContentJson: null, activityLogs: [],
        createdAt: now, updatedAt: now,
      })
    }
    for (let index = 0; index < 30; index++) {
      const contentMd = index === 0 ? '# Long note\n\n' + 'Performance sample paragraph.\n\n'.repeat(400) : `Short note ${index + 1}`
      transaction.objectStore('notes').put({
        id: `perf-note-${index}`, title: `Perf note ${String(index + 1).padStart(2, '0')}`,
        contentMd, contentJson: null, editorMode: 'document', collection: 'all-notes',
        tags: [], pinned: false, excerpt: contentMd.slice(0, 100),
        wordCount: 0, charCount: 0, paragraphCount: 0, imageCount: 0, fileCount: 0,
        headings: [], backlinks: [], deletedAt: null, createdAt: now, updatedAt: now,
      })
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
    return { longNoteId: 'perf-note-0', shortNoteId: 'perf-note-1' }
  })
  await page.reload()
  await expect(page.locator('.tasks-page')).toBeVisible()

  const searchMs: number[] = []
  const searchInput = page.locator('.command-palette__input-row input')
  for (let index = 0; index < 20; index++) {
    const start = Date.now()
    await page.keyboard.press('ControlOrMeta+K')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Perf task 01')
    await expect(page.locator('.command-palette__item--result').filter({ hasText: 'Perf task 01' }).first()).toBeVisible()
    searchMs.push(Date.now() - start)
    await page.keyboard.press('Escape')
  }

  const viewMs: number[] = []
  const tabs = page.getByRole('tablist', { name: 'Tasks page view' })
  for (let index = 0; index < 20; index++) {
    const target = tabs.getByRole('tab', { name: index % 2 === 0 ? 'Board' : 'Cards' })
    const start = Date.now()
    await target.click()
    await expect(target).toHaveAttribute('aria-selected', 'true')
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    viewMs.push(Date.now() - start)
  }

  const editorOpenMs: number[] = []
  for (let index = 0; index < 10; index++) {
    await page.goto(`/note?note=${ids.shortNoteId}`)
    await expect(page.locator('.note-editor .ProseMirror')).toBeVisible()
    const start = Date.now()
    await page.goto(`/note?note=${ids.longNoteId}`)
    await expect(page.locator('.note-editor .ProseMirror')).toContainText('Performance sample paragraph.')
    editorOpenMs.push(Date.now() - start)
  }

  const saveMs: number[] = []
  const editorInputMs: number[] = []
  const persistMs: number[] = []
  const editor = page.locator('.note-editor .ProseMirror')
  for (let index = 0; index < 10; index++) {
    const marker = `Saved performance marker ${index}`
    const start = Date.now()
    await editor.fill(`${marker}\n\n` + 'Performance sample paragraph.\n\n'.repeat(400))
    const inputDoneAt = Date.now()
    await expect.poll(async () => page.evaluate(async (id) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('workbench-app')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const content = await new Promise<string>((resolve, reject) => {
        const request = database.transaction('notes', 'readonly').objectStore('notes').get(id)
        request.onsuccess = () => resolve(request.result?.contentMd ?? '')
        request.onerror = () => reject(request.error)
      })
      database.close()
      return content
    }, ids.longNoteId)).toContain(marker)
    editorInputMs.push(inputDoneAt - start)
    persistMs.push(Date.now() - inputDoneAt)
    saveMs.push(Date.now() - start)
  }

  const report = {
    kind: 'local automation baseline; includes Playwright protocol overhead',
    build: process.env.PERF_PREVIEW === '1' ? 'production preview' : 'development server',
    dataset: { projects: 10, tasks: 50, notes: 30, longNoteParagraphs: 400 },
    samples: { searchMs, viewMs, editorOpenMs, editorInputMs, persistMs, saveMs },
    p95Ms: {
      search: percentile95(searchMs),
      view: percentile95(viewMs),
      editorOpen: percentile95(editorOpenMs),
      editorInput: percentile95(editorInputMs),
      persist: percentile95(persistMs),
      save: percentile95(saveMs),
    },
  }
  await test.info().attach('performance-baseline.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
  console.log('FOCUSGO_PERFORMANCE_BASELINE', JSON.stringify(report))
  // Generous local regression limits, not Notion-comparability targets.
  expect(report.p95Ms.search).toBeLessThan(300)
  expect(report.p95Ms.view).toBeLessThan(700)
  expect(report.p95Ms.editorOpen).toBeLessThan(4_500)
  expect(report.p95Ms.editorInput).toBeLessThan(7_500)
  expect(report.p95Ms.persist).toBeLessThan(3_000)
  expect(report.p95Ms.save).toBeLessThan(9_000)
})
