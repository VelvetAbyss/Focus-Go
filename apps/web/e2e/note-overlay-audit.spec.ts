import { expect, test, type Page, type Locator } from '@playwright/test'

test.setTimeout(60000)
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
})
const setup = async (page: Page, width: number, zoom: number) => {
  await page.setViewportSize({ width, height: 844 })
  await page.goto('/note')
  const id = await page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.create({ title: 'Overlay audit', contentMd: ['First paragraph', ...Array.from({ length: 40 }, (_, i) => `Context paragraph ${i}`)].join('\n\n'), tags: [], collection: 'all-notes' })).id
  })
  await page.goto(`/note?note=${id}`)
  await expect(page.locator('.ProseMirror')).toContainText('First paragraph', { timeout: 20000 })
  const style = await page.addStyleTag({ content: `.note-editor__content { zoom: ${zoom} !important; }` })
  await style.evaluate(node => { node.id = 'note-audit-zoom' })
}
const selectFirst = async (page: Page) => {
  const p = page.locator('.ProseMirror p').first()
  await p.click()
  await p.evaluate(node => {
    const range = document.createRange(); range.selectNodeContents(node)
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
}
const insideViewport = async (page: Page, locator: Locator) => {
  await expect(locator).toBeVisible()
  await expect.poll(async () => {
    const box = await locator.boundingBox(), viewport = page.viewportSize()!
    return box ? Math.max(-box.x, -box.y, box.x + box.width - viewport.width, box.y + box.height - viewport.height, 0) : Infinity
  }, { message: locator.toString() }).toBeLessThanOrEqual(2)
}
const near = async (anchor: Locator, panel: Locator) => {
  await expect(anchor).toBeVisible()
  await expect(panel).toBeVisible()
  await expect.poll(async () => {
    const a = await anchor.boundingBox(), p = await panel.boundingBox()
    return a && p ? Math.max(a.x - p.x - p.width, p.x - a.x - a.width, a.y - p.y - p.height, p.y - a.y - a.height, 0) : Infinity
  }).toBeLessThan(18)
}

for (const [width, zoom] of [[1440, 0.7], [960, 1.5], [390, 1.5], [320, 0.7]]) {
  test(`audit top formats, highlight and page panels ${width}/${zoom}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await setup(page, width, zoom)
    const toolbar = page.locator('.note-editor__toolbar-inline')
    await expect.poll(async () => (await toolbar.boundingBox())?.width ?? 0).toBeGreaterThan(80)
    for (const label of ['Format text as heading', 'List options']) {
      await selectFirst(page)
      const trigger = toolbar.getByRole('button', { name: label, exact: true })
      await trigger.scrollIntoViewIfNeeded(); await trigger.click()
      const panel = page.locator('.tiptap-dropdown-menu-content')
      await insideViewport(page, panel); await near(trigger, panel)
      await page.keyboard.press('Escape')
      await expect(page.locator('.ProseMirror')).toBeFocused()
      await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe('First paragraph')
    }
    for (const [label, selector] of [['Format text as heading', 'h1'], ['List options', 'ul']] as const) {
      await selectFirst(page)
      const trigger = toolbar.getByRole('button', { name: label, exact: true })
      await trigger.scrollIntoViewIfNeeded(); await trigger.click()
      await page.locator('.tiptap-dropdown-menu-content').getByRole('menuitem').first().click()
      await expect(page.locator(`.ProseMirror ${selector}`)).toContainText('First paragraph')
      await expect(page.locator('.ProseMirror')).toBeFocused()
      await page.keyboard.press('ControlOrMeta+Z')
      await expect(page.locator(`.ProseMirror ${selector}`)).toHaveCount(0)
    }
    await selectFirst(page)
    const highlight = toolbar.getByRole('button', { name: 'Highlight text', exact: true })
    await highlight.scrollIntoViewIfNeeded(); await highlight.click()
    const colors = page.getByRole('dialog', { name: 'Highlight colors' })
    await insideViewport(page, colors); await near(highlight, colors)
    await colors.getByRole('button', { name: /Yellow.*highlight color/i }).click()
    await expect(page.locator('.ProseMirror mark')).toHaveText('First paragraph')
    await expect(colors).toBeHidden()
    await expect(page.locator('.ProseMirror')).toBeFocused()
    await selectFirst(page)
    const link = toolbar.getByRole('button', { name: 'Link', exact: true })
    await link.scrollIntoViewIfNeeded(); await link.click()
    const input = page.getByPlaceholder('Paste a link...')
    const linkPanel = page.getByRole('dialog').filter({ has: input })
    await insideViewport(page, linkPanel); await near(link, linkPanel)
    await input.fill('https://example.com/audit'); await input.press('Enter')
    await expect(page.locator('.ProseMirror a')).toHaveText('First paragraph')
    for (const id of ['info', 'appearance', 'export', 'import']) {
      await selectFirst(page)
      await page.locator(`.note-editor [data-note-panel-trigger="${id}"]`).click()
      const panel = page.locator(`[data-note-floating-panel="${id}"][data-state="open"]`)
      await insideViewport(page, panel)
      if (id === 'info') {
        await page.setViewportSize({ width, height: 600 })
        await insideViewport(page, panel)
        await page.setViewportSize({ width, height: 844 })
      }
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
      await expect(page.locator('.ProseMirror')).toBeFocused()
      await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe('First paragraph')
    }
    expect(errors).toEqual([])
  })

  test(`audit block handle, slash and selection geometry ${width}/${zoom}`, async ({ page }) => {
    await setup(page, width, zoom)
    const editor = page.locator('.ProseMirror')
    await selectFirst(page)
    const rangeRect = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().toJSON())
    const selectionMenu = page.locator('.note-selection-menu')
    await insideViewport(page, selectionMenu)
    const menuBox = (await selectionMenu.boundingBox())!
    expect(Math.max(rangeRect.top - menuBox.y - menuBox.height, menuBox.y - rangeRect.bottom, 0)).toBeLessThan(22)
    expect(Math.max(0, Math.min(menuBox.y + menuBox.height, rangeRect.bottom) - Math.max(menuBox.y, rangeRect.top))).toBeLessThanOrEqual(1)
    await page.evaluate(() => window.scrollBy(0, 24))
    await expect.poll(async () => {
      const range = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().toJSON())
      const box = (await selectionMenu.boundingBox())!
      const gap = Math.max(range.top - box.y - box.height, box.y - range.bottom, 0)
      const overlap = Math.max(0, Math.min(box.y + box.height, range.bottom) - Math.max(box.y, range.top))
      return gap < 22 && overlap <= 1
    }).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.keyboard.press('Escape')
    await editor.locator('p').nth(3).hover()
    const handle = page.getByRole('button', { name: 'Block actions — drag to move' })
    const paragraph = (await editor.locator('p').nth(3).boundingBox())!
    const h = (await handle.boundingBox())!
    expect(Math.abs(h.y - paragraph.y)).toBeLessThan(8)
    await handle.click()
    const blockMenu = page.locator('.note-block-tools__menu')
    await near(handle, blockMenu); await insideViewport(page, blockMenu)
    await page.keyboard.press('Escape')
    await expect(editor).toBeFocused()
    await editor.locator('p').nth(8).click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('/')
    const slash = page.locator('.note-command-menu')
    await insideViewport(page, slash)
    const caret = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().toJSON())
    const s = (await slash.boundingBox())!
    expect(Math.max(caret.top - s.y - s.height, s.y - caret.bottom, 0)).toBeLessThan(24)
    await page.keyboard.press('Escape')
    await expect(slash).toHaveCount(0)
  })
}

for (const width of [1440, 320]) {
  test(`audit keyboard, backward selection and fullscreen at ${width}`, async ({ page }) => {
    await setup(page, width, 1)
    await selectFirst(page)
    const toolbar = page.locator('.note-editor__toolbar-inline')
    const heading = toolbar.getByRole('button', { name: 'Format text as heading', exact: true })
    await heading.scrollIntoViewIfNeeded(); await heading.hover()
    const tooltip = page.getByRole('tooltip')
    await insideViewport(page, tooltip); await near(heading, tooltip)
    await heading.focus(); await page.keyboard.press('ArrowRight')
    await expect(toolbar.getByRole('button', { name: 'List options', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(toolbar.getByRole('button', { name: 'Add image', exact: true })).toBeFocused()
    await page.keyboard.press('Home'); await expect(heading).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.tiptap-dropdown-menu-content')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ProseMirror')).toBeFocused()
    await selectFirst(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.note-selection-menu')).toBeHidden()
    await page.keyboard.press('Alt+F10')
    await expect(page.locator('.note-selection-menu').getByRole('combobox')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ProseMirror')).toBeFocused()
    await page.locator('.ProseMirror p').first().evaluate(node => getSelection()!.setBaseAndExtent(node, node.childNodes.length, node, 0))
    await page.locator('[data-note-panel-trigger="appearance"]').click()
    const panel = page.locator('[data-note-floating-panel="appearance"][data-state="open"]')
    await panel.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => page.evaluate(() => {
      const selection = getSelection()!, range = selection.getRangeAt(0)
      return selection.toString() === 'First paragraph' && selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
    })).toBe(true)
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
    await expect(page.locator('.note-page[data-fullscreen="true"]')).toBeVisible()
    await selectFirst(page)
    await insideViewport(page, page.locator('.note-selection-menu'))
    await page.locator('[data-note-panel-trigger="export"]').click()
    await insideViewport(page, page.locator('[data-note-floating-panel="export"][data-state="open"]'))
    await page.keyboard.press('Escape')
    await expect(page.locator('.note-page[data-fullscreen="true"]')).toBeVisible()
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
    await expect(page.locator('.note-page[data-fullscreen="false"]')).toBeVisible()
    await page.locator('.note-editor').screenshot({ path: `../../artifacts/note-overlay-audit-2026-10-20/editor-${width}.png` })
  })

  test(`audit task dialog, actual appearance zoom and image controls at ${width}`, async ({ page }) => {
    await setup(page, width, 1)
    await selectFirst(page)
    await page.getByRole('button', { name: 'Create task', exact: true }).click()
    const task = page.locator('.note-task-dialog')
    await insideViewport(page, task)
    await expect(task.getByRole('textbox', { name: 'Task title' })).toHaveValue('First paragraph')
    await page.keyboard.press('Escape')
    await expect(page.locator('.ProseMirror')).toBeFocused()
    await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe('First paragraph')
    // Use the product's slider, not the injected geometry fixture.
    await page.locator('#note-audit-zoom').evaluate(node => node.remove())
    await page.locator('[data-note-panel-trigger="appearance"]').click()
    const appearance = page.locator('[data-note-floating-panel="appearance"][data-state="open"]')
    const zoom = appearance.getByRole('slider', { name: 'Zoom', exact: true })
    await zoom.focus(); await zoom.press('End')
    await expect(zoom).toHaveValue('150')
    await appearance.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => page.locator('.note-editor__content').evaluate(node => getComputedStyle(node).zoom)).toBe('1.5')
    const toolbar = page.locator('.note-editor__toolbar-inline')
    const addImage = toolbar.getByRole('button', { name: 'Add image', exact: true })
    await addImage.scrollIntoViewIfNeeded(); await addImage.click()
    const uploader = page.locator('.tiptap-image-upload')
    await insideViewport(page, uploader)
    await uploader.locator('input[type="file"]').setInputFiles({ name: 'audit.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#448361"/></svg>') })
    const image = page.locator('.note-editor__image-frame')
    await expect(image).toBeVisible()
    await image.locator('img').click()
    await insideViewport(page, image)
    const handle = page.getByRole('button', { name: 'Resize image se' })
    await expect(handle).toBeVisible()
    const before = (await image.boundingBox())!, h = (await handle.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down(); await page.mouse.move(h.x - 40, h.y, { steps: 4 }); await page.mouse.up()
    await expect.poll(async () => (await image.boundingBox())!.width).toBeLessThan(before.width - 10)
    await page.getByRole('textbox', { name: 'Image caption' }).fill('Caption survives zoom')
    await expect(page.getByRole('textbox', { name: 'Image caption' })).toHaveValue('Caption survives zoom')
  })
}

test('audit failed image paste keeps toolbar and editing surface usable', async ({ page }) => {
  await setup(page, 390, 1)
  await selectFirst(page)
  await page.locator('.ProseMirror').evaluate(node => {
    FileReader.prototype.readAsDataURL = function () { this.dispatchEvent(new ProgressEvent('error')) }
    const clipboardData = new DataTransfer()
    clipboardData.items.add(new File([new Uint8Array([1, 2, 3])], 'failure.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
  })
  const error = page.locator('.note-editor__paste-error')
  await expect(error).toBeVisible()
  expect((await page.locator('.note-editor__topbar').boundingBox())!.height).toBeLessThan(100)
  expect((await page.locator('.note-editor__surface').boundingBox())!.height).toBeGreaterThan(100)
  await error.getByRole('button').click()
  await expect(error).toHaveCount(0)
  await page.locator('.ProseMirror p').first().click(); await page.keyboard.press('End')
  await page.keyboard.type(' recovered')
  await expect(page.locator('.ProseMirror p').first()).toHaveText('First paragraph recovered')
})
