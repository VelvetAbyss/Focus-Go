import { expect, test } from '@playwright/test'

test('a new visitor opens the same dashboard as local port 5174', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: route.request().url().endsWith('/get-session') ? 'null' : '{}',
  }))
  await page.goto('/')

  await expect(page).toHaveTitle('Focus&go')
  expect(await page.content()).toContain('/sw.js?v=')
  await expect(page.locator('script[src="/registerSW.js"]')).toHaveCount(0)
  await expect(page.getByText('选择数据存放方式')).toHaveCount(0)
  await expect(page.getByText('仪表盘', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '本周 成果' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '待办列表' })).toBeVisible()

  const shell = page.locator('.focus-shell').first()
  await expect(shell).toBeVisible()
  expect((await shell.boundingBox())?.width).toBeGreaterThan(1100)
  expect((await page.locator('main').first().boundingBox())?.height).toBeGreaterThan(300)
})
