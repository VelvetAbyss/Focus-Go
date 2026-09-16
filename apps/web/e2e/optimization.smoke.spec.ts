import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // All remote services are isolated; no production account or user data is used.
  await page.route('https://**/*', (route) => route.fulfill({ status: route.request().url().endsWith('/get-session') ? 200 : 503, contentType: 'application/json', body: route.request().url().endsWith('/get-session') ? 'null' : '{}' }))
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: route.request().url().endsWith('/get-session') ? 'null' : '{}' }))
})

test('guest starts a real ten-minute focus, reloads and completes without duplicate tasks', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('What will you work on?').fill('Write the opening paragraph')
  await page.getByRole('button', { name: 'Start 10-minute focus' }).click()
  await expect(page.locator('.first-focus').getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.first-focus').getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  // Move wall time forward without waiting ten minutes in CI.
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 601_000 })
  await expect(page.getByText('You made 10 minutes of progress.')).toBeVisible()
  const rows = await page.evaluate(() => new Promise<{ tasks: unknown[]; sessions: Array<{ plannedMinutes: number; status: string; taskId: string }> }>((resolve, reject) => {
    const request = indexedDB.open('workbench-app')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['tasks', 'focus_sessions'])
      const tasks = transaction.objectStore('tasks').getAll()
      const sessions = transaction.objectStore('focus_sessions').getAll()
      transaction.oncomplete = () => { resolve({ tasks: tasks.result, sessions: sessions.result }); db.close() }
      transaction.onerror = () => { reject(transaction.error); db.close() }
    }
  }))
  expect(rows.tasks).toHaveLength(1)
  expect(rows.sessions).toHaveLength(1)
  expect(rows.sessions[0]).toMatchObject({ plannedMinutes: 10, status: 'completed' })
  expect(rows.sessions[0].taskId).toBe((rows.tasks[0] as { id: string }).id)
})

test('mobile navigation leaves room for tasks and all view controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 })
  await page.goto('/tasks')
  await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible()
  const layout = await page.evaluate(() => ({
    top: document.querySelector('.focus-shell__main')!.getBoundingClientRect().top,
    tabs: [...document.querySelectorAll('.tasks-page-shell__tab')].map((node) => ({ right: node.getBoundingClientRect().right, height: node.getBoundingClientRect().height })),
  }))
  expect(layout.top).toBeLessThan(120)
  expect(layout.tabs).toHaveLength(4)
  for (const tab of layout.tabs) { expect(tab.right).toBeLessThanOrEqual(320); expect(tab.height).toBeGreaterThanOrEqual(44) }
  for (const control of await page.locator('.tasks-fg__mode-tab, .tasks-fg__status-tab').all()) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
  expect((await page.locator('.tasks-fg__composer--hero input.tasks-fg__input').boundingBox())!.width).toBeGreaterThan(140)
  const composer = (await page.locator('.tasks-fg__composer-section').boundingBox())!
  const content = (await page.locator('.tasks-fg__content').boundingBox())!
  expect(composer.y).toBeLessThan(500)
  expect(composer.y + composer.height).toBeLessThanOrEqual(content.y)
  await page.screenshot({ path: '../../docs/plans/evidence/2026-09-09-webapp-execution/tasks-320.png' })
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({ path: '../../docs/plans/evidence/2026-09-09-webapp-execution/tasks-768.png' })
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click()
  await expect(page.locator('#focus-primary-navigation')).toBeVisible()
})

test('failed auth shows recovery and an unknown route has an accessible way home', async ({ page }) => {
  await page.route('**/get-session', (route) => route.abort('failed'))
  await page.goto('/missing-page')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.unroute('**/get-session')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to workspace' }).click()
  await expect(page.getByLabel('What will you work on?')).toBeVisible()
})
