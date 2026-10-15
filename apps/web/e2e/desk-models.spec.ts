import { expect, test, type Page } from '@playwright/test'

const storage = 'focusgo.dashboard.desk'
const pose = { a1: -0.18, a2: 1.59, a3: -1.51 }
const seed = async (page: Page, items: object[]) => {
  await page.route('**/api/auth/get-session', r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.addInitScript(({ storage, items, pose }) => {
    if (!sessionStorage.getItem('desk-seeded')) {
      localStorage.setItem(storage, JSON.stringify({ lampOn: false, lampX: 1.95, pose, items, note: false }))
      sessionStorage.setItem('desk-seeded', '1')
    }
  }, { storage, items, pose })
  await page.goto('/')
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status', 'ready')
}
const settings = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storage)
const point = (page: Page, x: number, y: number) => page.locator('.dash-desk').evaluate((el, {x,y}) => {
  const desk = el as HTMLElement, r = desk.getBoundingClientRect(), h = desk.closest('header')!
  const zoom = r.width / desk.offsetWidth, unit = Math.round(Math.min(60, desk.offsetHeight / 2.45) * 100) / 100
  return { x: h.getBoundingClientRect().left + Math.round(h.offsetWidth / 2) * zoom + x * unit * zoom,
    y: r.bottom - (3.5 + y * unit) * zoom }
}, {x,y})

test('all production models render, animate, and switch ink theme without shader errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGL|GL_INVALID/.test(m.text())) errors.push(m.text()) })
  await page.goto('/e2e/fixtures/desk-models.html')
  await page.waitForFunction(() => 'deskAudit' in window)
  await expect(page.locator('#labels span')).toHaveCount(10)
  await page.locator('#act').click()
  await page.waitForTimeout(900)
  await page.locator('#angle').click()
  await page.locator('#theme').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '.artifacts/desk-models-dark.png' })
  await page.locator('#theme').click()
  await page.locator('#angle').click()
  await page.screenshot({ path: '.artifacts/desk-models-side.png' })
  expect(errors).toEqual([])
})

test('free drag saves the imported candle; pointer cancellation restores it', async ({ page }) => {
  await seed(page, [{ id:'candle-a',kind:'candle',x:-3 }])
  const from = await point(page,-3,0.38)
  await page.mouse.move(from.x,from.y)
  await page.mouse.down()
  await page.mouse.move(from.x+65,from.y,{steps:15})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).items[0].x).toBeGreaterThan(-2)
  const moved = (await settings(page)).items[0].x
  await page.reload()
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).items[0].x).toBe(moved)
  const next = await point(page,moved,0.38)
  await page.mouse.move(next.x,next.y)
  await page.mouse.down()
  await page.mouse.move(next.x-55,next.y,{steps:10})
  await page.locator('canvas.dash-desk__canvas').dispatchEvent('pointercancel',{pointerId:1})
  await page.mouse.up()
  expect((await settings(page)).items[0].x).toBe(moved)
})

test('picker accepts repeated instances of every kind and credits remain accessible', async ({ page }) => {
  await seed(page, [])
  await page.locator('.dash-desk').hover()
  await page.locator('.dash-desk__control').nth(1).click()
  const add = page.locator('[aria-labelledby="desk-picker-add"] button')
  for(let i=0;i<9;i++) await add.nth(i).click()
  await add.nth(8).click()
  await expect.poll(async()=>(await settings(page)).items.length).toBe(10)
  expect((await settings(page)).items.filter((i:{kind:string})=>i.kind==='candle')).toHaveLength(2)
  expect(new Set((await settings(page)).items.map((i:{id:string})=>i.id)).size).toBe(10)
  await expect(page.locator('a[href="/licenses/desk-models.txt"]')).toBeVisible()
  const credit = await page.request.get('/licenses/desk-models.txt')
  expect(await credit.text()).toContain('Pat Siefring')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  await page.screenshot({path:'.artifacts/desk-dashboard-all.png'})
  await page.setViewportSize({width:1280,height:900})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  await page.screenshot({path:'.artifacts/desk-dashboard-narrow.png'})
})

test('reduced-motion timer expires independently of animation or pointer activity', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await seed(page,[{id:'timer-a',kind:'timer',x:-2,endsAt:Date.now()+8000},{id:'timer-b',kind:'timer',x:-3.4,endsAt:Date.now()+120000}])
  await expect.poll(async()=>Boolean((await settings(page)).items.find((i:{id:string})=>i.id==='timer-a').endsAt),{timeout:12000}).toBe(false)
  expect((await settings(page)).items.find((i:{id:string})=>i.id==='timer-b').endsAt).toBeGreaterThan(Date.now())
})

test('lamp hinges keep moving the shade and persist their angles', async ({ page }) => {
  await seed(page,[])
  await page.locator('.dash-desk').hover()
  await page.locator('.dash-desk__control').first().click()
  const elbow={x:1.99-Math.sin(pose.a1)*1.45,y:.11+Math.cos(pose.a1)*1.45}
  const p=await point(page,elbow.x,elbow.y)
  await page.mouse.move(p.x,p.y)
  await page.mouse.down()
  await page.mouse.move(p.x-25,p.y-5,{steps:15})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).pose.a1).not.toBe(pose.a1)
  const saved=(await settings(page)).pose
  await page.waitForTimeout(800)
  await page.screenshot({path:'.artifacts/desk-lamp-moved.png'})
  await page.reload()
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).pose).toEqual(saved)
  expect((await settings(page)).lampOn).toBe(true)
})
