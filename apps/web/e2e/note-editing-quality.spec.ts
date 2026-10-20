import { expect, test, type Page } from '@playwright/test'

test.setTimeout(60000)

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
})
const setup = async (page: Page, contentMd = 'First paragraph\n\nSecond paragraph') => {
  await page.goto('/note')
  await expect(page.locator('.note-page-shell')).toBeVisible({ timeout: 15000 })
  const id = await page.evaluate(async contentMd => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    return (await notesRepo.create({ title: 'Editing quality', contentMd, tags: [], collection: 'all-notes' })).id
  }, contentMd)
  await page.goto(`/note?note=${id}`)
  const editor = page.locator('.ProseMirror')
  await expect(editor).toContainText(contentMd.split('\n')[0].replace(/^#+ /, ''), { timeout: 15000 })
  return editor
}
const selectFirst = async (page: Page) => {
  const paragraph = page.locator('.ProseMirror p').first()
  await paragraph.click()
  await paragraph.evaluate(node => {
    const range = document.createRange()
    range.selectNodeContents(node)
    const selection = window.getSelection()!
    selection.removeAllRanges(); selection.addRange(range)
  })
  await expect(page.locator('.note-selection-menu')).toBeVisible()
}
const paste = async (page: Page, text: string, html = '') => page.locator('.ProseMirror').evaluate((node, { text, html }) => {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  if (html) clipboardData.setData('text/html', html)
  node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
}, { text, html })

for (const { width, zoom } of [{ width: 1440, zoom: 1 }, { width: 1440, zoom: 0.8 }, { width: 1440, zoom: 1.25 }, { width: 390, zoom: 1 }]) {
  test(`popover: color and link stay next to mounted anchors at ${width}px and ${zoom} document zoom`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    const editor = await setup(page, ['First paragraph', ...Array.from({ length: 60 }, (_, index) => `Context paragraph ${index}`)].join('\n\n'))
    await page.addStyleTag({ content: `.note-editor__content { zoom: ${zoom} !important; }` })
    await selectFirst(page)
    const menu = page.locator('.note-selection-menu')
    const nearAnchor = async (anchor: ReturnType<Page['locator']>, panel: ReturnType<Page['locator']>) => {
      await expect(anchor).toBeVisible()
      await expect(panel).toBeVisible()
      await expect.poll(async () => {
        const a = await anchor.boundingBox(), p = await panel.boundingBox()
        if (!a || !p) return Infinity
        const horizontalGap = Math.max(a.x - p.x - p.width, p.x - a.x - a.width, 0)
        const verticalGap = Math.max(a.y - p.y - p.height, p.y - a.y - a.height, 0)
        return Math.max(horizontalGap, verticalGap)
      }).toBeLessThan(14)
    }
    const color = menu.getByRole('button', { name: 'Text color', exact: true })
    await color.click()
    const palette = page.locator('.note-text-color-menu')
    await nearAnchor(color, palette)
    await page.locator('.note-editor__surface').evaluate(node => { node.scrollTop += 16 })
    await nearAnchor(color, palette)
    await palette.screenshot({ path: `../../artifacts/note-popover-anchor-2026-10-20/color-${width}-${zoom}.png` })
    await palette.getByRole('button', { name: 'Red', exact: false }).click()
    await expect(editor.locator('span[style*="color"]')).toHaveText('First paragraph')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First paragraph')
    const link = menu.getByRole('button', { name: 'Link', exact: true })
    await link.click()
    const input = page.getByPlaceholder('Paste a link...')
    await nearAnchor(link, page.getByRole('dialog').filter({ has: input }))
    await input.fill('https://example.com/anchor')
    await input.press('Enter')
    await expect(editor.locator('a')).toHaveText('First paragraph')
    if (width < 480) {
      const more = menu.getByRole('button', { name: 'More formatting' })
      await more.click()
      await nearAnchor(more, page.locator('.note-selection-more'))
      await page.keyboard.press('Escape')
    } else {
      const topColor = page.locator('.note-editor__topbar .note-text-color-trigger')
      await topColor.click()
      await nearAnchor(topColor, palette)
      await page.keyboard.press('Escape')
    }
    expect(errors).toEqual([])
  })
}

