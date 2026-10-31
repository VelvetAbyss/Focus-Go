import { expect, test, type Page } from '@playwright/test'

test('a new visitor opens the same dashboard as local port 5174', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: route.request().url().endsWith('/get-session') ? 'null' : '{}',
  }))
  await page.goto('/')

  await expect(page).toHaveTitle('Focus&go')
  await expect(page.locator('meta[name="focusgo-release"]')).toHaveAttribute('content', /^[a-f0-9]{7,40}$/i)
  await expect(page.locator('script[src="/registerSW.js"]')).toHaveCount(0)
  await expect(page.getByText('选择数据存放方式')).toHaveCount(0)
  await expect(page.getByText('仪表盘', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '本周成果' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '待办列表' })).toBeVisible()

  // These dynamic CSS chunks were missing in the reported broken layout.
  await expect(page.locator('.recap-card__stats')).toHaveCSS('display', 'grid')
  await expect(page.locator('.weather-sky')).toHaveCSS('position', 'absolute')
  await expect(page.locator('.wc-hero')).toHaveCSS('position', 'relative')
  await expect(page.getByRole('button', { name: '新建视图' })).toBeVisible()

  const shell = page.locator('.focus-shell').first()
  await expect(shell).toBeVisible()
  expect((await shell.boundingBox())?.width).toBeGreaterThan(1100)
  expect((await page.locator('main').first().boundingBox())?.height).toBeGreaterThan(300)
})

async function expectNoteToCloseInPlace(page: Page) {
  const detail = page.locator('#fg-notes-note-detail')
  await expect(detail).toBeVisible()
  await detail.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
  const motion = await page.evaluate(() => {
    const source = document.querySelector<HTMLElement>('.dashboard-notes .paper-stack[aria-expanded="true"]')!
    const detail = document.querySelector<HTMLElement>('#fg-notes-note-detail')!
    const point = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y }
    }
    const from = point(detail), target = point(source), previous = new Set(source.getAnimations())
    document.querySelector<HTMLButtonElement>('#fg-notes-close-note')!.click()
    const animation = source.getAnimations().find(candidate => !previous.has(candidate))
    if (!animation) throw new Error('The note did not animate closed')
    animation.pause()
    const duration = Number(animation.effect!.getTiming().duration)
    const samples = [0, .05, .25, .5, .75, .99, 1].map(progress => {
      animation.currentTime = duration * progress
      return point(source)
    })
    animation.finish()
    return { from, target, samples }
  })
  // Inspect the rendered animation, not just its final resting position.
  expect(Math.abs(motion.samples[0].x - motion.from.x)).toBeLessThan(3)
  expect(Math.abs(motion.samples[0].y - motion.from.y)).toBeLessThan(3)
  for (const sample of motion.samples) {
    for (const axis of ['x', 'y'] as const) {
      expect(sample[axis]).toBeGreaterThanOrEqual(Math.min(motion.from[axis], motion.target[axis]) - 3)
      expect(sample[axis]).toBeLessThanOrEqual(Math.max(motion.from[axis], motion.target[axis]) + 3)
    }
  }
  expect(Math.abs(motion.samples.at(-1)!.x - motion.target.x)).toBeLessThan(3)
  expect(Math.abs(motion.samples.at(-1)!.y - motion.target.y)).toBeLessThan(3)
  await expect(detail).toBeHidden()
  return motion
}

test.describe('hanging note close animation', () => {
  test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })

  for (const zoom of ['default', '1.1']) {
    test(`returns hanging and pinned notes without jumping at ${zoom} zoom`, async ({ page }) => {
      await page.route('**/api/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: route.request().url().includes('get-session') ? 'null' : '{}',
      }))
      await page.goto('/')
      const stack = page.locator('#fg-notes-paper-stack')
      await expect(stack).toBeVisible()
      if (zoom !== 'default') await page.locator('.focus-shell').evaluate((el, zoom) => { (el as HTMLElement).style.zoom = zoom }, zoom)
      // Stop wind only; keep the closing animation enabled for exact geometry checks.
      await page.locator('#fg-notes-pause').evaluate(el => (el as HTMLButtonElement).click())
      await stack.click({ force: true })
      await page.locator('#fg-notes-note-text').fill('关闭动画回归')
      await expectNoteToCloseInPlace(page)

      await stack.click({ force: true })
      await page.locator('#fg-notes-placement-action').click()
      const pinned = page.locator('.loose-note')
      await expect(pinned).toBeVisible()
      await pinned.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
      const rect = (await pinned.boundingBox())!
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
      await page.mouse.down()
      await page.mouse.move(1410, 540, { steps: 18 })
      await page.mouse.up()
      // Let the drag's accidental-click suppression expire before opening.
      await page.waitForTimeout(300)
      // The side edge forces the full editor away from its thumbnail position.
      await pinned.click({ force: true })
      const motion = await expectNoteToCloseInPlace(page)
      expect(Math.abs(motion.from.x - motion.target.x)).toBeGreaterThan(20)
    })
  }
})
