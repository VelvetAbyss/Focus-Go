import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const artifactRoot = resolve(process.cwd(), '../../artifacts/typography-system-2026-10-15')
const captures: unknown[] = []
const pages = [
  ['/', '.recap-card .card__title', 'section'],
  ['/timeline', '.timeline-page h1', 'page'],
  ['/tasks', '.tasks-page-shell__title', 'page'],
  ['/projects', '.pj-title', 'page'],
  ['/note', '.note-page__unselected h2', 'section'],
  ['/calendar', '.calendar-main-title', 'page'],
  ['/trips', '.trips-journal__title', 'page'],
  ['/focus', '.focus-zip-history h2', 'section'],
  ['/diary', '.diary-page__title', 'page'],
  ['/habits', '.hb-header__title', 'page'],
  ['/labs', '.labs-page__title', 'page'],
  ['/workspace/settings', '.page-title', 'page'],
  ['/support', '.page-title', 'page'],
  ['/admin', '.admin-deck__title', 'page'],
  ['/typography-not-found', '.type-page-title', 'page'],
  ['/workspace/settings/legal/privacy-policy', '.page-title', 'page'],
  ['/workspace/settings/legal/terms-of-service', '.page-title', 'page'],
] as const

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
})

const capture = async (page: Page, name: string) => {
  const directory = resolve(artifactRoot, 'screens')
  mkdirSync(directory, { recursive: true })
  await page.screenshot({ path: resolve(directory, `${name}.png`), fullPage: true, animations: 'disabled' })
}

const metrics = (page: Page, selector: string) => page.locator(selector).first().evaluate(element => {
  const style = getComputedStyle(element)
  const shell = document.querySelector('.focus-shell') as HTMLElement
  return {
    text: element.textContent?.trim(), font: style.fontFamily, size: style.fontSize,
    weight: style.fontWeight, leading: style.lineHeight, tracking: style.letterSpacing,
    scale: shell.style.getPropertyValue('--shell-scale'),
    overlay: getComputedStyle(document.documentElement).getPropertyValue('--overlay-scale').trim(),
    overflow: document.documentElement.scrollWidth > innerWidth,
    width: element.getBoundingClientRect().width,
  }
})

test.afterEach(() => {
  if (captures.length === 0) return
  mkdirSync(artifactRoot, { recursive: true })
  writeFileSync(resolve(artifactRoot, 'page-metrics.json'), JSON.stringify(captures, null, 2))
})