for (const width of [320, 390, 480, 1280]) {
  test(`toolbar: single row at ${width}px, with narrow secondary actions in More`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await setup(page)
    await selectFirst(page)
    const menu = page.locator('.note-selection-menu')
    const more = menu.getByRole('button', { name: 'More formatting' })
    if (width < 480) {
      await expect(more).toBeVisible()
      await expect(menu.getByRole('button', { name: 'Underline', exact: true })).toBeHidden()
    } else {
      await expect(more).toBeHidden()
      await expect(menu.getByRole('button', { name: 'Underline', exact: true })).toBeVisible()
    }
    const geometry = await menu.evaluate(node => {
      const box = node.getBoundingClientRect()
      const controls = Array.from(node.querySelectorAll<HTMLElement>('select, button')).filter(control => control.getClientRects().length)
      return { height: box.height, left: box.left, right: box.right,
        centers: controls.map(control => { const rect = control.getBoundingClientRect(); return rect.top + rect.height / 2 }) }
    })
    expect(geometry.height).toBeLessThanOrEqual(40)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(width)
    expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThanOrEqual(1)
    await menu.screenshot({ path: `../../artifacts/note-toolbar-2026-10-20/toolbar-${width}.png` })
    await menu.getByRole('button', { name: 'Text color', exact: true }).click()
    await page.locator('.note-text-color-menu').getByRole('button', { name: 'Red', exact: false }).click()
    await expect(page.locator('.ProseMirror span[style*="color"]')).toHaveText('First paragraph')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First paragraph')
  })
}

