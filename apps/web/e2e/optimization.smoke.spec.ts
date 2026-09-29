import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // All remote services are isolated; no production account or user data is used.
  await page.route('https://**/*', (route) => route.fulfill({ status: route.request().url().endsWith('/get-session') ? 200 : 503, contentType: 'application/json', body: route.request().url().endsWith('/get-session') ? 'null' : '{}' }))
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: route.request().url().endsWith('/get-session') ? 'null' : '{}' }))
})

test('local workspace opens, saves a task, and restores it after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start using it now' }).click()
  await expect(page.getByRole('main', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/tasks')
  const composer = page.locator('.tasks-fg__composer--hero input.tasks-fg__input')
  await composer.fill('Write the opening paragraph')
  await composer.press('Enter')
  await expect(page.getByText('Write the opening paragraph', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Write the opening paragraph', { exact: true })).toBeVisible()
})

test('mobile navigation leaves room for tasks and all view controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 })
  await page.goto('/tasks')
  await page.getByRole('button', { name: 'Start using it now' }).click()
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
  expect(content.y).toBeLessThan(composer.y)
  await page.screenshot({ path: '../../docs/plans/evidence/2026-09-09-webapp-execution/tasks-320.png' })
  await page.locator('.tasks-fg__composer--hero input.tasks-fg__input').scrollIntoViewIfNeeded()
  await expect(page.locator('.tasks-fg__composer--hero input.tasks-fg__input')).toBeInViewport()
  await page.screenshot({ path: '../../docs/plans/evidence/2026-09-09-webapp-execution/tasks-composer-320.png' })
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({ path: '../../docs/plans/evidence/2026-09-09-webapp-execution/tasks-768.png' })
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click()
  await expect(page.locator('#focus-primary-navigation')).toBeVisible()
})

test('failed auth shows recovery and an unknown route has an accessible way home', async ({ page }) => {
  await page.route('**/get-session', (route) => route.abort('failed'))
  await page.goto('/missing-page')
  await page.getByRole('button', { name: 'Sign in and sync' }).click()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.unroute('**/get-session')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('404', { exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page).toHaveURL('http://focusgo-smoke.localhost:5198/')
})