for (const profile of [
  { name: 'zh-1512-light', lang: 'zh', width: 1512, height: 858, dark: false },
  { name: 'zh-390-light', lang: 'zh', width: 390, height: 844, dark: false },
  { name: 'en-1920-light', lang: 'en', width: 1920, height: 956, dark: false },
  { name: 'zh-1512-dark', lang: 'zh', width: 1512, height: 858, dark: true },
]) {
  test(`all route title roles and responsive scale remain coherent: ${profile.name}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: profile.width, height: profile.height })
    await page.addInitScript(lang => localStorage.setItem('workbench.ui.language', lang), profile.lang)
    for (const [route, selector, role] of pages) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 })
      if (profile.dark) await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark')
        document.documentElement.classList.add('dark')
      })
      await page.waitForTimeout(350)
      const result = await metrics(page, selector)
      captures.push({ profile: profile.name, route, role, ...result })
      expect(result.font).not.toContain('Instrument Serif')
      expect(result.font).not.toContain('Noto Serif')
      expect(result.size).toBe(role === 'page' ? '32px' : '18px')
      expect(result.weight).toBe('600')
      expect(result.leading).toBe(role === 'page' ? '40px' : '25.2px')
      expect(result.tracking).toBe('normal')
      expect(result.scale).toBe(profile.width >= 1920 || profile.width < 768 ? '1' : '0.8')
      expect(result.overlay).toBe(result.scale)
      expect(result.overflow, `page overflow on ${route}`).toBe(false)
      if (profile.width < 768 && route === '/calendar') {
        const grid = page.locator('.calendar-month-grid')
        await expect(grid).toHaveCSS('display', 'grid')
        expect((await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ')).toHaveLength(7)
      }
      if (profile.width < 768 && route === '/focus') {
        const noise = await page.locator('.focus-zip-app__column--left').boundingBox()
        const timer = await page.locator('.focus-zip-app__column--center').boundingBox()
        expect(timer?.width).toBeLessThan(profile.width)
        expect(timer!.y + timer!.height).toBeLessThanOrEqual(noise!.y + 1)
      }
      await capture(page, `${profile.name}-${route.replaceAll('/', '_') || 'dashboard'}`)
    }
  })
}

const seed = async (page: Page) => {
  await page.goto('/note')
  await expect(page.locator('.note-page-shell')).toBeVisible()
  return page.evaluate(async () => {
    const { projectsRepo } = await import('/src/data/repositories/projectsRepo.ts')
    const { tasksRepo } = await import('/src/data/repositories/tasksRepo.ts')
    const { notesRepo } = await import('/src/data/repositories/notesRepo.ts')
    const { tripsRepo } = await import('/src/features/trips/tripsRepo.ts')
    const project = await projectsRepo.create({ title: '统一排版 · 客户跟进', description: '在同一处整理项目与行动。', status: 'active' })
    const task = await tasksRepo.add({ title: '确认下一步行动 Follow up', description: '记录上下文，并确认交付时间。', status: 'todo', priority: 'medium', projectId: project.id, isToday: true })
    const note = await notesRepo.create({ title: '排版记录', contentMd: '# 排版记录\n\n中文与 English 的正文。\n\n## 下一步\n\n- 确认时间\n- 整理资料', tags: [], collection: 'all-notes' })
    const trip = await tripsRepo.create({ title: '杭州出行 Travel plan', destination: '杭州' })
    return { project: project.id, task: task.id, note: note.id, trip: trip.id }
  })
}

test('populated detail titles, task views and user content remain distinct', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  const ids = await seed(page)
  for (const [route, selector] of [
    [`/projects/${ids.project}`, '.pd-hero__title'],
    [`/trips/${ids.trip}`, '[data-type-role="page"]'],
    [`/tasks?task=${ids.task}`, '.task-detail-title-input'],
  ]) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 })
    const value = await metrics(page, selector)
    captures.push({ profile: 'populated', route, ...value })
    expect(value.size).toBe('32px')
    expect(value.weight).toBe('600')
    expect(value.leading).toBe('40px')
    if (route.startsWith('/projects/')) {
      await expect(page.locator('.pd-focus-card h2')).toHaveCSS('font-size', '18px')
      await expect(page.locator('.pd-focus-card h2')).toHaveCSS('font-weight', '600')
    }
    await capture(page, `detail-${route.replaceAll('/', '_').replaceAll('?', '_')}`)
  }
  await page.goto(`/note?note=${ids.note}`)
  await expect(page.locator('.ProseMirror h2')).toContainText('下一步')
  await capture(page, 'populated-note')
  await page.goto('/tasks')
  for (const label of ['卡片', '今日', '看板', '分析']) {
    await page.getByRole('tab', { name: label, exact: true }).click()
    await expect(page.locator('.tasks-page-shell__title')).toBeVisible()
    await capture(page, `tasks-view-${label}`)
  }
})

test('settings sections and project/habit dialogs use shared roles', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.goto('/workspace/settings')
  for (const label of ['外观', '体验', '天气', '连接', '数据', '法务', '反馈']) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${label}`) })
    await tab.click()
    await page.waitForTimeout(300)
    await capture(page, `settings-${label}`)
  }
  await page.goto('/projects')
  await page.getByRole('button', { name: '新建项目', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('h2').first()).toHaveCSS('font-size', '18px')
  await expect(dialog.locator('h2').first()).toHaveCSS('font-weight', '600')
  await capture(page, 'project-dialog')
  await page.keyboard.press('Escape')
  await page.goto('/habits')
  await page.getByRole('button', { name: '添加新习惯', exact: true }).click()
  await expect(page.locator('.habit-dialog__title')).toBeVisible()
  await expect(page.locator('.habit-dialog__title')).toHaveCSS('font-size', '18px')
  await capture(page, 'habit-dialog')
})

