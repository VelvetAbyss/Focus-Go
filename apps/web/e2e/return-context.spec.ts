import { expect, test } from '@playwright/test'

test('project note returns to the same filtered notes tab', async ({ page }) => {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Create First Project' }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Return context project')
  await page.getByRole('button', { name: 'Create Project' }).click()
  await page.getByText('Return context project').click()
  await page.getByRole('tab', { name: 'Notes' }).click()

  await page.getByRole('button', { name: /Create your first note/ }).click()
  await expect(page).toHaveURL(/\/note\?note=[^&]+&from=/)
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')

  await page.getByPlaceholder('Search notes').fill('Return context')
  await expect(page).toHaveURL(/[?&]q=Return(?:\+|%20)context/)
  await page.locator('.pd-note-card__open').click()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByPlaceholder('Search notes')).toHaveValue('Return context')
  await expect(page.locator('.pd-note-card')).toHaveCount(1)
  await expect(page.locator('.pd-note-card__open')).toBeFocused()
})

test('linked note and focus return to the selected task', async ({ page }) => {
  await page.goto('/tasks')
  await expect(page.locator('.tasks-page')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+K')
  await page.locator('.command-palette__input-row input').fill('Return context task')
  await page.getByRole('option', { name: /Create task Return context task/ }).click()
  await page.locator('.task-card-shell').filter({ hasText: 'Return context task' }).click()
  const taskUrl = page.url()
  await expect(taskUrl).toMatch(/\/tasks\?task=[^&]+$/)

  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.task-drawer-panel').getByRole('button', { name: 'More' }).last().click()
  await page.getByRole('button', { name: 'Open in Notes' }).click()
  await expect(page).toHaveURL(/\/note\?note=[^&]+&from=/)
  await page.getByRole('button', { name: 'Back to task' }).click()
  await expect(page).toHaveURL(taskUrl)
  await expect(page.locator('.task-drawer-panel')).toBeVisible()
  await expect(page.locator('.task-drawer-panel').getByRole('button', { name: 'Close' })).toBeFocused()

  await page.locator('.task-drawer-panel').getByRole('button', { name: /^Focus$/ }).click()
  await expect(page).toHaveURL(/\/focus\?from=/)
  await page.getByRole('button', { name: 'Back to task' }).click()
  await expect(page).toHaveURL(taskUrl)
  await expect(page.locator('.task-drawer-panel')).toBeVisible()
})

test('project notes restore their scroll position after opening a note', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 })
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Create First Project' }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Scrolled project')
  await page.getByRole('button', { name: 'Create Project' }).click()
  await page.getByText('Scrolled project').click()
  await page.getByRole('tab', { name: 'Notes' }).click()
  const projectId = new URL(page.url()).pathname.split('/').at(-1)!

  await page.evaluate(async (id) => {
    const path = '/src/data/repositories/notesRepo.ts'
    const { notesRepo } = await import(path)
    for (let index = 0; index < 24; index += 1) {
      await notesRepo.create({ title: `Scroll note ${index}`, contentMd: '', collection: 'all-notes', tags: [`project:${id}`] })
    }
  }, projectId)
  await page.reload()
  const lastCard = page.locator('.pd-note-card__open').last()
  await expect(page.locator('.pd-note-card')).toHaveCount(24)
  await lastCard.scrollIntoViewIfNeeded()
  const scrollPane = page.locator('.focus-shell__route-layer')
  const before = await scrollPane.evaluate((node) => node.scrollTop)
  expect(before).toBeGreaterThan(0)

  await lastCard.click()
  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.locator('.pd-note-card')).toHaveCount(24)
  await expect.poll(() => scrollPane.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0)
  await expect(lastCard).toBeFocused()
})
