import { expect, test } from '@playwright/test'

test('task links reopen on refresh and follow browser history', async ({ page }) => {
  await page.goto('/tasks')
  await expect(page.locator('.tasks-page')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+K')
  await page.locator('.command-palette__input-row input').fill('Linked task QA')
  await page.getByRole('option', { name: /Create task Linked task QA/ }).click()
  const card = page.locator('.task-card-shell').filter({ hasText: 'Linked task QA' })
  await expect(card).toBeVisible()
  await card.click()

  await expect(page).toHaveURL(/\/tasks\?task=[^&]+$/)
  await expect(page.locator('.task-drawer-panel')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.locator('.task-drawer-panel')).toHaveCount(0)

  await page.goForward()
  await expect(page.locator('.task-drawer-panel')).toBeVisible()
  await page.reload()
  await expect(page.locator('.task-drawer-panel')).toBeVisible()
})

test('note links restore the selected editor through history and refresh', async ({ page }) => {
  await page.goto('/note')
  await expect(page.locator('.note-page')).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).first().click()
  const editor = page.locator('.ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.type('First linked note')
  await expect(page.locator('.note-page-column--browser')).toContainText('First linked note')
  const firstUrl = page.url()
  expect(firstUrl).toMatch(/\/note\?note=[^&]+$/)

  await page.getByRole('button', { name: 'New note' }).first().click()
  await expect(editor).not.toContainText('First linked note')
  await editor.click()
  await page.keyboard.type('Second linked note')
  await expect(page.locator('.note-page-column--browser')).toContainText('Second linked note')
  const secondUrl = page.url()
  expect(secondUrl).not.toBe(firstUrl)

  await page.goBack()
  await expect(page).toHaveURL(firstUrl)
  await expect(editor).toContainText('First linked note')

  await page.goForward()
  await expect(page).toHaveURL(secondUrl)
  await expect(editor).toContainText('Second linked note')

  await page.reload()
  await expect(editor).toContainText('Second linked note')
})