test('calendar, note appearance and trip dialogs retain common heading metrics', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.goto('/calendar')
  await page.getByRole('button', { name: '订阅', exact: true }).click()
  await page.getByRole('button', { name: '添加订阅', exact: true }).click()
  let modal = page.getByRole('dialog').last()
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('heading').first()).toHaveCSS('font-size', '18px')
  await capture(page, 'calendar-subscription-dialog')
  await page.keyboard.press('Escape')
  const ids = await seed(page)
  await page.goto(`/note?note=${ids.note}`)
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '外观', exact: true }).click()
  const appearance = page.locator('[data-note-floating-panel="appearance"]')
  await expect(appearance).toBeVisible()
  await expect(appearance.getByRole('heading')).toHaveCSS('font-size', '18px')
  await appearance.getByRole('button', { name: 'Serif', exact: true }).click()
  await expect(page.locator('.ProseMirror')).toHaveCSS('font-family', /Source Serif 4/)
  await capture(page, 'note-appearance-user-serif')
  const zoom = appearance.locator('input[type=range]').last()
  await zoom.focus()
  await zoom.press('ArrowRight')
  await expect(page.locator('.note-editor__content')).toHaveCSS('zoom', '1.05')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.note-editor__content')).toHaveCSS('zoom', '1.05')
  await page.goto('/trips')
  await page.getByRole('button', { name: '新建旅行', exact: true }).click()
  modal = page.getByRole('dialog').last()
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('heading').first()).toHaveCSS('font-size', '18px')
  await expect(modal.getByRole('heading').first()).toHaveCSS('font-weight', '600')
  await capture(page, 'trip-template-dialog')
})

test('Life and News dashboard views use operating typography with controlled news data', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  const headers = { 'access-control-allow-origin': 'http://127.0.0.1:5191', 'access-control-allow-credentials': 'true' }
  await page.route('**/news/sources', route => route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ sources: [{ id: 'hackernews', name: '排版检查来源', category: 'tech', type: 'hottest', interval: 60000, home: 'https://example.com', accent: '#3a3733' }] }) }))
  await page.route('**/news/source?**', route => route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ status: 'success', id: 'hackernews', updatedTime: Date.now(), items: [{ id: 'type-1', title: '中文与 English 混排的信息列表', url: 'https://example.com/article' }] }) }))
  await page.goto('/')
  await expect(page.locator('.recap-card')).toBeVisible()
  await page.locator('.dash-toolbar__tab').filter({ hasText: '生活' }).click()
  await expect(page.locator('.life-dashboard')).toBeVisible()
  await page.waitForTimeout(1000)
  await capture(page, 'dashboard-life')
  await page.locator('.dash-toolbar__tab').filter({ hasText: '资讯' }).click()
  await expect(page.locator('.news-dashboard')).toBeVisible()
  await expect(page.getByText('中文与 English 混排的信息列表')).toBeVisible({ timeout: 15_000 })
  await capture(page, 'dashboard-news-controlled-fixture')
})


test('admin read-only fixture panels render shared typography', async ({ page }) => {
  test.setTimeout(90_000)
  const headers = { 'access-control-allow-origin': 'http://127.0.0.1:5191', 'access-control-allow-credentials': 'true' }
  const overview = { totals: { totalUsers: 1, premiumUsers: 0, active7dCount: 1, active30dCount: 1 }, users: [], syncTotals: { grandTotalPayloadBytes: 0, blobCount: 0, blobTotalBytes: 0 }, server: { uptimeSeconds: 3600, loadAvg1: 0.1, loadAvg5: 0.1, loadAvg15: 0.1, totalMemBytes: 1000000, freeMemBytes: 600000, usedMemBytes: 400000, processRssBytes: 100000, dbFileSizeBytes: 1000 } }
  const analytics = { summary: { totalUsers: 1, newUsers7d: 1, newUsers30d: 1, userGrowth7d: 0, userGrowth30d: 0, premiumUsers: 0, payingUsers: 0, paidOrders: 0, paidRate: 0, paidConversionRate: 0, active7dRate: 1, active30dRate: 1, revenueByCurrency: {} }, series: [], funnels: { registeredUsers: 1, activeUsers30d: 1, orderUsers: 0, paidUsers: 0 }, channels: [] }
  await page.route('**/admin/**', route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/admin/') && !path.startsWith('/api/admin/')) return route.fallback()
    const value = path.endsWith('/overview') ? overview : path.endsWith('/analytics') ? analytics : path.endsWith('/orders') ? { total: 0, orders: [], summary: [] } : { total: 0, feedback: [] }
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) })
  })
  await page.addInitScript(() => localStorage.setItem('workbench.ui.language', 'zh'))
  await page.goto('/admin')
  await expect(page.locator('.admin-kpi-card').first()).toBeVisible()
  for (const label of ['总览', '增长', '用户', '订单', '服务端', '用户反馈']) {
    await page.locator('.admin-tab').filter({ hasText: new RegExp(`^${label}$`) }).click()
    await page.waitForTimeout(400)
    await capture(page, `admin-controlled-fixture-${label}`)
  }
})