test('toolbar: More actions, keyboard dismissal, color and link preserve the same partial range', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const editor = await setup(page)
  await selectFirst(page)
  await editor.locator('p').first().evaluate(node => {
    const range = document.createRange()
    range.setStart(node.firstChild!, 0); range.setEnd(node.firstChild!, 5)
    const selection = window.getSelection()!
    selection.removeAllRanges(); selection.addRange(range)
  })
  const menu = page.locator('.note-selection-menu')
  await menu.getByRole('button', { name: 'More formatting' }).click()
  const more = page.locator('.note-selection-more')
  await expect(more.getByRole('button', { name: 'Underline', exact: true })).toBeFocused()
  await more.screenshot({ path: '../../artifacts/note-toolbar-2026-10-20/more.png' })
  await page.keyboard.press('ArrowDown')
  await expect(more.getByRole('button', { name: 'Strikethrough', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(more).toBeHidden()
  await expect(editor).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First')
  for (const [name, selector] of [['Underline', 'u'], ['Strikethrough', 's']] as const) {
    await menu.getByRole('button', { name: 'More formatting' }).click()
    await more.getByRole('button', { name, exact: true }).click()
    await expect(editor.locator(selector)).toHaveText('First')
    await expect(more).toBeHidden()
  }
  await menu.getByRole('button', { name: 'Text color', exact: true }).click()
  await page.locator('.note-text-color-menu').getByRole('button', { name: 'Red', exact: false }).click()
  await menu.getByRole('button', { name: 'Link', exact: true }).click()
  const input = page.getByPlaceholder('Paste a link...')
  await input.fill('https://example.com/selected')
  await input.press('Enter')
  await expect(editor.locator('a')).toHaveText('First')
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/selected')
  await expect(editor.locator('a span[style*="color"], span[style*="color"] a')).toHaveText('First')
  await expect(editor.locator('p').last()).toHaveText('Second paragraph')
  await expect(editor).toBeFocused()
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('a')).toHaveCount(0)
  await expect(editor.locator('span[style*="color"]')).toHaveText('First')
  await menu.getByRole('button', { name: 'More formatting' }).click()
  await more.getByRole('button', { name: 'Inline code', exact: true }).click()
  await expect(editor.locator('code')).toHaveText('First')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First')
})

test('toolbar: Chinese narrow menu resets color, edits and removes links, and respects outside focus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.setViewportSize({ width: 390, height: 844 })
  // Leave an exposed paragraph below the toolbar and its now-correctly
  // anchored submenu for the outside-click continuation check.
  const editor = await setup(page, ['First paragraph', ...Array(4).fill('Context paragraph'), 'Second paragraph'].join('\n\n'))
  await selectFirst(page)
  const menu = page.locator('.note-selection-menu')
  await menu.getByRole('button', { name: '文字颜色', exact: true }).click()
  await page.locator('.note-text-color-menu').getByRole('button', { name: '红色', exact: false }).click()
  await menu.getByRole('button', { name: '文字颜色', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First paragraph')
  await menu.getByRole('button', { name: '文字颜色', exact: true }).click()
  await page.locator('.note-text-color-menu').getByRole('button', { name: '默认', exact: false }).click()
  await expect(editor.locator('span[style*="color"]')).toHaveCount(0)
  const input = page.getByPlaceholder('Paste a link...')
  for (const url of ['https://example.com/first', 'https://example.com/updated']) {
    await menu.getByRole('button', { name: '链接', exact: true }).click()
    await input.fill(url)
    await input.press('Enter')
    await expect(editor.locator('a')).toHaveAttribute('href', url)
    await expect(editor.locator('a')).toHaveText('First paragraph')
  }
  await menu.getByRole('button', { name: '链接', exact: true }).click()
  await page.getByTitle('Remove link', { exact: true }).click()
  await expect(editor.locator('a')).toHaveCount(0)
  await menu.getByRole('button', { name: '更多格式' }).click()
  await editor.locator('p').last().click()
  await expect(page.locator('.note-selection-more')).toBeHidden()
  await page.keyboard.press('End')
  await page.keyboard.type(' continued')
  await expect(editor.locator('p').last()).toHaveText('Second paragraph continued')
  await expect(editor.locator('p').first()).toHaveText('First paragraph')
  await selectFirst(page)
  await page.keyboard.press('Alt+F10')
  await expect(menu.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('End')
  await expect(menu.getByRole('button', { name: '更多格式' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.note-selection-more')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect(menu.getByRole('button', { name: '下划线', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: '更多格式' })).toBeHidden()
  await menu.screenshot({ path: '../../artifacts/note-toolbar-2026-10-20/toolbar-zh-desktop.png' })
  expect(errors).toEqual([])
})

test('input: Shift+Enter preserves slash text and IME Enter does not execute an action', async ({ page }) => {
  const editor = await setup(page)
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/quote')
  await expect(page.locator('.note-command-menu')).toBeVisible()
  await page.keyboard.press('Shift+Enter')
  await expect(editor.locator('blockquote')).toHaveCount(0)
  await expect(editor).toContainText('/quote')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/h2')
  await editor.evaluate(node => {
    node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.note-command-menu')).toHaveCount(0)
  await expect(editor.locator('h2')).toHaveCount(0)
  await editor.evaluate(node => node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
  await page.keyboard.press('Escape')
  await page.keyboard.insertText(' 中文继续输入')
  await expect(editor).toContainText('中文继续输入')
})

test('selection: keyboard reaches formatting and Escape returns to the original range', async ({ page }) => {
  const editor = await setup(page)
  await selectFirst(page)
  await page.keyboard.press('Alt+F10')
  const menu = page.locator('.note-selection-menu')
  await expect(menu.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu.getByRole('button', { name: 'Bold', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(editor.locator('strong')).toHaveText('First paragraph')
  await page.keyboard.press('Escape')
  await expect(editor).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('First paragraph')
})

test('selection: link input keeps its range, ignores composing Enter and opens only on request', async ({ page }) => {
  const editor = await setup(page)
  await selectFirst(page)
  await page.locator('.note-selection-menu').getByRole('button', { name: 'Link', exact: true }).click()
  const input = page.getByPlaceholder('Paste a link...')
  await expect(input).toBeFocused()
  await input.fill('https://example.com/context')
  await input.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })))
  await expect(input).toBeVisible()
  await expect(editor.locator('a')).toHaveCount(0)
  await input.press('Enter')
  await expect(input).toBeHidden()
  await expect(editor.locator('a')).toHaveText('First paragraph')
  await editor.locator('a').click()
  await expect(input).toHaveCount(0)
  await expect(editor).toBeFocused()
})

test('blocks: duplicate and delete preserve rich containers and undo one action at a time', async ({ page }) => {
  const editor = await setup(page, 'First paragraph\n\n> **Rich block**\n>\n> Context\n\nLast paragraph')
  await editor.locator('blockquote').hover()
  await page.getByRole('button', { name: 'Block actions — drag to move' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate block', exact: true }).click()
  await expect(editor.locator('blockquote')).toHaveCount(2)
  await expect(editor.locator('blockquote strong')).toHaveText(['Rich block', 'Rich block'])
  await editor.locator('blockquote').nth(1).hover()
  await page.getByRole('button', { name: 'Block actions — drag to move' }).click()
  await page.getByRole('menuitem', { name: 'Delete block', exact: true }).click()
  await expect(editor.locator('blockquote')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('blockquote')).toHaveCount(2)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('blockquote')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Shift+Z')
  await expect(editor.locator('blockquote')).toHaveCount(2)
})

test('paste: spreadsheet replaces a range and stays separate from the next typed text', async ({ page }) => {
  const editor = await setup(page)
  await selectFirst(page)
  await paste(page, 'Name\tQty\nHose\t3')
  await expect(editor.locator('table')).toContainText('Hose')
  await expect(editor).not.toContainText('First paragraph')
  await expect(editor).toContainText('Second paragraph')
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('table')).toHaveCount(0)
  await expect(editor).toContainText('First paragraph')
  await page.keyboard.press('ControlOrMeta+Shift+Z')
  await expect(editor.locator('table')).toContainText('Hose')
  await editor.locator('p').last().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' continued')
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('table')).toContainText('Hose')
  await expect(editor).not.toContainText('continued')
})

test('paste: rich HTML retains heading, table headers, inline formatting and adjacent text', async ({ page }) => {
  const editor = await setup(page)
  await selectFirst(page)
  await paste(page, 'Rich paste', '<h2>Rich paste</h2><table><tr><th><strong>Header</strong></th><th>Qty</th></tr><tr><td><span style="color:#d44c47">Red</span></td><td>3</td></tr></table><p>After table</p>')
  await expect(editor.locator('h2')).toHaveText('Rich paste')
  await expect(editor.locator('th strong')).toHaveText('Header')
  await expect(editor.locator('td span')).toHaveCSS('color', 'rgb(212, 76, 71)')
  await expect(editor).toContainText('After table')
  await expect(editor).toContainText('Second paragraph')
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('table')).toHaveCount(0)
  await expect(editor).toContainText('First paragraph')
  await selectFirst(page)
  await paste(page, 'https://example.com/source')
  await expect(editor.locator('a')).toHaveText('First paragraph')
  await expect(page.getByPlaceholder('Paste a link...')).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('a')).toHaveCount(0)
})

test('paste: paste-without-formatting keeps spreadsheet text plain', async ({ page }) => {
  const editor = await setup(page)
  await selectFirst(page)
  await editor.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  await paste(page, 'Name\tQty\nHose\t3')
  await expect(editor.locator('table')).toHaveCount(0)
  await expect(editor).toContainText('Hose')
  await expect(editor).not.toContainText('First paragraph')
})

test('paste: an image finishes at its original range while the user continues elsewhere', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.FileReader
    window.FileReader = class extends Original {
      readAsDataURL(blob: Blob) { setTimeout(() => super.readAsDataURL(blob), 300) }
    }
  })
  const editor = await setup(page)
  await selectFirst(page)
  await editor.evaluate(node => {
    const data = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=')
    const clipboardData = new DataTransfer()
    clipboardData.items.add(new File([Uint8Array.from(data, char => char.charCodeAt(0))], 'pixel.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
  })
  await editor.locator('p').last().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' continued')
  await expect(editor.locator('img')).toHaveCount(1)
  await expect(editor).not.toContainText('First paragraph')
  await expect(editor.locator('p').last()).toContainText('Second paragraph continued')
  await expect(editor).toBeFocused()
})

test('undo: rapid typing, bold and color are three distinct reversible actions in the CRDT editor', async ({ page }) => {
  const editor = await setup(page)
  await editor.locator('p').first().click()
  await page.keyboard.press('Home')
  await page.keyboard.type('Typed ')
  await selectFirst(page)
  await page.keyboard.press('ControlOrMeta+B')
  await expect(editor.locator('strong')).toContainText('Typed')
  await page.locator('.note-selection-menu').getByRole('button', { name: 'Text color', exact: true }).click()
  await page.locator('.note-text-color-menu').getByRole('button', { name: 'Red', exact: false }).click()
  await expect(editor.locator('span[style*="color"]')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('span[style*="color"]')).toHaveCount(0)
  await expect(editor.locator('strong')).toContainText('Typed')
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor.locator('strong')).toHaveCount(0)
  await expect(editor).toContainText('Typed')
  await page.keyboard.press('ControlOrMeta+Z')
  await expect(editor).not.toContainText('Typed')
  await expect(editor).toContainText('First paragraph')
})

test('input: long-note typing stays at the caret and survives local save and reload', async ({ page }, testInfo) => {
  const text = Array.from({ length: 200 }, (_, index) => `Paragraph ${index + 1}: ${'Writing should stay continuous. '.repeat(4)}`).join('\n\n')
  const editor = await setup(page, text)
  await editor.locator('p').last().click()
  await page.keyboard.press('ControlOrMeta+End')
  await editor.evaluate(node => {
    const samples: number[] = []
    ;(window as unknown as { noteInputSamples: number[] }).noteInputSamples = samples
    node.addEventListener('beforeinput', () => {
      const start = performance.now()
      requestAnimationFrame(() => samples.push(performance.now() - start))
    })
  })
  await page.keyboard.type(' END-OF-LONG-NOTE', { delay: 30 })
  await expect(editor.locator('p').last()).toContainText('END-OF-LONG-NOTE')
  await expect.poll(() => page.evaluate(async () => {
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    const note = (await notesRepo.list()).find(note => note.id === new URL(location.href).searchParams.get('note'))
    return note?.contentMd.includes('END-OF-LONG-NOTE')
  })).toBe(true)
  await page.keyboard.type('!')
  await expect(editor.locator('p').last()).toContainText('END-OF-LONG-NOTE!')
  const samples = await page.evaluate(() => (window as unknown as { noteInputSamples: number[] }).noteInputSamples)
  const sorted = [...samples].sort((a, b) => a - b)
  await testInfo.attach('long-note-input-to-next-frame', { contentType: 'application/json', body: JSON.stringify({
    paragraphs: 200, characters: text.length, samples: samples.length,
    p50ms: sorted[Math.floor(sorted.length * .5)], p95ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))],
    note: 'Local Chromium development build; beforeinput to next animation frame, not a Notion comparison or completed paint measurement.',
  }, null, 2) })
  await page.reload()
  await expect(editor.locator('p').last()).toContainText('END-OF-LONG-NOTE!')
})
