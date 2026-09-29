import { expect, test } from '@playwright/test'

test('diary entries survive quick creation, history navigation and reload', async ({ page }) => {
  await page.goto('/diary')
  await page.locator('.diary-page__new').click()
  const editor = page.locator('.diary-page .ProseMirror')
  await expect(editor).toBeVisible()
  await editor.fill('First linked diary entry')
  const firstUrl = page.url()
  await expect(firstUrl).toMatch(/\/diary\?entry=[^&]+&view=day&date=\d{4}-\d{2}-\d{2}$/)

  await page.locator('.diary-page__new').click()
  await expect(page).not.toHaveURL(firstUrl)
  await expect(editor).toBeFocused()
  await editor.fill('Second linked diary entry')
  await expect(page.locator('.diary-page__timeline-preview').first()).toContainText('Second linked diary entry')
  const secondUrl = page.url()
  expect(secondUrl).not.toBe(firstUrl)

  await page.goBack()
  await expect(page).toHaveURL(firstUrl)
  await expect(editor).toContainText('First linked diary entry')
  await page.goForward()
  await expect(page).toHaveURL(secondUrl)
  await expect(editor).toContainText('Second linked diary entry')

  await page.reload()
  await expect(page).toHaveURL(secondUrl)
  await expect(editor).toContainText('Second linked diary entry')
  await expect(editor).toBeFocused()
})

test('command palette opens a diary entry by a durable URL', async ({ page }) => {
  await page.goto('/diary')
  await page.locator('.diary-page__new').click()
  await page.locator('.diary-page .ProseMirror').fill('Palette diary link')
  await expect(page.locator('.diary-page__timeline-preview')).toContainText('Palette diary link')
  const entryId = new URL(page.url()).searchParams.get('entry')

  await page.goto('/tasks')
  await expect(page.locator('.tasks-page')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+K')
  await page.locator('.command-palette__input-row input').fill('Palette diary link')
  await page.locator('.command-palette__item--result').filter({ hasText: 'Palette diary link' }).click()
  await expect(page).toHaveURL(new RegExp(`/diary\\?entry=${entryId}(?:&|$)`))
  await expect(page.locator('.diary-page .ProseMirror')).toContainText('Palette diary link')
  await expect(page.locator('.diary-page .ProseMirror')).toBeFocused()

  await page.goto('/diary?entry=missing-entry')
  await expect(page).toHaveURL('/diary')
  await expect(page.locator('.diary-page .ProseMirror')).toHaveCount(0)
})

test('diary link restores its period and view after reload and history navigation', async ({ page }) => {
  await page.goto('/diary?view=week&date=2026-09-22')
  await expect(page.locator('.diary-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await page.locator('.diary-page__new').click()
  await page.locator('.diary-page .ProseMirror').fill('Older week entry')
  await expect(page.locator('.diary-page__timeline-preview')).toContainText('Older week entry')
  const entryUrl = page.url()

  await page.reload()
  await expect(page).toHaveURL(entryUrl)
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.diary-page .ProseMirror')).toContainText('Older week entry')

  await page.getByRole('tab', { name: 'Month' }).click()
  await expect(page).toHaveURL(/\/diary\?view=month&date=2026-09-22$/)
  await page.goBack()
  await expect(page).toHaveURL(entryUrl)
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.diary-page .ProseMirror')).toContainText('Older week entry')
})
