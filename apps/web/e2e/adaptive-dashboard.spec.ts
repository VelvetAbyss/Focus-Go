import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const artifacts = resolve(import.meta.dirname, '../../../artifacts/fixed-dashboard-2026-11-17')
const dimensions = [[320,568],[390,844],[430,932],[568,320],[844,390],[768,1024],[1024,768],[820,1180],[1180,820],[1280,720],[1440,900],[1920,1080],[2560,1440],[960,540],[640,360],[480,270]]
// Use fresh local browser storage. All mutations below belong to this test context.
async function seed(page: Page, all: boolean) {
  await page.route('**/api/auth/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.route('**/api/sync/**', route => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('workbench.ui.language', 'zh')
    localStorage.setItem('focusgo.dashboard.layoutLocked', 'true')
  })
  await page.goto('/')
  await expect(page.locator('.adaptive-widget').first()).toBeVisible()
  await page.evaluate(async ({ all }) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const registry = await load('/src/features/dashboard/registry.tsx')
    const labs = await load('/src/features/labs/labsApi.ts')
    await labs.ensureLabsSeed()
    if (all) for (const key of ['translation', 'bazi', 'astrology', 'tarot']) await labs.installFeature(key)
    const main = registry.getDashboardCards(), life = registry.getLifeCards((key: string) => key)
    const pack = (cards: {id:string}[], cols:number) => cards.map((card, i) => ({key:card.id,x:i%3*(cols/3),y:Math.floor(i/3)*9,w:cols/3,h:8}))
    if (all) {
      const items = structuredClone((await load('/src/data/defaultDashboardLayout.ts')).DEFAULT_DASHBOARD_LAYOUT_ITEMS)
      for (const card of main) if (!items.some((item: {key:string}) => item.key === card.id)) {
        items.push({key:card.id,x:0,y:Math.max(...items.map((item: {y:number;h:number})=>item.y+item.h)),...card.defaultSize})
      }
      await (await load('/src/data/repositories/dashboardRepo.ts')).dashboardRepo.upsert({items,hiddenCardIds:[],layoutVersion:1,themeOverride:null})
      await (await load('/src/data/repositories/lifeDashboardRepo.ts')).lifeDashboardRepo.upsert({items:pack(life,24),hiddenCardIds:[]})
    }
    const taskRepo = (await load('/src/data/repositories/tasksRepo.ts')).tasksRepo
    for (const title of ['整理本周计划', '确认下一次交付时间，并向项目伙伴同步进度', '阅读与记录今天的新想法']) await taskRepo.add({ title, status:'todo', priority:'medium' })
    await (await load('/src/data/repositories/booksRepo.ts')).booksRepo.create({source:'manual',sourceId:'adaptive-test',title:'设计中的设计',authors:['原研哉'],status:'reading',progress:35,subjects:[],lastSyncedAt:Date.now()})
    ;(await load('/src/shared/prefs/dashboardLayoutLock.ts')).writeLayoutLocked(true)
  }, {all})
  await page.reload()
  await expect(page.locator('.adaptive-widget')).toHaveCount(all ? 13 : 5)
}
async function savedLayouts(page: Page) {
  return page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    return JSON.stringify({main:await (await load('/src/data/repositories/dashboardRepo.ts')).dashboardRepo.get(),life:await (await load('/src/data/repositories/lifeDashboardRepo.ts')).lifeDashboardRepo.get()})
  })
}
async function geometry(page: Page) {
  return page.evaluate(() => {
    const route = document.querySelector<HTMLElement>('.focus-shell__route-layer')!
    const board = document.querySelector<HTMLElement>('.dashboard-overview__canvas')!.getBoundingClientRect()
    const tiles = [...document.querySelectorAll<HTMLElement>('.adaptive-widget')].map(node => {
      const r = node.getBoundingClientRect()
      return {id:node.dataset.widget,w:r.width,h:r.height,inBounds:r.left>=board.left-.5&&r.top>=board.top-.5&&r.right<=board.right+.5&&r.bottom<=board.bottom+.5}
    })
    return {width:innerWidth,height:innerHeight,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,routeOverflow:route.scrollHeight>route.clientHeight+1,tiles}
  })
}

test('all 22 widgets fit phone, tablet, desktop, portrait and landscape; each opens and returns', async ({page}) => {
  await seed(page,true)
  const before = await savedLayouts(page)
  const evidence: unknown[]=[]
  for (const [tab,count] of [['专注',13],['生活',9]] as const) {
    await page.getByRole('tab',{name:tab,exact:true}).click()
    await expect(page.locator('.adaptive-widget')).toHaveCount(count)
    for (const [width,height] of dimensions) {
      await page.setViewportSize({width,height})
      await page.waitForTimeout(180)
      const result=await geometry(page)
      evidence.push({tab,...result})
      expect(result.bodyOverflow,`${tab} ${width} horizontal overflow`).toBe(false)
      expect(result.routeOverflow,`${tab} ${width} page scroll`).toBe(false)
      expect(result.tiles.every(tile=>tile.inBounds),`${tab} ${width} off canvas`).toBe(true)
      expect(result.tiles.every(tile=>tile.w>=43 && tile.h>=43),`${tab} ${width}×${height} touch size ${JSON.stringify(result.tiles)}`).toBe(true)
    }
    await page.setViewportSize({width:390,height:844})
    const ids=await page.locator('.adaptive-widget').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.widget!))
    for (const id of ids) {
      const trigger=page.locator(`[data-widget="${id}"] > button`)
      await trigger.click()
      const detail=page.locator('.widget-detail')
      await expect(detail).toBeVisible()
      await expect(detail.locator('.adaptive-widget__host')).not.toBeEmpty()
      const bounds=await detail.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.width).toBeLessThanOrEqual(391)
      for (const [width,height] of [[320,568],[844,390],[390,844]]) {
        await page.setViewportSize({width,height})
        await page.waitForTimeout(100)
        const overflow=await detail.locator('.widget-detail__body').evaluate(node=>node.scrollWidth>node.clientWidth+1)
        expect(overflow,`${id} detail overflows at ${width}×${height}`).toBe(false)
      }
      await detail.locator('[data-widget-close]').click()
      await expect(detail).toBeHidden()
      await expect(trigger).toBeFocused()
    }
  }
  expect(await savedLayouts(page)).toEqual(before)
  mkdirSync(artifacts,{recursive:true})
  writeFileSync(resolve(artifacts,'geometry.json'),JSON.stringify(evidence,null,2))
})

test('drafts survive detail, nested editors, rotation, and returning to the overview', async ({page}) => {
  await seed(page,true)
  await page.setViewportSize({width:390,height:844})
  await page.locator('[data-widget="translation"] > button').click()
  const editor=page.locator('.widget-detail textarea').first()
  await editor.fill('请保留这一段未提交的翻译草稿。')
  await page.setViewportSize({width:844,height:390})
  await expect(editor).toHaveValue('请保留这一段未提交的翻译草稿。')
  await page.locator('.widget-detail [data-widget-close]').click()
  await page.locator('[data-widget="translation"] > button').click()
  await expect(editor).toHaveValue('请保留这一段未提交的翻译草稿。')
  await expect(page.locator('.widget-detail [data-widget-close]')).toBeFocused()
  await page.locator('.widget-detail [data-widget-close]').click()
  await page.getByRole('tab',{name:'生活',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  await page.locator('[data-widget="library"] > button').click()
  await page.locator('.widget-detail').getByRole('heading', { name: '书库', exact: true }).click()
  const nested=page.locator('.life-modal__panel')
  await expect(nested).toBeVisible()
  const search=nested.locator('input').first()
  await search.fill('触屏输入草稿')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('触屏输入草稿')
  await expect(nested.locator('..')).toHaveClass(/dialog--visible/)
  await nested.evaluate(el=>Promise.all(el.parentElement!.getAnimations({subtree:true}).map(animation=>animation.finished)))
  await page.screenshot({path:resolve(artifacts,'phone-library-editor.png')})
  await page.keyboard.press('Escape')
  await expect(nested).toBeHidden()
  await expect(page.locator('.widget-detail')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.widget-detail')).toBeHidden()
  const noteEntry=page.locator('#fg-notes-paper-stack')
  await expect(noteEntry).toBeVisible()
  await noteEntry.click()
  const noteEditor=page.locator('#fg-notes-note-text')
  await expect(noteEditor).toBeVisible()
  await noteEditor.fill('手机上的便签仍然可以编辑')
  await expect(noteEditor).toHaveValue('手机上的便签仍然可以编辑')
  await page.locator('#fg-notes-note-detail').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)))
  await page.screenshot({path:resolve(artifacts,'phone-quick-note.png')})
})

test('default desktop task cards and mobile summaries retain the working data', async ({page}) => {
  await seed(page,false)
  await page.setViewportSize({width:1920,height:1080})
  await expect(page.locator('[data-widget="tasks"]')).toHaveAttribute('data-mode','full')
  await expect(page.locator('[data-widget="tasks"] .task-card-shell')).toHaveCount(3)
  await expect(page.locator('[data-widget="tasks"] .task-card-shell').first()).toBeVisible()
  mkdirSync(artifacts,{recursive:true})
  await page.screenshot({path:resolve(artifacts,'desktop.png')})
  await page.setViewportSize({width:390,height:844})
  await expect(page.locator('[data-widget="tasks"]')).toHaveAttribute('data-mode','summary')
  await expect(page.locator('[data-widget="tasks"] .widget-glance__value')).toHaveText('3')
  await page.screenshot({path:resolve(artifacts,'phone-focus.png')})
  await page.getByRole('tab',{name:'生活',exact:true}).click()
  await expect(page.locator('[data-widget="library"] .widget-glance__value')).toHaveText('1')
  await page.screenshot({path:resolve(artifacts,'phone-life.png')})
  await page.setViewportSize({width:820,height:1180})
  await page.screenshot({path:resolve(artifacts,'tablet-life.png')})
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('tab',{name:'专注',exact:true}).click()
  await page.locator('[data-widget="tasks"] > button').click()
  await page.locator('.widget-detail .tasks-fg__input').fill('触屏创建的任务')
  await page.locator('.widget-detail .tasks-fg__add-btn').click()
  await expect(page.locator('.widget-detail .task-card-shell').filter({hasText:'触屏创建的任务'})).toBeVisible()
  await page.locator('.widget-detail [data-widget-close]').click()
  await expect(page.locator('[data-widget="tasks"] .widget-glance__value')).toHaveText('4')
})

test('short desktop weather and pay cards keep their own controls and content', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 928 })
  await page.clock.setFixedTime(new Date(2026, 10, 17, 14, 20))
  const forecastURL = 'https://api.open-meteo.com/v1/forecast?**'
  await page.addInitScript(() => {
    localStorage.setItem('focusgo.dashboard.headerScene', JSON.stringify({ mode: 'desk' }))
    localStorage.setItem('workbench.weather.autoLocation', 'false')
  })
  await page.route(forecastURL, route => route.fulfill({
    json: {
      current: {
        time: '2026-11-17T14:20', temperature_2m: 13, weather_code: 1, is_day: 1,
        apparent_temperature: 12, relative_humidity_2m: 64, wind_speed_10m: 8,
      },
      daily: {
        time: ['2026-11-17', '2026-11-18', '2026-11-19'],
        weather_code: [1, 61, 2],
        temperature_2m_max: [15, 17, 18],
        temperature_2m_min: [10, 11, 12],
        precipitation_probability_max: [0, 80, 20],
      },
    },
  }))
  await seed(page, false)
  await page.evaluate(async () => {
    const dashboardPath = '/src/data/repositories/dashboardRepo.ts'
    const salaryPath = '/src/features/salary/salaryStorage.ts'
    const { dashboardRepo } = await import(/* @vite-ignore */ dashboardPath)
    const { writeSalaryState } = await import(/* @vite-ignore */ salaryPath)
    // Match the reported three-column layout with two three-row cards.
    await dashboardRepo.upsert({
      items: [
        { key: 'salary-earned', x: 0, y: 0, w: 3, h: 3 },
        { key: 'world_clock', x: 0, y: 3, w: 3, h: 6 },
        { key: 'tasks', x: 3, y: 0, w: 6, h: 9 },
        { key: 'weather', x: 9, y: 0, w: 3, h: 3 },
        { key: 'widget-todos', x: 9, y: 3, w: 3, h: 6 },
      ],
      hiddenCardIds: ['spend', 'task-progress-summary'], layoutVersion: 1, themeOverride: null,
    })
    writeSalaryState({
      settings: {
        monthlySalary: 12_000, currency: 'CNY', workStart: 540, workEnd: 1080,
        lunch: { start: 720, end: 780 }, workdays: [1, 2, 3, 4, 5], payday: 30,
        followCnHolidays: false,
      },
      breaks: [], wishlist: [], activeBreakStartAt: null,
    })
  })
  await page.reload()
  await expect(page.locator('.adaptive-widget')).toHaveCount(5)
  const weather = page.locator('[data-widget="weather"]')
  const pay = page.locator('[data-widget="salary-earned"]')
  const forecast = weather.getByRole('tablist', { name: '三日预报' })
  const refreshWeather = weather.getByRole('button', { name: '重新加载天气' })
  const paySettings = pay.getByRole('button', { name: '计薪设置' })
  const before = await savedLayouts(page)

  for (const [width, height] of [[1920, 928], [1920, 872], [1440, 900], [1440, 840]]) {
    await test.step(`Both cards fit at ${width}×${height}`, async () => {
      await page.setViewportSize({ width, height })
      await expect(weather.locator('.weather-sky')).toBeInViewport()
      await expect(forecast).toBeInViewport({ ratio: 1 })
      await expect(pay.locator('.salary-earned__amount')).toBeInViewport({ ratio: 1 })
      await expect(pay.getByText(/^今日预计/)).toBeInViewport({ ratio: 1 })
      await expect(pay.getByText(/距发薪/)).toBeInViewport({ ratio: 1 })
      await expect(paySettings).toBeInViewport({ ratio: 1 })
      expect((await geometry(page)).routeOverflow).toBe(false)
    })
  }
  await page.setViewportSize({ width: 1920, height: 928 })
  await expect(pay.locator('.salary-grid--day')).toBeInViewport({ ratio: 1 })
  const tomorrow = forecast.getByRole('tab', { name: /^明天/ })
  await tomorrow.click()
  await expect(tomorrow).toHaveAttribute('aria-selected', 'true')
  await expect(weather.locator('.weather-card__temp-value')).toHaveText('17')
  await Promise.all([page.waitForResponse(forecastURL), refreshWeather.click()])
  await paySettings.click()
  const payDialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: '计薪设置', exact: true }),
  })
  await expect(payDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(payDialog).toBeHidden()

  for (const [width, height] of [[390, 844], [820, 1180]]) {
    await page.setViewportSize({ width, height })
    await expect(weather.getByRole('button', { name: '展开天气', exact: true })).toBeVisible()
    await expect(weather.locator('.weather-card')).toBeHidden()
    await expect(pay.locator('.salary-card--earned')).toBeHidden()
  }
  await page.setViewportSize({ width: 1920, height: 928 })
  await expect(tomorrow).toHaveAttribute('aria-selected', 'true')
  expect(await savedLayouts(page)).toEqual(before)
})
